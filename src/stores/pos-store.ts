import { create } from "zustand"
import { cleanGuestName } from "@/lib/guests"
import type {
  PosCatalog,
  PosCustomer,
  PosLineItem,
  PosProduct,
  PosVariant,
} from "@/types/pos"
import { round2, round3 } from "@/lib/pos/money"
import { playSound } from "@/lib/sounds"

export interface BulkEditOptions {
  qty: number
  unitId: string
  pricePerUnit: number
  abbrev: string
  unitName: string
}

export interface CouponApplied {
  code: string
  label: string
  amount: number
  percent?: number
  couponId?: string
  promotionId?: string
}

type CouponStatus = "none" | "pending" | "error" | "applied"

/** Borrador de una cuenta que se dejó en pausa para atender otra (mesa o para llevar). */
export interface HeldTicket {
  key: string
  label: string
  /** Solo lo que aún no se envía a cocina; lo enviado se recarga del servidor. */
  items: PosLineItem[]
  customerId: string | null
  manualDiscount: { kind: "percent" | "amount"; value: number } | null
  coupon: { status: CouponStatus; code: string; result: CouponApplied | null; error?: string }
  pointsRedeemed: number
  heldAt: number
}

const GUEST_SEP = "::g::"
const withGuestKey = (key: string, guest: string | null) => (guest ? `${key}${GUEST_SEP}${guest}` : key)
const baseKey = (key: string) => key.split(GUEST_SEP)[0]

/** Reasigna un renglón a otra persona (o a nadie), fusionando con el renglón gemelo si existe. */
function assignGuest(items: PosLineItem[], key: string, guest: string | null): PosLineItem[] {
  const line = items.find((i) => i.key === key)
  if (!line || (line.sentQty ?? 0) > 0) return items
  const name = cleanGuestName(guest)
  const newKey = withGuestKey(baseKey(line.key), name)
  if (newKey === line.key) return items
  const twin = items.find((i) => i.key === newKey)
  if (twin) {
    if (line.kind === "bulk") return items
    return items.filter((i) => i.key !== line.key).map((i) => (i.key === newKey ? { ...i, qty: round3(i.qty + line.qty) } : i))
  }
  return items.map((i) => (i.key === line.key ? { ...i, key: newKey, guestName: name ?? undefined } : i))
}

/** Nombres de las personas del ticket: los agregados a mano y los que ya tienen renglones. */
export function guestNamesOf(state: Pick<PosState, "guestNames" | "items">): string[] {
  const out: string[] = []
  const add = (n: string | null | undefined) => {
    const name = cleanGuestName(n)
    if (name && !out.some((o) => o.toLowerCase() === name.toLowerCase())) out.push(name)
  }
  state.guestNames.forEach(add)
  state.items.forEach((i) => add(i.guestName))
  return out
}

interface PosState extends PosCatalog {
  registerId: string
  activeCategory: string | null
  search: string
  scanRefocus: number
  keyboardOpen: boolean
  items: PosLineItem[]
  /** «Pedir para varias personas»: lo que se agrega se asigna a `activeGuest`. */
  guestMode: boolean
  guestNames: string[]
  activeGuest: string | null
  customerId: string | null
  selectedTable: { id: string; number: number; name?: string | null } | null
  /** Comer aquí (con mesa) o para llevar; aplica a negocios con mesas/cocina. */
  serviceType: "dine_in" | "takeaway"
  /** Comanda para llevar ya enviada a cocina (se amplía y se cierra al cobrar). */
  kitchenOrderId: string | null
  manualDiscount: { kind: "percent" | "amount"; value: number } | null
  coupon: {
    status: CouponStatus
    code: string
    result: CouponApplied | null
    error?: string
  }
  pointsRedeemed: number
  /** Cuentas en pausa por contexto («table:<id>», «take:<orderId>» o «draft:<n>»). */
  held: Record<string, HeldTicket>
  stashTicket: (key: string, label: string) => void
  takeHeld: (key: string) => HeldTicket | null
  dropHeld: (key: string) => void
  /** Deja en blanco el ticket de trabajo sin tocar caja, catálogo ni cuentas en pausa. */
  resetWorkingTicket: () => void

