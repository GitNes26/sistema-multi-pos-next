import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { $Enums } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { broadcastKdsUpdate } from "@/lib/kds/live";
import { listUpcomingReservations } from "@/lib/tables/upcoming";
import { jsonResponse } from "@/lib/api-helpers";

// Guard del KDS: sesión de app (no portal) con organización y permiso de
// pedidos (orders.view para leer / kds.operate para operar el tablero), igual
// que /api/kds/stream. La operación del tablero es de cocina (kds.operate):
// el repartidor (delivery.manage) puede ver pero NO avanzar artículos.
async function requireKdsSession(permission: "orders.view" | "kds.operate") {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  const organizationId = effectiveOrgId(session);
  if (session.user.scope === "portal" || !organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  if (!hasPermission(session, permission)) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Permiso requerido: " + permission },
        { status: 403 }
      ),
    };
  }
  return { session, organizationId };
}

// GET /api/kds — Get orders pending preparation for KDS
// GET /api/kds?locationId=xxx — Filter by location
export async function GET(req: Request) {
  const guard = await requireKdsSession("orders.view");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const url = new URL(req.url);
    const locationId = url.searchParams.get("locationId");

    // Get orders that are in preparation or pending
    const kdsStatuses: $Enums.OrderStatus[] = ["pending", "confirmed", "preparing"];
    const where = {
      organizationId,
      status: { in: kdsStatuses },
      ...(locationId ? { locationId } : {}),
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        table: {
          select: {
            id: true,
            number: true,
            name: true,
            room: { select: { id: true, name: true } },
          },
        },
        location: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            quantity: true,
            unitPrice: true,
            itemStatus: true,
            selectedOptions: true,
            comment: true,
            extraPrice: true,
          },
        },
        preparation: {
          select: {
            id: true,
            startedAt: true,
            generalNotes: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Calculate time elapsed for each order
    const now = new Date();
    const ordersWithTime = orders.map((order) => {
      const elapsed = order.preparation?.startedAt
        ? Math.floor((now.getTime() - new Date(order.preparation.startedAt).getTime()) / 1000)
        : Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 1000);
      return { ...order, elapsedSeconds: elapsed };
    });

    // Stats
    const stats = {
      pending: orders.filter((o) => o.status === "pending").length,
      confirmed: orders.filter((o) => o.status === "confirmed").length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      totalItems: orders.reduce((sum, o) => sum + o.items.length, 0),
      readyItems: orders.reduce(
        (sum, o) => sum + o.items.filter((i) => i.itemStatus === "ready").length,
        0
      ),
    };

    // Aviso de llegada: reservaciones confirmadas próximas para que la
    // cocina/el anfitrión preparen el lugar.
    const upcoming = await listUpcomingReservations(organizationId, locationId ?? null);
    const upcomingReservations = upcoming.map((r) => ({
      id: r.id,
      guests: r.guests,
      startsAt: r.startsAt.toISOString(),
      table: r.table,
    }));

    return jsonResponse({ ok: true, orders: ordersWithTime, stats, upcomingReservations });
  } catch (error) {
    console.error("[kds] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener órdenes KDS" }, { status: 500 });
  }
}

