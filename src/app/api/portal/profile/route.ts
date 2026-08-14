import { NextResponse } from "next/server";
import { getPortalCustomer, updatePortalProfile } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.13 — Perfil del cliente (GET) y edición (PATCH).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const customer = await getPortalCustomer(guard.organizationId, guard.userId);
    return NextResponse.json({ ok: true, customer });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const customer = await updatePortalProfile(
      guard.organizationId,
      guard.customerId,
      input
    );
    return NextResponse.json({ ok: true, customer });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
