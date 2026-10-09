import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db"
import { getStorefront } from "@/lib/portal/server"
import { sendTicketToKitchen, KitchenError, type KitchenLineInput } from "@/lib/pos/kitchen"
import { broadcastKdsUpdate } from "@/lib/kds/live"
import { persistNotification } from "@/lib/notifications/helpers"

// Menú digital por QR de mesa: el comensal arma un carrito COMPARTIDO de su mesa (lo ve el
// cajero/host en vivo), lo manda a cocina y consulta su cuenta. Lo enviado ya no se puede
// quitar ni disminuir desde el menú. El QR (mesa + token) es la credencial: sin sesión.

export class MenuError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "MenuError"
    this.status = status
  }
}

const OPEN_STATUSES = ["pending", "confirmed", "preparing", "ready"] as const

/** Línea mínima que guarda el carrito (los precios siempre se recalculan en servidor). */
export interface CartLineInput {
  key: string
  productId: string
  variantId: string | null
  quantity: number
  optionValueIds: string[]
  notes: string
}

export interface ResolvedCartLine {
  key: string
  productId: string
  variantId: string | null
  name: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  extraPrice: number
  taxRate: number
  options: { optionName: string; value: string; extraPrice: number }[]
  optionValueIds: string[]
  notes: string
}

export async function resolveTable(tableId: string | null | undefined, token: string | null | undefined) {
  if (!tableId || !token) throw new MenuError("Escanea el QR de tu mesa para pedir", 400)
  const table = await prisma.table.findFirst({
    where: { id: tableId, qrToken: token, isActive: true },
    include: {
      location: { select: { id: true, name: true } },
      organization: {
        select: {
          id: true,
          name: true,
          isBlocked: true,
          companyProfile: { select: { tradeName: true, logoUrl: true } },
          appSettings: { select: { primaryHue: true, accentHue: true } },
        },
      },
    },
  })
  if (!table) throw new MenuError("QR de mesa inválido", 404)
  if (table.organization.isBlocked) throw new MenuError("Este negocio no está disponible", 403)
  return table
}

function cleanLines(raw: unknown): CartLineInput[] {
  if (!Array.isArray(raw)) return []
  const out: CartLineInput[] = []
  for (const r of raw.slice(0, 80)) {
    const o = r as Partial<CartLineInput>
    const quantity = Math.floor(Number(o.quantity))
    if (!o.productId || typeof o.productId !== "string" || !Number.isFinite(quantity) || quantity < 1) continue
    out.push({
      key: typeof o.key === "string" && o.key ? o.key.slice(0, 64) : randomUUID(),
      productId: o.productId,
      variantId: typeof o.variantId === "string" ? o.variantId : null,
      quantity: Math.min(quantity, 99),
      optionValueIds: Array.isArray(o.optionValueIds) ? o.optionValueIds.filter((v): v is string => typeof v === "string").slice(0, 40) : [],
      notes: typeof o.notes === "string" ? o.notes.trim().slice(0, 200) : "",
    })
  }
  return out
}

/** Recalcula nombre y precio de cada línea con el catálogo vigente (descarta lo no disponible). */
export async function resolveLines(organizationId: string, lines: CartLineInput[]): Promise<ResolvedCartLine[]> {
  if (!lines.length) return []
  const products = await prisma.product.findMany({
    where: { organizationId, id: { in: [...new Set(lines.map((l) => l.productId))] }, isActive: true, isAvailable: true },
    include: {
      variants: { where: { isActive: true, isAvailable: true }, orderBy: { createdAt: "asc" } },
      options: { include: { values: { where: { isActive: true } } } },
    },
  })
  const byId = new Map(products.map((p) => [p.id, p]))
  const out: ResolvedCartLine[] = []
  for (const l of lines) {
    const p = byId.get(l.productId)
    if (!p || p.productType === "bulk") continue
    const variant = l.variantId ? p.variants.find((v) => v.id === l.variantId) : p.variants[0]
    if (!variant) continue
    const picked = new Set(l.optionValueIds)
    const options: ResolvedCartLine["options"] = []
    for (const opt of p.options) {
      for (const v of opt.values) {
        if (picked.has(v.id)) options.push({ optionName: opt.name, value: v.value, extraPrice: Number(v.extraPrice ?? 0) })
      }
    }
    const extra = Math.round(options.reduce((s, o) => s + o.extraPrice, 0) * 100) / 100
    out.push({
      key: l.key,
      productId: p.id,
      variantId: variant.id,
      name: p.variants.length > 1 ? `${p.name} · ${variant.name}` : p.name,
      imageUrl: variant.imageUrl ?? p.imageUrl ?? null,
      quantity: l.quantity,
      unitPrice: Math.round((Number(variant.price) + extra) * 100) / 100,
      extraPrice: extra,
      taxRate: Number(p.taxRate ?? 0),
      options,
      optionValueIds: l.optionValueIds,
      notes: l.notes,
    })
  }
  return out
}

