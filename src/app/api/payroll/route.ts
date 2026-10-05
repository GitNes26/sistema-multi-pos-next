import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createPeriod,
  deleteConcept,
  deletePeriod,
  getPeriod,
  markEntryPaid,
  payrollWorkspace,
  recalcPeriod,
  receiptCompany,
  saveConcept,
  setPeriodStatus,
  updateEmployeePay,
  updateEntry,
} from "@/lib/payroll/server";
import { emailReceipt } from "@/lib/payroll/receipt";

// Nómina ligera. GET: espacio de trabajo o detalle (?periodId). POST: { action, ... }.

async function guard() {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  if (!session?.user || session.user.scope === "portal" || !organizationId) return { error: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  if (!hasPermission(session, "payroll.manage")) return { error: NextResponse.json({ ok: false, error: "No tienes permiso para la nómina" }, { status: 403 }) };
  return { organizationId, userId: session.user.id };
}

function fail(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : 500;
  if (status >= 500) console.error("[payroll]", error);
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : "Error del servidor", field: error && typeof error === "object" && "field" in error ? (error as { field?: string }).field : undefined },
    { status: status || 500 }
  );
}

export async function GET(req: NextRequest) {
  const access = await guard();
  if ("error" in access) return access.error;
  try {
    const periodId = req.nextUrl.searchParams.get("periodId");
    if (periodId) {
      const [period, company] = await Promise.all([getPeriod(access.organizationId, periodId), receiptCompany(access.organizationId)]);
      return NextResponse.json({ ok: true, period, company });
    }
    return NextResponse.json({ ok: true, ...(await payrollWorkspace(access.organizationId)) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  const access = await guard();
  if ("error" in access) return access.error;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const org = access.organizationId;
    const id = String(body.id ?? "");
    switch (String(body.action ?? "")) {
      case "employee.pay":
        return NextResponse.json({ ok: true, employee: await updateEmployeePay(org, id, body) });
      case "concept.save":
        return NextResponse.json({ ok: true, concept: await saveConcept(org, body) });
      case "concept.delete":
        return NextResponse.json(await deleteConcept(org, id));
      case "period.create":
        return NextResponse.json({ ok: true, ...(await createPeriod(org, access.userId, body as never)) }, { status: 201 });
      case "period.status":
        return NextResponse.json(await setPeriodStatus(org, id, String(body.status ?? "")));
      case "period.recalc":
        return NextResponse.json(await recalcPeriod(org, id));
      case "period.delete":
        return NextResponse.json(await deletePeriod(org, id));
      case "entry.update":
        return NextResponse.json(await updateEntry(org, id, body));
      case "entry.paid":
        return NextResponse.json(await markEntryPaid(org, id, body.paid !== false));
      case "entry.email":
        return NextResponse.json(await emailReceipt(org, id));
      default:
        return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 });
    }
  } catch (error) {
    return fail(error);
  }
}
