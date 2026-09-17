import { Prisma, type LocationType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import {
  canTransitionPurchaseOrder,
  purchaseTotals,
  receivedOrderStatus,
} from "@/lib/purchasing/domain"

const n = (value: Prisma.Decimal | number | string | null | undefined) =>
  Number(value ?? 0)
const positive = (value: unknown, field: string) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new CrudError(`${field} debe ser mayor que cero`, 400, field)
  return parsed
}

export async function purchasingWorkspace(organizationId: string) {
  const [suppliers, products, locations, cedis, quotes, orders, receipts] =
    await Promise.all([
      prisma.supplier.findMany({
        where: { organizationId },
        include: { products: true },
        orderBy: { businessName: "asc" },
      }),
      prisma.product.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          productType: true,
          variants: {
            where: { isActive: true },
            select: { id: true, name: true, sku: true, cost: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.location.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.cedi.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.purchaseQuote.findMany({
        where: { organizationId },
        include: { supplier: { select: { businessName: true } }, items: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchaseOrder.findMany({
        where: { organizationId },
        include: {
          supplier: { select: { businessName: true } },
          items: true,
          receipts: { select: { id: true, folio: true, receivedAt: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.goodsReceipt.findMany({
        where: { organizationId },
        include: {
          order: {
            select: {
              folio: true,
              supplier: { select: { businessName: true } },
            },
          },
          items: true,
        },
        orderBy: { receivedAt: "desc" },
        take: 100,
      }),
    ])
  const serialize = <T>(value: T): T =>
    JSON.parse(
      JSON.stringify(value, (_key, item) =>
        item instanceof Prisma.Decimal
          ? item.toNumber()
          : typeof item === "bigint"
            ? item.toString()
            : item
      )
    )
  return serialize({
    suppliers,
    products,
    locations,
    cedis,
    quotes,
    orders,
    receipts,
  })
}

async function nextFolio(
  organizationId: string,
  prefix: string,
  model: "quote" | "order" | "receipt"
) {
  const count =
    model === "quote"
      ? await prisma.purchaseQuote.count({ where: { organizationId } })
      : model === "order"
        ? await prisma.purchaseOrder.count({ where: { organizationId } })
        : await prisma.goodsReceipt.count({ where: { organizationId } })
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`
}

export async function createSupplier(
  organizationId: string,
  input: Record<string, unknown>
) {
  const businessName = String(input.businessName ?? "").trim()
  if (!businessName)
    throw new CrudError("La razón social es obligatoria", 400, "businessName")
  const code =
    String(input.code ?? "").trim() ||
    `PROV-${String((await prisma.supplier.count({ where: { organizationId } })) + 1).padStart(4, "0")}`
  return prisma.supplier.create({
    data: {
      organizationId,
      code,
      businessName,
      tradeName: String(input.tradeName ?? "").trim() || null,
      taxId: String(input.taxId ?? "").trim() || null,
      contactName: String(input.contactName ?? "").trim() || null,
      email: String(input.email ?? "").trim() || null,
      phone: String(input.phone ?? "").trim() || null,
      address: String(input.address ?? "").trim() || null,
      paymentTerms: String(input.paymentTerms ?? "").trim() || null,
      leadTimeDays: Math.max(0, Number(input.leadTimeDays ?? 0)),
      notes: String(input.notes ?? "").trim() || null,
      isActive: input.isActive !== false,
    },
  })
}

export async function updateSupplier(
  organizationId: string,
  id: string,
  input: Record<string, unknown>
) {
  const row = await prisma.supplier.findFirst({ where: { id, organizationId } })
  if (!row) throw new CrudError("Proveedor no encontrado", 404)
  const businessName = String(input.businessName ?? "").trim()
  if (!businessName)
    throw new CrudError("La razón social es obligatoria", 400, "businessName")
  return prisma.supplier.update({
    where: { id },
    data: {
      businessName,
      tradeName: String(input.tradeName ?? "").trim() || null,
      taxId: String(input.taxId ?? "").trim() || null,
      contactName: String(input.contactName ?? "").trim() || null,
      email: String(input.email ?? "").trim() || null,
      phone: String(input.phone ?? "").trim() || null,
      address: String(input.address ?? "").trim() || null,
      paymentTerms: String(input.paymentTerms ?? "").trim() || null,
      leadTimeDays: Math.max(0, Number(input.leadTimeDays ?? 0)),
      notes: String(input.notes ?? "").trim() || null,
      isActive: input.isActive !== false,
    },
  })
}

export async function linkSupplierProduct(
  organizationId: string,
  input: Record<string, unknown>
) {
  const supplierId = String(input.supplierId ?? ""),
    productId = String(input.productId ?? ""),
    variantId = String(input.variantId ?? "") || null
  const [supplier, product] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: supplierId, organizationId } }),
    prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: { variants: true },
    }),
  ])
  if (
    !supplier ||
    !product ||
    (variantId && !product.variants.some((v) => v.id === variantId))
  )
    throw new CrudError("Proveedor o producto inválido", 400)
  const existing = await prisma.supplierProduct.findFirst({
    where: { supplierId, productId, variantId },
  })
  const values = {
    supplierSku: String(input.supplierSku ?? "").trim() || null,
    unitCost: Math.max(0, Number(input.unitCost ?? 0)),
    minimumOrder: positive(input.minimumOrder ?? 1, "minimumOrder"),
    leadTimeDays:
      input.leadTimeDays == null
        ? null
        : Math.max(0, Number(input.leadTimeDays)),
    isPreferred: input.isPreferred === true,
    isActive: true,
  }
  return existing
    ? prisma.supplierProduct.update({
        where: { id: existing.id },
        data: values,
      })
    : prisma.supplierProduct.create({
        data: { organizationId, supplierId, productId, variantId, ...values },
      })
}

type PurchaseItemInput = {
  productId: string
  variantId?: string | null
  description?: string
  quantity: number
  unitCost: number
  taxRate?: number
}
async function validateItems(organizationId: string, raw: PurchaseItemInput[]) {
  if (!Array.isArray(raw) || !raw.length)
    throw new CrudError("Agrega al menos un producto", 400, "items")
  const ids = [...new Set(raw.map((i) => i.productId))]
  const products = await prisma.product.findMany({
    where: { organizationId, id: { in: ids } },
    include: { variants: true },
  })
  if (products.length !== ids.length)
    throw new CrudError(
      "Uno o más productos no pertenecen a la organización",
      400,
      "items"
    )
  return raw.map((item) => {
    const p = products.find((x) => x.id === item.productId)!
    if (item.variantId && !p.variants.some((v) => v.id === item.variantId))
      throw new CrudError(`La variante de ${p.name} no es válida`, 400, "items")
    return {
      productId: p.id,
      variantId: item.variantId || null,
      description:
        item.description?.trim() ||
        `${p.name}${item.variantId ? ` · ${p.variants.find((v) => v.id === item.variantId)?.name}` : ""}`,
      quantity: positive(item.quantity, "quantity"),
      unitCost: Math.max(0, Number(item.unitCost ?? 0)),
      taxRate: Math.max(0, Number(item.taxRate ?? 0)),
    }
  })
}

export async function createQuote(
  organizationId: string,
  userId: string,
  input: {
    supplierId: string
    validUntil?: string
    notes?: string
    items: PurchaseItemInput[]
  }
) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, organizationId, isActive: true },
  })
  if (!supplier)
    throw new CrudError("Selecciona un proveedor activo", 400, "supplierId")
  const items = await validateItems(organizationId, input.items)
  return prisma.purchaseQuote.create({
    data: {
      organizationId,
      supplierId: supplier.id,
      folio: await nextFolio(organizationId, "COT", "quote"),
      status: "requested",
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      notes: input.notes?.trim() || null,
      createdBy: userId,
      items: { create: items },
    },
    include: { items: true, supplier: true },
  })
}

export async function createOrder(
  organizationId: string,
  userId: string,
  input: {
    supplierId: string
    quoteId?: string
    locationType: LocationType
    locationId: string
    expectedAt?: string
    notes?: string
    items: PurchaseItemInput[]
  }
) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, organizationId, isActive: true },
  })
  if (!supplier)
    throw new CrudError("Selecciona un proveedor activo", 400, "supplierId")
  const target =
    input.locationType === "cedis"
      ? await prisma.cedi.findFirst({
          where: { id: input.locationId, organizationId, isActive: true },
        })
      : await prisma.location.findFirst({
          where: { id: input.locationId, organizationId, isActive: true },
        })
  if (!target)
    throw new CrudError("Selecciona un destino válido", 400, "locationId")
  const items = await validateItems(organizationId, input.items)
  const { subtotal, tax, total } = purchaseTotals(items)
  return prisma.purchaseOrder.create({
    data: {
      organizationId,
      supplierId: supplier.id,
      quoteId: input.quoteId || null,
      folio: await nextFolio(organizationId, "OC", "order"),
      locationType: input.locationType,
      locationId: input.locationId,
      expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
      notes: input.notes?.trim() || null,
      subtotal,
      tax,
      total,
      createdBy: userId,
      items: { create: items },
    },
    include: { items: true, supplier: true },
  })
}

export async function changeOrderStatus(
  organizationId: string,
  userId: string,
  orderId: string,
  status: string
) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, organizationId },
  })
  if (!order) throw new CrudError("Orden no encontrada", 404)
  if (!canTransitionPurchaseOrder(order.status, status))
    throw new CrudError(
      `No se puede cambiar de ${order.status} a ${status}`,
      409
    )
  return prisma.purchaseOrder.update({
    where: { id: order.id },
    data: {
      status,
      ...(status === "approved"
        ? { approvedBy: userId, approvedAt: new Date() }
        : {}),
      ...(status === "sent" ? { sentAt: new Date() } : {}),
      ...(status === "cancelled" ? { cancelledAt: new Date() } : {}),
    },
  })
}

export async function receiveOrder(
  organizationId: string,
  userId: string,
  input: {
    orderId: string
    notes?: string
    items: { orderItemId: string; quantity: number }[]
  }
) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: input.orderId, organizationId },
    include: { items: true },
  })
  if (
    !order ||
    !["approved", "sent", "partially_received"].includes(order.status)
  )
    throw new CrudError("La orden no está disponible para recepción", 409)
  const quantities = new Map(
    input.items.map((item) => [
      item.orderItemId,
      positive(item.quantity, "quantity"),
    ])
  )
  if (!quantities.size)
    throw new CrudError("Indica al menos una cantidad recibida", 400, "items")
  const employee = await prisma.employee.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  })
  const folio = await nextFolio(organizationId, "REC", "receipt")
  return prisma.$transaction(
    async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          organizationId,
          orderId: order.id,
          folio,
          receivedBy: userId,
          notes: input.notes?.trim() || null,
        },
      })
      for (const [itemId, quantity] of quantities) {
        const item = order.items.find((row) => row.id === itemId)
        if (!item)
          throw new CrudError("Partida de orden inválida", 400, "items")
        const pending = n(item.quantity) - n(item.receivedQuantity)
        if (quantity > pending + 0.0001)
          throw new CrudError(
            `La recepción de ${item.description} supera lo pendiente (${pending})`,
            409,
            "items"
          )
        let inventory = await tx.inventory.findFirst({
          where: {
            organizationId,
            locationType: order.locationType,
            locationId: order.locationId,
            ...(item.variantId
              ? { variantId: item.variantId }
              : { productId: item.productId, variantId: null }),
          },
        })
        if (!inventory)
          inventory = await tx.inventory.create({
            data: {
              organizationId,
              locationType: order.locationType,
              locationId: order.locationId,
              productId: item.productId,
              variantId: item.variantId,
              quantity: 0,
            },
          })
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: quantity } },
        })
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQuantity: { increment: quantity } },
        })
        await tx.goodsReceiptItem.create({
          data: {
            receiptId: receipt.id,
            orderItemId: item.id,
            inventoryId: inventory.id,
            quantity,
            unitCost: item.unitCost,
          },
        })
        await tx.inventoryMovement.create({
          data: {
            organizationId,
            productId: item.productId,
            variantId: item.variantId,
            locationType: order.locationType,
            locationId: order.locationId,
            type: "purchase",
            quantity,
            reason: `Recepción ${folio} · ${order.folio}`,
            referenceId: receipt.id,
            employeeId: employee?.id ?? null,
            userId,
          },
        })
        if (item.variantId)
          await tx.productVariant.updateMany({
            where: { id: item.variantId, organizationId },
            data: { cost: item.unitCost },
          })
      }
      const refreshed = await tx.purchaseOrderItem.findMany({
        where: { orderId: order.id },
      })
      const status = receivedOrderStatus(
        refreshed.map((item) => ({
          quantity: n(item.quantity),
          receivedQuantity: n(item.receivedQuantity),
        }))
      )
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status,
          completedAt: status === "received" ? new Date() : null,
        },
      })
      return tx.goodsReceipt.findUnique({
        where: { id: receipt.id },
        include: { items: true },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}
