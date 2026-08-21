import { create } from "zustand";
import type { PortalCategory, PortalProduct, PortalVariantOption } from "@/lib/portal/server";
import { round2, round3 } from "@/lib/pos/money";
import type { NavItemId } from "@/components/portal/portal-shell";

// FASE 13 — Store del portal: catálogo + carrito (13.5) + favoritos.

export interface BulkInputOptions {
  qty: number;
  unitId: string;
  unitName: string;
  unitAbbrev: string;
  pricePerUnit: number;
}

export interface PortalCartItem {
  key: string;
  productId: string;
  variantId: string | null;
  kind: "standard" | "bulk";
  name: string;
  variantName: string | null;
  imageUrl: string | null;
  unitPrice: number;
  unitAbbrev: string;
  unitId: string | null;
  qty: number;
  taxRate: number;
  trackInventory: boolean;
  stock: number;
  step: number;
  bulkQuantityDisplay?: string;
  comment?: string;
}

interface PortalState {
  categories: PortalCategory[];
  products: PortalProduct[];
  activeCategory: string | null;
  search: string;
  items: PortalCartItem[];
  favorites: Set<string>;
  cartOpen: boolean;
  bulkProduct: PortalProduct | null;
  navOrder: NavItemId[];

  setStorefront: (categories: PortalCategory[], products: PortalProduct[]) => void;
  setActiveCategory: (id: string | null) => void;
  setSearch: (value: string) => void;
  setCartOpen: (open: boolean) => void;
  setBulkProduct: (product: PortalProduct | null) => void;
  setNavOrder: (order: NavItemId[]) => void;

  addStandard: (product: PortalProduct, variant: PortalVariantOption, qty?: number) => void;
  addBulk: (product: PortalProduct, opts: BulkInputOptions) => void;
  setQty: (key: string, qty: number) => void;
  setComment: (key: string, comment: string) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;

  setFavorites: (ids: string[]) => void;
  toggleFavorite: (variantId: string) => void;
}

function standardKey(variantId: string): string {
  return `v::${variantId}`;
}

function bulkKey(productId: string, unitId: string): string {
  return `b::${productId}::${unitId}`;
}

export const usePortalStore = create<PortalState>()((set) => ({
  categories: [],
  products: [],
  activeCategory: null,
  search: "",
  items: [],
  favorites: new Set(),
  cartOpen: false,
  bulkProduct: null,
  navOrder: ["home", "store", "orders", "lists", "profile"],

  setStorefront: (categories, products) => set({ categories, products }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setSearch: (search) => set({ search }),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setBulkProduct: (bulkProduct) => set({ bulkProduct }),
  setNavOrder: (navOrder) => set({ navOrder }),

  addStandard: (product, variant, qty = 1) => {
    set((s) => {
      const key = standardKey(variant.id);
      const existing = s.items.find((i) => i.key === key);
      const variantName = variant.name === "Estándar" ? null : variant.name;
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.key === key ? { ...i, qty: round3(i.qty + Math.max(1, qty)) } : i
          ),
        };
      }
      const line: PortalCartItem = {
        key,
        productId: product.productId,
        variantId: variant.id,
        kind: "standard",
        name: product.name,
        variantName,
        imageUrl: variant.imageUrl ?? product.imageUrl,
        unitPrice: variant.price,
        unitAbbrev: "pza",
        unitId: null,
        qty: Math.max(1, qty),
        taxRate: product.taxRate,
        trackInventory: product.trackInventory,
        stock: variant.stock,
        step: 1,
      };
      return { items: [...s.items, line] };
    });
  },

  addBulk: (product, opts) => {
    set((s) => {
      const key = bulkKey(product.productId, opts.unitId);
      const qty = round3(opts.qty);
      const line: PortalCartItem = {
        key,
        productId: product.productId,
        variantId: null,
        kind: "bulk",
        name: product.name,
        variantName: null,
        imageUrl: product.imageUrl,
        unitPrice: opts.pricePerUnit,
        unitAbbrev: opts.unitAbbrev,
        unitId: opts.unitId,
        qty,
        taxRate: product.taxRate,
        trackInventory: product.trackInventory,
        stock: 0,
        step: product.bulk?.step ?? 0.01,
        bulkQuantityDisplay: `${round3(qty)} ${opts.unitAbbrev} × ${opts.pricePerUnit.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}/${opts.unitAbbrev}`,
      };
      const existing = s.items.find((i) => i.key === key);
      return {
        items: existing ? s.items.map((i) => (i.key === key ? line : i)) : [...s.items, line],
      };
    });
  },

  setQty: (key, qty) =>
    set((s) => ({
      items: s.items.map((i) => (i.key === key ? { ...i, qty: round3(qty) } : i)),
    })),

  setComment: (key, comment) =>
    set((s) => ({
      items: s.items.map((i) => (i.key === key ? { ...i, comment } : i)),
    })),

  removeItem: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),

  clearCart: () => set({ items: [] }),

  setFavorites: (ids) => set({ favorites: new Set(ids) }),

  toggleFavorite: (variantId) =>
    set((s) => {
      const next = new Set(s.favorites);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return { favorites: next };
    }),
}));

export function cartSubtotal(items: PortalCartItem[]): number {
  return round2(items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0));
}

export function cartTax(items: PortalCartItem[]): number {
  return round2(
    items.reduce((acc, i) => acc + i.unitPrice * i.qty * i.taxRate, 0)
  );
}

export function cartTotal(items: PortalCartItem[]): number {
  return round2(cartSubtotal(items) + cartTax(items));
}
