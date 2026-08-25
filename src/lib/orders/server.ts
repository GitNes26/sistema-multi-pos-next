import { prisma } from "@/lib/db";
import type { $Enums, Prisma } from "@prisma/client";
import crypto from "crypto";
import { notifyOrderEvent } from "@/lib/notifications/events";
import { broadcastOrderStatus } from "@/lib/portal/live";

// FASE 12 — Servidor de pedidos (admin): listado, detalle, estados, preparación.

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "in_transit",
  "at_destination",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Estados que mantienen el pedido "activo" para el monitoreo (12.4). */
export const ACTIVE_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "in_transit", "at_destination", "delivered"];

const toNum = (v: Prisma.Decimal | number | string | null): number =>
  v == null ? 0 : Number(v);

export interface OrderListFilters {
  page?: number;
  pageSize?: number;
  status?: string | null;
  deliveryMethod?: string | null;
  locationId?: string | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  active?: boolean;
}

export interface OrderRow {
  id: string;
  orderNumber: number;
  status: string;
  deliveryMethod: string;
  customerName: string | null;
  locationName: string | null;
  itemsCount: number;
  total: number;
  createdAt: string;
}

export async function getOrderReportCounts(organizationId: string) {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: { organizationId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = r._count._all;
  return counts;
}

export async function listOrders(
  organizationId: string,
  f: OrderListFilters = {}
): Promise<{ rows: OrderRow[]; total: number; counts: Record<string, number> }> {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 25));

  const where: Prisma.OrderWhereInput = { organizationId };
  if (f.status) where.status = f.status as $Enums.OrderStatus;
  if (f.active) where.status = { in: ACTIVE_STATUSES as $Enums.OrderStatus[] };
  if (f.deliveryMethod) where.deliveryMethod = f.deliveryMethod as $Enums.DeliveryMethod;
  if (f.locationId) where.locationId = f.locationId;
  if (f.search) {
    const q = f.search.trim();
    where.OR = q.match(/^\d+$/)
      ? [{ orderNumber: BigInt(q) }]
      : [{ customer: { fullName: { contains: q } } }, { notes: { contains: q } }];
  }
  if (f.from || f.to) {
    where.createdAt = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00`) } : {}),
      ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}),
    };
  }

  const [rows, total, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { fullName: true } },
        location: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
    getOrderReportCounts(organizationId),
  ]);

  return {
    rows: rows.map((o) => ({
      id: o.id,
      orderNumber: Number(o.orderNumber),
      status: o.status,
      deliveryMethod: o.deliveryMethod,
      customerName: o.customer?.fullName ?? null,
      locationName: o.location?.name ?? null,
      itemsCount: o._count.items,
      total: toNum(o.total),
      createdAt: o.createdAt.toISOString(),
    })),
    total,
    counts,
  };
}

export interface OrderDetailInput {
  id: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: number;
  status: string;
  deliveryMethod: string;
  address: string | null;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  locationName: string | null;
  saleId: string | null;
  isPaid: boolean;
  paymentMethod: string | null;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitName: string | null;
    unitPrice: number;
    lineTotal: number;
    bulkQuantityDisplay: string | null;
    comment: string | null;
  }[];
  history: {
    id: string;
    status: string;
    employeeName: string | null;
    notes: string | null;
    createdAt: string;
  }[];
}

export async function getOrderDetail(organizationId: string, id: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: { id, organizationId },
    include: {
      customer: { select: { fullName: true, phone: true } },
      location: { select: { name: true } },
      items: {
        include: { unit: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      statusHistory: {
        include: { employee: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) return null;

  return {
    id: order.id,
    orderNumber: Number(order.orderNumber),
    status: order.status,
    deliveryMethod: order.deliveryMethod,
    address: order.address ?? null,
    subtotal: toNum(order.subtotal),
    discount: toNum(order.discount),
    deliveryFee: toNum(order.deliveryFee),
    total: toNum(order.total),
    notes: order.notes,
    customerName: order.customer?.fullName ?? null,
    customerPhone: order.customer?.phone ?? null,
    locationName: order.location?.name ?? null,
    saleId: order.saleId,
    isPaid: order.paidAt != null || order.saleId != null,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName,
      quantity: toNum(i.quantity),
      unitName: i.unit?.name ?? null,
      unitPrice: toNum(i.unitPrice),
      lineTotal: toNum(i.lineTotal),
      bulkQuantityDisplay: i.bulkQuantityDisplay,
      comment: i.comment,
    })),
    history: order.statusHistory.map((h) => ({
      id: h.id,
      status: h.status,
      employeeName: h.employee?.fullName ?? null,
      notes: h.notes,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export interface StatusCtx {
  userId?: string | null;
  employeeId?: string | null;
}

/**
 * Cambia el estado del pedido (12.2): registra en status_history con el empleado
 * y el timestamp, y emite la notificación SSE correspondiente (12.5).
 */
export async function updateOrderStatus(
  organizationId: string,
  id: string,
  status: string,
  ctx: StatusCtx,
  notes?: string
): Promise<OrderDetail | null> {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new Error("Estado de pedido inválido");
  }

  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findFirst({ where: { id, organizationId } });
    if (!current) throw new Error("Pedido no encontrado");
    if (current.status === "cancelled" || current.status === "delivered") {
      throw new Error("El pedido ya no puede cambiar de estado");
    }

    // Validar transiciones válidas según tipo de entrega
    const isValid = isValidTransition(current.status, status, current.deliveryMethod);
    if (!isValid) {
      throw new Error(`Transición inválida: ${current.status} → ${status}`);
    }

    // Para recoger en sucursal: generar PIN + QR al quedar listo el pedido.
    const isPickupReady = current.deliveryMethod === "pickup" && status === "ready";

    await tx.order.update({
      where: { id },
      data: {
        status: status as $Enums.OrderStatus,
        ...(isPickupReady
          ? { deliveryPin: generatePin(), deliveryQrToken: crypto.randomUUID() }
          : {}),
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: status as $Enums.OrderStatus,
        employeeId: ctx.employeeId ?? null,
        userId: ctx.userId ?? null,
        notes: notes ?? null,
      },
    });
    return current;
  });

  // Notificación SSE (12.5) + tracking del portal (13.7).
  const detail = await getOrderDetail(organizationId, id);
  if (detail) {
    await notifyOrderEvent(organizationId, order.locationId, ctx, {
      id,
      orderNumber: detail.orderNumber,
      status: detail.status,
      customerName: detail.customerName,
      total: detail.total,
    });
    broadcastOrderStatus({
      orderId: id,
      orderNumber: detail.orderNumber,
      status: detail.status,
      updatedAt: detail.updatedAt,
    });
  }
  return detail;
}

// ── Validación de transiciones ────────────────────────────────────────────────

const TRANSITIONS_PICKUP: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["delivered"],
  // in_transit y at_destination no aplican para pickup
};

const TRANSITIONS_DELIVERY: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["in_transit"],
  in_transit: ["at_destination"],
  at_destination: ["delivered"],
};

function isValidTransition(from: string, to: string, deliveryMethod: string): boolean {
  const map = deliveryMethod === "pickup" ? TRANSITIONS_PICKUP : TRANSITIONS_DELIVERY;
  return map[from]?.includes(to) ?? false;
}

// ── Confirmación de llegada del driver ────────────────────────────────────────

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * El driver confirma que llegó al domicilio del cliente.
 * Genera PIN de 6 dígitos + token QR único.
 */
export async function confirmArrival(
  organizationId: string,
  orderId: string,
  ctx: StatusCtx
): Promise<OrderDetail | null> {
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findFirst({ where: { id: orderId, organizationId } });
    if (!current) throw new Error("Pedido no encontrado");
    if (current.status !== "in_transit") {
      throw new Error("El pedido debe estar en tránsito para confirmar llegada");
    }

    const pin = generatePin();
    const qrToken = crypto.randomUUID();

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "at_destination",
        deliveryPin: pin,
        deliveryQrToken: qrToken,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "at_destination",
        employeeId: ctx.employeeId ?? null,
        userId: ctx.userId ?? null,
        notes: "Driver confirmó llegada al domicilio",
      },
    });
    return current;
  });

  const detail = await getOrderDetail(organizationId, orderId);
  if (detail) {
    await notifyOrderEvent(organizationId, order.locationId, ctx, {
      id: orderId,
      orderNumber: detail.orderNumber,
      status: "at_destination",
      customerName: detail.customerName,
      total: detail.total,
    });
    broadcastOrderStatus({
      orderId,
      orderNumber: detail.orderNumber,
      status: "at_destination",
      updatedAt: detail.updatedAt,
    });
  }
  return detail;
}

// ── Confirmación de entrega con PIN/QR ────────────────────────────────────────

export interface ConfirmDeliveryResult {
  ok: boolean;
  order?: OrderDetail;
  error?: string;
}

/**
 * Confirma la entrega validando PIN o QR token.
 * Si el PIN/QR es válido, cambia el estado a "delivered".
 */
export async function confirmDelivery(
  organizationId: string,
  orderId: string,
  input: { pin?: string; qrToken?: string }
): Promise<ConfirmDeliveryResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId },
  });
  if (!order) return { ok: false, error: "Pedido no encontrado" };

  // Recogida: el PIN/QR se genera en "ready". Domicilio: en "at_destination".
  const expectedStatus =
    order.deliveryMethod === "pickup" ? "ready" : "at_destination";
  if (order.status !== expectedStatus) {
    return {
      ok: false,
      error:
        order.deliveryMethod === "pickup"
          ? "El pedido no está listo para recoger"
          : "El pedido no está en estado de entrega",
    };
  }

  // Validar PIN o QR
  if (input.pin) {
    if (order.deliveryPin !== input.pin) {
      return { ok: false, error: "PIN incorrecto" };
    }
  } else if (input.qrToken) {
    if (order.deliveryQrToken !== input.qrToken) {
      return { ok: false, error: "QR inválido" };
    }
  } else {
    return { ok: false, error: "Proporcione PIN o QR" };
  }

  // Entrega confirmada
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: "delivered", deliveryPin: null, deliveryQrToken: null },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "delivered",
        notes: input.pin ? "Entrega confirmada con PIN" : "Entrega confirmada con QR",
      },
    });
  });

  const detail = await getOrderDetail(organizationId, orderId);
  if (detail) {
    await notifyOrderEvent(organizationId, order.locationId, {}, {
      id: orderId,
      orderNumber: detail.orderNumber,
      status: "delivered",
      customerName: detail.customerName,
      total: detail.total,
    });
    broadcastOrderStatus({
      orderId,
      orderNumber: detail.orderNumber,
      status: "delivered",
      updatedAt: detail.updatedAt,
    });
  }
  return { ok: true, order: detail! };
}

// ── Cobro en tienda ────────────────────────────────────────────────────────────

export interface PayOrderInStoreInput {
  method: string;
  reference?: string | null;
}

/**
 * Registra el cobro en tienda de un pedido pendiente de pago
 * (p. ej. "pagar en efectivo al recoger"). Marca paidAt y el método usado.
 */
export async function payOrderInStore(
  organizationId: string,
  orderId: string,
  input: PayOrderInStoreInput
): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({ where: { id: orderId, organizationId } });
  if (!order) throw new Error("Pedido no encontrado");
  if (order.status === "cancelled" || order.status === "delivered") {
    throw new Error("El pedido ya no puede cobrarse");
  }
  if (order.paidAt || order.saleId) {
    throw new Error("El pedido ya está pagado");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paidAt: new Date(),
      paymentMethod: input.method as $Enums.PaymentMethod,
      paymentReference: input.reference ?? null,
    },
  });

  return getOrderDetail(organizationId, orderId);
}

// ── Preparación (12.3) ────────────────────────────────────────────────────────

export interface PreparationItemRow {
  id: string;
  orderItemId: string;
  scanned: boolean;
  found: boolean;
  notes: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitName: string | null;
  bulkQuantityDisplay: string | null;
  comment: string | null;
}

export interface PreparationView {
  id: string;
  orderId: string;
  status: string;
  orderNumber: number;
  employeeName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  elapsedSeconds: number | null;
  generalNotes: string | null;
  items: PreparationItemRow[];
}

export async function getPreparation(organizationId: string, orderId: string): Promise<PreparationView | null> {
  const prep = await prisma.orderPreparation.findFirst({
    where: { orderId, order: { organizationId } },
    include: {
      employee: { select: { fullName: true } },
      order: { select: { orderNumber: true, status: true } },
      items: {
        include: {
          orderItem: {
            include: {
              unit: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!prep) return null;

  return {
    id: prep.id,
    orderId: prep.orderId,
    status: prep.order.status,
    orderNumber: Number(prep.order.orderNumber),
    employeeName: prep.employee?.fullName ?? null,
    startedAt: prep.startedAt?.toISOString() ?? null,
    completedAt: prep.completedAt?.toISOString() ?? null,
    elapsedSeconds: prep.elapsedSeconds ?? null,
    generalNotes: prep.generalNotes,
    items: prep.items.map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      scanned: i.scanned,
      found: i.found,
      notes: i.employeeNotes,
      productName: i.orderItem.productName,
      variantName: i.orderItem.variantName,
      quantity: toNum(i.orderItem.quantity),
      unitName: i.orderItem.unit?.name ?? null,
      bulkQuantityDisplay: i.orderItem.bulkQuantityDisplay,
      comment: i.orderItem.comment,
    })),
  };
}

/** Confirma un pedido pendiente: pending → confirmed. */
export async function confirmOrder(
  organizationId: string,
  id: string,
  ctx: StatusCtx
): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({ where: { id, organizationId } });
  if (!order) throw new Error("Pedido no encontrado");
  if (order.status !== "pending") throw new Error("Solo se pueden confirmar pedidos pendientes");

  await updateOrderStatus(organizationId, id, "confirmed", ctx);
  return getOrderDetail(organizationId, id);
}

/** Marca un pedido como en camino: ready → in_transit (solo delivery). */
export async function startDelivery(
  organizationId: string,
  id: string,
  ctx: StatusCtx,
  notes?: string
): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({ where: { id, organizationId } });
  if (!order) throw new Error("Pedido no encontrado");
  if (order.deliveryMethod !== "delivery") throw new Error("Este pedido no es a domicilio");
  if (order.status !== "ready") throw new Error("El pedido debe estar listo para iniciar entrega");

  await updateOrderStatus(organizationId, id, "in_transit", ctx, notes);
  return getOrderDetail(organizationId, id);
}

/** Inicia la preparación: crea la sesión (empleado + startedAt) y el checklist. */
export async function startPreparation(
  organizationId: string,
  orderId: string,
  ctx: StatusCtx & { employeeName?: string | null }
): Promise<PreparationView> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId },
    include: { items: { select: { id: true } } },
  });
  if (!order) throw new Error("Pedido no encontrado");
  if (order.status === "cancelled") throw new Error("Un pedido cancelado no puede prepararse");
  if (order.status !== "confirmed") throw new Error("El pedido debe estar confirmado antes de prepararse");

  const existing = await prisma.orderPreparation.findUnique({ where: { orderId } });
  if (existing) return (await getPreparation(organizationId, orderId))!;

  await prisma.$transaction(async (tx) => {
    const created = await tx.orderPreparation.create({
      data: {
        orderId,
        employeeId: ctx.employeeId ?? null,
        startedAt: new Date(),
      },
    });
    await tx.orderPreparationItem.createMany({
      data: order.items.map((i) => ({ preparationId: created.id, orderItemId: i.id })),
    });
  });

  // Al iniciar preparación, el pedido pasa a "preparing".
  await updateOrderStatus(organizationId, orderId, "preparing", ctx);

  return (await getPreparation(organizationId, orderId))!;
}

/** Marca un item del checklist: escaneado / encontrado / notas (12.3). */
export async function setPreparationItem(
  organizationId: string,
  itemId: string,
  input: { found?: boolean; scanned?: boolean; notes?: string | null }
): Promise<PreparationItemRow> {
  const item = await prisma.orderPreparationItem.findFirst({
    where: { id: itemId, preparation: { order: { organizationId } } },
    include: { orderItem: { include: { unit: { select: { name: true } } } } },
  });
  if (!item) throw new Error("Item de preparación no encontrado");

  const updated = await prisma.orderPreparationItem.update({
    where: { id: itemId },
    data: {
      ...(input.found !== undefined ? { found: input.found } : {}),
      ...(input.scanned !== undefined ? { scanned: input.scanned } : {}),
      ...(input.notes !== undefined ? { employeeNotes: input.notes ?? null } : {}),
    },
  });

  return {
    id: updated.id,
    orderItemId: updated.orderItemId,
    scanned: updated.scanned,
    found: updated.found,
    notes: updated.employeeNotes,
    productName: item.orderItem.productName,
    variantName: item.orderItem.variantName,
    quantity: toNum(item.orderItem.quantity),
    unitName: item.orderItem.unit?.name ?? null,
    bulkQuantityDisplay: item.orderItem.bulkQuantityDisplay,
    comment: item.orderItem.comment,
  };
}

/** Completa la preparación: pone completedAt + elapsedSeconds + notas (12.3). */
export async function completePreparation(
  organizationId: string,
  orderId: string,
  generalNotes?: string | null
): Promise<PreparationView> {
  const prep = await prisma.orderPreparation.findFirst({
    where: { orderId, order: { organizationId } },
  });
  if (!prep) throw new Error("Preparación no iniciada");

  const started = prep.startedAt ?? new Date();
  const elapsed = Math.round((Date.now() - started.getTime()) / 1000);

  await prisma.orderPreparation.update({
    where: { id: prep.id },
    data: { completedAt: new Date(), elapsedSeconds: elapsed, generalNotes: generalNotes ?? null },
  });

  return (await getPreparation(organizationId, orderId))!;
}

// ─── Delivery Policy ────────────────────────────────────────────────────────

export interface DeliveryPolicyData {
  id: string;
  organizationId?: string;
  branchId?: string;
  pickupEnabled: boolean;
  pickupMinAmount: number | null;
  pickupFee: number;
  pickupFeeEnabled: boolean;
  pickupSchedule: DaySchedule[] | null;
  deliveryEnabled: boolean;
  deliveryMinAmount: number | null;
  deliveryFee: number;
  deliveryFeeEnabled: boolean;
  deliverySchedule: DaySchedule[] | null;
  deliveryRadiusKm: number | null;
  deliveryEstimatedMins: number | null;
}

export interface DaySchedule {
  day: number;
  enabled: boolean;
  open: string;
  close: string;
}

export async function getDeliveryPolicy(organizationId: string): Promise<DeliveryPolicyData | null> {
  const p = await prisma.deliveryPolicy.findUnique({ where: { organizationId } });
  if (!p) return null;
  return {
    id: p.id,
    organizationId: p.organizationId,
    pickupEnabled: p.pickupEnabled,
    pickupMinAmount: toNum(p.pickupMinAmount) || null,
    pickupFee: toNum(p.pickupFee),
    pickupFeeEnabled: p.pickupFeeEnabled,
    pickupSchedule: p.pickupScheduleJson ? JSON.parse(p.pickupScheduleJson) : null,
    deliveryEnabled: p.deliveryEnabled,
    deliveryMinAmount: toNum(p.deliveryMinAmount) || null,
    deliveryFee: toNum(p.deliveryFee),
    deliveryFeeEnabled: p.deliveryFeeEnabled,
    deliverySchedule: p.deliveryScheduleJson ? JSON.parse(p.deliveryScheduleJson) : null,
    deliveryRadiusKm: toNum(p.deliveryRadiusKm) || null,
    deliveryEstimatedMins: p.deliveryEstimatedMins,
  };
}

export async function upsertDeliveryPolicy(
  organizationId: string,
  input: Partial<Omit<DeliveryPolicyData, "id" | "organizationId" | "branchId">>
): Promise<DeliveryPolicyData> {
  const data: Record<string, unknown> = {};
  if (input.pickupEnabled !== undefined) data.pickupEnabled = input.pickupEnabled;
  if (input.pickupMinAmount !== undefined) data.pickupMinAmount = input.pickupMinAmount;
  if (input.pickupFee !== undefined) data.pickupFee = input.pickupFee;
  if (input.pickupFeeEnabled !== undefined) data.pickupFeeEnabled = input.pickupFeeEnabled;
  if (input.pickupSchedule !== undefined) data.pickupScheduleJson = JSON.stringify(input.pickupSchedule);
  if (input.deliveryEnabled !== undefined) data.deliveryEnabled = input.deliveryEnabled;
  if (input.deliveryMinAmount !== undefined) data.deliveryMinAmount = input.deliveryMinAmount;
  if (input.deliveryFee !== undefined) data.deliveryFee = input.deliveryFee;
  if (input.deliveryFeeEnabled !== undefined) data.deliveryFeeEnabled = input.deliveryFeeEnabled;
  if (input.deliverySchedule !== undefined) data.deliveryScheduleJson = JSON.stringify(input.deliverySchedule);
  if (input.deliveryRadiusKm !== undefined) data.deliveryRadiusKm = input.deliveryRadiusKm;
  if (input.deliveryEstimatedMins !== undefined) data.deliveryEstimatedMins = input.deliveryEstimatedMins;

  const policy = await prisma.deliveryPolicy.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });

  return {
    id: policy.id,
    organizationId: policy.organizationId,
    pickupEnabled: policy.pickupEnabled,
    pickupMinAmount: toNum(policy.pickupMinAmount) || null,
    pickupFee: toNum(policy.pickupFee),
    pickupFeeEnabled: policy.pickupFeeEnabled,
    pickupSchedule: policy.pickupScheduleJson ? JSON.parse(policy.pickupScheduleJson) : null,
    deliveryEnabled: policy.deliveryEnabled,
    deliveryMinAmount: toNum(policy.deliveryMinAmount) || null,
    deliveryFee: toNum(policy.deliveryFee),
    deliveryFeeEnabled: policy.deliveryFeeEnabled,
    deliverySchedule: policy.deliveryScheduleJson ? JSON.parse(policy.deliveryScheduleJson) : null,
    deliveryRadiusKm: toNum(policy.deliveryRadiusKm) || null,
    deliveryEstimatedMins: policy.deliveryEstimatedMins,
  };
}

export function calculateDeliveryFee(
  policy: DeliveryPolicyData | null,
  method: "pickup" | "delivery",
  subtotal: number
): { fee: number; error?: string } {
  if (!policy) return { fee: 0 };

  if (method === "pickup") {
    if (!policy.pickupEnabled) return { fee: 0, error: "Recoger en sucursal no disponible" };
    if (policy.pickupMinAmount && subtotal < policy.pickupMinAmount) {
      return { fee: 0, error: `Monto mínimo para recoger: $${policy.pickupMinAmount}` };
    }
    if (policy.pickupFeeEnabled) return { fee: policy.pickupFee };
    return { fee: 0 };
  }

  if (!policy.deliveryEnabled) return { fee: 0, error: "Servicio a domicilio no disponible" };
  if (policy.deliveryMinAmount && subtotal < policy.deliveryMinAmount) {
    return { fee: 0, error: `Monto mínimo para domicilio: $${policy.deliveryMinAmount}` };
  }
  if (policy.deliveryFeeEnabled) return { fee: policy.deliveryFee };
  return { fee: 0 };
}

// ─── Branch Delivery Policy (override por sucursal) ───

export async function getBranchDeliveryPolicy(branchId: string): Promise<DeliveryPolicyData | null> {
  const p = await prisma.branchDeliveryPolicy.findUnique({ where: { branchId } });
  if (!p) return null;
  return {
    id: p.id,
    branchId: p.branchId,
    pickupEnabled: p.pickupEnabled,
    pickupMinAmount: toNum(p.pickupMinAmount) || null,
    pickupFee: toNum(p.pickupFee),
    pickupFeeEnabled: p.pickupFeeEnabled,
    pickupSchedule: p.pickupScheduleJson ? JSON.parse(p.pickupScheduleJson) : null,
    deliveryEnabled: p.deliveryEnabled,
    deliveryMinAmount: toNum(p.deliveryMinAmount) || null,
    deliveryFee: toNum(p.deliveryFee),
    deliveryFeeEnabled: p.deliveryFeeEnabled,
    deliverySchedule: p.deliveryScheduleJson ? JSON.parse(p.deliveryScheduleJson) : null,
    deliveryRadiusKm: toNum(p.deliveryRadiusKm) || null,
    deliveryEstimatedMins: p.deliveryEstimatedMins,
  };
}

export async function getEffectiveDeliveryPolicy(
  organizationId: string,
  branchId?: string
): Promise<DeliveryPolicyData | null> {
  if (branchId) {
    const branchPolicy = await getBranchDeliveryPolicy(branchId);
    if (branchPolicy) return branchPolicy;
  }
  return getDeliveryPolicy(organizationId);
}

export async function upsertBranchDeliveryPolicy(
  branchId: string,
  input: Partial<Omit<DeliveryPolicyData, "id" | "organizationId" | "branchId">>
): Promise<DeliveryPolicyData> {
  const data: Record<string, unknown> = {};
  if (input.pickupEnabled !== undefined) data.pickupEnabled = input.pickupEnabled;
  if (input.pickupMinAmount !== undefined) data.pickupMinAmount = input.pickupMinAmount;
  if (input.pickupFee !== undefined) data.pickupFee = input.pickupFee;
  if (input.pickupFeeEnabled !== undefined) data.pickupFeeEnabled = input.pickupFeeEnabled;
  if (input.pickupSchedule !== undefined) data.pickupScheduleJson = JSON.stringify(input.pickupSchedule);
  if (input.deliveryEnabled !== undefined) data.deliveryEnabled = input.deliveryEnabled;
  if (input.deliveryMinAmount !== undefined) data.deliveryMinAmount = input.deliveryMinAmount;
  if (input.deliveryFee !== undefined) data.deliveryFee = input.deliveryFee;
  if (input.deliveryFeeEnabled !== undefined) data.deliveryFeeEnabled = input.deliveryFeeEnabled;
  if (input.deliverySchedule !== undefined) data.deliveryScheduleJson = JSON.stringify(input.deliverySchedule);
  if (input.deliveryRadiusKm !== undefined) data.deliveryRadiusKm = input.deliveryRadiusKm;
  if (input.deliveryEstimatedMins !== undefined) data.deliveryEstimatedMins = input.deliveryEstimatedMins;

  const policy = await prisma.branchDeliveryPolicy.upsert({
    where: { branchId },
    create: { branchId, ...data },
    update: data,
  });

  return {
    id: policy.id,
    branchId: policy.branchId,
    pickupEnabled: policy.pickupEnabled,
    pickupMinAmount: toNum(policy.pickupMinAmount) || null,
    pickupFee: toNum(policy.pickupFee),
    pickupFeeEnabled: policy.pickupFeeEnabled,
    pickupSchedule: policy.pickupScheduleJson ? JSON.parse(policy.pickupScheduleJson) : null,
    deliveryEnabled: policy.deliveryEnabled,
    deliveryMinAmount: toNum(policy.deliveryMinAmount) || null,
    deliveryFee: toNum(policy.deliveryFee),
    deliveryFeeEnabled: policy.deliveryFeeEnabled,
    deliverySchedule: policy.deliveryScheduleJson ? JSON.parse(policy.deliveryScheduleJson) : null,
    deliveryRadiusKm: toNum(policy.deliveryRadiusKm) || null,
    deliveryEstimatedMins: policy.deliveryEstimatedMins,
  };
}

export async function restoreBranchToCompanyPolicy(branchId: string): Promise<void> {
  await prisma.branchDeliveryPolicy.delete({ where: { branchId } }).catch(() => {});
}

export function isScheduleOpen(
  schedule: DaySchedule[] | null,
  timezone: string = "America/Mexico_City"
): { open: boolean; nextOpen?: string } {
  if (!schedule || schedule.length === 0) return { open: true };

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
  const parts = formatter.formatToParts(now);
  const dayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const currentMinutes = hour * 60 + minute;

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = dayMap[dayStr] ?? 0;

  const todaySchedule = schedule.find((s) => s.day === today);
  if (!todaySchedule || !todaySchedule.enabled) return { open: false, nextOpen: "Cerrado hoy" };

  const [openH, openM] = todaySchedule.open.split(":").map(Number);
  const [closeH, closeM] = todaySchedule.close.split(":").map(Number);
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;

  if (currentMinutes >= openMin && currentMinutes < closeMin) return { open: true };
  return { open: false, nextOpen: `Abre a las ${todaySchedule.open}` };
}