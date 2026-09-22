import { prisma } from "@/lib/db"
import { resolveBulkUnitPrice } from "@/lib/pos/bulk-pricing"
import type { Prisma, $Enums } from "@prisma/client"
import type {
  PosCashRegister,
  PosCashSession,
  PosCatalog,
  PosFeatures,
  PosOrder,
  PosProduct,
  PosSalePayload,
} from "@/types/pos"
import { round2 } from "./money"
import { saleArithmeticError } from "./sale-integrity"
import { bestAutoPromotion, type PricingLine } from "./pricing"
import { getWeekdaysNumber } from "./pricing-schedule"
import { customerMayUsePromotion, reservePromotionCustomerUse } from "@/lib/promotions/customer-use"
import { isFeatureEnabled, type FeatureKey } from "@/lib/features"
import type { BusinessMode } from "@/lib/auth/options"
import { maybeNotifyLowStock } from "@/lib/inventory/server"
import { consumeRecipeIngredients } from "@/lib/inventory/recipes"
import { notifySaleCompleted } from "@/lib/notifications/events"
import { notifyStaff } from "@/lib/notifications/staff"
import { broadcastTableUpdate } from "@/lib/tables/live"
import { closeKitchenOrderOnSale } from "./kitchen"

export class PosError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "PosError"
    this.status = status
  }
}

const toNum = (v: Prisma.Decimal | number | string | null): number =>
  v == null ? 0 : Number(v)

function firstActiveLocation<T extends { isActive: boolean }>(
  locations: T[]
): T | undefined {
  return locations.find((l) => l.isActive) ?? locations[0]
}

/** Compute POS features based on business mode */
function computeFeatures(mode: BusinessMode): PosFeatures {
  return {
    combos: isFeatureEnabled("combos", mode),
    productBuilder: isFeatureEnabled("product_builder", mode),
    itemNotes: isFeatureEnabled("item_notes", mode),
    tables: isFeatureEnabled("tables", mode),
    kds: isFeatureEnabled("kds", mode),
    bulkProducts: isFeatureEnabled("bulk_products", mode),
    credit: isFeatureEnabled("credit", mode),
    tips: isFeatureEnabled("tips", mode),
    splitBill: isFeatureEnabled("split_bill", mode),
  }
}

/**
 * Catálogo completo del POS para una organización/sucursal. Se serializan los
 * Decimal a number para poder pasar los datos a componentes client sin romper
 * RSC (igual que en FASE 5 con los iconos: nada no-serializable en props).
 */
