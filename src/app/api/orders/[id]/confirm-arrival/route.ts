import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { confirmArrival } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../../guard";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  try {
    const employee = await prisma.employee.findFirst({
      where: { userId: guard.userId },
      select: { id: true, fullName: true },
    });
    const detail = await confirmArrival(guard.organizationId, id, {
      userId: guard.userId,
      employeeId: employee?.id ?? null,
    });
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, order: detail });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
