import bcrypt from "bcryptjs"
import type { $Enums } from "@prisma/client"
import { prisma } from "../../src/lib/db/client"
import { categoryPlaceholder, productPlaceholder } from "../../src/lib/catalog/auto-emoji"

// Empresa de pruebas "NESSIK Test" (modo híbrido) con datos listos para
// entrar: propietario, un trabajador y un cliente del portal; 5 categorías con
// 2 productos cada una, una promoción de cada tipo y una publicación de cada
// tipo. Se crea en cada seed de producción salvo SEED_NESSIK_TEST=false.
// Si ya existe completa, no se duplica: solo se reactivan las cuentas de
// prueba. Si quedó incompleta (p. ej. tras la limpieza global del seed de
// demo), se reconstruye sobre la misma organización.

export const NESSIK_TEST = {
  orgName: "NESSIK Test",
  password: process.env.NESSIK_TEST_PASSWORD ?? "Nessik2026!",
  owner: { email: "propietario@nessik.test", name: "Néstor Propietario", code: "NT-001" },
  worker: { email: "trabajador@nessik.test", name: "Laura Trabajadora", code: "NT-002" },
  customer: { email: "cliente@nessik.test", name: "Carlos Cliente", code: "NTC-001" },
}

export function isNessikTestEnabled() {
  return (process.env.SEED_NESSIK_TEST ?? "true").toLowerCase() !== "false"
}

const LEGAL_VERSION = "2026-09-25"

type Seed = { name: string; price: number; cost: number; bulk?: { unit: string; min: number; step: number } }

const CATALOG: Record<string, Seed[]> = {
  Bebidas: [
    { name: "Café americano", price: 35, cost: 9 },
    { name: "Refresco de cola 600 ml", price: 22, cost: 13 },
  ],
  Desayunos: [
    { name: "Chilaquiles verdes", price: 89, cost: 32 },
    { name: "Huevos al gusto", price: 75, cost: 25 },
  ],
  Comida: [
    { name: "Hamburguesa clásica", price: 120, cost: 48 },
    { name: "Tacos de pastor (3 pzas)", price: 65, cost: 24 },
  ],
  Postres: [
    { name: "Pastel de chocolate", price: 55, cost: 18 },
    { name: "Helado de vainilla", price: 40, cost: 12 },
  ],
  Abarrotes: [
    { name: "Frijol negro a granel", price: 32, cost: 20, bulk: { unit: "kg", min: 0.25, step: 0.05 } },
    { name: "Aceite vegetal 1 L", price: 46, cost: 31 },
  ],
}

