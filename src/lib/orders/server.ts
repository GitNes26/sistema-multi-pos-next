import { prisma } from "@/lib/db";
import type { $Enums, Prisma } from "@prisma/client";
import { notifyOrderEvent } from "@/lib/notifications/events";
import { broadcastOrderStatus } from "@/lib/portal/live";

// FASE 12 — Servidor de pedidos (admin): listado, detalle, estados, preparación.

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Estados que mantienen el pedido "activo" para el monitoreo (12.4). */
export const ACTIVE_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "ready"];

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
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  locationName: string | null;
  saleId: string | null;
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
    subtotal: toNum(order.subtotal),
    discount: toNum(order.discount),
    total: toNum(order.total),
    notes: order.notes,
    customerName: order.customer?.fullName ?? null,
    customerPhone: order.customer?.phone ?? null,
    locationName: order.location?.name ?? null,
    saleId: order.saleId,
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

    await tx.order.update({ where: { id }, data: { status: status as $Enums.OrderStatus } });
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