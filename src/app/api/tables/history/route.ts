import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";
import { jsonResponse } from "@/lib/api-helpers";

// GET /api/tables/history?tableId=xxx&limit=50
// Returns sessions, linked orders, and aggregated revenue for one table.

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
    const tableId = url.searchParams.get("tableId");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId requerido" }, { status: 400 });
    }

    // Verify the table belongs to this organization.
    const table = await prisma.table.findFirst({
      where: { id: tableId, organizationId },
      select: { id: true, number: true, name: true, capacity: true, status: true },
    });
    if (!table) {
      return NextResponse.json({ ok: false, error: "Mesa no encontrada" }, { status: 404 });
    }

    // Fetch past sessions (newest first).
    const sessions = await prisma.tableSession.findMany({
      where: { tableId },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            deliveryMethod: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                productName: true,
                quantity: true,
                unitPrice: true,
                lineTotal: true,
              },
            },
          },
        },
      },
    });

    // Fetch all orders directly linked to this table (may not go through sessions).
    const orders = await prisma.order.findMany({
      where: { tableId, organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        deliveryMethod: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
    });

    // Merge unique orders (some may appear in both sessions and direct queries).
    const orderMap = new Map<string, typeof orders[number]>();
    for (const o of orders) orderMap.set(o.id, o);
    for (const s of sessions) {
      if (s.order && !orderMap.has(s.order.id)) {
        orderMap.set(s.order.id, s.order);
      }
    }
    const allOrders = Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Aggregated stats.
    const totalRevenue = allOrders.reduce(
      (acc, o) => acc + Number(o.total ?? 0),
      0
    );
    const totalSessions = sessions.length;
    const totalOrders = allOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return jsonResponse({
      ok: true,
      table,
      sessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        notes: s.notes,
        orderId: s.orderId,
        order: s.order
          ? {
              id: s.order.id,
              orderNumber: Number(s.order.orderNumber),
              status: s.order.status,
              total: Number(s.order.total),
              deliveryMethod: s.order.deliveryMethod,
              createdAt: s.order.createdAt.toISOString(),
              itemCount: s.order.items.length,
            }
          : null,
      })),
      orders: allOrders.map((o) => ({
        id: o.id,
        orderNumber: Number(o.orderNumber),
        status: o.status,
        total: Number(o.total),
        deliveryMethod: o.deliveryMethod,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.items.length,
      })),
      stats: {
        totalRevenue,
        totalSessions,
        totalOrders,
        avgOrderValue,
      },
    });
  } catch (error) {
    console.error("[tables/history] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error al obtener historial" },
      { status: 500 }
    );
  }
}