  setCatalog: (catalog: PosCatalog) => void
  setRegister: (registerId: string) => void
  setActiveCategory: (id: string | null) => void
  setSearch: (value: string) => void
  bumpScan: () => void
  setKeyboardOpen: (open: boolean) => void

  addProduct: (
    product: PosProduct,
    opts?: { qty?: number; variant?: PosVariant }
  ) => void
  addBulk: (product: PosProduct, opts: BulkEditOptions) => void
  addConfiguredItem: (
    product: PosProduct,
    config: {
      selectedOptions: {
        optionId: string
        optionName: string
        values: { id: string; value: string; extraPrice: number }[]
      }[]
      totalExtraPrice: number
      notes: string
      quantity: number
    }
  ) => void
  setGuestMode: (on: boolean) => void
  addGuest: (name: string) => void
  setActiveGuest: (name: string | null) => void
  /** Cambia a quién pertenece un renglón (no aplica a lo ya enviado a cocina). */
  setItemGuest: (key: string, name: string | null) => void
  editItem: (key: string, patch: Partial<PosLineItem>) => void
  setQty: (key: string, qty: number) => void
  removeItem: (key: string) => void
  clearTicket: () => void

  setCustomer: (customerId: string | null) => void
  setTable: (
    table: { id: string; number: number; name?: string | null } | null
  ) => void
  /** Registra la cantidad de una línea que ya se envió a cocina. */
  setServiceType: (type: "dine_in" | "takeaway") => void
  setKitchenOrderId: (id: string | null) => void
  /** Carga al inicio del ticket las líneas de la cuenta abierta de una mesa (ya enviadas a cocina). */
  prependSentLines: (lines: PosLineItem[]) => void
  markSent: (key: string, qty: number) => void
  /** Devuelve el ticket a "sin enviar" (pull-back de la orden de cocina). */
  resetSent: () => void
  setManualDiscount: (
    d: { kind: "percent" | "amount"; value: number } | null
  ) => void
  applyCoupon: (result: CouponApplied) => void
  couponError: (message: string) => void
  couponPending: () => void
  clearCoupon: () => void
  setPointsRedeemed: (points: number) => void
}

/** Identifica la cuenta que se está atendiendo (para pausarla y retomarla). */
export function ticketContextKey(s: Pick<PosState, "serviceType" | "selectedTable" | "kitchenOrderId">): string {
  if (s.serviceType === "takeaway") return s.kitchenOrderId ? `take:${s.kitchenOrderId}` : "draft:new"
  if (s.selectedTable && !s.selectedTable.id.startsWith("manual-")) return `table:${s.selectedTable.id}`
  return "none"
}

function lineKey(product: PosProduct, unitId: string | null): string {
  return product.kind === "bulk"
    ? `${product.id}::${unitId ?? "u"}`
    : product.id
}

export function bulkDisplay(
  qty: number,
  abbrev: string,
  price: number
): string {
  return `${round3(qty)} ${abbrev} × ${price.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}/${abbrev} = ${round2(qty * price).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}`
}

