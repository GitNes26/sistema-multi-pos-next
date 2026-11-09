import { prisma } from "@/lib/db"
import { buildTurnsBoard, typicalMinutes, type TurnOrderRow, type TurnsBoard } from "./turns-board"

// Lee de la base lo necesario para la pantalla de turnos de la clientela. Todo por organizationId (y sucursal si se pide).

/** Órdenes abiertas de las últimas 24 h y listas de las últimas 12 h (las viejas ya no son «turnos» de hoy). */
const OPEN_WINDOW_H = 24
const READY_WINDOW_H = 12

export async function getTurnsBoard(organizationId: string, opts: { locationId?: string | null; now?: Date } = {}): Promise<TurnsBoard> {
  const now = opts.now ?? new Date()
  const where = {
    organizationId,
    ...(opts.locationId ? { locationId: opts.locationId } : {}),
    OR: [
      { status: "open", createdAt: { gte: new Date(now.getTime() - OPEN_WINDOW_H * 3_600_000) } },
      { status: "ready", OR: [{ readyAt: { gte: new Date(now.getTime() - READY_WINDOW_H * 3_600_000) } }, { readyAt: null, createdAt: { gte: new Date(now.getTime() - READY_WINDOW_H * 3_600_000) } }] },
    ],
  }
  const orders = await prisma.serviceOrder.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true, number: true, status: true, createdAt: true, promisedAt: true, readyAt: true, flowId: true, stageId: true,
      stage: { select: { label: true } },
      flow: { select: { stages: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true, isReady: true } } } },
      asset: { select: { label: true, reference: true } },
      station: { select: { name: true } },
      items: { select: { productName: true } },
    },
  })

  // Tiempo típico por flujo: mediana de lo que tardaron en quedar listas las últimas órdenes entregadas.
  const flowIds = [...new Set(orders.map((o) => o.flowId))]
  const typicalByFlow: Record<string, number | null> = {}
  for (const flowId of flowIds) {
    const done = await prisma.serviceOrder.findMany({
      where: { organizationId, flowId, status: "delivered", readyAt: { not: null } },
      orderBy: { readyAt: "desc" },
      take: 30,
      select: { createdAt: true, readyAt: true },
    })
    typicalByFlow[flowId] = typicalMinutes(done.map((d) => ((d.readyAt as Date).getTime() - d.createdAt.getTime()) / 60_000))
  }

  const rows: TurnOrderRow[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.createdAt,
    promisedAt: o.promisedAt,
    readyAt: o.readyAt,
    flowId: o.flowId,
    stageId: o.stageId,
    stageLabel: o.stage.label,
    stages: o.flow.stages,
    assetLabel: o.asset?.label ?? null,
    assetReference: o.asset?.reference ?? null,
    stationName: o.station?.name ?? null,
    services: o.items.map((i) => i.productName),
  }))
  return buildTurnsBoard(rows, now, typicalByFlow)
}
