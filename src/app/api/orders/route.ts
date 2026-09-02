import { NextResponse } from "next/server";
import { listOrders, type OrderListFilters } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "./guard";
import { jsonResponse } from "@/lib/api-helpers";

// FASE 12.1 — Listado de pedidos con filtros (estado, método, sucursal, rango, búsqueda).

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await ordersGuard("orders.view");
  if (guard instanceof NextResponse) return guard;
  const { searchParams } = new URL(req.url);

  const filters: OrderListFilters = {
    page: Number(searchParams.get("page") ?? 1) || 1,
    pageSize: Number(searchParams.get("pageSize") ?? 25) || 25,
    status: searchParams.get("status") || undefined,
    deliveryMethod: searchParams.get("deliveryMethod") || undefined,
    locationId: searchParams.get("locationId") || undefined,
    search: searchParams.get("search") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    active: searchParams.get("active") === "true",
  };

  try {
    const data = await listOrders(guard.organizationId, filters);
    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}