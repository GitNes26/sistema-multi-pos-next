import type {
  OrderDetail,
  OrderRow,
  PreparationView,
} from "@/lib/orders/server";

// FASE 12 — Cliente HTTP del módulo de pedidos.

export type { OrderDetail };

export type OrderStatusKey = "pending" | "confirmed" | "preparing" | "ready" | "in_transit" | "at_destination" | "delivered" | "cancelled";

export const ORDER_STATUSES: OrderStatusKey[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "in_transit",
  "at_destination",
  "delivered",
  "cancelled",
];

export const ORDER_STATUS_LABELS: Record<OrderStatusKey, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  in_transit: "En camino",
  at_destination: "En domicilio",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

/** Flujos de estado por tipo de entrega */
export const ORDER_FLOW_PICKUP: OrderStatusKey[] = [
  "pending", "confirmed", "preparing", "ready", "delivered",
];

export const ORDER_FLOW_DELIVERY: OrderStatusKey[] = [
  "pending", "confirmed", "preparing", "ready", "in_transit", "at_destination", "delivered",
];

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  pickup: "Recoger en sucursal",
  delivery: "A domicilio",
};

export interface OrderListParams {
  page?: number;
  pageSize?: number;
  status?: string | null;
  deliveryMethod?: string | null;
  locationId?: string | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  active?: boolean;
}

export interface OrderListResult {
  rows: OrderRow[];
  total: number;
  counts: Record<string, number>;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? "Error de red");
  return data;
}

export const ordersApi = {
  list: (params: OrderListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.status) qs.set("status", params.status);
    if (params.deliveryMethod) qs.set("deliveryMethod", params.deliveryMethod);
    if (params.locationId) qs.set("locationId", params.locationId);
    if (params.search) qs.set("search", params.search);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.active) qs.set("active", "true");
    return json<{ ok: boolean } & OrderListResult>(`/api/orders?${qs.toString()}`);
  },
  detail: (id: string) =>
    json<{ ok: boolean; order: OrderDetail }>(`/api/orders/${id}`),
  updateStatus: (id: string, status: string, notes?: string) =>
    json<{ ok: boolean; order: OrderDetail }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),
  preparation: (id: string) =>
    json<{ ok: boolean; prep: PreparationView | null }>(`/api/orders/${id}/preparation`),
  startPreparation: (id: string) =>
    json<{ ok: boolean; prep: PreparationView }>(`/api/orders/${id}/preparation`, {
      method: "POST",
    }),
  completePreparation: (id: string, generalNotes?: string | null) =>
    json<{ ok: boolean; prep: PreparationView }>(`/api/orders/${id}/preparation`, {
      method: "PATCH",
      body: JSON.stringify({ generalNotes }),
    }),
  setPreparationItem: (orderId: string, itemId: string, input: { found?: boolean; scanned?: boolean; notes?: string | null }) =>
    json<{ ok: boolean; item: PreparationView["items"][number] }>(
      `/api/orders/${orderId}/preparation/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify(input) }
    ),
  confirmArrival: (id: string) =>
    json<{ ok: boolean; order: OrderDetail }>(`/api/orders/${id}/confirm-arrival`, {
      method: "POST",
    }),
  startDelivery: (id: string, notes?: string | null) =>
    json<{ ok: boolean; order: OrderDetail }>(`/api/orders/${id}/deliver`, {
      method: "POST",
      body: JSON.stringify({ notes: notes ?? undefined }),
    }),
  confirmDelivery: (id: string, input: { pin?: string; qrToken?: string }) =>
    json<{ ok: boolean; order: OrderDetail }>(`/api/orders/${id}/confirm-delivery`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  payOrder: (id: string, input: { method: string; reference?: string | null }) =>
    json<{ ok: boolean; order: OrderDetail }>(`/api/orders/${id}/pay`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