// PUT /api/kds — Update order item status (kds.operate: cocina y gestión)
// Body: { orderItemId: string, status: OrderItemStatus }
// Or: { orderId: string, action: "start" | "ready" | "complete" }
export async function PUT(req: Request) {
  const guard = await requireKdsSession("kds.operate");
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  try {
    const body = await req.json();
    const { orderItemId, status, orderId, action, notes } = body;

    // Update individual item status
    if (orderItemId && status) {
      const validStatuses = ["pending", "preparing", "ready", "served"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ ok: false, error: "Estado no válido" }, { status: 400 });
      }

      const item = await prisma.orderItem.update({
        where: { id: orderItemId },
        data: { itemStatus: status },
        include: { order: { select: { id: true, status: true } } },
      });

      // If all items are ready, mark order as ready
      const allItems = await prisma.orderItem.findMany({
        where: { orderId: item.orderId },
      });
      const allReady = allItems.every((i) => i.id === orderItemId || i.itemStatus === "ready");
      if (allReady && item.order.status !== "ready") {
        await prisma.order.update({
          where: { id: item.orderId },
          data: { status: "ready" },
        });
      }

      // Broadcast item update to all KDS screens
      const updatedOrder = await prisma.order.findUnique({
        where: { id: item.orderId },
        include: {
          table: {
            select: {
              id: true,
              number: true,
              name: true,
              room: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (updatedOrder) {
        const now = Date.now();
        const allItemsNow = await prisma.orderItem.findMany({ where: { orderId: item.orderId } });
        broadcastKdsUpdate(organizationId, {
          type: "order_updated",
          orderId: updatedOrder.id,
          orderNumber: Number(updatedOrder.orderNumber),
          status: updatedOrder.status,
          locationId: updatedOrder.locationId,
          table: updatedOrder.table,
          elapsedSeconds: Math.floor((now - updatedOrder.createdAt.getTime()) / 1000),
          items: allItemsNow.map((i) => ({
            id: i.id,
            productName: i.productName,
            variantName: i.variantName,
            quantity: Number(i.quantity),
            itemStatus: i.itemStatus,
          })),
        });
      }

      return jsonResponse({ ok: true, item });
    }

    // Order-level actions
    if (orderId && action) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { preparation: true } });
      if (!order) {
        return NextResponse.json({ ok: false, error: "Orden no encontrada" }, { status: 404 });
      }

      let newStatus = order.status;
      switch (action) {
        case "start":
          newStatus = "preparing";
          // Create preparation record if not exists
          await prisma.orderPreparation.upsert({
            where: { orderId },
            create: {
              orderId,
              startedAt: new Date(),
              generalNotes: notes || null,
            },
            update: {
              startedAt: order.preparation?.startedAt || new Date(),
              generalNotes: notes || undefined,
            },
          });
          // Set all items to preparing
          await prisma.orderItem.updateMany({
            where: { orderId, itemStatus: "pending" },
            data: { itemStatus: "preparing" },
          });
          break;
        case "ready":
          newStatus = "ready";
          await prisma.orderItem.updateMany({
            where: { orderId },
            data: { itemStatus: "ready" },
          });
          break;
        case "complete":
          newStatus = "delivered";
          await prisma.orderPreparation.updateMany({
            where: { orderId },
            data: { completedAt: new Date() },
          });
          break;
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
        include: {
          table: {
            select: {
              id: true,
              number: true,
              name: true,
              room: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Log status change
      await prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: newStatus,
          userId: (session.user as { id?: string }).id ?? null,
          notes: action,
        },
      });

      // Broadcast order-level update to all KDS screens
      const now = Date.now();
      const allItems = await prisma.orderItem.findMany({ where: { orderId } });
      broadcastKdsUpdate(organizationId, {
        type: newStatus === "delivered" ? "order_removed" : "order_updated",
        orderId: updatedOrder.id,
        orderNumber: Number(updatedOrder.orderNumber),
        status: newStatus,
        locationId: updatedOrder.locationId,
        table: updatedOrder.table,
        elapsedSeconds: Math.floor((now - updatedOrder.createdAt.getTime()) / 1000),
        items: allItems.map((i) => ({
          id: i.id,
          productName: i.productName,
          variantName: i.variantName,
          quantity: Number(i.quantity),
          itemStatus: i.itemStatus,
        })),
      });

      return jsonResponse({ ok: true, orderId, status: newStatus });
    }

    return NextResponse.json({ ok: false, error: "Parámetros inválidos" }, { status: 400 });
  } catch (error) {
    console.error("[kds] PUT Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar KDS" }, { status: 500 });
  }
}
