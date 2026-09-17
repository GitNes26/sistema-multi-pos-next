import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { createOrder, createQuote, createSupplier, changeOrderStatus, linkSupplierProduct, purchasingWorkspace, receiveOrder, updateSupplier } from "@/lib/purchasing/server";

async function guard(permission: "purchasing.view" | "purchasing.manage" | "purchasing.approve" | "purchasing.receive") {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  if (!session?.user || session.user.scope === "portal" || !organizationId) return { error: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  if (!hasPermission(session, permission)) return { error: NextResponse.json({ ok: false, error: "No tienes permiso para esta acción" }, { status: 403 }) };
  return { organizationId, userId: session.user.id };
}

export async function GET() {
  const access = await guard("purchasing.view");
  if ("error" in access) return access.error;
  return NextResponse.json({ ok: true, data: await purchasingWorkspace(access.organizationId!) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const permission = action === "receive" ? "purchasing.receive" : action === "status" && body.status === "approved" ? "purchasing.approve" : "purchasing.manage";
    const access = await guard(permission);
    if ("error" in access) return access.error;
    const org = access.organizationId!, user = access.userId!;
    let data: unknown;
    if (action === "supplier.create") data = await createSupplier(org, body);
    else if (action === "supplier.update") data = await updateSupplier(org, String(body.id ?? ""), body);
    else if (action === "supplier.link") data = await linkSupplierProduct(org, body);
    else if (action === "quote.create") data = await createQuote(org, user, body as never);
    else if (action === "order.create") data = await createOrder(org, user, body as never);
    else if (action === "status") data = await changeOrderStatus(org, user, String(body.orderId ?? ""), String(body.status ?? ""));
    else if (action === "receive") data = await receiveOrder(org, user, body as never);
    else return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : 500;
    console.error("[purchasing]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error del servidor", field: error && typeof error === "object" && "field" in error ? (error as { field?: string }).field : undefined }, { status });
  }
}
