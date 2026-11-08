import type { $Enums, Prisma } from "@prisma/client";
import { findOpenCashSession, settleRentalCash } from "@/lib/reservations/cash";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/pos/money";
import { createSale, PosError } from "@/lib/pos/server";
import type { PosSalePayload } from "@/types/pos";
import { missingRequiredChecklist } from "@/lib/checklists/server";
import { computeLateFee, settleDeposit } from "./penalties";

// ── Reservaciones (rental / hybrid) ──────────────────────────────────────────
// Modelo: una reservación aparta N unidades de artículos rentables (variantes
// con inventario = unidades disponibles) durante un período [startsAt, endsAt).
// La disponibilidad por día = unidades totales − unidades apartadas por
// reservaciones activas (pending/confirmed/completed) que cubren ese día.
// El checkout cobra el período y liga la venta (saleId).

export const RESERVATION_MODES: $Enums.BusinessMode[] = ["rental", "hybrid"];

/** Estatus que apartan unidades (bloquean disponibilidad). */
export const ACTIVE_STATUSES: $Enums.ReservationStatus[] = [
  "pending",
  "confirmed",
  "completed",
];

export class ReservationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface RentableUnit {
  variantId: string;
  productId: string;
  name: string;
  price: number;
  /** Unidades totales disponibles (inventario en la sucursal principal). */
  totalUnits: number;
}

