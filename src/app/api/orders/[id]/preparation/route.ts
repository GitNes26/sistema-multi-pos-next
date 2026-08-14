import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPreparation, startPreparation, completePreparation } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../../guard";

// FASE 12.3 — Preparación de pedido: consultar, iniciar (timer + checklist) y completar.

async function resolveEmployee(userId: string) {
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
    const prep = await getPreparation(guard.organizationId, id);
    if (!prep) {
      return NextResponse.json({ ok: false, prep: null, error: "Preparación no iniciada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, prep });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  try {
    const employee = await resolveEmployee(guard.userId);
    const prep = await startPreparation(guard.organizationId, id, {
      userId: guard.userId,
      employeeId: employee?.id ?? null,
      employeeName: employee?.fullName ?? null,
    });
    return NextResponse.json({ ok: true, prep });
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
    const body = (await req.json()) as { generalNotes?: string | null };
    const prep = await completePreparation(guard.organizationId, id, body.generalNotes ?? null);
    return NextResponse.json({ ok: true, prep });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}