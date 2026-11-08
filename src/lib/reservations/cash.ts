import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

type Db = Prisma.TransactionClient | typeof prisma

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const toNum = (v: unknown) => (v == null ? 0 : Number(v))

/** Caja abierta de la sucursal (la más reciente). */
export async function findOpenCashSession(db: Db, organizationId: string, locationId: string) {
  return db.cashSession.findFirst({
    where: { organizationId, cashRegister: { locationId }, status: "open" },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  })
}

/** Efectivo del depósito de rentas en una sesión de caja: lo que entró y lo que se regresó (para el corte). */
export async function rentalCashForSession(db: Db, cashSessionId: string) {
  const grouped = await db.rentalCashEntry.groupBy({
    by: ["kind"],
    where: { cashSessionId },
    _sum: { amount: true },
  })
  const sum = (kind: string) => toNum(grouped.find((g) => g.kind === kind)?._sum.amount)
  return { cashIn: round2(sum("deposit_in") + sum("balance_in")), cashOut: round2(sum("deposit_out")) }
}

/**
 * Registra en la caja lo que falte de una renta devuelta: el depósito que se regresa al cliente (sale) y el
 * saldo que los cargos excedan (entra). Sin caja abierta no se registra y la renta queda «pendiente de caja».
 */
export async function settleRentalCash(organizationId: string, reservationId: string, userId: string | null) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findFirst({
      where: { id: reservationId, organizationId },
      select: { id: true, locationId: true, returnedAt: true, depositRefund: true, balanceDue: true },
    })
    if (!r || !r.returnedAt) return { cashPending: false, registered: [] as string[] }
    const loc = r.locationId ?? (await tx.location.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id
    if (!loc) return { cashPending: false, registered: [] as string[] }
    const existing = await tx.rentalCashEntry.findMany({ where: { reservationId, kind: { in: ["deposit_out", "balance_in"] } }, select: { kind: true } })
    const has = (kind: string) => existing.some((e) => e.kind === kind)
    const out = toNum(r.depositRefund)
    const owed = toNum(r.balanceDue)
    const needOut = out > 0 && !has("deposit_out")
    const needIn = owed > 0 && !has("balance_in")
    if (!needOut && !needIn) return { cashPending: false, registered: [] as string[] }
    const session = await findOpenCashSession(tx, organizationId, loc)
    if (!session) return { cashPending: true, registered: [] as string[] }
    const registered: string[] = []
    const base = { organizationId, locationId: loc, reservationId, cashSessionId: session.id, userId }
    if (needOut) {
      await tx.rentalCashEntry.create({ data: { ...base, kind: "deposit_out", amount: out } })
      registered.push("deposit_out")
    }
    if (needIn) {
      await tx.rentalCashEntry.create({ data: { ...base, kind: "balance_in", amount: owed } })
      registered.push("balance_in")
    }
    return { cashPending: false, registered }
  })
}
