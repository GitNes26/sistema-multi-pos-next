import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acceptDelivery, assignDriver, listDriverOptions } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../../guard";

// Reparto de pedidos a domicilio.
// GET  → empleados que pueden repartir (repartidores primero).
// POST { action: "assign", employeeId } → asigna (orders.manage).
// POST { action: "accept" }             → quien reparte toma/acepta la entrega (delivery.manage).

export async function GET() {
  const guard = await ordersGuard("orders.view");
  if (guard instanceof NextResponse) return guard;
  try {
    return NextResponse.json({ ok: true, drivers: await listDriverOptions(guard.organizationId) });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; employeeId?: string };
  const guard = await ordersGuard(body.action === "accept" ? "delivery.manage" : "orders.manage");
  if (guard instanceof NextResponse) return guard;

  try {
    const me = await prisma.employee.findFirst({
      where: { userId: guard.userId, organizationId: guard.organizationId },
      select: { id: true },
    });
    const ctx = { userId: guard.userId, employeeId: me?.id ?? null };
    if (body.action === "accept") {
      return NextResponse.json({ ok: true, order: await acceptDelivery(guard.organizationId, id, ctx) });
    }
    if (body.action === "assign" && body.employeeId) {
      return NextResponse.json({ ok: true, order: await assignDriver(guard.organizationId, id, body.employeeId, ctx) });
    }
    return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
