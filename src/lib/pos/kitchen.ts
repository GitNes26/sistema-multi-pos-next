import { Prisma } from "@prisma/client";
import type { $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { round2, round3 } from "@/lib/pos/money";
import { broadcastKdsUpdate } from "@/lib/kds/live";
import { broadcastOrderStatus } from "@/lib/portal/live";
import { notifyOrderEvent } from "@/lib/notifications/events";

// Enviar a cocina (POS · mesas) — crea/amplía la orden de cocina de una mesa
// para que el ticket del POS aparezca en el KDS, espejo del flujo del portal
// (Order + OrderItem + OrderPreparation) pero iniciado por el mesero en caja.

export class KitchenError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "KitchenError";
    this.status = status;
  }
}

const toNum = (v: Prisma.Decimal | number | string | null | undefined): number =>
  v == null ? 0 : Number(v);

/** Modos con mesas + KDS (food_service y hybrid). */
const FOOD_MODES = ["food_service", "hybrid"] as const;

/** Estados de una orden de cocina abierta (visible en KDS y sin cobrar). */
const OPEN_KITCHEN_STATUSES: $Enums.OrderStatus[] = ["pending", "confirmed", "preparing"];

export interface KitchenLineInput {
  /** Clave de la línea del ticket en el cliente (se devuelve para marcarla). */
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  productType?: $Enums.ProductType;
  quantity: number;
  unitId?: string | null;
  unitPrice: number;
  bulkQuantityDisplay?: string | null;
  taxRate?: number;
  notes?: string | null;
  selectedOptions?: { optionName: string; value: string; extraPrice: number }[] | null;
  extraPrice?: number;
}

export interface SendToKitchenInput {
  tableId: string;
  customerId?: string | null;
  items: KitchenLineInput[];
}

export interface SentKitchenLine {
  key: string;
  orderItemId: string;
  quantity: number;
}

export interface SendToKitchenResult {
  orderId: string;
  orderNumber: number;
  orderStatus: $Enums.OrderStatus;
  /** true si se creó la orden en este envío; false si se amplió una existente. */
  createdOrder: boolean;
  created: SentKitchenLine[];
}

type KitchenCtx = { userId: string; employeeId: string | null };

