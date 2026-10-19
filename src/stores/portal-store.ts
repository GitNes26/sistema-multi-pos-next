import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PortalCategory, PortalCombo, PortalProduct, PortalVariantOption } from "@/lib/portal/server";
import { round2, round3 } from "@/lib/pos/money";
import { cleanGuestName } from "@/lib/guests";
import type { NavItemIdIncludingCombos } from "@/components/portal/portal-shell";

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
  kind: "standard" | "bulk" | "custom";
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
  /** Recargo total por unidad aplicado al precio base (opciones del producto). */
  extraPrice?: number;
  selectedOptions?: {
    optionId: string;
    optionName: string;
    values: { id: string; value: string; extraPrice: number }[];
  }[];
  comboId?: string;
  comboItems?: PortalCombo["items"];
  comboTax?: number;
  /** «Pedir para varias personas»: a quién pertenece el renglón. */
  guestName?: string;
}

const GUEST_SEP = "::g::";
const withGuestKey = (key: string, guest: string | null) => (guest ? `${key}${GUEST_SEP}${guest}` : key);
const baseKey = (key: string) => key.split(GUEST_SEP)[0];

/** Reasigna un renglón a otra persona (o a nadie), fusionando con el gemelo si existe. */
function assignGuest(items: PortalCartItem[], key: string, guest: string | null): PortalCartItem[] {
  const line = items.find((i) => i.key === key);
  if (!line) return items;
  const name = cleanGuestName(guest);
  const newKey = withGuestKey(baseKey(line.key), name);
  if (newKey === line.key) return items;
  const twin = items.find((i) => i.key === newKey);
  if (twin) {
    if (line.kind === "bulk") return items;
    return items.filter((i) => i.key !== line.key).map((i) => (i.key === newKey ? { ...i, qty: round3(i.qty + line.qty) } : i));
  }
  return items.map((i) => (i.key === line.key ? { ...i, key: newKey, guestName: name ?? undefined } : i));
}

/** Nombres de las personas del pedido: los agregados a mano y los que ya tienen renglones. */
export function portalGuestNames(state: { guestNames: string[]; items: PortalCartItem[] }): string[] {
  const out: string[] = [];
  const add = (n: string | null | undefined) => {
    const name = cleanGuestName(n);
    if (name && !out.some((o) => o.toLowerCase() === name.toLowerCase())) out.push(name);
  };
  state.guestNames.forEach(add);
  state.items.forEach((i) => add(i.guestName));
  return out;
}

interface PortalState {
  categories: PortalCategory[];
  products: PortalProduct[];
  activeCategory: string | null;
  search: string;
  items: PortalCartItem[];
  /** «Pedir para varias personas»: lo que se agrega se asigna a `activeGuest`. */
  guestMode: boolean;
  guestNames: string[];
  activeGuest: string | null;
  /** Cliente + empresa dueños del carrito guardado (evita mezclar cuentas en un mismo navegador). */
  cartOwner: string | null;
  favorites: Set<string>;
  cartOpen: boolean;
  bulkProduct: PortalProduct | null;
  navOpen: boolean;
  navOrder: NavItemIdIncludingCombos[];

  /** Asocia el carrito guardado a una cuenta; si cambió de cuenta, lo vacía. */
  bindCartOwner: (owner: string) => void;
  setStorefront: (categories: PortalCategory[], products: PortalProduct[]) => void;
  setActiveCategory: (id: string | null) => void;
  setSearch: (value: string) => void;
  setCartOpen: (open: boolean) => void;
  setBulkProduct: (product: PortalProduct | null) => void;
  setNavOpen: (open: boolean) => void;
  setNavOrder: (order: NavItemIdIncludingCombos[]) => void;

