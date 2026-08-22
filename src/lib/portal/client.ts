import type {
  PortalCategory,
  PortalCustomer,
  PortalHomeData,
  PortalLocation,
  PortalOrderDetail,
  PortalOrderInput,
  PortalOrderRow,
  PortalProduct,
  PaymentMethodView,
  ShoppingListRow,
  ShoppingListView,
  ShoppingListInput,
  ExpiringCardView,
} from "@/lib/portal/server";
import type { DeliveryPolicyData } from "@/lib/orders/server";

// FASE 13 — Cliente HTTP del portal de clientes.

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? "Error de red");
  return data;
}

export interface PortalStorefrontData {
  categories: PortalCategory[];
  products: PortalProduct[];
}

export interface LoyaltyData {
  points: number;
  transactions: {
    id: string;
    kind: string;
    points: number;
    note: string | null;
    createdAt: string;
  }[];
}

export const portalApi = {
  home: () => json<{ ok: boolean } & PortalHomeData>("/api/portal/home"),

  storefront: () =>
    json<{ ok: boolean } & PortalStorefrontData>("/api/portal/storefront"),

  locations: () =>
    json<{ ok: boolean; locations: PortalLocation[] }>("/api/portal/locations"),

  deliveryPolicy: () =>
    json<{ ok: boolean; policy: DeliveryPolicyData | null }>("/api/portal/delivery-policy"),

  // Pedidos
  createOrder: (input: PortalOrderInput) =>
    json<{ ok: boolean; order: PortalOrderDetail }>("/api/portal/orders", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listOrders: () =>
    json<{ ok: boolean; orders: PortalOrderRow[] }>("/api/portal/orders"),
  order: (id: string) =>
    json<{ ok: boolean; order: PortalOrderDetail }>(`/api/portal/orders/${id}`),
  cancelOrder: (id: string) =>
    json<{ ok: boolean; order: PortalOrderDetail }>(`/api/portal/orders/${id}/cancel`, {
      method: "POST",
    }),

  // Lealtad
  loyalty: () => json<{ ok: boolean } & LoyaltyData>("/api/portal/loyalty"),

  // Perfil
  profile: () =>
    json<{ ok: boolean; customer: PortalCustomer }>("/api/portal/profile"),
  updateProfile: (input: {
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string | null;
  }) =>
    json<{ ok: boolean; customer: PortalCustomer }>("/api/portal/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // Favoritos
  favorites: () =>
    json<{ ok: boolean; variantIds: string[] }>("/api/portal/favorites"),
  addFavorite: (variantId: string) =>
    json<{ ok: boolean }>("/api/portal/favorites", {
      method: "POST",
      body: JSON.stringify({ variantId }),
    }),
  removeFavorite: (variantId: string) =>
    json<{ ok: boolean }>(`/api/portal/favorites/${variantId}`, { method: "DELETE" }),

  // Listas de compra
  lists: () =>
    json<{ ok: boolean; lists: ShoppingListRow[] }>("/api/portal/lists"),
  list: (id: string) =>
    json<{ ok: boolean; list: ShoppingListView }>(`/api/portal/lists/${id}`),
  createList: (input: ShoppingListInput) =>
    json<{ ok: boolean; list: ShoppingListView }>("/api/portal/lists", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateList: (id: string, input: ShoppingListInput) =>
    json<{ ok: boolean; list: ShoppingListView }>(`/api/portal/lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteList: (id: string) =>
    json<{ ok: boolean }>(`/api/portal/lists/${id}`, { method: "DELETE" }),
  duplicateList: (id: string) =>
    json<{ ok: boolean; list: ShoppingListView }>(`/api/portal/lists/${id}/duplicate`, {
      method: "POST",
    }),

  // Métodos de pago
  paymentMethods: () =>
    json<{ ok: boolean; methods: PaymentMethodView[] }>("/api/portal/payment-methods"),
  addPaymentMethod: (input: {
    alias?: string;
    brand?: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault?: boolean;
  }) =>
    json<{ ok: boolean; methods: PaymentMethodView[] }>("/api/portal/payment-methods", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  removePaymentMethod: (id: string) =>
    json<{ ok: boolean }>(`/api/portal/payment-methods/${id}`, { method: "DELETE" }),
  setDefaultPaymentMethod: (id: string) =>
    json<{ ok: boolean; methods: PaymentMethodView[] }>(
      `/api/portal/payment-methods/${id}/default`,
      { method: "POST" }
    ),
  expiringCards: () =>
    json<{ ok: boolean; cards: ExpiringCardView[] }>("/api/portal/cards-expiring"),
};
