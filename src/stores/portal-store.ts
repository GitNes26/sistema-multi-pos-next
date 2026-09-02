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

/** Item from a past order used for reorder. */
export interface ReorderItem {
  variantId: string | null;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  comment?: string;
  selectedOptions?: Record<string, unknown>[];
  bulkQuantityDisplay?: string;
  extraPrice: number;
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
  categoryId: string | null;
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

  addStandard: (product: PortalProduct, variant: PortalVariantOption, qty?: number) => { added: number; limited: boolean };
  addBulk: (product: PortalProduct, opts: BulkInputOptions) => { added: number; limited: boolean };
  reorderItems: (items: ReorderItem[]) => number;
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

export const usePortalStore = create<PortalState>()((set, get) => ({
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
    const key = standardKey(variant.id);
    const existing = get().items.find((i) => i.key === key);
    const variantName = variant.name === "Estándar" ? null : variant.name;
    const track = product.trackInventory;
    const already = existing ? existing.qty : 0;
    const maxAllowed = track ? Math.max(0, variant.stock - already) : Number.POSITIVE_INFINITY;
    const addQty = round3(Math.min(Math.max(1, qty), maxAllowed));
    if (addQty <= 0) return { added: 0, limited: true };

    set((s) => {
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.key === key ? { ...i, qty: round3(i.qty + addQty) } : i
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
        qty: addQty,
        taxRate: product.taxRate,
        categoryId: product.categoryId,
        trackInventory: track,
        stock: variant.stock,
        step: 1,
      };
      return { items: [...s.items, line] };
    });
    return { added: addQty, limited: track && addQty < Math.max(1, qty) };
  },

  addBulk: (product, opts) => {
    const key = bulkKey(product.productId, opts.unitId);
    const existing = get().items.find((i) => i.key === key);
    const track = product.trackInventory;
    const already = existing ? existing.qty : 0;
    const available = track ? product.stock : Number.POSITIVE_INFINITY;
    const maxAllowed = Math.max(0, available - already);
    const addQty = round3(Math.min(round3(opts.qty), maxAllowed));
    if (addQty <= 0) return { added: 0, limited: true };

    set((s) => {
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
        qty: addQty,
        taxRate: product.taxRate,
        categoryId: product.categoryId,
        trackInventory: track,
        stock: track ? product.stock : 0,
        step: product.bulk?.step ?? 0.01,
        bulkQuantityDisplay: `${round3(addQty)} ${opts.unitAbbrev} × ${opts.pricePerUnit.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}/${opts.unitAbbrev}`,
      };
      return {
        items: existing ? s.items.map((i) => (i.key === key ? line : i)) : [...s.items, line],
      };
    });
    return { added: addQty, limited: track && addQty < round3(opts.qty) };
  },

  reorderItems: (reorderItems) => {
    let addedCount = 0;
    set((s) => {
      const newItems = [...s.items];
      for (const ri of reorderItems) {
        const key = ri.variantId
          ? standardKey(ri.variantId)
          : `reorder::${ri.productId}::${ri.quantity}`;
        const existing = newItems.find((i) => i.key === key);
        if (existing) {
          // Merge quantity.
          const idx = newItems.indexOf(existing);
          newItems[idx] = { ...existing, qty: round3(existing.qty + ri.quantity) };
        } else {
          newItems.push({
            key,
            productId: ri.productId,
            variantId: ri.variantId,
            kind: ri.variantId ? "standard" : "bulk",
            name: ri.name,
            variantName: null,
            imageUrl: null,
            unitPrice: ri.unitPrice,
            unitAbbrev: "pza",
            unitId: null,
            qty: ri.quantity,
            taxRate: 0,
            categoryId: null,
            trackInventory: false,
            stock: 0,
            step: 1,
            comment: ri.comment,
            bulkQuantityDisplay: ri.bulkQuantityDisplay,
          });
        }
        addedCount++;
      }
      return { items: newItems };
    });
    return addedCount;
  },

  setQty: (key, qty) =>
    set((s) => ({
      items: s.items.map((i) => {
        if (i.key !== key) return i;
        const capped = i.trackInventory ? Math.min(qty, i.stock) : qty;
        return { ...i, qty: round3(capped) };
      }),
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