export async function seedNessikTest() {
  const passwordHash = await bcrypt.hash(NESSIK_TEST.password, 10)
  const now = new Date()
  const access = {
    passwordHash,
    isActive: true,
    activationRequired: false,
    emailVerified: now,
    legalAcceptedAt: now,
    legalVersion: LEGAL_VERSION,
  }
  const upsertUser = (email: string, fullName: string) =>
    prisma.user.upsert({
      where: { email },
      update: { ...access, fullName },
      create: { email, fullName, ...access },
    })

  const ownerUser = await upsertUser(NESSIK_TEST.owner.email, NESSIK_TEST.owner.name)
  const workerUser = await upsertUser(NESSIK_TEST.worker.email, NESSIK_TEST.worker.name)
  const customerUser = await upsertUser(NESSIK_TEST.customer.email, NESSIK_TEST.customer.name)

  const existing = await prisma.organization.findFirst({ where: { name: NESSIK_TEST.orgName }, select: { id: true } })
  if (existing) {
    const complete = await prisma.membership.findFirst({ where: { organizationId: existing.id, userId: ownerUser.id }, select: { id: true } })
    if (complete) {
      await prisma.organization.update({ where: { id: existing.id }, data: { isBlocked: false, blockedReason: null } })
      console.log("ℹ️  NESSIK Test ya existe: cuentas de prueba reactivadas")
      return existing.id
    }
    console.log("ℹ️  NESSIK Test estaba incompleta: se reconstruye")
  }

  // ── Empresa ────────────────────────────────────────────────────────────
  const orgData = {
    name: NESSIK_TEST.orgName,
    ownerId: ownerUser.id,
    currency: "MXN",
    businessMode: "hybrid" as const,
    pointsPerCurrency: 1,
    pointValue: 0.1,
    loyaltyEnabled: true,
    isBlocked: false,
    blockedReason: null,
  }
  const org = existing
    ? await prisma.organization.update({ where: { id: existing.id }, data: orgData })
    : await prisma.organization.create({ data: orgData })
  if (existing) {
    // Restos de configuración 1:1 que pudieran sobrevivir; se recrean abajo.
    await prisma.companyProfile.deleteMany({ where: { organizationId: org.id } })
    await prisma.appSettings.deleteMany({ where: { organizationId: org.id } })
    await prisma.deliveryPolicy.deleteMany({ where: { organizationId: org.id } })
  }
  await prisma.companyProfile.create({
    data: {
      organizationId: org.id,
      legalName: "NESSIK Test S.A. de C.V.",
      tradeName: "NESSIK Test",
      taxId: "NTE260927AB1",
      address: "Av. Juárez 100, Col. Centro",
      city: "Torreón",
      state: "Coahuila",
      postalCode: "27000",
      country: "México",
      phone: "8710000000",
      email: "contacto@nessik.test",
      website: "https://nessik.net",
      ticketFooter: "¡Gracias por su compra! NESSIK Test",
    },
  })
  await prisma.appSettings.create({
    data: { organizationId: org.id, primaryHue: 262, accentHue: 190, theme: "system", fontFamily: "montserrat" },
  })
  await prisma.deliveryPolicy.create({
    data: {
      organizationId: org.id,
      pickupEnabled: true,
      pickupMinAmount: 0,
      pickupFee: 0,
      pickupFeeEnabled: false,
      deliveryEnabled: true,
      deliveryMinAmount: 100,
      deliveryFee: 25,
      deliveryFeeEnabled: true,
      deliveryRadiusKm: 6,
      deliveryEstimatedMins: 35,
    },
  })

  const plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "desc" } })
  if (plan) {
    const subscription = {
      planId: plan.id,
      status: "active",
      periodEndsAt: new Date("2099-12-31T23:59:59.000Z"),
      extraLocations: 10,
      extraEmployeePacks: 10,
      autoBlockOnPastDue: false,
      notes: "Empresa de pruebas NESSIK",
    }
    await prisma.organizationSubscription.upsert({
      where: { organizationId: org.id },
      update: subscription,
      create: { organizationId: org.id, ...subscription },
    })
  }

  // ── Equipo ─────────────────────────────────────────────────────────────
  await prisma.membership.create({ data: { userId: ownerUser.id, organizationId: org.id, role: "owner", roleId: "system-owner" } })
  await prisma.membership.create({ data: { userId: workerUser.id, organizationId: org.id, role: "cashier", roleId: "system-cashier" } })

  const location = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Matriz NESSIK",
      code: "NT-MTZ",
      latitude: 25.5428,
      longitude: -103.4068,
      address: "Av. Juárez 100, Col. Centro, Torreón, Coah.",
      phone: "8710000001",
      managerName: NESSIK_TEST.owner.name,
      allowsPickup: true,
      allowsDelivery: true,
      openingHours: "Lun-Dom 08:00-22:00",
    },
  })
  await prisma.cashRegister.create({ data: { organizationId: org.id, locationId: location.id, name: "Caja 1", folioPrefix: "NT1" } })
  // CEDIS con existencias para probar traslados hacia la Matriz.
  const cedis = await prisma.cedi.create({
    data: {
      organizationId: org.id,
      name: "CEDIS NESSIK",
      code: "NT-CED",
      latitude: 25.5605,
      longitude: -103.3775,
      address: "Blvd. Revolución 2500, Parque Industrial, Torreón, Coah.",
      phone: "8710000003",
      managerName: NESSIK_TEST.worker.name,
      openingHours: "Lun-Sáb 07:00-17:00",
    },
  })

  const gerente = await prisma.employeePosition.create({ data: { organizationId: org.id, name: "Gerente" } })
  const cajero = await prisma.employeePosition.create({ data: { organizationId: org.id, name: "Cajero" } })
  await prisma.employee.create({
    data: {
      organizationId: org.id,
      userId: ownerUser.id,
      employeeCode: NESSIK_TEST.owner.code,
      fullName: NESSIK_TEST.owner.name,
      positionId: gerente.id,
      locationId: location.id,
      phone: "8710000002",
      salaryType: "monthly",
      salaryAmount: 18000,
      paymentFrequency: "biweekly",
    },
  })
  await prisma.employee.create({
    data: {
      organizationId: org.id,
      userId: workerUser.id,
      employeeCode: NESSIK_TEST.worker.code,
      fullName: NESSIK_TEST.worker.name,
      positionId: cajero.id,
      locationId: location.id,
      phone: "8710000003",
      salaryType: "hourly",
      salaryAmount: 55,
      paymentFrequency: "weekly",
    },
  })

  await prisma.customer.create({
    data: {
      organizationId: org.id,
      userId: customerUser.id,
      customerCode: NESSIK_TEST.customer.code,
      fullName: NESSIK_TEST.customer.name,
      phone: "8710000004",
      email: NESSIK_TEST.customer.email,
      address: "Calle Morelos 250, Col. Centro, Torreón",
      points: 150,
    },
  })

  // ── Catálogo e inventario ──────────────────────────────────────────────
  const units = await prisma.unitOfMeasure.findMany({ where: { organizationId: null }, select: { id: true, abbreviation: true } })
  const unitId = (abbr: string) => units.find((u) => u.abbreviation === abbr)?.id ?? null
  const categoryIds: Record<string, string> = {}
  const products: { id: string; variantId: string | null; name: string; category: string }[] = []

  for (const [category, items] of Object.entries(CATALOG)) {
    const cat = await prisma.category.create({ data: { organizationId: org.id, name: category, imageUrl: categoryPlaceholder(category) } })
    categoryIds[category] = cat.id
    for (const item of items) {
      const product = await prisma.product.create({
        data: {
          organizationId: org.id,
          name: item.name,
          categoryId: cat.id,
          imageUrl: productPlaceholder(item.name, category),
          productType: item.bulk ? "bulk" : "standard",
          taxRate: 0.16,
          trackInventory: true,
          ...(item.bulk
            ? {
                bulkUnitId: unitId(item.bulk.unit),
                bulkPricePerUnit: item.price,
                bulkMinQuantity: item.bulk.min,
                bulkStep: item.bulk.step,
              }
            : {}),
        },
      })
      let variantId: string | null = null
      if (!item.bulk) {
        const variant = await prisma.productVariant.create({
          data: { productId: product.id, organizationId: org.id, name: "Default", price: item.price, cost: item.cost, isActive: true },
        })
        variantId = variant.id
      }
      await prisma.inventory.create({
        data: {
          organizationId: org.id,
          productId: product.id,
          variantId,
          locationId: location.id,
          locationType: "location",
          quantity: item.bulk ? 40 : 50,
          minThreshold: item.bulk ? 5 : 10,
          unitId: item.bulk ? unitId(item.bulk.unit) : unitId("pza"),
        },
      })
      await prisma.inventory.create({
        data: {
          organizationId: org.id,
          productId: product.id,
          variantId,
          locationId: cedis.id,
          locationType: "cedis",
          quantity: item.bulk ? 300 : 200,
          minThreshold: item.bulk ? 50 : 40,
          unitId: item.bulk ? unitId(item.bulk.unit) : unitId("pza"),
        },
      })
      products.push({ id: product.id, variantId, name: item.name, category })
    }
  }
  const productId = (name: string) => products.find((p) => p.name === name)!

  // ── Proveedor ligado a los productos (para probar pedidos sugeridos) ───
  const supplier = await prisma.supplier.create({
    data: {
      organizationId: org.id,
      code: "PROV-001",
      businessName: "Distribuidora NESSIK S.A. de C.V.",
      tradeName: "Distribuidora NESSIK",
      contactName: "Mario Proveedor",
      email: "ventas@distribuidora.nessik.test",
      phone: "8710000002",
      paymentTerms: "Crédito 15 días",
      leadTimeDays: 2,
    },
  })
  for (const p of products) {
    const seed = Object.values(CATALOG).flat().find((item) => item.name === p.name)!
    await prisma.supplierProduct.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        productId: p.id,
        variantId: p.variantId,
        unitCost: seed.cost,
        minimumOrder: seed.bulk ? 5 : 12,
        leadTimeDays: 2,
        isPreferred: true,
      },
    })
  }

  // ── Una promoción de cada tipo ─────────────────────────────────────────
  const promos: {
    name: string
    benefit: $Enums.PromoBenefit
    scope: $Enums.PromoScope
    value: number
    buyQuantity?: number
    getQuantity?: number
    minAmount?: number
    target?: { kind: $Enums.PromotionTargetKind; id: string }
  }[] = [
    { name: "10% en Bebidas", benefit: "percent_off", scope: "category", value: 10, target: { kind: "category", id: categoryIds.Bebidas } },
    { name: "$20 menos en compras de $200", benefit: "amount_off", scope: "order", value: 20, minAmount: 200 },
    { name: "Café americano a $25", benefit: "fixed_price", scope: "variant", value: 25, target: { kind: "variant", id: productId("Café americano").variantId! } },
    { name: "2x1 en Helado de vainilla", benefit: "buy_x_get_y", scope: "product", value: 0, buyQuantity: 2, getQuantity: 1, target: { kind: "product", id: productId("Helado de vainilla").id } },
    { name: "Pastel gratis en compras de $300", benefit: "free_item", scope: "product", value: 0, minAmount: 300, target: { kind: "product", id: productId("Pastel de chocolate").id } },
    { name: "Cupón de $30 para tu próxima compra", benefit: "next_purchase_coupon", scope: "order", value: 30, minAmount: 150 },
  ]
  for (const p of promos) {
    const promo = await prisma.promotion.create({
      data: {
        organizationId: org.id,
        name: p.name,
        description: `Promoción de prueba: ${p.name}.`,
        benefit: p.benefit,
        scope: p.scope,
        value: p.value,
        buyQuantity: p.buyQuantity ?? 0,
        getQuantity: p.getQuantity ?? 0,
        minAmount: p.minAmount ?? 0,
        isActive: true,
        createdBy: ownerUser.id,
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 365 * 86400000),
      },
    })
    if (p.target) await prisma.promotionTarget.create({ data: { promotionId: promo.id, kind: p.target.kind, targetId: p.target.id } })
  }

  // ── Una publicación de cada tipo ───────────────────────────────────────
  const burger = productId("Hamburguesa clásica")
  const publications: { title: string; content: string; type: $Enums.PublicationType; designId: string; imageUrl?: string; productId?: string }[] = [
    { title: "¡Nueva Hamburguesa clásica!", content: "Pruébala hoy en sucursal o pídela en línea.", type: "product_new", designId: "sticker-new", imageUrl: productPlaceholder(burger.name, burger.category), productId: burger.id },
    { title: "10% en todas las bebidas", content: "Aplica en caja y en el portal durante todo el mes.", type: "promotion", designId: "coupon" },
    { title: "Horario de fin de semana", content: "Sábado y domingo abrimos de 9:00 a 21:00.", type: "notice", designId: "schedule" },
  ]
  for (const pub of publications) {
    await prisma.publication.create({
      data: {
        organizationId: org.id,
        title: pub.title,
        content: pub.content,
        type: pub.type,
        imageUrl: pub.imageUrl ?? null,
        isActive: true,
        publishedAt: now,
        metadata: { designId: pub.designId, ...(pub.productId ? { productId: pub.productId } : {}) },
      },
    })
  }

  console.log("✅ Empresa de pruebas NESSIK Test creada")
  return org.id
}