  addStandard: (
    product: PortalProduct,
    variant: PortalVariantOption,
    qty?: number,
    /** Recargo por unidad (extras del constructor de opciones). */
    extraPerUnit?: number,
    /** Huella de la configuración (opciones elegidas) para líneas distintas. */
    optionKey?: string,
    /** Notas / modificaciones del producto (se envían como comentario). */
    notes?: string,
    selectedOptions?: PortalCartItem["selectedOptions"]
  ) => { added: number; limited: boolean };
  addBulk: (product: PortalProduct, opts: BulkInputOptions) => { added: number; limited: boolean };
  addCombo: (combo: PortalCombo) => void;
  reorderItems: (items: ReorderItem[]) => number;
  setGuestMode: (on: boolean) => void;
  addGuest: (name: string) => void;
  setActiveGuest: (name: string | null) => void;
  setItemGuest: (key: string, name: string | null) => void;
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

// El carrito se conserva en el navegador hasta que el cliente finaliza la
// compra o lo vacía (clearCart / quitar productos). Se hidrata en el cliente
// (skipHydration) para no desajustar el HTML del servidor.
export const usePortalStore = create<PortalState>()(
  persist(
    (set, get) => ({
  categories: [],
  products: [],
  activeCategory: null,
  search: "",
  items: [],
  guestMode: false,
  guestNames: [],
  activeGuest: null,
  cartOwner: null,
  favorites: new Set(),
  cartOpen: false,
  bulkProduct: null,
  navOpen: false,
  navOrder: ["home", "store", "reservations", "orders", "lists", "profile", "combos"],

  bindCartOwner: (owner) => {
    const current = get().cartOwner;
    if (current === owner) return;
    set({ cartOwner: owner, ...(current ? { items: [] } : {}) });
  },
  setStorefront: (categories, products) => set({ categories, products }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setSearch: (search) => set({ search }),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setBulkProduct: (bulkProduct) => set({ bulkProduct }),
  setNavOpen: (navOpen) => set({ navOpen }),
  setNavOrder: (navOrder) => set({ navOrder }),

  addStandard: (product, variant, qty = 1, extraPerUnit = 0, optionKey, notes, selectedOptions) => {
    // Dos configuraciones distintas de la misma variante conviven como líneas
    // separadas (solo se fusionan cuando son idénticas).
    const guest = get().guestMode ? cleanGuestName(get().activeGuest) : null;
    const key = withGuestKey(
      optionKey ? `${standardKey(variant.id)}::${optionKey}` : standardKey(variant.id),
      guest
    );
    const existing = get().items.find((i) => i.key === key);
    const variantName = variant.name === "Estándar" ? null : variant.name;
    const track = product.trackInventory;
    const already = existing ? existing.qty : 0;
    const maxAllowed = track ? Math.max(0, variant.stock - already) : Number.POSITIVE_INFINITY;
    const addQty = round3(Math.min(Math.max(1, qty), maxAllowed));
    if (addQty <= 0) return { added: 0, limited: true };
    const extra = round3(Math.max(0, extraPerUnit));

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
        kind: product.kind === "custom" ? "custom" : "standard",
        name: product.name,
        variantName,
        imageUrl: variant.imageUrl ?? product.imageUrl,
        unitPrice: round2(variant.price + extra),
        unitAbbrev: "pza",
        unitId: null,
        qty: addQty,
        taxRate: product.taxRate,
        categoryId: product.categoryId,
        trackInventory: track,
        stock: variant.stock,
        step: 1,
        extraPrice: extra,
        selectedOptions,
        comment: notes?.trim() || undefined,
        guestName: guest ?? undefined,
      };
      return { items: [...s.items, line] };
    });
    return { added: addQty, limited: track && addQty < Math.max(1, qty) };
  },

  addBulk: (product, opts) => {
    const guest = get().guestMode ? cleanGuestName(get().activeGuest) : null;
    const key = withGuestKey(bulkKey(product.productId, opts.unitId), guest);
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
        qty: round3(already + addQty),
        taxRate: product.taxRate,
        categoryId: product.categoryId,
        trackInventory: track,
        stock: track ? product.stock : 0,
        step: product.bulk?.step ?? 0.01,
        bulkQuantityDisplay: `${round3(already + addQty)} ${opts.unitAbbrev} × ${opts.pricePerUnit.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}/${opts.unitAbbrev}`,
        guestName: guest ?? undefined,
      };
      return {
        items: existing ? s.items.map((i) => (i.key === key ? line : i)) : [...s.items, line],
      };
    });
    return { added: addQty, limited: track && addQty < round3(opts.qty) };
  },

  addCombo: (combo) => set((state) => {
    const guest = state.guestMode ? cleanGuestName(state.activeGuest) : null;
    const key = withGuestKey(`combo::${combo.id}`, guest);
    const existing = state.items.find((item) => item.key === key);
    if (existing) {
      return { items: state.items.map((item) => item.key === key ? { ...item, qty: item.qty + 1 } : item) };
    }
    const comboTax = round2(combo.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity * item.taxRate,
      0,
    ));
    return {
      items: [...state.items, {
        key,
        productId: combo.id,
        variantId: null,
        kind: "standard",
        name: combo.name,
        variantName: null,
        imageUrl: combo.imageUrl,
        unitPrice: combo.comboPrice,
        unitAbbrev: "combo",
        unitId: null,
        qty: 1,
        taxRate: 0,
        categoryId: null,
        trackInventory: false,
        stock: Number.POSITIVE_INFINITY,
        step: 1,
        comboId: combo.id,
        comboItems: combo.items,
        comboTax,
        guestName: guest ?? undefined,
      }],
    };
  }),

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

  setGuestMode: (on) =>
    set((s) => {
      if (on) return { guestMode: true, activeGuest: s.activeGuest ?? portalGuestNames(s)[0] ?? null };
      // Al apagarlo, todo vuelve a ser un solo pedido.
      let items = s.items;
      for (const line of s.items) if (line.guestName) items = assignGuest(items, line.key, null);
      return { guestMode: false, activeGuest: null, guestNames: [], items };
    }),

  addGuest: (name) =>
    set((s) => {
      const clean = cleanGuestName(name);
      if (!clean || portalGuestNames(s).some((n) => n.toLowerCase() === clean.toLowerCase())) return s;
      return { guestNames: [...s.guestNames, clean] };
    }),

  setActiveGuest: (activeGuest) => set({ activeGuest: cleanGuestName(activeGuest) }),

  setItemGuest: (key, name) => set((s) => ({ items: assignGuest(s.items, key, name) })),

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

  clearCart: () => set({ items: [], guestMode: false, guestNames: [], activeGuest: null }),

  setFavorites: (ids) => set({ favorites: new Set(ids) }),

  toggleFavorite: (variantId) =>
    set((s) => {
      const next = new Set(s.favorites);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return { favorites: next };
    }),
    }),
    {
      name: "multi-pos.portal-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        items: state.items,
        cartOwner: state.cartOwner,
        guestMode: state.guestMode,
        guestNames: state.guestNames,
        activeGuest: state.activeGuest,
      }),
    }
  )
);

export function cartSubtotal(items: PortalCartItem[]): number {
  return round2(items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0));
}

export function cartTax(items: PortalCartItem[]): number {
  return round2(
    items.reduce((acc, i) => acc + (i.comboTax != null ? i.comboTax * i.qty : i.unitPrice * i.qty * i.taxRate), 0)
  );
}

export function cartTotal(items: PortalCartItem[]): number {
  return round2(cartSubtotal(items) + cartTax(items));
}