export async function getPosCatalog(
  organizationId: string,
  userId: string
): Promise<PosCatalog> {
  const [
    locations,
    productsRaw,
    bulkRaw,
    categories,
    customers,
    promotions,
    registers,
    employee,
    userData,
    cashSession,
    companyProfile,
    orgLoyalty,
    combosRaw,
  ] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        address: true,
        phone: true,
      },
    }),
    prisma.productVariant.findMany({
      where: { organizationId, isActive: true, product: { isActive: true } },
      include: {
        product: {
          include: {
            category: true,
            options: {
              orderBy: { position: "asc" },
              include: {
                values: {
                  where: { isActive: true },
                  orderBy: { position: "asc" },
                },
              },
            },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { organizationId, isActive: true, productType: "bulk" },
      include: { category: true, bulkUnit: true, splitUnit: true },
    }),
    prisma.category.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, imageUrl: true },
    }),
    prisma.customer.findMany({
      where: { organizationId, isActive: true },
      orderBy: { fullName: "asc" },
      take: 1000,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        customerCode: true,
        points: true,
        imageUrl: true,
        address: true,
      },
    }),
    prisma.promotion.findMany({
      where: { organizationId, isActive: true },
      include: { targets: true },
    }),
    prisma.cashRegister.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, folioPrefix: true },
    }),
    prisma.employee.findFirst({
      where: { organizationId, userId: { equals: userId } },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    }),
    prisma.cashSession.findFirst({
      where: { organizationId, status: "open" },
      include: { cashRegister: { select: { id: true, name: true } } },
      orderBy: { openedAt: "desc" },
    }),
    prisma.companyProfile.findUnique({
      where: { organizationId },
      select: {
        tradeName: true,
        legalName: true,
        logoUrl: true,
        address: true,
        city: true,
        phone: true,
        ticketFooter: true,
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        pointsPerCurrency: true,
        pointValue: true,
        loyaltyEnabled: true,
        businessMode: true,
      },
    }),
    prisma.productCombo.findMany({
      where: { organizationId, isActive: true },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const limitedPromotionIds = promotions.filter((promotion) => promotion.maxUsesPerCustomer != null).map((promotion) => promotion.id)
  const promotionUses = limitedPromotionIds.length && customers.length
    ? await prisma.promotionCustomerUse.findMany({
        where: { organizationId, promotionId: { in: limitedPromotionIds }, customerId: { in: customers.map((customer) => customer.id) } },
        select: { promotionId: true, customerId: true, usesCount: true },
      })
    : []

  const location = firstActiveLocation(locations)
  if (!location) {
    throw new PosError(
      "No se encontró una sucursal activa para la organización",
      400
    )
  }

  // Compute features early so we can filter options and combos
  const businessMode =
    (orgLoyalty as { businessMode?: BusinessMode } | null)?.businessMode ??
    ("retail" as BusinessMode)
  const features = computeFeatures(businessMode)

  const inventoryRows = await prisma.inventory.findMany({
    where: {
      organizationId,
      locationId: location.id,
      locationType: "location",
    },
    select: { variantId: true, productId: true, quantity: true },
  })
  const variantStock = new Map<string, number>()
  const productStock = new Map<string, number>()
  for (const inv of inventoryRows) {
    const q = toNum(inv.quantity)
    if (inv.variantId) variantStock.set(inv.variantId, q)
    if (inv.productId) productStock.set(inv.productId, q)
  }

  const products: PosProduct[] = []

  // Agrupar variantes estándar por producto (una card por producto).
  const stdByProduct = new Map<string, PosProduct>()
  for (const v of productsRaw) {
    const p = v.product
    let entry = stdByProduct.get(p.id)
    if (!entry) {
      const categoryBelongsToOrganization =
        p.category?.organizationId === organizationId
      entry = {
        id: v.id,
        productId: p.id,
        variantId: v.id,
        kind: "standard",
        name: p.name,
        description: p.description ?? null,
        sku: v.sku,
        barcode: v.barcode,
        price: toNum(v.price),
        taxRate: toNum(p.taxRate),
        categoryId: categoryBelongsToOrganization ? p.categoryId : null,
        categoryName: categoryBelongsToOrganization
          ? (p.category?.name ?? null)
          : null,
        imageUrl: v.imageUrl ?? p.imageUrl,
        trackInventory: p.trackInventory,
        isAvailable: p.isAvailable,
        availabilityNote: p.availabilityNote,
        stock: variantStock.get(v.id) ?? 0,
        bulk: null,
        variantCount: 0,
        variants: [],
        options: [],
        hasOptions: false,
      }
      stdByProduct.set(p.id, entry)
    }
    entry.variants.push({
      id: v.id,
      name: v.name,
      price: toNum(v.price),
      imageUrl: v.imageUrl ?? p.imageUrl,
      stock: variantStock.get(v.id) ?? 0,
      isActive: v.isActive,
      isAvailable: v.isAvailable,
    })
  }
  products.push(...stdByProduct.values())

  // Elegir la variante "default" de cada producto (la activa "Default", o la primera activa).
  for (const p of products) {
    p.variantCount = p.variants.length
    const def =
      p.variants.find((v) => v.name === "Default" && v.isActive) ??
      p.variants.find((v) => v.isActive) ??
      p.variants[0]
    if (def) {
      p.id = def.id
      p.variantId = def.id
      p.price = def.price
      p.imageUrl = def.imageUrl
      p.stock = def.stock
      // NO mutar p.name — el cliente construye el displayName con product.name + variant.name
    }
  }

  for (const p of bulkRaw) {
    const categoryBelongsToOrganization =
      p.category?.organizationId === organizationId
    products.push({
      id: p.id,
      productId: p.id,
      variantId: null,
      kind: "bulk",
      name: p.name,
      description: p.description ?? null,
      sku: null,
      barcode: null,
      price: toNum(p.bulkPricePerUnit),
      taxRate: toNum(p.taxRate),
      categoryId: categoryBelongsToOrganization ? p.categoryId : null,
      categoryName: categoryBelongsToOrganization
        ? (p.category?.name ?? null)
        : null,
      imageUrl: p.imageUrl,
      trackInventory: p.trackInventory,
      isAvailable: p.isAvailable,
      availabilityNote: p.availabilityNote,
      stock: productStock.get(p.id) ?? 0,
      variantCount: 0,
      variants: [],
      bulk: {
        unitId: p.bulkUnitId ?? "",
        unitName: p.bulkUnit?.name ?? "Kilogramo",
        unitAbbrev: p.bulkUnit?.abbreviation ?? "kg",
        minQty: toNum(p.bulkMinQuantity),
        step: toNum(p.bulkStep),
        maxQty: toNum(p.bulkMaxQuantity) || 0,
        allowSplit: p.allowSplit,
        split:
          p.allowSplit && p.splitUnit
            ? {
                unitId: p.splitUnit.id,
                unitName: p.splitUnit.name,
                unitAbbrev: p.splitUnit.abbreviation,
                price: toNum(p.splitPricePerUnit),
              }
            : null,
      },
      options: [],
      hasOptions: false,
    })
  }

  products.sort(
    (a, b) =>
      (a.categoryName ?? "").localeCompare(b.categoryName ?? "") ||
      a.name.localeCompare(b.name)
  )

  const categoriesWithCount = categories.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    productCount: products.filter((p) => p.categoryId === c.id).length,
  }))

  const registersMapped: PosCashRegister[] = registers.map((r) => ({
    id: r.id,
    name: r.name,
    folioPrefix: r.folioPrefix,
  }))

  const session: PosCashSession | null = cashSession
    ? {
        id: cashSession.id,
        status: cashSession.status,
        openingCash: toNum(cashSession.openingCash),
        openedAt: cashSession.openedAt.toISOString(),
        closingCash:
          cashSession.closingCash == null
            ? null
            : toNum(cashSession.closingCash),
        closedAt: cashSession.closedAt?.toISOString() ?? null,
        registerId: cashSession.cashRegister.id,
        registerName: cashSession.cashRegister.name,
      }
    : null

  // Add options to each product (only if productBuilder feature is enabled
  // AND the product is tipo "custom": los productos estándar/granel nunca
  // llevan tópicos en el POS, solo los personalizados abren el constructor).
  for (const p of products) {
    const raw = productsRaw.find((v) => v.productId === p.productId)
    if (
      features.productBuilder &&
      raw?.product?.productType === "custom" &&
      raw?.product?.options
    ) {
      p.options = raw.product.options.map((o) => ({
        id: o.id,
        name: o.name,
        required: o.required,
        minSelect: o.minSelect,
        maxSelect: o.maxSelect,
        position: o.position,
        values: o.values.map((v) => ({
          id: v.id,
          value: v.value,
          extraPrice: toNum(v.extraPrice),
          imageUrl: v.imageUrl ?? null,
          isActive: v.isActive,
        })),
      }))
      p.hasOptions = p.options.length > 0
    } else {
      p.options = []
      p.hasOptions = false
    }
  }

  // Map combos (filtered by feature)
  const combos: PosCatalog["combos"] = features.combos
    ? combosRaw.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        comboPrice: toNum(c.comboPrice),
        items: c.items.map((ci) => ({
          id: ci.id,
          productId: ci.productId,
          productName: ci.product.name,
          variantId: ci.variantId,
          variantName: ci.variant?.name ?? null,
          quantity: toNum(ci.quantity),
          extraPrice: toNum(ci.extraPrice),
          position: ci.position,
        })),
      }))
    : []

  return {
    location: {
      id: location.id,
      name: location.name,
      code: location.code,
      address: location.address ?? null,
      phone: location.phone ?? null,
    },
    company: {
      name: companyProfile?.tradeName ?? companyProfile?.legalName ?? null,
      logoUrl: companyProfile?.logoUrl ?? null,
      address: companyProfile?.address ?? null,
      city: companyProfile?.city ?? null,
      phone: companyProfile?.phone ?? null,
      ticketFooter: companyProfile?.ticketFooter ?? null,
    },
    products,
    categories: categoriesWithCount,
    customers: customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      customerCode: c.customerCode,
      points: toNum(c.points),
      imageUrl: c.imageUrl,
      address: c.address,
    })),
    promotions: promotions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      descriptionFinal: p.descriptionFinal,
      benefit: p.benefit,
      scope: p.scope,
      value: toNum(p.value),
      buyQuantity: p.buyQuantity,
      getQuantity: p.getQuantity,
      minAmount: toNum(p.minAmount),
      minQuantity: toNum(p.minQuantity),
      couponCode: p.couponCode,
      requiresCustomer: p.requiresCustomer,
      priority: p.priority,
      exclusive: p.exclusive,
      maxUses: p.maxUses,
      maxUsesPerCustomer: p.maxUsesPerCustomer,
      usesCount: p.usesCount,
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
      weekdays: p.weekdays,
      startTime: p.startTime,
      endTime: p.endTime,
      targets: p.targets.map((t) => ({ kind: t.kind, targetId: t.targetId })),
    })),
    promotionUses,
    registers: registersMapped,
    session,
    cashier: {
      userId,
      employeeId: employee?.id ?? null,
      name: userData?.fullName ?? "",
    },
    combos,
    loyalty: {
      pointValue: toNum(orgLoyalty?.pointValue ?? null),
      pointsPerCurrency: toNum(orgLoyalty?.pointsPerCurrency ?? null),
      enabled: orgLoyalty?.loyaltyEnabled ?? true,
    },
    features,
  }
}