export const usePosStore = create<PosState>()((set, get) => ({
  location: { id: "", name: "", code: null, address: null, phone: null },
  company: {
    name: null,
    logoUrl: null,
    address: null,
    city: null,
    phone: null,
    ticketFooter: null,
    transfer: null,
  },
  products: [],
  categories: [],
  customers: [],
  promotions: [],
  promotionUses: [],
  combos: [],
  topSellers: [],
  registers: [],
  session: null,
  features: {
    combos: true,
    productBuilder: true,
    itemNotes: true,
    tables: true,
    kds: true,
    bulkProducts: true,
    credit: true,
    tips: true,
    splitBill: true,
  },
  cashier: { userId: "", employeeId: null, name: "" },
  loyalty: { pointValue: 0.01, pointsPerCurrency: 1, enabled: true },
  registerId: "",
  activeCategory: null,
  search: "",
  scanRefocus: 0,
  keyboardOpen: false,
  items: [],
  guestMode: false,
  guestNames: [],
  activeGuest: null,
  customerId: null,
  selectedTable: null,
  serviceType: "dine_in",
  kitchenOrderId: null,
  held: {},
  manualDiscount: null,
  coupon: { status: "none", code: "", result: null },
  pointsRedeemed: 0,

  setCatalog: (catalog) => {
    set((state) => ({
      ...catalog,
      registerId: catalog.registers.some((register) => register.id === state.registerId)
        ? state.registerId
        : catalog.registers[0]?.id ?? "",
    }))
  },

  setRegister: (registerId) => set({ registerId }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setSearch: (search) => set({ search }),
  bumpScan: () => set((s) => ({ scanRefocus: s.scanRefocus + 1 })),
  setKeyboardOpen: (keyboardOpen) => set({ keyboardOpen }),

  addProduct: (product, opts) => {
    set((s) => {
      const v = opts?.variant
      const guest = s.guestMode ? cleanGuestName(s.activeGuest) : null
      const key = withGuestKey(v ? v.id : product.id, guest)
      const existing = s.items.find((i) => i.key === key)
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.key === key
              ? { ...i, qty: round3(i.qty + Math.max(1, opts?.qty ?? 1)) }
              : i
          ),
        }
      }
      const qty = Math.max(1, opts?.qty ?? 1)
      const displayName = v
        ? v.name === "Default"
          ? product.name
          : `${product.name} · ${v.name}`
        : product.name
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
        guestName: guest ?? undefined,
      }
      return { items: [...s.items, line] }
    })
    playSound("scan")
  },

  addBulk: (product, opts) => {
    set((s) => {
      const guest = s.guestMode ? cleanGuestName(s.activeGuest) : null
      const key = withGuestKey(lineKey(product, opts.unitId), guest)
      const qty = round3(opts.qty)
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
        guestName: guest ?? undefined,
      }
      const existing = s.items.find((i) => i.key === key)
      return {
        items: existing
          ? s.items.map((i) => (i.key === key ? line : i))
          : [...s.items, line],
      }
    })
    playSound("scan")
  },

  addConfiguredItem: (product, config) => {
    set((s) => {
      const key = `${product.id}-${Date.now()}`
      const guest = s.guestMode ? cleanGuestName(s.activeGuest) : null
      // Los tópicos se muestran en su propia leyenda; el nombre queda limpio.
      const displayName = product.name
      const line: PosLineItem = {
        key,
        productId: product.productId,
        variantId: product.variantId,
        kind: product.kind,
        name: displayName,
        imageUrl: product.imageUrl,
        categoryId: product.categoryId,
        unitPrice: product.price + config.totalExtraPrice,
        unitAbbrev: "pza",
        qty: config.quantity,
        taxRate: product.taxRate,
        unitId: null,
        trackInventory: product.trackInventory,
        stock: product.stock,
        notes: config.notes || undefined,
        selectedOptions: config.selectedOptions.map((o) => ({
          optionId: o.optionId,
          optionName: o.optionName,
          valueIds: o.values.map((v) => v.id),
          value: o.values.map((v) => v.value).join(", "),
          extraPrice: o.values.reduce((s, v) => s + v.extraPrice, 0),
        })),
        extraPrice: config.totalExtraPrice,
        guestName: guest ?? undefined,
      }
      return { items: [...s.items, line] }
    })
    playSound("scan")
  },

  setGuestMode: (on) =>
    set((s) => {
      if (on) {
        const names = guestNamesOf(s)
        return { guestMode: true, activeGuest: s.activeGuest ?? names[0] ?? null }
      }
      // Al apagarlo, lo no enviado vuelve a ser un solo pedido.
      let items = s.items
      for (const line of s.items) if (line.guestName && !(line.sentQty ?? 0)) items = assignGuest(items, line.key, null)
      return { guestMode: false, activeGuest: null, guestNames: [], items }
    }),

  addGuest: (name) =>
    set((s) => {
      const clean = cleanGuestName(name)
      if (!clean || guestNamesOf(s).some((n) => n.toLowerCase() === clean.toLowerCase())) return s
      return { guestNames: [...s.guestNames, clean] }
    }),

  setActiveGuest: (activeGuest) => set({ activeGuest: cleanGuestName(activeGuest) }),

  setItemGuest: (key, name) => set((s) => ({ items: assignGuest(s.items, key, name) })),

  editItem: (key, patch) =>
    set((s) => ({
      items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    })),

  setQty: (key, qty) => {
    set((s) => ({
      items: s.items.map((i) =>
        i.key === key ? { ...i, qty: Math.max(1, round3(qty)) } : i
      ),
    }))
    playSound("scan")
  },

  removeItem: (key) => {
    set((s) => ({ items: s.items.filter((i) => i.key !== key) }))
    playSound("scan")
  },

  clearTicket: () =>
    set((s) => {
      // La cuenta cobrada ya no necesita su borrador en pausa.
      const held = { ...s.held }
      delete held[ticketContextKey(s)]
      return {
        items: [],
        guestMode: false,
        guestNames: [],
        activeGuest: null,
        customerId: null,
        selectedTable: null,
        kitchenOrderId: null,
        manualDiscount: null,
        coupon: { status: "none", code: "", result: null },
        pointsRedeemed: 0,
        held,
      }
    }),

  stashTicket: (key, label) =>
    set((s) => {
      const unsent = s.items.filter((i) => i.qty > (i.sentQty ?? 0)).map((i) => ({ ...i, qty: i.qty - (i.sentQty ?? 0), sentQty: 0 }))
      const hasState = unsent.length > 0 || s.manualDiscount || s.coupon.result || s.pointsRedeemed > 0
      const held = { ...s.held }
      if (!hasState) delete held[key]
      else
        held[key] = {
          key,
          label,
          items: unsent,
          customerId: s.customerId,
          manualDiscount: s.manualDiscount,
          coupon: s.coupon,
          pointsRedeemed: s.pointsRedeemed,
          heldAt: Date.now(),
        }
      return { held }
    }),
  takeHeld: (key) => get().held[key] ?? null,
  dropHeld: (key) =>
    set((s) => {
      const held = { ...s.held }
      delete held[key]
      return { held }
    }),
  resetWorkingTicket: () =>
    set({
      items: [],
      guestMode: false,
      guestNames: [],
      activeGuest: null,
      customerId: null,
      selectedTable: null,
      kitchenOrderId: null,
      manualDiscount: null,
      coupon: { status: "none", code: "", result: null },
      pointsRedeemed: 0,
    }),

  setCustomer: (customerId) => set({ customerId }),
  setTable: (table) => set({ selectedTable: table }),
  setServiceType: (serviceType) => set({ serviceType, ...(serviceType === "takeaway" ? {} : { kitchenOrderId: null }) }),
  setKitchenOrderId: (kitchenOrderId) => set({ kitchenOrderId }),
  prependSentLines: (lines) => set((s) => ({ items: [...lines, ...s.items] })),
  markSent: (key, qty) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.key === key ? { ...i, sentQty: Math.max(i.sentQty ?? 0, qty) } : i
      ),
    })),
  resetSent: () =>
    set((s) => ({
      items: s.items.map((i) =>
        (i.sentQty ?? 0) > 0 ? { ...i, sentQty: 0 } : i
      ),
    })),
  setManualDiscount: (manualDiscount) => set({ manualDiscount }),
  applyCoupon: (result) =>
    set({ coupon: { status: "applied", code: result.code, result } }),
  couponError: (error) =>
    set({
      coupon: { status: "error", code: get().coupon.code, result: null, error },
    }),
  couponPending: () => set({ coupon: { ...get().coupon, status: "pending" } }),
  clearCoupon: () =>
    set({ coupon: { status: "none", code: "", result: null } }),
  setPointsRedeemed: (pointsRedeemed) =>
    set({ pointsRedeemed: Math.max(0, round2(pointsRedeemed)) }),
}))

export function selectCustomer(customerId: string | null): PosCustomer | null {
  if (!customerId) return null
  return (
    usePosStore.getState().customers.find((c) => c.id === customerId) ?? null
  )
}
