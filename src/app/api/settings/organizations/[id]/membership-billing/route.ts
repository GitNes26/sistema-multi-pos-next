import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/permissions";
import { getAutoBillingState, LoyaltyError, setAutoBillingUnlocked } from "@/lib/loyalty/server";
import { superadminGuard } from "../../../guard";

export const dynamic = "force-dynamic";

// Cobro automático de membresías por empresa: bloqueado por defecto. Solo el superAdmin (permiso loyalty.autobilling)
// lo desbloquea o vuelve a bloquear; al bloquear se apagan las preferencias de cobro automático de esa empresa.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;
  if (!hasPermission(guard.session, "loyalty.autobilling")) return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  const { id } = await params;
  return NextResponse.json({ ok: true, ...(await getAutoBillingState(id)) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;
  if (!hasPermission(guard.session, "loyalty.autobilling")) return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { unlocked?: unknown };
  if (typeof body.unlocked !== "boolean") return NextResponse.json({ ok: false, error: "Indica si se desbloquea o se bloquea" }, { status: 400 });
  try {
    await setAutoBillingUnlocked(id, body.unlocked);
    return NextResponse.json({ ok: true, ...(await getAutoBillingState(id)) });
  } catch (err) {
    if (err instanceof LoyaltyError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    console.error("[membership-billing]", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