const ORDER_STATUSES: $Enums.OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
]

export async function getRecentOrders(
  organizationId: string,
  locationId: string
): Promise<PosOrder[]> {
  const orders = await prisma.order.findMany({
    where: { organizationId, locationId },
    include: {
      customer: { select: { fullName: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
  return orders
    .map((o) => ({
      id: o.id,
      orderNumber: `#${Number(o.orderNumber)}`,
      status: o.status,
      deliveryMethod: o.deliveryMethod,
      customerName: o.customer?.fullName ?? null,
      itemsCount: o.items.length,
      total: toNum(o.total),
      createdAt: o.createdAt.toISOString(),
    }))
    .sort(
      (a, b) =>
        ORDER_STATUSES.indexOf(a.status) - ORDER_STATUSES.indexOf(b.status) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
}

export async function getSalesStats(
  organizationId: string,
  locationId: string
) {
  const [todayStart, session] = await Promise.all([
    prisma.sale.findMany({
      where: {
        organizationId,
        locationId,
        status: "completed",
        createdAt: { gte: startOfDay() },
      },
      select: { total: true },
    }),
    prisma.cashSession.findFirst({
      where: { organizationId, cashRegister: { locationId }, status: "open" },
      include: {
        sales: {
          where: { status: "completed" },
          select: { total: true, payments: true, changeGiven: true },
        },
        saleReturns: {
          where: { status: "completed", returnType: "refund" },
          select: {
            refundPayments: {
              where: { method: "cash" },
              select: { amount: true },
            },
          },
        },
      },
    }),
  ])

  const sessionCashData = session
    ? {
        sales: session.sales.length,
        cashPayments: round2(
          session.sales.reduce(
            (acc, s) =>
              acc +
              s.payments
                .filter((p) => p.method === "cash")
                .reduce((x, p) => x + toNum(p.amount), 0),
            0
          )
        ),
        changeGiven: round2(
          session.sales.reduce((acc, s) => acc + toNum(s.changeGiven), 0)
        ),
        cashRefunds: round2(
          session.saleReturns.reduce(
            (sum, ret) =>
              sum +
              ret.refundPayments.reduce(
                (subtotal, payment) => subtotal + toNum(payment.amount),
                0
              ),
            0
          )
        ),
      }
    : null

  return {
    todaySales: todayStart.reduce((acc, s) => acc + toNum(s.total), 0),
    todayCount: todayStart.length,
    session: sessionCashData,
  }
}

function startOfDay(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

export async function validateCoupon(
  organizationId: string,
  code: string,
  customerId?: string
): Promise<
  | {
      ok: true
      label: string
      percent?: number
      amount: number
      couponId?: string
      promotionId?: string
    }
  | { ok: false; error: string }
> {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return { ok: false, error: "Ingresa un código de cupón" }

  const coupon = await prisma.coupon.findFirst({
    where: { organizationId, code: trimmed },
  })
  if (coupon) {
    if (coupon.redeemedAt)
      return { ok: false, error: "Este cupón ya fue utilizado" }
    if (coupon.expiresAt && coupon.expiresAt < new Date())
      return { ok: false, error: "Este cupón está vencido" }
    if (coupon.customerId && (!customerId || coupon.customerId !== customerId))
      return { ok: false, error: "Este cupón pertenece a otro cliente" }
    return {
      ok: true,
      label: `Cupón ${trimmed}`,
      amount: toNum(coupon.amount),
      percent: toNum(coupon.percent) > 0 ? toNum(coupon.percent) : undefined,
      couponId: coupon.id,
      promotionId: coupon.promotionId ?? undefined,
    }
  }

  const promo = await prisma.promotion.findFirst({
    where: { organizationId, couponCode: trimmed, isActive: true },
  })
  if (promo) {
    if (promo.endsAt && promo.endsAt < new Date())
      return { ok: false, error: "Este cupón está vencido" }
    if (promo.maxUses != null && promo.usesCount >= promo.maxUses)
      return { ok: false, error: "Este cupón alcanzó su límite de usos" }
    const percent = promo.benefit === "percent_off" ? toNum(promo.value) : 0
    const amount = promo.benefit === "amount_off" ? toNum(promo.value) : 0
    if (!percent && !amount)
      return { ok: false, error: "Este cupón no aplica como descuento" }
    return {
      ok: true,
      label: promo.name,
      percent: percent > 0 ? percent : undefined,
      amount,
      promotionId: promo.id,
    }
  }

  return { ok: false, error: "Cupón no válido" }
}

function nextPurchaseCoupons(payload: PosSalePayload) {
  return payload.nextPurchaseCoupon
    ? [
        {
          promotionId: payload.nextPurchaseCoupon.promotionId,
          amount: payload.nextPurchaseCoupon.amount,
        },
      ]
    : []
}

/** Valida referencias y precios contra el catálogo de la organización. */
async function validateSaleAmounts(
  organizationId: string,
  payload: PosSalePayload
) {
  const trustedLines: { subtotal: number; taxRate: number }[] = []
  const pricingLines: PricingLine[] = []
  for (const item of payload.items) {
    if (
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100000
    ) {
      throw new PosError("Cantidad inválida", 400)
    }
    const variant = item.variantId
      ? await prisma.productVariant.findFirst({
          where: {
            id: item.variantId,
            productId: item.productId,
            organizationId,
            isActive: true,
            isAvailable: true,
            product: { isAvailable: true },
          },
          include: {
            product: {
              select: {
                categoryId: true,
                taxRate: true,
                productType: true,
                isActive: true,
                bulkPricePerUnit: true,
                bulkUnitId: true,
                allowSplit: true,
                splitUnitId: true,
                splitPricePerUnit: true,
              },
            },
          },
        })
      : null
    const product = variant
      ? variant.product
      : await prisma.product.findFirst({
          where: {
            id: item.productId,
            organizationId,
            isActive: true,
            isAvailable: true,
          },
          select: {
            categoryId: true,
            taxRate: true,
            productType: true,
            isActive: true,
            bulkPricePerUnit: true,
            bulkUnitId: true,
            allowSplit: true,
            splitUnitId: true,
            splitPricePerUnit: true,
            variants: {
              where: { isActive: true },
              take: 1,
              select: { price: true },
            },
          },
        })
    if (!product || !product.isActive || (item.variantId && !variant)) {
      throw new PosError("Producto o variante no disponible", 400)
    }
    const basePrice = variant
      ? toNum(variant.price)
      : product.productType === "bulk"
        ? (() => {
            try {
              return resolveBulkUnitPrice(
                {
                  bulkUnitId: product.bulkUnitId,
                  bulkPricePerUnit: toNum(product.bulkPricePerUnit),
                  allowSplit: product.allowSplit,
                  splitUnitId: product.splitUnitId,
                  splitPricePerUnit: toNum(product.splitPricePerUnit),
                },
                item.unitId
              )
            } catch (error) {
              throw new PosError(
                error instanceof Error ? error.message : "Unidad de venta inválida",
                400
              )
            }
          })()
        : toNum(
            (product as { variants?: { price: Prisma.Decimal }[] })
              .variants?.[0]?.price ?? 0
          )
    let optionsExtra = 0
    if (Array.isArray(item.selectedOptions) && item.selectedOptions.length) {
      const valueIds = item.selectedOptions.flatMap(
        (option) => option.valueIds ?? []
      )
      if (!valueIds.length)
        throw new PosError(
          "Las opciones del producto deben volver a seleccionarse",
          400
        )
      const values = await prisma.productOptionValue.findMany({
        where: {
          id: { in: valueIds },
          isActive: true,
          option: { productId: item.productId },
        },
        select: { id: true, extraPrice: true },
      })
      if (values.length !== new Set(valueIds).size) {
        throw new PosError("Una opción elegida ya no está disponible", 409)
      }
      optionsExtra = values.reduce(
        (sum, value) => sum + Math.max(0, toNum(value.extraPrice)),
        0
      )
    }
    const trustedUnitPrice = round2(basePrice + optionsExtra)
    if (Math.abs(Number(item.unitPrice) - trustedUnitPrice) > 0.01) {
      throw new PosError(`Precio inválido para ${item.productName}`, 400)
    }
    const lineSubtotal = round2(item.quantity * trustedUnitPrice)
    if (Math.abs(Number(item.totalPrice) - lineSubtotal) > 0.01) {
      throw new PosError("Importe de línea inválido", 400)
    }
    if (Math.abs(Number(item.taxRate) - toNum(product.taxRate)) > 0.0001) {
      throw new PosError("Impuesto de producto inválido", 400)
    }
    trustedLines.push({ subtotal: lineSubtotal, taxRate: toNum(product.taxRate) })
    pricingLines.push({ key: `${item.productId}:${item.variantId ?? ""}`, productId: item.productId, variantId: item.variantId, categoryId: product.categoryId, qty: item.quantity, unitPrice: trustedUnitPrice, taxRate: toNum(product.taxRate) })
  }
  const arithmeticError = saleArithmeticError(payload, trustedLines)
  if (arithmeticError) throw new PosError(arithmeticError, 400)
  if (!Number.isFinite(payload.pointsRedeemedValue)) throw new PosError("Puntos inválidos", 400)

  const promotions = await prisma.promotion.findMany({
    where: { organizationId, isActive: true },
    include: { targets: { select: { kind: true, targetId: true } } },
  })
  const available = promotions.map((promotion) => ({
    id: promotion.id, name: promotion.name, description: promotion.description,
    descriptionFinal: promotion.descriptionFinal, benefit: promotion.benefit, scope: promotion.scope,
    value: toNum(promotion.value), buyQuantity: promotion.buyQuantity, getQuantity: promotion.getQuantity,
    minAmount: toNum(promotion.minAmount), minQuantity: toNum(promotion.minQuantity),
    couponCode: promotion.couponCode, requiresCustomer: promotion.requiresCustomer,
    priority: promotion.priority, exclusive: promotion.exclusive, maxUses: promotion.maxUses,
    maxUsesPerCustomer: promotion.maxUsesPerCustomer, usesCount: promotion.usesCount,
    startsAt: promotion.startsAt?.toISOString() ?? null, endsAt: promotion.endsAt?.toISOString() ?? null,
    weekdays: promotion.weekdays, startTime: promotion.startTime, endTime: promotion.endTime,
    targets: promotion.targets,
  }))
  const customerUses = payload.customerId ? await prisma.promotionCustomerUse.findMany({
    where: { organizationId, customerId: payload.customerId },
    select: { promotionId: true, usesCount: true },
  }) : []
  const usesByPromotion = new Map(customerUses.map((entry) => [entry.promotionId, entry.usesCount]))
  const eligible = available.filter((promotion) => customerMayUsePromotion(
    promotion.maxUsesPerCustomer, payload.customerId, usesByPromotion.get(promotion.id) ?? 0
  ))
  const customer = payload.customerId ? { id: payload.customerId, fullName: "", phone: null, email: null, customerCode: null, points: 0, imageUrl: null, address: null } : null
  const auto = bestAutoPromotion(eligible, pricingLines, customer)
  const coupon = payload.couponCode ? await validateCoupon(organizationId, payload.couponCode, payload.customerId) : null
  if (coupon && !coupon.ok) throw new PosError(coupon.error, 409)
  let seenAuto = false
  let seenCoupon = false
  for (const discount of payload.discounts.filter((entry) => entry.promotionId)) {
    if (auto.promotionId === discount.promotionId && !seenAuto && discount.amount <= auto.discount + 0.01) {
      seenAuto = true
      continue
    }
    const couponAmount = coupon?.ok ? (coupon.percent != null ? round2(payload.subtotal * coupon.percent / 100) : coupon.amount) : 0
    if (coupon?.ok && coupon.promotionId === discount.promotionId && !seenCoupon && discount.amount <= couponAmount + 0.01) {
      seenCoupon = true
      continue
    }
    throw new PosError("La promoción enviada no aplica al ticket actual", 409)
  }
  if (payload.nextPurchaseCoupon) {
    const couponPromotion = eligible.find((entry) => entry.id === payload.nextPurchaseCoupon?.promotionId)
    const now = new Date()
    const matchingTargets = couponPromotion?.scope === "order" ||
      couponPromotion?.targets.some((target) => pricingLines.some((line) =>
        (target.kind === "category" && line.categoryId === target.targetId) ||
        (target.kind === "product" && line.productId === target.targetId)
      ))
    const weekdays = getWeekdaysNumber(couponPromotion?.weekdays ?? null)
    const valid = couponPromotion?.benefit === "next_purchase_coupon" && matchingTargets &&
      (!couponPromotion.requiresCustomer || Boolean(payload.customerId)) &&
      payload.subtotal >= couponPromotion.minAmount &&
      (!couponPromotion.startsAt || now >= new Date(couponPromotion.startsAt)) &&
      (!couponPromotion.endsAt || now <= new Date(couponPromotion.endsAt)) &&
      (!weekdays.length || weekdays.includes(now.getDay())) &&
      (couponPromotion.maxUses == null || couponPromotion.usesCount < couponPromotion.maxUses)
    const expectedAmount = couponPromotion ? (couponPromotion.value || Math.round(Math.max(0, payload.total - payload.pointsRedeemedValue) * 0.1)) : 0
    if (!valid || !Number.isFinite(payload.nextPurchaseCoupon.amount) ||
        Math.abs(payload.nextPurchaseCoupon.amount - expectedAmount) > 0.01) {
      throw new PosError("El cupón de próxima compra ya no aplica al ticket", 409)
    }
  }
}

export async function createSale(
  organizationId: string,
  locationId: string,
  payload: PosSalePayload,
  ctx: { userId: string; employeeId: string | null }
): Promise<{ id: string; saleNumber: string; locationName: string }> {
  if (!payload.items.length) throw new PosError("El ticket está vacío", 400)

  await validateSaleAmounts(organizationId, payload)

  const payable = round2(payload.total - payload.pointsRedeemedValue)
  const paid = round2(payload.payments.reduce((acc, p) => acc + p.amount, 0))
  if (round2(paid - payable) < -0.01) {
    throw new PosError("Los pagos no cubren el total", 400)
  }

  const result = await prisma.$transaction(async (tx) => {
    const loc = await tx.location.findFirst({
      where: { id: locationId, organizationId },
    })
    if (!loc) throw new PosError("Sucursal no encontrada", 400)

    // Reservar secuencia de ticket por sucursal (6.12 – folio).
    await tx.location.update({
      where: { id: locationId },
      data: { saleSeq: { increment: 1 } },
    })
    const updated = await tx.location.findUniqueOrThrow({
      where: { id: locationId },
    })
    const locationSaleNumber = updated.saleSeq

    // Validar y descontar inventario (6.12 – ticket correcto/posible error de stock).
    for (const item of payload.items) {
      if (!item.trackInventory) continue
      const inv = item.variantId
        ? await tx.inventory.findUnique({
            where: {
              variantId_locationId_locationType: {
                variantId: item.variantId,
                locationId,
                locationType: "location",
              },
            },
          })
        : await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              locationId,
              locationType: "location",
            },
          })
      if (!inv)
        throw new PosError(
          `Sin inventario registrado para ${item.productName}`,
          400
        )
      const current = toNum(inv.quantity)
      if (current < item.quantity) {
        throw new PosError(
          `Stock insuficiente para ${item.productName} (disponible ${current})`,
          409
        )
      }
    }

    const sale = await tx.sale.create({
      data: {
        organizationId,
        locationId,
        cashSessionId: payload.cashSessionId,
        cashRegisterId: payload.cashRegisterId,
        cashierId: ctx.userId,
        employeeId: ctx.employeeId,
        customerId: payload.customerId,
        locationSaleNumber,
        subtotal: payload.subtotal,
        discount: payload.discount,
        tax: payload.tax,
        total: payload.total,
        tip: payload.tip ?? 0,
        pointsEarned: payload.pointsEarned,
        pointsRedeemed: payload.pointsRedeemed,
        changeGiven: payload.changeGiven,
        status: "completed",
        notes: payload.notes,
      },
    })

    if (payload.items.length) {
      await tx.saleItem.createMany({
        data: payload.items.map((i) => ({
          saleId: sale.id,
          productId: i.productId,
          variantId: i.variantId,
          productName: i.productName,
          variantName: i.variantName,
          productType: i.productType,
          quantity: i.quantity,
          unitId: i.unitId,
          unitPrice: i.unitPrice,
          unitCost: null,
          totalPrice: i.totalPrice,
          discount: i.discount,
          taxRate: i.taxRate,
          lineTotal: i.lineTotal,
          bulkQuantityDisplay: i.bulkQuantityDisplay,
          notes: i.notes ?? undefined,
          selectedOptions: i.selectedOptions
            ? JSON.parse(JSON.stringify(i.selectedOptions))
            : undefined,
          extraPrice: i.extraPrice ?? 0,
        })),
      })
    }

    if (payload.payments.length) {
      await tx.salePayment.createMany({
        data: payload.payments.map((p) => ({
          saleId: sale.id,
          method: p.method,
          amount: p.amount,
          reference: p.reference,
        })),
      })
    }

    if (payload.discounts.length) {
      await tx.saleDiscount.createMany({
        data: payload.discounts.map((d) => ({
          saleId: sale.id,
          promotionId: d.promotionId,
          label: d.label,
          amount: d.amount,
        })),
      })
    }
    const issuedCoupon = payload.couponCode ? await tx.coupon.findFirst({
      where: { organizationId, code: payload.couponCode.trim().toUpperCase() },
      select: { promotionId: true },
    }) : null
    for (const d of payload.discounts) {
      if (d.promotionId) {
        // El cupón de próxima compra ya contó al emitirse; redimirlo no es
        // un segundo uso de la promoción original.
        if (issuedCoupon?.promotionId === d.promotionId) continue
        const promotion = await tx.promotion.findFirst({ where: { id: d.promotionId, organizationId, isActive: true }, select: { maxUses: true, maxUsesPerCustomer: true } })
        if (!promotion) throw new PosError("La promoción ya no está disponible", 409)
        const used = await tx.promotion.updateMany({
          where: { id: d.promotionId, organizationId, isActive: true, ...(promotion.maxUses != null ? { usesCount: { lt: promotion.maxUses } } : {}) },
          data: { usesCount: { increment: 1 } },
        })
        if (!used.count) throw new PosError("La promoción alcanzó su límite de usos", 409)
        if (!(await reservePromotionCustomerUse(tx, organizationId, d.promotionId, payload.customerId, promotion.maxUsesPerCustomer))) {
          throw new PosError("Este cliente alcanzó el límite de usos de la promoción", 409)
        }
      }
    }

    // Descontar inventario y registrar movimientos.
    const touchedInventoryIds: string[] = []
    for (const item of payload.items) {
      if (!item.trackInventory) continue
      const inv = item.variantId
        ? await tx.inventory.update({
            where: {
              variantId_locationId_locationType: {
                variantId: item.variantId,
                locationId,
                locationType: "location",
              },
            },
            data: {
              quantity: { decrement: item.quantity },
              updatedAt: new Date(),
            },
          })
        : await tx.inventory
            .findFirst({
              where: {
                productId: item.productId,
                locationId,
                locationType: "location",
              },
            })
            .then((r) =>
              r
                ? tx.inventory.update({
                    where: { id: r.id },
                    data: {
                      quantity: { decrement: item.quantity },
                      updatedAt: new Date(),
                    },
                  })
                : null
            )
      if (!inv)
        throw new PosError(
          `Sin inventario registrado para ${item.productName}`,
          400
        )
      touchedInventoryIds.push(inv.id)
      await tx.inventoryMovement.create({
        data: {
          organizationId,
          productId: item.variantId ? null : item.productId,
          variantId: item.variantId ?? null,
          locationId,
          locationType: "location",
          type: "sale",
          quantity: -item.quantity,
          unitId: item.unitId,
          reason: "Venta POS",
          referenceId: sale.id,
          userId: ctx.userId,
          employeeId: ctx.employeeId,
        },
      })
    }

    await consumeRecipeIngredients(
      tx,
      organizationId,
      locationId,
      sale.id,
      ctx.userId,
      payload.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions,
      }))
    )

    // Redimir cupón si aplica (6.8).
    if (payload.couponCode) {
      await redeemCouponTx(tx, organizationId, payload.couponCode, sale.id)
    }

    // Generar cupón de próxima compra cuando una promoción lo otorga (6.8).
    for (const np of nextPurchaseCoupons(payload)) {
      const code = await nextCouponCode(tx, organizationId)
      await tx.coupon.create({
        data: {
          organizationId,
          promotionId: np.promotionId,
          code,
          amount: np.amount,
          customerId: payload.customerId ?? null,
          expiresAt: addDays(new Date(), 30),
        },
      })
      const promotion = await tx.promotion.findFirst({ where: { id: np.promotionId, organizationId, isActive: true }, select: { maxUses: true, maxUsesPerCustomer: true } })
      if (!promotion) throw new PosError("El cupón ya no está disponible", 409)
      const used = await tx.promotion.updateMany({
        where: { id: np.promotionId, organizationId, isActive: true, ...(promotion.maxUses != null ? { usesCount: { lt: promotion.maxUses } } : {}) },
        data: { usesCount: { increment: 1 } },
      })
      if (!used.count) throw new PosError("El cupón alcanzó su límite de usos", 409)
      if (!(await reservePromotionCustomerUse(tx, organizationId, np.promotionId, payload.customerId, promotion.maxUsesPerCustomer))) {
        throw new PosError("Este cliente alcanzó el límite de usos de la promoción", 409)
      }
    }

    // Una venta cobrada a crédito genera automáticamente la cuenta por cobrar.
    // Se ejecuta dentro de la misma transacción de la venta para que nunca exista
    // una venta a crédito sin su saldo, ni un saldo si la venta falla.
    const creditAmount = round2(
      (payload.payments ?? [])
        .filter((payment) => payment.method === "credit")
        .reduce((sum, payment) => sum + payment.amount, 0)
    )
    if (creditAmount > 0) {
      if (!payload.customerId) throw new PosError("Selecciona un cliente para vender a crédito", 400)
      const policy = await tx.creditPolicy.findUnique({ where: { organizationId } })
      if (!policy?.creditEnabled) throw new PosError("Las ventas a crédito no están habilitadas", 409)
      const account = await tx.customerCredit.upsert({
        where: { customerId: payload.customerId },
        create: { organizationId, customerId: payload.customerId, creditLimit: policy.defaultLimit, useDefaultLimit: true },
        update: {},
      })
      if (["suspended", "closed"].includes(account.status)) throw new PosError("La cuenta de crédito del cliente está bloqueada", 409)
      const limit = account.useDefaultLimit ? policy.defaultLimit : account.creditLimit
      const balanceAfter = round2(Number(account.currentBalance) + creditAmount)
      if (limit != null && balanceAfter > Number(limit)) throw new PosError(`Límite de crédito excedido. Disponible: $${Math.max(0, Number(limit) - Number(account.currentBalance)).toFixed(2)}`, 409)
      const reserved = await tx.customerCredit.updateMany({
        where: { id: account.id, status: { notIn: ["suspended", "closed"] }, ...(limit != null ? { currentBalance: { lte: Number(limit) - creditAmount } } : {}) },
        data: { currentBalance: { increment: creditAmount }, status: "active" },
      })
      if (!reserved.count) throw new PosError("El crédito disponible cambió. Revisa el saldo e intenta de nuevo", 409)
      const updatedCredit = await tx.customerCredit.findUniqueOrThrow({ where: { id: account.id }, select: { currentBalance: true } })
      await tx.creditTransaction.create({
        data: {
          creditId: account.id,
          customerId: payload.customerId,
          organizationId,
          type: "charge",
          amount: creditAmount,
          balanceAfter: updatedCredit.currentBalance,
          description: `Venta POS #${sale.saleNumber}`,
          referenceType: "sale",
          referenceId: sale.id,
          dueDate: new Date(Date.now() + policy.maxDaysToPay * 86400000),
        },
      })
    }

    // Loyalty: ganar y/o canjear puntos (6.7 / 6.10).
    // Si la venta es a crédito y la política indica que el crédito NO genera puntos, suprimir.
    let effectivePointsEarned = payload.pointsEarned
    if (
      effectivePointsEarned > 0 &&
      payload.payments?.some((p) => p.method === "credit")
    ) {
      const creditPolicy = await tx.creditPolicy.findUnique({
        where: { organizationId },
        select: { creditEarnsPoints: true },
      })
      if (creditPolicy && !creditPolicy.creditEarnsPoints) {
        effectivePointsEarned = 0
        // Actualizar el registro de venta con los puntos efectivos
        await tx.sale.update({
          where: { id: sale.id },
          data: { pointsEarned: 0 },
        })
      }
    }

    if (payload.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: payload.customerId, organizationId },
        select: { id: true },
      })
      if (customer) {
        if (effectivePointsEarned > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { points: { increment: effectivePointsEarned } },
          })
          await tx.loyaltyTransaction.create({
            data: {
              organizationId,
              customerId: customer.id,
              saleId: sale.id,
              kind: "earn",
              points: effectivePointsEarned,
              note: "Venta POS",
            },
          })
        }
        if (payload.pointsRedeemed > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { points: { decrement: payload.pointsRedeemed } },
          })
          await tx.loyaltyTransaction.create({
            data: {
              organizationId,
              customerId: customer.id,
              saleId: sale.id,
              kind: "redeem",
              points: payload.pointsRedeemed,
              note: "Canje en POS",
            },
          })
        }
      }
    }

    return { sale, locationName: loc.name, touchedInventoryIds }
  })

  await Promise.all(
    (result.touchedInventoryIds ?? []).map((id) =>
      maybeNotifyLowStock(organizationId, id, {
        userId: ctx.userId,
        employeeId: ctx.employeeId,
      })
    )
  )

  // Asociar mesa si se seleccionó (food_service): ocupar → cobrar → liberar.
  if (payload.tableId && !payload.tableId.startsWith("manual-")) {
    const freedTable = await prisma.table.update({
      where: { id: payload.tableId },
      data: { status: "free" },
      include: { location: { select: { name: true } } },
    })
    broadcastTableUpdate(organizationId, {
      id: freedTable.id,
      number: freedTable.number,
      name: freedTable.name,
      capacity: freedTable.capacity,
      status: freedTable.status,
      location: freedTable.location,
      updatedAt: freedTable.updatedAt.toISOString(),
    })
    // Cerrar sesión de mesa activa si existe (el cobro la finaliza).
    const activeSession = await prisma.tableSession.findFirst({
      where: { tableId: payload.tableId, endedAt: null },
    })
    if (activeSession) {
      await prisma.tableSession.update({
        where: { id: activeSession.id },
        data: { endedAt: new Date() },
      })
    }
    // Cerrar la orden de cocina de la mesa si el ticket se envió al KDS:
    // liga la venta (saleId + paidAt) y la saca de la pantalla de cocina.
    await closeKitchenOrderOnSale(
      organizationId,
      payload.tableId,
      result.sale.id,
      {
        userId: ctx.userId,
        employeeId: ctx.employeeId,
      }
    )
  }

  // Notificar venta completada por SSE (11.6) — fuera de la transacción.
  await notifySaleCompleted(organizationId, result.sale.locationId, ctx, {
    locationSaleNumber:
      result.sale.locationSaleNumber == null
        ? null
        : Number(result.sale.locationSaleNumber),
    saleNumber: String(result.sale.saleNumber),
    total: toNum(result.sale.total),
    locationName: result.locationName,
  })
  if (payload.payments?.some((payment) => payment.method === "credit")) {
    await notifyStaff(organizationId, "orders.view", { kind: "credit_charge", title: "Nueva venta a crédito", body: `Venta ${result.sale.saleNumber} · ${toNum(result.sale.total).toFixed(2)}`, link: "/admin/credits", excludeUserId: ctx.userId ?? undefined }).catch((error) => console.error("[credit/notification]", error))
  }

  return {
    id: result.sale.id,
    saleNumber: `#${Number(result.sale.locationSaleNumber)}`,
    locationName: result.locationName,
  }
}

