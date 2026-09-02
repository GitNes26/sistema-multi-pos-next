import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderDetail, updateOrderStatus } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../guard";
import { jsonResponse } from "@/lib/api-helpers";

// FASE 12.1/12.2 — Detalle del pedido y cambio de estado (con historial + SSE).

async function resolveEmployeeId(userId: string) {
  const emp = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true, fullName: true },
  });
  return emp ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ordersGuard("orders.view");
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  try {
    const detail = await getOrderDetail(guard.organizationId, id);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    }
    return jsonResponse({ ok: true, order: detail });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  try {
    const body = (await req.json()) as { status: string; notes?: string };
    if (!body.status) {
      return NextResponse.json({ ok: false, error: "Falta el estado" }, { status: 400 });
    }
    const employee = await resolveEmployeeId(guard.userId);
    const detail = await updateOrderStatus(guard.organizationId, id, body.status, {
      userId: guard.userId,
      employeeId: employee?.id ?? null,
    }, body.notes);

    if (!detail) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    }
    return jsonResponse({ ok: true, order: detail, employeeName: employee?.fullName ?? null });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}