/** Crea o amplía la orden de cocina de la mesa con las líneas enviadas. */
export async function sendTicketToKitchen(
  organizationId: string,
  locationId: string,
  input: SendToKitchenInput,
  ctx: KitchenCtx
): Promise<SendToKitchenResult> {
  if (!input.tableId || input.tableId.startsWith("manual-")) {
    throw new KitchenError("Selecciona una mesa del mapa para enviar a cocina");
  }
  if (!input.items.length) {
    throw new KitchenError("El ticket no tiene artículos para enviar a cocina");
  }
  for (const it of input.items) {
    if (!it.key || !it.productName || !(it.quantity > 0) || !(it.unitPrice >= 0)) {
      throw new KitchenError("Artículo inválido en el envío a cocina");
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { businessMode: true },
  });
  if (!org) throw new KitchenError("Organización no encontrada", 404);
  if (!(FOOD_MODES as readonly string[]).includes(org.businessMode)) {
    throw new KitchenError("Enviar a cocina solo aplica a food_service e híbrido", 403);
  }

  // El Order no guarda impuesto aparte y su importe es solo indicativo (la
  // venta final del POS es la fuente de verdad del dinero).
  const subtotal = round2(input.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0));
  const total = subtotal;

  const result = await prisma.$transaction(async (tx) => {
    const table = await tx.table.findFirst({
      where: { id: input.tableId, organizationId },
      select: { id: true, number: true, name: true, status: true },
    });
    if (!table) throw new KitchenError("Mesa no encontrada", 404);

    const openOrder = await tx.order.findFirst({
      where: {
        organizationId,
        tableId: table.id,
        deliveryMethod: "pickup",
        status: { in: OPEN_KITCHEN_STATUSES },
        saleId: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, status: true, subtotal: true, total: true },
    });

    // IDs explícitos para devolver el mapeo línea del ticket → order_item sin
    // consultas extra (createMany no devuelve filas en MySQL).
    const itemRows = input.items.map((it) => ({
      id: crypto.randomUUID(),
      key: it.key,
      quantity: it.quantity,
      row: {
        productId: it.productId,
        variantId: it.variantId,
        productName: it.productName,
        productType: (it.productType ?? "standard") as $Enums.ProductType,
        quantity: round3(it.quantity),
        unitId: it.unitId ?? null,
        unitPrice: round2(it.unitPrice),
        lineTotal: round2(it.quantity * it.unitPrice),
        bulkQuantityDisplay: it.bulkQuantityDisplay ?? null,
        comment: it.notes ?? null,
        selectedOptions: it.selectedOptions
          ? (JSON.parse(JSON.stringify(it.selectedOptions)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        extraPrice: round2(it.extraPrice ?? 0),
      },
    }));

    const history = async (orderId: string, status: $Enums.OrderStatus, notes?: string) => {
      await tx.orderStatusHistory.create({
        data: { orderId, status, userId: ctx.userId, employeeId: ctx.employeeId, notes: notes ?? null },
      });
    };

    // ── Orden nueva: pending → confirmed → preparing + sesión de preparación ──
    if (!openOrder) {
      const order = await tx.order.create({
        data: {
          organizationId,
          locationId,
          tableId: table.id,
          customerId: input.customerId ?? null,
          status: "pending",
          deliveryMethod: "pickup",
          subtotal,
          total,
        },
      });
      await tx.orderItem.createMany({
        data: itemRows.map((r) => ({ ...r.row, orderId: order.id, id: r.id })),
      });
      await history(order.id, "pending", "Enviado a cocina desde POS");

      // El envío del mesero inicia la cocción de inmediato (igual que la
      // preparación del portal): orden confirmed → preparing + OrderPreparation.
      const prep = await tx.orderPreparation.create({
        data: { orderId: order.id, employeeId: null, startedAt: new Date() },
      });
      await tx.orderPreparationItem.createMany({
        data: itemRows.map((r) => ({ preparationId: prep.id, orderItemId: r.id })),
      });
      await tx.order.update({ where: { id: order.id }, data: { status: "confirmed" } });
      await history(order.id, "confirmed");
      await tx.order.update({ where: { id: order.id }, data: { status: "preparing" } });
      await history(order.id, "preparing", "Enviado a cocina desde POS");

      return {
        orderId: order.id,
        orderNumber: Number(order.orderNumber),
        status: "preparing" as $Enums.OrderStatus,
        createdOrder: true as const,
        created: itemRows.map((r) => ({ key: r.key, orderItemId: r.id, quantity: r.quantity })),
      };
    }

    // ── Orden abierta: se amplía con las nuevas líneas ──────────────────────
    await tx.orderItem.createMany({
      data: itemRows.map((r) => ({ ...r.row, orderId: openOrder.id, id: r.id })),
    });
    // Recalcular importes de la orden con la nueva ronda (valor indicativo;
    // la venta final del POS es la fuente de verdad).
    await tx.order.update({
      where: { id: openOrder.id },
      data: {
        subtotal: round2(toNum(openOrder.subtotal) + subtotal),
        total: round2(toNum(openOrder.total) + subtotal),
      },
    });

    // Sesión de preparación única por orden: si no existe (orden confirmada de
    // una ronda previa), se crea con todos los artículos pendientes.
    let prep = await tx.orderPreparation.findFirst({
      where: { orderId: openOrder.id },
      select: { id: true },
    });
    if (!prep) {
      const priorItems = await tx.orderItem.findMany({
        where: { orderId: openOrder.id },
        select: { id: true },
      });
      prep = await tx.orderPreparation.create({
        data: { orderId: openOrder.id, employeeId: null, startedAt: new Date() },
      });
      await tx.orderPreparationItem.createMany({
        data: priorItems.map((i) => ({ preparationId: prep!.id, orderItemId: i.id })),
      });
    }
    await tx.orderPreparationItem.createMany({
      data: itemRows.map((r) => ({ preparationId: prep!.id, orderItemId: r.id })),
    });

    // Asegurar el estado de cocción (rondas previas pudieron dejarla pendiente).
    if (openOrder.status === "pending" || openOrder.status === "confirmed") {
      await tx.order.update({ where: { id: openOrder.id }, data: { status: "preparing" } });
      if (openOrder.status === "pending") await history(openOrder.id, "confirmed");
      await history(openOrder.id, "preparing", "Enviado a cocina desde POS");
    }

    return {
      orderId: openOrder.id,
      orderNumber: Number(openOrder.orderNumber),
      status: "preparing" as $Enums.OrderStatus,
      createdOrder: false as const,
      created: itemRows.map((r) => ({ key: r.key, orderItemId: r.id, quantity: r.quantity })),
    };
  });

  // Broadcast KDS en vivo (fuera de la transacción).
  const fresh = await prisma.order.findUnique({
    where: { id: result.orderId },
    include: {
      table: { select: { id: true, number: true, name: true } },
      items: { select: { id: true, productName: true, variantName: true, quantity: true, itemStatus: true } },
    },
  });
  if (fresh) {
    broadcastKdsUpdate(organizationId, {
      type: result.createdOrder ? "order_new" : "order_updated",
      orderId: fresh.id,
      orderNumber: Number(fresh.orderNumber),
      status: result.status,
      locationId: fresh.locationId,
      table: fresh.table,
      elapsedSeconds: 0,
      items: fresh.items.map((i) => ({
        id: i.id,
        productName: i.productName,
        variantName: i.variantName,
        quantity: toNum(i.quantity),
        itemStatus: i.itemStatus,
      })),
    });
    await notifyOrderEvent(organizationId, fresh.locationId, { userId: ctx.userId }, {
      id: fresh.id,
      orderNumber: Number(fresh.orderNumber),
      status: "preparing",
      customerName: fresh.table ? `Mesa ${fresh.table.number}` : null,
      total: toNum(fresh.total),
    });
  }

  return {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    orderStatus: result.status,
    createdOrder: result.createdOrder,
    created: result.created,
  };
}

/**
 * Cancela la orden de cocina abierta de una mesa sin cobrarla (pull-back del
 * KDS): la mesa quedó libre sin pasar por caja. Solo permitido mientras la
 * orden siga abierta (pending/confirmed/preparing) y sin venta ligada; si la
 * cocina ya terminó (ready/delivered), la ruta devuelve 409.
 */
export async function cancelKitchenOrder(
  organizationId: string,
  orderId: string,
  ctx: KitchenCtx
): Promise<{ orderId: string; orderNumber: number } | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId },
    include: { table: { select: { id: true, number: true, name: true } } },
  });
  if (!order) return null;
  if (!OPEN_KITCHEN_STATUSES.includes(order.status)) {
    throw new KitchenError(
      "La orden ya salió de cocina: no se puede cancelar",
      409
   );
  }
  if (order.saleId || order.paidAt) {
    throw new KitchenError("La orden ya fue cobrada", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "cancelled" },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: "cancelled",
        userId: ctx.userId,
        employeeId: ctx.employeeId,
        notes: order.table
          ? `Cancelada desde POS · Mesa ${order.table.number} sin cobrar`
          : "Cancelada desde POS sin cobrar",
      },
    });
  });

  // Saca la orden del KDS en vivo (mismo evento que el cobro en caja).
  broadcastKdsUpdate(organizationId, {
    type: "order_removed",
    orderId: order.id,
    orderNumber: Number(order.orderNumber),
    status: "cancelled",
    locationId: order.locationId,
  });

  return { orderId: order.id, orderNumber: Number(order.orderNumber) };
}

