import { NextResponse } from "next/server";
import { closeCashSession, openCashSession, getSalesStats } from "@/lib/pos/server";
import { createExpense } from "@/lib/expenses/server";
import { CrudError } from "@/lib/crud/types";
import { effectiveOrgId } from "@/lib/auth/org-context";
import {
  assertPermission,
  PermissionDeniedError,
} from "@/lib/auth/server-permissions";
import { getCashierContext, requirePosSession, resolveLocationId } from "../helpers";

export async function GET(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = effectiveOrgId(session)!;
  const { searchParams } = new URL(req.url);
  const locationId = await resolveLocationId(organizationId, searchParams.get("locationId"));
  const stats = await getSalesStats(organizationId, locationId);
  return NextResponse.json({ ok: true, ...stats });
}

export async function POST(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = effectiveOrgId(session)!;

  try {
    const body = (await req.json()) as {
      action: "open" | "close" | "withdraw";
      amount?: number;
      description?: string;
      category?: string;
      locationId?: string;
      registerId?: string;
      openingCash?: number;
      closingCash?: number;
      sessionId?: string;
      notes?: string;
    };
    const locationId = await resolveLocationId(organizationId, body.locationId);

    // RBAC server-side: abrir/cerrar la caja exige cash.open / cash.close.
    // El mesero (y roles sin caja) no puede operarla aunque el control se
    // oculte en el cliente.
    if (body.action === "open") {
      assertPermission(session, "cash.open");
    } else if (body.action === "close") {
      assertPermission(session, "cash.close");
    }

    if (body.action === "open") {
      if (!body.registerId) {
        return NextResponse.json({ ok: false, error: "Selecciona una caja registradora" }, { status: 400 });
      }
      const result = await openCashSession(
        organizationId,
        locationId,
        body.registerId,
        body.openingCash ?? 0,
        session.user.id
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "close") {
      if (!body.sessionId) {
        return NextResponse.json({ ok: false, error: "No hay sesión de caja abierta" }, { status: 400 });
      }
      const summary = await closeCashSession(
        organizationId,
        body.sessionId,
        body.closingCash ?? 0,
        body.notes
      );
      return NextResponse.json({ ok: true, summary });
    }

    // Retiro de efectivo con motivo: queda registrado como gasto de la caja abierta.
    if (body.action === "withdraw") {
      // Quien registra gastos o quien cierra la caja puede retirar efectivo.
      try {
        assertPermission(session, "expenses.manage");
      } catch {
        assertPermission(session, "cash.close");
      }
      if (!body.sessionId) {
        return NextResponse.json({ ok: false, error: "No hay sesión de caja abierta" }, { status: 400 });
      }
      const expense = await createExpense(
        organizationId,
        { amount: body.amount, description: body.description, category: body.category || "cash_withdrawal" },
        {
          userId: session.user.id,
          employeeId: (await getCashierContext(session.user.id, organizationId)).employeeId,
          cashSessionId: body.sessionId,
        }
      );
      return NextResponse.json({ ok: true, expense });
    }

    return NextResponse.json({ ok: false, error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    if (err instanceof CrudError) {
      return NextResponse.json({ ok: false, error: err.message, field: err.field ?? null }, { status: err.status });
    }
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Error en la caja";
    const status = message.includes("no está abierta") ? 400 : 500;
    console.error("[pos/cash]", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}