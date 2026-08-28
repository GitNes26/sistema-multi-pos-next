import { create } from "zustand";
import type {
  PosCatalog,
  PosCustomer,
  PosLineItem,
  PosProduct,
  PosVariant,
} from "@/types/pos";
import { round2, round3 } from "@/lib/pos/money";
import { playSound } from "@/lib/sounds";

export interface BulkEditOptions {
  qty: number;
  unitId: string;
  pricePerUnit: number;
  abbrev: string;
  unitName: string;
}

export interface CouponApplied {
  code: string;
  label: string;
  amount: number;
  percent?: number;
  couponId?: string;
  promotionId?: string;
}

type CouponStatus = "none" | "pending" | "error" | "applied";

interface PosState extends PosCatalog {
  registerId: string;
  activeCategory: string | null;
  search: string;
  scanRefocus: number;
  keyboardOpen: boolean;
  items: PosLineItem[];
  customerId: string | null;
  manualDiscount: { kind: "percent" | "amount"; value: number } | null;
  coupon: { status: CouponStatus; code: string; result: CouponApplied | null; error?: string };
  pointsRedeemed: number;

  setCatalog: (catalog: PosCatalog) => void;
  setRegister: (registerId: string) => void;
  setActiveCategory: (id: string | null) => void;
  setSearch: (value: string) => void;
  bumpScan: () => void;
  setKeyboardOpen: (open: boolean) => void;

  addProduct: (product: PosProduct, opts?: { qty?: number; variant?: PosVariant }) => void;
  addBulk: (product: PosProduct, opts: BulkEditOptions) => void;
  editItem: (key: string, patch: Partial<PosLineItem>) => void;
  setQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clearTicket: () => void;

  setCustomer: (customerId: string | null) => void;
  setManualDiscount: (d: { kind: "percent" | "amount"; value: number } | null) => void;
  applyCoupon: (result: CouponApplied) => void;
  couponError: (message: string) => void;
  couponPending: () => void;
  clearCoupon: () => void;
  setPointsRedeemed: (points: number) => void;
}

function lineKey(product: PosProduct, unitId: string | null): string {
  return product.kind === "bulk" ? `${product.id}::${unitId ?? "u"}` : product.id;
}

export function bulkDisplay(qty: number, abbrev: string, price: number): string {
  return `${round3(qty)} ${abbrev} × ${price.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}/${abbrev} = ${round2(qty * price).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}`;
}

export const usePosStore = create<PosState>()((set, get) => ({
  location: { id: "", name: "", code: null, address: null, phone: null },
  company: { name: null, logoUrl: null, address: null, city: null, phone: null },
  products: [],
  categories: [],
  customers: [],
  promotions: [],
  registers: [],
  session: null,
  cashier: { userId: "", employeeId: null, name: "" },
  loyalty: { pointValue: 0.01, pointsPerCurrency: 1, enabled: true },
  registerId: "",
  activeCategory: null,
  search: "",
  scanRefocus: 0,
  keyboardOpen: false,
  items: [],
  customerId: null,
  manualDiscount: null,
  coupon: { status: "none", code: "", result: null },
  pointsRedeemed: 0,

  setCatalog: (catalog) => {
    set({
      ...catalog,
      registerId: catalog.registers[0]?.id ?? "",
    });
  },

  setRegister: (registerId) => set({ registerId }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setSearch: (search) => set({ search }),
  bumpScan: () => set((s) => ({ scanRefocus: s.scanRefocus + 1 })),
  setKeyboardOpen: (keyboardOpen) => set({ keyboardOpen }),

  addProduct: (product, opts) => {
    set((s) => {
      const v = opts?.variant;
      const key = v ? v.id : product.id;
      const existing = s.items.find((i) => i.key === key);
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.key === key ? { ...i, qty: round3(i.qty + Math.max(1, opts?.qty ?? 1)) } : i
          ),
        };
      }
      const qty = Math.max(1, opts?.qty ?? 1);
      const displayName = v ? (v.name === "Default" ? product.name : `${product.name} · ${v.name}`) : product.name;
      const line: PosLineItem = {
        key,
        productId: product.productId,
        variantId: v ? v.id : product.variantId,
        kind: product.kind,
        name: displayName,
        imageUrl: v?.imageUrl ?? product.imageUrl,
        categoryId: product.categoryId,
        unitPrice: v ? v.price : product.price,
        unitAbbrev: "pza",
        qty,
        taxRate: product.taxRate,
        unitId: null,
        trackInventory: product.trackInventory,
        stock: v ? v.stock : product.stock,
      };
      return { items: [...s.items, line] };
    });
    playSound("scan");
  },

  addBulk: (product, opts) => {
    set((s) => {
      const key = lineKey(product, opts.unitId);
      const qty = round3(opts.qty);
      const line: PosLineItem = {
        key,
        productId: product.productId,
        variantId: null,
        kind: "bulk",
        name: product.name,
        imageUrl: product.imageUrl,
        categoryId: product.categoryId,
        unitPrice: opts.pricePerUnit,
        unitAbbrev: opts.abbrev,
        qty,
        taxRate: product.taxRate,
        unitId: opts.unitId,
        trackInventory: product.trackInventory,
        stock: product.stock,
        bulkQuantityDisplay: bulkDisplay(qty, opts.abbrev, opts.pricePerUnit),
      };
      const existing = s.items.find((i) => i.key === key);
      return {
        items: existing
          ? s.items.map((i) => (i.key === key ? line : i))
          : [...s.items, line],
      };
    });
    playSound("scan");
  },

  editItem: (key, patch) =>
    set((s) => ({
      items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    })),

  setQty: (key, qty) => {
    set((s) => ({
      items: s.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, round3(qty)) } : i)),
    }));
    playSound("scan");
  },

  removeItem: (key) => {
    set((s) => ({ items: s.items.filter((i) => i.key !== key) }));
    playSound("scan");
  },

  clearTicket: () =>
    set({
      items: [],
      customerId: null,
      manualDiscount: null,
      coupon: { status: "none", code: "", result: null },
      pointsRedeemed: 0,
    }),

  setCustomer: (customerId) => set({ customerId }),
  setManualDiscount: (manualDiscount) => set({ manualDiscount }),
  applyCoupon: (result) =>
    set({ coupon: { status: "applied", code: result.code, result } }),
  couponError: (error) => set({ coupon: { status: "error", code: get().coupon.code, result: null, error } }),
  couponPending: () => set({ coupon: { ...get().coupon, status: "pending" } }),
  clearCoupon: () => set({ coupon: { status: "none", code: "", result: null } }),
  setPointsRedeemed: (pointsRedeemed) => set({ pointsRedeemed: Math.max(0, round2(pointsRedeemed)) }),
}));

export function selectCustomer(customerId: string | null): PosCustomer | null {
  if (!customerId) return null;
  return usePosStore.getState().customers.find((c) => c.id === customerId) ?? null;
}