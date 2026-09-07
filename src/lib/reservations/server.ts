import type { $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/pos/money";
import { createSale, PosError } from "@/lib/pos/server";
import type { PosSalePayload } from "@/types/pos";

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
}

/** Artículos rentables = variantes de productos con unidades en inventario. */
export async function getRentableUnits(organizationId: string): Promise<RentableUnit[]> {
  const location = await prisma.location.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!location) return [];

  const inv = await prisma.inventory.findMany({
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
  return rows.map((r) => ({
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
  }));
}

/** Unidades de `variantId` apartadas por reservaciones activas en la fecha. */
async function reservedUnitsForDate(
  organizationId: string,
  variantId: string,
  date: Date,
  excludeId?: string
): Promise<number> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const agg = await prisma.reservationItem.aggregate({
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
  excludeId?: string
): Promise<Map<string, number>> {
  const units = await getRentableUnits(organizationId);
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
      const booked = await reservedUnitsForDate(organizationId, it.variantId, day, excludeId);
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

  const units = await getRentableUnits(organizationId);
  const priceByVariant = new Map(units.map((u) => [u.variantId, u.price]));
  await assertAvailability(organizationId, input.items, input.startsAt, input.endsAt);

  const location = await prisma.location.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
      data: {
        organizationId,
        locationId: location?.id ?? null,
        customerId: input.customerId,
        status: "pending",
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes?.trim() ? input.notes.trim() : null,
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
  });
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
    if (err instanceof PosError) throw new ReservationError(err.message, err.status);
    throw err;
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
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
  const reservation = await prisma.reservation.findFirst({
    where: { id, organizationId },
    select: { id: true, status: true, saleId: true, startsAt: true, endsAt: true, notes: true },
  });
  if (!reservation) throw new ReservationError("Reservación no encontrada", 404);

  if (changes.status === "completed") {
    throw new ReservationError("Usa el cobro para completar la reservación", 400);
  }
  const allowed: Record<string, boolean> = { pending: true, confirmed: true, cancelled: true };
  if (changes.status && !allowed[changes.status]) {
    throw new ReservationError("Estatus inválido", 400);
  }
  if (changes.status === "cancelled" && reservation.saleId) {
    throw new ReservationError("La reservación ya fue cobrada", 409);
  }

  const startsAt = changes.startsAt ?? reservation.startsAt;
  const endsAt = changes.endsAt ?? reservation.endsAt;
  if (changes.startsAt || changes.endsAt) {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new ReservationError("La fecha de fin debe ser posterior al inicio", 400);
    }
    if (reservation.status === "completed") {
      throw new ReservationError("No se puede reprogramar una reservación cobrada", 409);
    }
    // Validar que las unidades sigan disponibles en el nuevo período.
    const items = await prisma.reservationItem.findMany({
      where: { reservationId: id },
      select: { variantId: true, quantity: true },
    });
    await assertAvailability(
      organizationId,
      items.map((i) => ({ variantId: i.variantId, quantity: Number(i.quantity) })),
      startsAt,
      endsAt,
      id
    );
  }

  return prisma.reservation.update({
    where: { id },
    data: {
      status: changes.status ?? reservation.status,
      startsAt,
      endsAt,
      notes:
        changes.notes !== undefined
          ? String(changes.notes).trim()
            ? String(changes.notes).trim()
            : null
          : reservation.notes,
    },
    select: { id: true, status: true, startsAt: true, endsAt: true, notes: true },
  });
}