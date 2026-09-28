import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { payOrderInStore } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../../guard";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  try {
    const body = (await req.json()) as { method?: string; reference?: string | null };
    if (!body.method) {
      return NextResponse.json({ ok: false, error: "Método de pago requerido" }, { status: 400 });
    }
    const employee = await prisma.employee.findFirst({ where: { userId: guard.userId, organizationId: guard.organizationId }, select: { id: true } });
    const detail = await payOrderInStore(
      guard.organizationId,
      id,
      { method: body.method, reference: body.reference },
      { userId: guard.userId, employeeId: employee?.id ?? null }
    );
    return NextResponse.json({ ok: true, order: detail });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
