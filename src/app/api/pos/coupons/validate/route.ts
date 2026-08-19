import { NextResponse } from "next/server";
import { validateCoupon } from "@/lib/pos/server";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { requirePosSession } from "../../helpers";

export async function POST(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = effectiveOrgId(session)!;

  try {
    const body = (await req.json()) as { code: string; customerId?: string };
    const result = await validateCoupon(organizationId, body.code, body.customerId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[pos/coupons]", err);
    return NextResponse.json({ ok: false, error: "Error al validar el cupón" }, { status: 500 });
  }
}