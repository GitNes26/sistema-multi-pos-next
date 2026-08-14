import { NextResponse } from "next/server";
import { createShoppingList, listShoppingLists } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.10 — Listas de compra (GET listado, POST crear).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const lists = await listShoppingLists(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, lists });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const list = await createShoppingList(guard.organizationId, guard.customerId, input);
    return NextResponse.json({ ok: true, list });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
