import { NextResponse } from "next/server";
import { addFavorite, listFavorites } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.9 — Favoritos (GET listado, POST agregar).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const variantIds = await listFavorites(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, variantIds });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const { variantId } = await req.json();
    if (!variantId) return NextResponse.json({ ok: false, error: "Falta variantId" }, { status: 400 });
    const result = await addFavorite(guard.organizationId, guard.customerId, variantId);
    return NextResponse.json(result);
  } catch (err) {
    return portalErrorResponse(err);
  }
}
