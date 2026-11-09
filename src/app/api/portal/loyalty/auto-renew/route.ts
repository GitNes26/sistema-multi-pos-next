import { NextResponse } from "next/server";
import { LoyaltyError, setCardAutoRenew } from "@/lib/loyalty/server";
import { requirePortalCustomer, portalErrorResponse } from "../../guard";

export const dynamic = "force-dynamic";

// Renovación automática de mi membresía: me llega el enlace de pago antes de vencer (por el proveedor de pagos en línea del
// negocio). Mientras la plataforma no la desbloquee o el negocio no tenga pasarela responde con el motivo; desactivarla siempre se permite.
export async function POST(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.programId || typeof body.enabled !== "boolean") return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    await setCardAutoRenew(guard.organizationId, guard.customerId, { programId: String(body.programId), enabled: body.enabled });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof LoyaltyError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    return portalErrorResponse(err);
  }
}
