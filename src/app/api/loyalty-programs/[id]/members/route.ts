import { NextResponse } from "next/server";
import { listMembers, manageMember } from "@/lib/loyalty/server";
import { loyaltyFail, requireLoyaltyAdmin } from "../../guard";

export const dynamic = "force-dynamic";

// Miembros de una membresía: vigentes, vencidos y dados de baja (próximos a vencer primero).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireLoyaltyAdmin("loyalty.view");
  if ("response" in guard) return guard.response;
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ ok: true, members: await listMembers(guard.organizationId, id) });
  } catch (err) {
    return loyaltyFail(err);
  }
}

// Acciones manuales sobre un miembro (baja, cortesía de días o ajuste de créditos), siempre con motivo.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireLoyaltyAdmin("loyalty.manage");
  if ("response" in guard) return guard.response;
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.customerId || (body.action !== "cancel" && body.action !== "extend" && body.action !== "adjust")) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }
    await manageMember(guard.organizationId, id, String(body.customerId), { action: body.action, days: body.days, credits: body.credits, note: body.note });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return loyaltyFail(err);
  }
}
