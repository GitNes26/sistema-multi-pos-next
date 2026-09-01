import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { $Enums } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";

// GET /api/kds — Get orders pending preparation for KDS
// GET /api/kds?locationId=xxx — Filter by location
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

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
        table: { select: { id: true, number: true, name: true } },
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

    return NextResponse.json({ ok: true, orders: ordersWithTime, stats });
  } catch (error) {
    console.error("[kds] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener órdenes KDS" }, { status: 500 });
  }
}

// PUT /api/kds — Update order item status
// Body: { orderItemId: string, status: OrderItemStatus }
// Or: { orderId: string, action: "start" | "ready" | "complete" }
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

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

      return NextResponse.json({ ok: true, item });
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

      await prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
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

      return NextResponse.json({ ok: true, orderId, status: newStatus });
    }

    return NextResponse.json({ ok: false, error: "Parámetros inválidos" }, { status: 400 });
  } catch (error) {
    console.error("[kds] PUT Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar KDS" }, { status: 500 });
  }
}