export interface ReservationRow {
  id: string;
  status: $Enums.ReservationStatus;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  saleId: string | null;
  customer: { id: string; fullName: string; phone: string | null } | null;
  items: { variantId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  total: number;
  depositAmount: number;
  deliveredAt: string | null;
  returnedAt: string | null;
  lateFee: number;
  damageFee: number;
  penaltyNotes: string | null;
  depositRefund: number | null;
  balanceDue: number | null;
  /** Devuelta, con dinero por regresar o cobrar que aún no pasa por la caja. */
  cashPending: boolean;
}

/** Artículos rentables = variantes de productos con unidades en inventario. */
export async function getRentableUnits(organizationId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<RentableUnit[]> {
  const location = await db.location.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!location) return [];

  const inv = await db.inventory.findMany({
    where: {
      organizationId,
      locationId: location.id,
      locationType: "location",
      variant: { product: { isActive: true }, isActive: true },
    },
    select: {
      quantity: true,
      variant: {
        select: {
          id: true,
          price: true,
          productId: true,
          product: { select: { name: true, trackInventory: true } },
        },
      },
    },
    orderBy: { variant: { product: { name: "asc" } } },
  });

  const units: RentableUnit[] = [];
  for (const r of inv) {
    if (!r.variant || !r.variant.product.trackInventory) continue;
    units.push({
      variantId: r.variant.id,
      productId: r.variant.productId,
      name: r.variant.product.name,
      price: Number(r.variant.price),
      // Las unidades de renta son discretas: se reservan piezas enteras.
      totalUnits: Math.floor(Number(r.quantity)),
    });
  }
  return units;
}

/** Reservaciones cuyo período toca [from, to). */
export async function getReservations(
  organizationId: string,
  from: Date,
  to: Date
): Promise<ReservationRow[]> {
  const rows = await prisma.reservation.findMany({
    where: {
      organizationId,
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      saleId: true,
      depositAmount: true,
      deliveredAt: true,
      returnedAt: true,
      lateFee: true,
      damageFee: true,
      penaltyNotes: true,
      depositRefund: true,
      balanceDue: true,
      customer: { select: { id: true, fullName: true, phone: true } },
      items: {
        select: {
          variantId: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          variant: { select: { product: { select: { name: true } } } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });
  const returnedIds = rows.filter((r) => r.returnedAt).map((r) => r.id);
  const cashDone = returnedIds.length
    ? await prisma.rentalCashEntry.findMany({ where: { reservationId: { in: returnedIds }, kind: { in: ["deposit_out", "balance_in"] } }, select: { reservationId: true, kind: true } })
    : [];
  return rows.map((r) => ({
    cashPending:
      Boolean(r.returnedAt) &&
      ((Number(r.depositRefund ?? 0) > 0 && !cashDone.some((c) => c.reservationId === r.id && c.kind === "deposit_out")) ||
        (Number(r.balanceDue ?? 0) > 0 && !cashDone.some((c) => c.reservationId === r.id && c.kind === "balance_in"))),
    id: r.id,
    status: r.status,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    notes: r.notes,
    saleId: r.saleId,
    customer: r.customer
      ? { id: r.customer.id, fullName: r.customer.fullName, phone: r.customer.phone }
      : null,
    items: r.items.map((i) => ({
      variantId: i.variantId,
      name: i.variant.product.name,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal ?? 0),
    })),
    total: r.items.reduce((acc, i) => acc + Number(i.lineTotal ?? 0), 0),
    depositAmount: Number(r.depositAmount),
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
    returnedAt: r.returnedAt?.toISOString() ?? null,
    lateFee: Number(r.lateFee),
    damageFee: Number(r.damageFee),
    penaltyNotes: r.penaltyNotes,
    depositRefund: r.depositRefund === null ? null : Number(r.depositRefund),
    balanceDue: r.balanceDue === null ? null : Number(r.balanceDue),
  }));
}

/** Unidades de `variantId` apartadas por reservaciones activas en la fecha. */
async function reservedUnitsForDate(
  organizationId: string,
  variantId: string,
  date: Date,
  excludeId?: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const agg = await db.reservationItem.aggregate({
    where: {
      variantId,
      reservation: {
        organizationId,
        id: excludeId ? { not: excludeId } : undefined,
        status: { in: ACTIVE_STATUSES },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    },
    _sum: { quantity: true },
  });
  return Number(agg._sum.quantity ?? 0);
}

function iterateDays(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const last = new Date(to);
  last.setHours(0, 0, 0, 0);
  while (d < last) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export interface ReservationDraftItem {
  variantId: string;
  quantity: number;
}

/** Valida que haya unidades suficientes cada día del período. */
export async function assertAvailability(
  organizationId: string,
  items: { variantId: string; quantity: number }[],
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Map<string, number>> {
  const units = await getRentableUnits(organizationId, db);
  const unitByName = new Map(units.map((u) => [u.variantId, u]));
  const totals = new Map<string, number>();

  for (const it of items) {
    const unit = unitByName.get(it.variantId);
    if (!unit) throw new ReservationError("Artículo no disponible para renta", 404);
    const qty = Math.round(Number(it.quantity));
    if (!qty || qty <= 0) throw new ReservationError("Cantidad inválida", 400);
    if (qty > unit.totalUnits) {
      throw new ReservationError(
        `Solo hay ${unit.totalUnits} unidad(es) de «${unit.name}» en total`,
        409
      );
    }
    totals.set(it.variantId, unit.totalUnits);

    for (const day of iterateDays(startsAt, endsAt)) {
      const booked = await reservedUnitsForDate(organizationId, it.variantId, day, excludeId, db);
      const available = unit.totalUnits - booked;
      if (qty > available) {
        const label = day.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
        throw new ReservationError(
          `El ${label} solo quedan ${available} unidad(es) de «${unit.name}» (se piden ${qty})`,
          409
        );
      }
    }
  }
  return totals;
}

export interface ReservationCreateInput {
  customerId: string;
  items: ReservationDraftItem[];
  startsAt: Date;
  endsAt: Date;
  notes?: string | null;
  /** Depósito en garantía; si no se manda se usa el sugerido por la política de rentas. */
  depositAmount?: number | null;
  depositNote?: string | null;
}

export interface RentalPolicyDto {
  defaultDeposit: number;
  lateFeePerDay: number;
  graceMinutes: number;
}

export async function getRentalPolicy(organizationId: string): Promise<RentalPolicyDto> {
  const p = await prisma.rentalPolicy.findUnique({ where: { organizationId } });
  return p
    ? { defaultDeposit: Number(p.defaultDeposit), lateFeePerDay: Number(p.lateFeePerDay), graceMinutes: p.graceMinutes }
    : { defaultDeposit: 0, lateFeePerDay: 0, graceMinutes: 60 };
}

export async function saveRentalPolicy(organizationId: string, input: Partial<RentalPolicyDto>): Promise<RentalPolicyDto> {
  const num = (v: unknown, label: string, max: number) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new ReservationError(`${label} no es válido`, 400);
    return n;
  };
  const data = {
    defaultDeposit: round2(num(input.defaultDeposit ?? 0, "El depósito", 1_000_000)),
    lateFeePerDay: round2(num(input.lateFeePerDay ?? 0, "El cargo por retraso", 1_000_000)),
    graceMinutes: Math.round(num(input.graceMinutes ?? 60, "La gracia", 1440)),
  };
  await prisma.rentalPolicy.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
  return data;
}

export async function createReservation(organizationId: string, input: ReservationCreateInput) {
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw new ReservationError("La fecha de fin debe ser posterior al inicio", 400);
  }
  if (input.items.length === 0) {
    throw new ReservationError("Agrega al menos un artículo a la renta", 400);
  }

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId },
    select: { id: true },
  });
  if (!customer) throw new ReservationError("Cliente no encontrado en esta organización", 404);

  const location = await prisma.location.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  try {
    return await prisma.$transaction(async (tx) => {
    const units = await getRentableUnits(organizationId, tx);
    const policy = await tx.rentalPolicy.findUnique({ where: { organizationId }, select: { defaultDeposit: true } });
    const requested = input.depositAmount;
    if (requested != null && (!Number.isFinite(Number(requested)) || Number(requested) < 0)) {
      throw new ReservationError("El depósito no es válido", 400);
    }
    const depositAmount = round2(requested != null ? Number(requested) : Number(policy?.defaultDeposit ?? 0));
    const priceByVariant = new Map(units.map((u) => [u.variantId, u.price]));
    await assertAvailability(organizationId, input.items, input.startsAt, input.endsAt, undefined, tx);
    const reservation = await tx.reservation.create({
      data: {
        organizationId,
        locationId: location?.id ?? null,
        customerId: input.customerId,
        status: "pending",
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        depositAmount,
        depositNote: input.depositNote?.trim() ? input.depositNote.trim().slice(0, 190) : null,
        items: {
          create: input.items.map((it) => {
            const price = priceByVariant.get(it.variantId) ?? 0;
            const qty = Math.round(Number(it.quantity));
            return {
              variantId: it.variantId,
              quantity: qty,
              unitPrice: price,
              lineTotal: round2(price * qty),
            };
          }),
        },
      },
      select: { id: true },
    });
    return reservation;
    }, { isolationLevel: "Serializable" });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2034") {
      throw new ReservationError("Las unidades ya no están disponibles para ese período", 409);
    }
    throw err;
  }
}

/** Cobra la reservación: venta del período + marca completed + saleId. */
export async function checkoutReservation(
  organizationId: string,
  reservationId: string,
  method: $Enums.PaymentMethod,
  ctx: { userId: string; employeeId: string | null }
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, organizationId },
    select: {
      id: true,
      status: true,
      customerId: true,
      locationId: true,
      notes: true,
      items: {
        select: {
          variantId: true,
          quantity: true,
          unitPrice: true,
          variant: {
            select: {
              productId: true,
              product: { select: { name: true, taxRate: true, trackInventory: true } },
            },
          },
        },
      },
    },
  });
  if (!reservation) throw new ReservationError("Reservación no encontrada", 404);
  if (reservation.status === "completed") {
    throw new ReservationError("La reservación ya fue cobrada", 409);
  }
  if (reservation.status === "cancelled") {
    throw new ReservationError("No se puede cobrar una reservación cancelada", 409);
  }
  // Reclamar el checkout antes de crear la venta para evitar cobros dobles
  // cuando llegan dos solicitudes simultáneas.
  const claimed = await prisma.reservation.updateMany({
    where: { id: reservation.id, organizationId, status: { in: ["pending", "confirmed"] } },
    data: { status: "completed" },
  });
  if (claimed.count !== 1) throw new ReservationError("La reservación ya fue cobrada o cambió de estado", 409);
  if (!reservation.items.length) {
    throw new ReservationError("La reservación no tiene artículos", 400);
  }

  let subtotal = 0;
  const saleItems = reservation.items.map((it) => {
    const qty = Number(it.quantity);
    const unitPrice = Number(it.unitPrice);
    const taxRate = Number(it.variant.product.taxRate);
    const lineSubtotal = round2(qty * unitPrice);
    subtotal = round2(subtotal + lineSubtotal);
    return {
      productId: it.variant.productId,
      variantId: it.variantId,
      productType: "standard" as const,
      productName: it.variant.product.name,
      variantName: null,
      quantity: qty,
      unitId: null,
      unitPrice,
      totalPrice: lineSubtotal,
      discount: 0,
      taxRate,
      // La renta no consume existencias: las unidades regresan.
      trackInventory: false,
      lineTotal: lineSubtotal,
      extraPrice: 0,
    };
  });
  // Impuesto por línea según su tasa (todas comparten taxRate en la demo).
  const tax = round2(reservation.items.reduce((acc, it, i) => {
    const rate = Number(it.variant.product.taxRate);
    return acc + round2(saleItems[i].lineTotal * rate);
  }, 0));
  const total = round2(subtotal + tax);

  const payload: PosSalePayload = {
    items: saleItems,
    customerId: reservation.customerId ?? undefined,
    subtotal,
    discount: 0,
    tax,
    total,
    changeGiven: 0,
    pointsEarned: reservation.customerId ? total : 0,
    pointsRedeemed: 0,
    pointsRedeemedValue: 0,
    payments: [{ method, amount: total }],
    discounts: [],
    notes: reservation.notes ?? undefined,
  };

  const locationId = reservation.locationId ?? (await resolveReservationLocation(organizationId));
  let sale;
  try {
    sale = await createSale(organizationId, locationId, payload, ctx);
  } catch (err) {
    await prisma.reservation.updateMany({
      where: { id: reservation.id, organizationId, status: "completed", saleId: null },
      data: { status: reservation.status },
    });
    if (err instanceof PosError) throw new ReservationError(err.message, err.status);
    throw err;
  }

  await prisma.reservation.updateMany({
    where: { id: reservation.id, organizationId, status: "completed", saleId: null },
    data: { status: "completed", saleId: sale.id },
  });
  return { saleId: sale.id, saleNumber: sale.saleNumber, locationName: sale.locationName, total };
}

