import { NextResponse } from "next/server";
import { getPosCatalog, PosError } from "@/lib/pos/server";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { requirePosSession } from "../helpers";

export async function GET() {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = effectiveOrgId(session)!;

  try {
    const catalog = await getPosCatalog(organizationId, session.user.id);
    return NextResponse.json({ ok: true, catalog });
  } catch (err) {
    if (err instanceof PosError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[pos/catalog]", err);
    return NextResponse.json({ ok: false, error: "Error al cargar el catálogo" }, { status: 500 });
  }
}