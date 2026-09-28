import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordOrderSale } from "@/lib/orders/sale";
import { ordersGuard, ordersErrorResponse } from "../../guard";

// POST: registra la venta de un pedido entregado/cobrado que no la tenga
// (pedidos anteriores al cambio o si el registro automático falló).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;
  try {
    const order = await prisma.order.findFirst({ where: { id, organizationId: guard.organizationId }, select: { status: true, paidAt: true, tableId: true } });
    if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    if (order.tableId) return NextResponse.json({ ok: false, error: "Los pedidos de mesa se cobran en el POS" }, { status: 409 });
    if (order.status !== "delivered" && !order.paidAt) {
      return NextResponse.json({ ok: false, error: "La venta se registra al cobrar o al entregar el pedido" }, { status: 409 });
    }
    const employee = await prisma.employee.findFirst({ where: { userId: guard.userId, organizationId: guard.organizationId }, select: { id: true } });
    const saleId = await recordOrderSale(guard.organizationId, id, { userId: guard.userId, employeeId: employee?.id ?? null });
    return NextResponse.json({ ok: true, saleId });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
