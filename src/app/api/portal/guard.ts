import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getPortalCustomer, PortalError } from "@/lib/portal/server";

// FASE 13 — Guard de rutas del portal: resuelve la sesión del cliente.

export type PortalCtx = {
  customerId: string;
  organizationId: string;
  userId: string;
};

export async function requirePortalCustomer(): Promise<
  PortalCtx | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  if (session.user.scope !== "portal" || !session.user.organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  const customer = await getPortalCustomer(session.user.organizationId, session.user.id);
  if (!customer) {
    return { response: NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 403 }) };
  }
  return {
    customerId: customer.id,
    organizationId: session.user.organizationId,
    userId: session.user.id,
  };
}

export function portalErrorResponse(err: unknown): NextResponse {
  if (err instanceof PortalError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  console.error("[portal]", err);
  return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
}