async function redeemCouponTx(
  tx: Prisma.TransactionClient,
  organizationId: string,
  code: string,
  saleId: string
) {
  const trimmed = code.trim().toUpperCase()
  const coupon = await tx.coupon.findFirst({
    where: { organizationId, code: trimmed },
  })
  if (coupon && !coupon.redeemedAt) {
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { redeemedAt: new Date(), redeemedSaleId: saleId },
    })
  }
  return coupon?.promotionId ?? null
}

async function nextCouponCode(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<string> {
  const count = await tx.coupon.count({ where: { organizationId } })
  const candidate = `NEXT-${1000 + count + 1}`
  const existing = await tx.coupon.findFirst({
    where: { organizationId, code: candidate },
  })
  return existing ? `NEXT-${Date.now()}` : candidate
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

export async function getCurrentCashSession(
  organizationId: string,
  locationId: string
) {
  const s = await prisma.cashSession.findFirst({
    where: { organizationId, cashRegister: { locationId }, status: "open" },
    include: { cashRegister: { select: { id: true, name: true } } },
    orderBy: { openedAt: "desc" },
  })
  return s
    ? {
        id: s.id,
        status: s.status,
        openingCash: toNum(s.openingCash),
        openedAt: s.openedAt.toISOString(),
        closingCash: s.closingCash == null ? null : toNum(s.closingCash),
        closedAt: s.closedAt?.toISOString() ?? null,
        registerId: s.cashRegister.id,
        registerName: s.cashRegister.name,
      }
    : null
}

export async function openCashSession(
  organizationId: string,
  locationId: string,
  registerId: string,
  openingCash: number,
  userId: string
) {
  const existing = await prisma.cashSession.findFirst({
    where: { organizationId, cashRegister: { locationId }, status: "open" },
  })
  if (existing)
    return {
      created: false,
      session: await getCurrentCashSession(organizationId, locationId),
    }

  const reg = await prisma.cashRegister.findFirst({
    where: { id: registerId, organizationId, locationId },
  })
  if (!reg) throw new PosError("Caja no encontrada en la sucursal", 400)

  const session = await prisma.cashSession.create({
    data: {
      organizationId,
      locationId,
      cashRegisterId: registerId,
      openingCash: round2(openingCash),
      userId,
      openedBy: userId,
      status: "open",
    },
  })
  return {
    created: true,
    session: {
      id: session.id,
      status: session.status as $Enums.CashSessionStatus,
      openingCash: toNum(session.openingCash),
      openedAt: session.openedAt.toISOString(),
      closingCash: null,
      closedAt: null,
      registerId,
      registerName: reg.name,
    },
  }
}

export async function closeCashSession(
  organizationId: string,
  sessionId: string,
  closingCash: number,
  notes?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findFirst({
      where: { id: sessionId, organizationId, status: "open" },
    })
    if (!session) throw new PosError("La caja no está abierta", 400)

    const sales = await tx.sale.findMany({
      where: { cashSessionId: session.id, status: "completed" },
      include: { payments: true },
      orderBy: { createdAt: "asc" },
    })

    const cashPayments = round2(
      sales.reduce(
        (acc, s) =>
          acc +
          s.payments
            .filter((p) => p.method === "cash")
            .reduce((x, p) => x + toNum(p.amount), 0),
        0
      )
    )
    const changeGiven = round2(
      sales.reduce((acc, s) => acc + toNum(s.changeGiven), 0)
    )
    const cashRefunds = round2(
      toNum(
        (
          await tx.saleReturnPayment.aggregate({
            where: {
              method: "cash",
              return: {
                organizationId,
                cashSessionId: session.id,
                status: "completed",
                returnType: "refund",
              },
            },
            _sum: { amount: true },
          })
        )._sum.amount
      )
    )
    const totalSales = round2(sales.reduce((acc, s) => acc + toNum(s.total), 0))
    const expectedCash = round2(
      toNum(session.openingCash) + cashPayments - changeGiven - cashRefunds
    )

    const updated = await tx.cashSession.update({
      where: { id: session.id },
      data: {
        closingCash: round2(closingCash),
        systemCash: round2(expectedCash),
        notes,
        closedAt: new Date(),
        status: "closed",
      },
    })

    return {
      id: updated.id,
      salesCount: sales.length,
      totalSales,
      cashPayments,
      changeGiven,
      cashRefunds,
      openingCash: toNum(session.openingCash),
      systemCash: round2(expectedCash),
      closingCash: round2(closingCash),
      difference: round2(closingCash - expectedCash),
      closedAt: updated.closedAt?.toISOString() ?? null,
    }
  })
  return result
}