/** Cuenta abierta de la mesa (lo ya enviado a cocina). */
export async function openAccount(organizationId: string, tableId: string) {
  const order = await prisma.order.findFirst({
    where: { organizationId, tableId, deliveryMethod: "pickup", status: { in: [...OPEN_STATUSES] }, saleId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      items: { select: { id: true, productName: true, quantity: true, unitPrice: true, extraPrice: true, itemStatus: true, comment: true }, orderBy: { createdAt: "asc" } },
    },
  })
  if (!order) return null
  const items = order.items.map((i) => ({
    id: i.id,
    name: i.productName,
    quantity: Number(i.quantity),
    total: Math.round(Number(i.quantity) * Number(i.unitPrice) * 100) / 100,
    status: i.itemStatus,
    notes: i.comment,
  }))
  return {
    orderNumber: Number(order.orderNumber),
    status: order.status,
    items,
    total: Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100,
  }
}

export async function getMenu(tableId: string, token: string) {
  const table = await resolveTable(tableId, token)
  const orgId = table.organizationId
  const [store, cartRow, account] = await Promise.all([
    getStorefront(orgId, null),
    prisma.tableCart.findUnique({ where: { tableId: table.id } }),
    openAccount(orgId, table.id),
  ])
  const cart = await resolveLines(orgId, cleanLines(cartRow?.items))
  return {
    table: { id: table.id, number: table.number, name: table.name },
    business: {
      name: table.organization.companyProfile?.tradeName ?? table.organization.name,
      logoUrl: table.organization.companyProfile?.logoUrl ?? null,
      locationName: table.location?.name ?? null,
      primaryHue: table.organization.appSettings?.primaryHue ?? null,
    },
    categories: store.categories,
    products: store.products.filter((p) => p.kind !== "bulk"),
    cart,
    account,
    updatedAt: cartRow?.updatedAt.toISOString() ?? null,
  }
}

function announceCart(organizationId: string, tableId: string, tableNumber: number, count: number) {
  // Aviso en vivo al POS/KDS de la organización: el carrito de la mesa cambió.
  broadcastKdsUpdate(organizationId, { type: "table_cart", table: { id: tableId, number: tableNumber, name: null }, items: [], elapsedSeconds: 0, status: String(count) })
}

export async function saveCart(tableId: string, token: string, raw: unknown) {
  const table = await resolveTable(tableId, token)
  const lines = cleanLines(raw)
  if (lines.length === 0) {
    await prisma.tableCart.deleteMany({ where: { tableId: table.id } })
  } else {
    await prisma.tableCart.upsert({
      where: { tableId: table.id },
      create: { organizationId: table.organizationId, tableId: table.id, items: lines as unknown as object },
      update: { items: lines as unknown as object },
    })
  }
  announceCart(table.organizationId, table.id, table.number, lines.length)
  return resolveLines(table.organizationId, lines)
}

/** Manda el carrito a cocina: se vuelve comanda de la mesa y el carrito queda vacío. */
export async function sendCart(tableId: string, token: string) {
  const table = await resolveTable(tableId, token)
  const orgId = table.organizationId
  const row = await prisma.tableCart.findUnique({ where: { tableId: table.id } })
  const resolved = await resolveLines(orgId, cleanLines(row?.items))
  if (resolved.length === 0) throw new MenuError("Tu carrito está vacío o sus productos ya no están disponibles", 400)

  let locationId = table.locationId
  if (!locationId) {
    const loc = await prisma.location.findFirst({ where: { organizationId: orgId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } })
    locationId = loc?.id ?? null
  }
  if (!locationId) throw new MenuError("El negocio no tiene sucursal configurada", 409)

  const items: KitchenLineInput[] = resolved.map((l) => ({
    key: l.key,
    productId: l.productId,
    variantId: l.variantId,
    productName: l.name,
    productType: "standard",
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate,
    notes: l.notes || null,
    selectedOptions: l.options.length ? l.options : null,
    extraPrice: l.extraPrice,
  }))
  try {
    const result = await sendTicketToKitchen(orgId, locationId, { tableId: table.id, serviceType: "dine_in", items }, { userId: null, employeeId: null })
    await prisma.tableCart.deleteMany({ where: { tableId: table.id } })
    announceCart(orgId, table.id, table.number, 0)
    await persistNotification({
      organizationId: orgId,
      locationId,
      kind: "order",
      title: `Mesa ${table.number} pidió desde el menú`,
      body: `${resolved.reduce((s, l) => s + l.quantity, 0)} artículos enviados a cocina`,
      severity: "info",
      link: "/kds",
      metadata: { tableId: table.id, source: "digital_menu" },
    }).catch(() => undefined)
    return result
  } catch (err) {
    if (err instanceof KitchenError) throw new MenuError(err.message, err.status)
    throw err
  }
}

/** El comensal pide la cuenta: avisa al personal (no cierra nada por sí solo). */
export async function requestBill(tableId: string, token: string) {
  const table = await resolveTable(tableId, token)
  const account = await openAccount(table.organizationId, table.id)
  await persistNotification({
    organizationId: table.organizationId,
    locationId: table.locationId ?? null,
    kind: "info",
    title: `Mesa ${table.number} pide la cuenta`,
    body: account ? `Cuenta #${account.orderNumber} · $${account.total.toFixed(2)}` : "Sin consumo registrado",
    severity: "warning",
    link: "/pos",
    metadata: { tableId: table.id, source: "digital_menu", event: "bill_requested" },
  })
  return { ok: true }
}