/**
 * Cierra la orden de cocina abierta de una mesa al cobrarla en el POS:
 * liga saleId + paidAt y la saca del KDS (estado terminal `delivered`,
 * igual que la acción "complete" del KDS).
 * También cierra órdenes ya `ready`: si cocina terminó antes del cobro, la
 * orden quedaría huérfana (sin venta ligada ni pagada) — el cobro la cierra
 * igual, preservando el estado listo de sus artículos.
 */
export async function closeKitchenOrderOnSale(
  organizationId: string,
  tableId: string,
  saleId: string,
  ctx: KitchenCtx
): Promise<{ orderId: string; orderNumber: number } | null> {
  const order = await prisma.order.findFirst({
    where: {
      organizationId,
      tableId,
      deliveryMethod: "pickup",
      status: { in: [...OPEN_KITCHEN_STATUSES, "ready"] },
      saleId: null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, orderNumber: true, locationId: true },
  });
  if (!order) return null;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "delivered", saleId, paidAt: new Date() },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: "delivered",
        userId: ctx.userId,
        employeeId: ctx.employeeId,
        notes: "Cobrado en POS",
      },
    });
  });

  broadcastKdsUpdate(organizationId, {
    type: "order_removed",
    orderId: order.id,
    orderNumber: Number(order.orderNumber),
    status: "delivered",
    locationId: order.locationId,
  });
  broadcastOrderStatus({
    orderId: order.id,
    orderNumber: Number(order.orderNumber),
    status: "delivered",
    updatedAt: new Date().toISOString(),
  });

  return { orderId: order.id, orderNumber: Number(order.orderNumber) };
}