async function resolveReservationLocation(organizationId: string): Promise<string> {
  const loc = await prisma.location.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!loc) throw new ReservationError("Sin sucursal configurada", 400);
  return loc.id;
}

/** Reprogramar/confirmar: re-valida disponibilidad si cambió el período. */
export async function updateReservation(
  organizationId: string,
  id: string,
  changes: { status?: $Enums.ReservationStatus; startsAt?: Date; endsAt?: Date; notes?: string | null }
) {
  if (changes.status === "completed") {
    throw new ReservationError("Usa el cobro para completar la reservación", 400);
  }
  const allowed: Record<string, boolean> = { pending: true, confirmed: true, cancelled: true };
  if (changes.status && !allowed[changes.status]) {
    throw new ReservationError("Estatus inválido", 400);
  }
  if ((changes.startsAt && Number.isNaN(changes.startsAt.getTime())) || (changes.endsAt && Number.isNaN(changes.endsAt.getTime()))) {
    throw new ReservationError("Período inválido", 400);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id, organizationId },
        select: { id: true, status: true, saleId: true, startsAt: true, endsAt: true, notes: true, updatedAt: true },
      });
      if (!reservation) throw new ReservationError("Reservación no encontrada", 404);
      const terminal = reservation.status === "completed" || reservation.status === "cancelled";
      if (changes.status && terminal && changes.status !== reservation.status) {
        throw new ReservationError("La reservación ya está cerrada y no puede cambiar de estado", 409);
      }

      const startsAt = changes.startsAt ?? reservation.startsAt;
      const endsAt = changes.endsAt ?? reservation.endsAt;
      if (endsAt.getTime() <= startsAt.getTime()) {
        throw new ReservationError("La fecha de fin debe ser posterior al inicio", 400);
      }
      if (changes.startsAt || changes.endsAt) {
        if (terminal) throw new ReservationError("No se puede reprogramar una reservación cerrada", 409);
        const items = await tx.reservationItem.findMany({
          where: { reservationId: id },
          select: { variantId: true, quantity: true },
        });
        await assertAvailability(
          organizationId,
          items.map((i) => ({ variantId: i.variantId, quantity: Number(i.quantity) })),
          startsAt,
          endsAt,
          id,
          tx
        );
      }

      const updated = await tx.reservation.updateMany({
        where: { id, organizationId, status: reservation.status, updatedAt: reservation.updatedAt },
        data: {
          status: changes.status ?? reservation.status,
          startsAt,
          endsAt,
          notes: changes.notes !== undefined ? (String(changes.notes).trim() || null) : reservation.notes,
        },
      });
      if (updated.count !== 1) throw new ReservationError("La reservación cambió mientras se actualizaba", 409);
      return tx.reservation.findUniqueOrThrow({
        where: { id },
        select: { id: true, status: true, startsAt: true, endsAt: true, notes: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (err) {
    if (err instanceof ReservationError) throw err;
    if ((err as { code?: string })?.code === "P2034") throw new ReservationError("La reservación cambió mientras se actualizaba", 409);
    throw err;
  }
}


/** Entrega el equipo al cliente. Si la lista de entrega es obligatoria, debe estar hecha. */
export async function deliverReservation(organizationId: string, id: string, userId: string | null = null) {
  const r = await prisma.reservation.findFirst({ where: { id, organizationId }, select: { id: true, status: true, deliveredAt: true, locationId: true, depositAmount: true } });
  if (!r) throw new ReservationError("Reservación no encontrada", 404);
  if (r.status === "cancelled") throw new ReservationError("La reservación está cancelada", 409);
  if (r.status === "pending") throw new ReservationError("Confirma la reservación antes de entregar", 409);
  if (r.deliveredAt) throw new ReservationError("El equipo ya fue entregado", 409);
  const missing = await missingRequiredChecklist(organizationId, "reservation", id, "delivery");
  if (missing) throw new ReservationError(`Antes de entregar completa la revisión «${missing}»`, 409);
  // El depósito se recibe en efectivo en la caja abierta de la sucursal: queda en el corte.
  const deposit = Number(r.depositAmount);
  const locationId = deposit > 0 ? (r.locationId ?? (await resolveReservationLocation(organizationId))) : null;
  await prisma.$transaction(async (tx) => {
    let sessionId: string | null = null;
    if (deposit > 0 && locationId) {
      const session = await findOpenCashSession(tx, organizationId, locationId);
      if (!session) throw new ReservationError("Abre la caja para recibir el depósito en efectivo", 409);
      sessionId = session.id;
    }
    const claimed = await tx.reservation.updateMany({
      where: { id, organizationId, deliveredAt: null, status: { in: ["confirmed", "completed"] } },
      data: { deliveredAt: new Date() },
    });
    if (claimed.count !== 1) throw new ReservationError("La reservación cambió mientras se entregaba", 409);
    if (sessionId && locationId) {
      await tx.rentalCashEntry.create({ data: { organizationId, locationId, reservationId: id, kind: "deposit_in", amount: deposit, cashSessionId: sessionId, userId } });
    }
  });
  return { id };
}

export interface ReturnInput {
  damageFee?: number | null;
  penaltyNotes?: string | null;
  /** Para recepciones capturadas a posteriori. */
  returnedAt?: Date | null;
}

/**
 * Recibe el equipo: calcula el retraso con la política, suma el cargo por daños capturado y liquida
 * contra el depósito (se regresa lo que sobra; si los cargos lo exceden queda un saldo por cobrar).
 */
export async function returnReservation(organizationId: string, id: string, input: ReturnInput, userId: string | null = null) {
  const damage = round2(Number(input.damageFee ?? 0));
  if (!Number.isFinite(damage) || damage < 0 || damage > 10_000_000) throw new ReservationError("El cargo por daños no es válido", 400);
  const r = await prisma.reservation.findFirst({
    where: { id, organizationId },
    select: { id: true, status: true, deliveredAt: true, returnedAt: true, endsAt: true, depositAmount: true },
  });
  if (!r) throw new ReservationError("Reservación no encontrada", 404);
  if (!r.deliveredAt) throw new ReservationError("Primero registra la entrega del equipo", 409);
  if (r.returnedAt) throw new ReservationError("El equipo ya fue devuelto", 409);
  const missing = await missingRequiredChecklist(organizationId, "reservation", id, "return");
  if (missing) throw new ReservationError(`Antes de recibir completa la revisión «${missing}»`, 409);

  const returnedAt = input.returnedAt && !Number.isNaN(input.returnedAt.getTime()) ? input.returnedAt : new Date();
  const policy = await getRentalPolicy(organizationId);
  const lateFee = computeLateFee(r.endsAt, returnedAt, policy);
  const { refund, balanceDue } = settleDeposit(Number(r.depositAmount), round2(lateFee + damage));

  const claimed = await prisma.reservation.updateMany({
    where: { id, organizationId, returnedAt: null, deliveredAt: { not: null } },
    data: {
      returnedAt,
      lateFee,
      damageFee: damage,
      penaltyNotes: input.penaltyNotes?.trim() ? input.penaltyNotes.trim().slice(0, 190) : null,
      depositRefund: refund,
      balanceDue,
    },
  });
  if (claimed.count !== 1) throw new ReservationError("La renta cambió mientras se recibía", 409);
  // El efectivo que se regresa o se cobra pasa por la caja abierta; sin caja queda «pendiente de caja».
  const cash = await settleRentalCash(organizationId, id, userId).catch(() => ({ cashPending: true }));
  return { id, lateFee, damageFee: damage, depositRefund: refund, balanceDue, cashPending: cash.cashPending };
}
