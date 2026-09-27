import type { $Enums } from "@prisma/client"
import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { createOrder, linkSupplierProduct } from "@/lib/purchasing/server"

// Reabastecimiento asistido:
// • sugerencias de pedido para lo que está en su mínimo, agrupadas por el
//   proveedor preferido de cada producto (con su costo, mínimo de pedido y
//   días de entrega);
// • creación de las órdenes de compra aceptadas;
// • velocidad de venta para sugerir mínimos.

type LocType = $Enums.LocationType
const num = (v: unknown) => (v == null ? 0 : Number(v))
const round3 = (n: number) => Math.round(n * 1000) / 1000

export interface ReorderLine {
  inventoryId: string
  productId: string
  variantId: string | null
  name: string
  image: string | null
  unit: string | null
  current: number
  min: number
  suggested: number
  unitCost: number
  minimumOrder: number
  supplierSku: string | null
}

export interface ReorderGroup {
  supplierId: string | null
  supplierName: string
  leadTimeDays: number
  lines: ReorderLine[]
}

/** Cantidad sugerida: llevar la existencia al doble del mínimo, respetando el pedido mínimo del proveedor. */
function suggestQty(current: number, min: number, minimumOrder: number) {
  const need = Math.max(0, min * 2 - current)
  const base = Math.max(need, minimumOrder || 0)
  return base >= 1 ? Math.ceil(base) : round3(base)
}

export async function getReorderSuggestions(organizationId: string, locationType: LocType, locationId: string): Promise<ReorderGroup[]> {
  const rows = await prisma.inventory.findMany({
    where: {
      organizationId,
      locationType,
      locationId,
      minThreshold: { gt: 0 },
      OR: [
        { product: { isActive: true, trackInventory: true } },
        { productId: null, variant: { isActive: true, product: { isActive: true, trackInventory: true } } },
      ],
    },
    include: {
      product: { select: { id: true, name: true, imageUrl: true } },
      variant: { select: { id: true, name: true, cost: true, product: { select: { id: true, name: true, imageUrl: true } } } },
      unit: { select: { abbreviation: true } },
    },
  })
  const low = rows.filter((r) => num(r.quantity) <= num(r.minThreshold))
  if (!low.length) return []

  const productIds = [...new Set(low.map((r) => r.productId ?? r.variant?.product.id).filter((x): x is string => !!x))]
  const links = await prisma.supplierProduct.findMany({
    where: { organizationId, productId: { in: productIds }, isActive: true, supplier: { isActive: true } },
    include: { supplier: { select: { id: true, businessName: true, leadTimeDays: true } } },
    orderBy: [{ isPreferred: "desc" }, { unitCost: "asc" }],
  })

  const groups = new Map<string, ReorderGroup>()
  for (const r of low) {
    const product = r.product ?? r.variant?.product
    if (!product) continue
    // Preferido de la variante exacta; si no, el del producto en general.
    const link =
      links.find((l) => l.productId === product.id && l.variantId === r.variantId) ??
      links.find((l) => l.productId === product.id && !l.variantId) ??
      links.find((l) => l.productId === product.id)
    const key = link?.supplier.id ?? "none"
    const group = groups.get(key) ?? {
      supplierId: link?.supplier.id ?? null,
      supplierName: link?.supplier.businessName ?? "Sin proveedor asignado",
      leadTimeDays: link?.leadTimeDays ?? link?.supplier.leadTimeDays ?? 0,
      lines: [],
    }
    const current = num(r.quantity)
    const min = num(r.minThreshold)
    const variantName = r.variant?.name && r.variant.name !== "Default" ? ` · ${r.variant.name}` : ""
    group.lines.push({
      inventoryId: r.id,
      productId: product.id,
      variantId: r.variantId,
      name: `${product.name}${variantName}`,
      image: product.imageUrl,
      unit: r.unit?.abbreviation ?? null,
      current,
      min,
      suggested: suggestQty(current, min, num(link?.minimumOrder)),
      unitCost: link ? num(link.unitCost) : num(r.variant?.cost),
      minimumOrder: num(link?.minimumOrder),
      supplierSku: link?.supplierSku ?? null,
    })
    groups.set(key, group)
  }
  // Primero los que tienen proveedor; al final los que falta asignar.
  return [...groups.values()].sort((a, b) => (a.supplierId ? 0 : 1) - (b.supplierId ? 0 : 1) || a.supplierName.localeCompare(b.supplierName))
}

/** Crea una orden de compra (borrador) por proveedor con las líneas aceptadas. */
export async function createReorderOrders(
  organizationId: string,
  userId: string,
  input: {
    locationType: LocType
    locationId: string
    orders: { supplierId: string; lines: { productId: string; variantId: string | null; quantity: number; unitCost: number; description?: string; link?: boolean }[] }[]
  }
) {
  const valid = input.orders.map((o) => ({ ...o, lines: o.lines.filter((l) => l.quantity > 0) })).filter((o) => o.supplierId && o.lines.length)
  if (!valid.length) throw new CrudError("Selecciona al menos un producto con proveedor y cantidad", 400)
  const suppliers = await prisma.supplier.findMany({ where: { organizationId, id: { in: valid.map((o) => o.supplierId) } }, select: { id: true, leadTimeDays: true } })
  const created: { id: string; folio: string }[] = []
  for (const o of valid) {
    const lead = suppliers.find((s) => s.id === o.supplierId)?.leadTimeDays ?? 0
    const order = await createOrder(organizationId, userId, {
      supplierId: o.supplierId,
      locationType: input.locationType,
      locationId: input.locationId,
      expectedAt: lead > 0 ? new Date(Date.now() + lead * 86400000).toISOString() : undefined,
      notes: "Generada desde sugerencias de reabastecimiento (existencias en mínimo).",
      items: o.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, description: l.description, quantity: l.quantity, unitCost: l.unitCost, taxRate: 0 })),
    })
    created.push({ id: order.id, folio: order.folio })
    // Productos que no tenían proveedor: se recuerda el elegido como preferido.
    for (const l of o.lines.filter((x) => x.link)) {
      await linkSupplierProduct(organizationId, { supplierId: o.supplierId, productId: l.productId, variantId: l.variantId, unitCost: l.unitCost, minimumOrder: 1, isPreferred: true })
    }
  }
  return { ok: true, orders: created }
}

/**
 * Venta promedio diaria de cada fila de inventario (últimos `days` días) y el
 * mínimo sugerido para cubrir `coverageDays` de venta.
 */
export async function salesVelocity(organizationId: string, locationType: LocType, locationId: string, days = 30, coverageDays = 7) {
  const rows = await prisma.inventory.findMany({
    where: { organizationId, locationType, locationId },
    select: { id: true, productId: true, variantId: true },
  })
  if (locationType !== "location") return rows.map((r) => ({ inventoryId: r.id, dailyAverage: 0, suggestedMin: 0 }))
  const since = new Date(Date.now() - days * 86400000)
  const items = await prisma.saleItem.groupBy({
    by: ["productId", "variantId"],
    where: { sale: { organizationId, locationId, status: "completed", createdAt: { gte: since } } },
    _sum: { quantity: true },
  })
  const soldBy = (productId: string | null, variantId: string | null) =>
    items
      .filter((i) => (variantId ? i.variantId === variantId : i.productId === productId))
      .reduce((s, i) => s + num(i._sum.quantity), 0)
  return rows.map((r) => {
    const sold = soldBy(r.productId, r.variantId)
    const daily = sold / days
    return { inventoryId: r.id, dailyAverage: round3(daily), suggestedMin: daily > 0 ? Math.ceil(daily * coverageDays) : 0 }
  })
}
