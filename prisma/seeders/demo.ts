import { $Enums } from "@prisma/client"
import { prisma } from "../../src/lib/db/client"
import { seedProduction, SYSTEM_UNITS } from "./production"

// FASE 1.3.2 — Seed de demo
// Genera una organización completa con datos de ejemplo deterministas.

const DEMO_ORG_NAME = "Supermercado Demo"
const DEMO_PASSWORD = "demo1234"

type ProductDef = {
  category: string
  name: string
  price: number
  bulk?: boolean
  variants?: { name: string; price: number }[]
}

const PRODUCTS: ProductDef[] = [
  // Abarrotes
  { category: "Abarrotes", name: "Arroz 1kg", price: 24.5 },
  { category: "Abarrotes", name: "Frijoles 900g", price: 32 },
  { category: "Abarrotes", name: "Aceite vegetal 1L", price: 45 },
  { category: "Abarrotes", name: "Atún en lata", price: 28.5 },
  { category: "Abarrotes", name: "Spaghetti 500g", price: 18.9 },
  // Bebidas
  { category: "Bebidas", name: "Refresco cola 2L", price: 28 },
  { category: "Bebidas", name: "Agua natural 1.5L", price: 22 },
  { category: "Bebidas", name: "Jugo de naranja 1L", price: 25 },
  { category: "Bebidas", name: "Cerveza 355ml", price: 19.5 },
  { category: "Bebidas", name: "Té helado 600ml", price: 18 },
  // Lácteos
  {
    category: "Lácteos y Huevo",
    name: "Leche entera 1L",
    price: 23,
    variants: [
      { name: "Entera", price: 23 },
      { name: "Light", price: 23.5 },
    ],
  },
  { category: "Lácteos y Huevo", name: "Queso manchego 400g", price: 89 },
  { category: "Lácteos y Huevo", name: "Yogurt natural 1kg", price: 52 },
  { category: "Lácteos y Huevo", name: "Mantequilla 90g", price: 26 },
  {
    category: "Lácteos y Huevo",
    name: "Huevo blanco 12 pzas",
    price: 42,
    variants: [
      { name: "Blanco 12", price: 42 },
      { name: "Rojo 12", price: 44 },
    ],
  },
  // Frutas y Verduras (a granel)
  { category: "Frutas y Verduras", name: "Tomate rojo", price: 28, bulk: true },
  {
    category: "Frutas y Verduras",
    name: "Cebolla blanca",
    price: 22,
    bulk: true,
  },
  { category: "Frutas y Verduras", name: "Papa", price: 20, bulk: true },
  {
    category: "Frutas y Verduras",
    name: "Manzana roja",
    price: 35,
    bulk: true,
  },
  { category: "Frutas y Verduras", name: "Plátano", price: 18, bulk: true },
  // Carnes
  {
    category: "Carnes y Pescados",
    name: "Pechuga de pollo",
    price: 98,
    bulk: true,
  },
  { category: "Carnes y Pescados", name: "Res molida", price: 120, bulk: true },
  {
    category: "Carnes y Pescados",
    name: "Chuleta de cerdo",
    price: 110,
    bulk: true,
  },
  { category: "Carnes y Pescados", name: "Tilapia", price: 85 },
  { category: "Carnes y Pescados", name: "Tocino", price: 65 },
  // Panadería
  { category: "Panadería", name: "Pan blanco 600g", price: 35 },
  { category: "Panadería", name: "Pan de caja integral", price: 38.5 },
  { category: "Panadería", name: "Bolillo", price: 1.5 },
  { category: "Panadería", name: "Concha", price: 12 },
  { category: "Panadería", name: "Pastel de chocolate", price: 120 },
  // Limpieza
  { category: "Limpieza", name: "Jabón en polvo 1kg", price: 55 },
  { category: "Limpieza", name: "Cloro 1L", price: 15.5 },
  { category: "Limpieza", name: "Detergente trastes 500ml", price: 24 },
  { category: "Limpieza", name: "Papel higiénico 4 pzas", price: 46 },
  { category: "Limpieza", name: "Esponja", price: 18 },
  // Electrónica
  { category: "Electrónica", name: "Baterías AA 4 pzas", price: 49 },
  { category: "Electrónica", name: "Audífonos", price: 199 },
  { category: "Electrónica", name: "Cable USB-C", price: 89 },
  { category: "Electrónica", name: "Memoria USB 32GB", price: 149 },
  { category: "Electrónica", name: "Bocina bluetooth", price: 499 },
  // Ropa
  { category: "Ropa", name: "Calcetines x3", price: 59 },
  { category: "Ropa", name: "Playera básica", price: 99 },
  {
    category: "Ropa",
    name: "Pantalón de mezclilla",
    price: 349,
    variants: [
      { name: "28", price: 349 },
      { name: "30", price: 349 },
      { name: "32", price: 349 },
    ],
  },
  { category: "Ropa", name: "Gorra", price: 129 },
  { category: "Ropa", name: "Cinturón", price: 89 },
  // Salud y Cuidado
  { category: "Salud y Cuidado", name: "Shampoo 400ml", price: 62 },
  { category: "Salud y Cuidado", name: "Pasta dental", price: 35 },
  { category: "Salud y Cuidado", name: "Jabón de tocador", price: 22 },
  { category: "Salud y Cuidado", name: "Cepillo dental", price: 28 },
  { category: "Salud y Cuidado", name: "Alcohol 70% 500ml", price: 25 },
]

const CUSTOMERS = [
  { name: "María García", phone: "5512345678" },
  { name: "José Martínez", phone: "5523456789" },
  { name: "Lucía Fernández", phone: "5534567890" },
  { name: "Miguel Hernández", phone: "5545678901" },
  { name: "Carmen López", phone: "5556789012" },
  { name: "Jorge Sánchez", phone: "5567890123" },
  { name: "Fernanda Díaz", phone: "5578901234" },
  { name: "Roberto Torres", phone: "5589012345" },
  { name: "Patricia Ramírez", phone: "5590123456" },
  { name: "Andrés Castillo", phone: "5501234567" },
]

// PRNG determinista
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

const pick = <T>(arr: T[], rnd: () => number): T =>
  arr[Math.floor(rnd() * arr.length)]

async function cleanupDemo(orgId: string, emails: string[]) {
  const d = prisma
  await d.orderPreparationItem.deleteMany()
  await d.orderPreparation.deleteMany()
  await d.orderStatusHistory.deleteMany()
  await d.orderItem.deleteMany()
  await d.order.deleteMany()
  await d.saleDiscount.deleteMany()
  await d.salePayment.deleteMany()
  await d.saleItem.deleteMany()
  await d.sale.deleteMany()
  await d.coupon.deleteMany()
  await d.loyaltyTransaction.deleteMany()
  await d.promotionTarget.deleteMany()
  await d.promotion.deleteMany()
  await d.inventoryRevisionItem.deleteMany()
  await d.inventoryRevision.deleteMany()
  await d.variantPriceHistory.deleteMany()
  await d.inventoryMovement.deleteMany()
  await d.inventory.deleteMany()
  await d.customerAddress.deleteMany()
  await d.branchDeliveryPolicy.deleteMany()
  await d.deliveryPolicy.deleteMany()
  await d.variantOptionValue.deleteMany()
  await d.shoppingListItem.deleteMany()
  await d.shoppingList.deleteMany()
  await d.customerFavorite.deleteMany()
  await d.productVariant.deleteMany()
  await d.productOptionValue.deleteMany()
  await d.productOption.deleteMany()
  await d.product.deleteMany()
  await d.category.deleteMany()
  await d.customerPaymentMethod.deleteMany()
  await d.customer.deleteMany()
  await d.cashSession.deleteMany()
  await d.cashRegister.deleteMany()
  await d.cedi.deleteMany()
  await d.location.deleteMany()
  await d.employee.deleteMany()
  await d.employeePosition.deleteMany()
  await d.membership.deleteMany()
  await d.userInvitation.deleteMany()
  await d.notification.deleteMany()
  await d.publication.deleteMany()
  await d.companyProfile.deleteMany()
  await d.appSettings.deleteMany()
  await d.profile.deleteMany()
  await d.organization.delete({ where: { id: orgId } })
  await d.user.deleteMany({ where: { email: { in: emails } } })
}

export async function seedDemo() {
  await seedProduction()

  const rnd = mulberry32(2026)

  // ── Limpieza (idempotencia) ──────────────────────────────────────────────
  const existingOrg = await prisma.organization.findFirst({
    where: { name: DEMO_ORG_NAME },
  })
  const demoEmails = [
    "demo@multi-pos.com",
    "manager@demo.multi-pos.com",
    "cajero1@demo.multi-pos.com",
    "cajero2@demo.multi-pos.com",
    "repartidor@demo.multi-pos.com",
    ...CUSTOMERS.map(
      (_, i) => `cli-${String(i + 1).padStart(3, "0")}@portal.local`
    ),
  ]
  if (existingOrg) {
    await cleanupDemo(existingOrg.id, demoEmails)
  }

  // ── Usuarios del equipo ──────────────────────────────────────────────────
  const passwordHash = await import("bcryptjs").then((m) =>
    m.hash(DEMO_PASSWORD, 10)
  )

  const mkUser = async (email: string, fullName: string) =>
    prisma.user.create({
      data: { email, passwordHash, fullName, isActive: true },
    })

  const ownerUser = await mkUser("demo@multi-pos.com", "Ana López")
  const managerUser = await mkUser("manager@demo.multi-pos.com", "Carlos Ruiz")
  const cashier1User = await mkUser("cajero1@demo.multi-pos.com", "Luis Gómez")
  const cashier2User = await mkUser("cajero2@demo.multi-pos.com", "María Pérez")
  const repartidorUser = await mkUser(
    "repartidor@demo.multi-pos.com",
    "Pedro Hernández"
  )

  // ── Organización ─────────────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      ownerId: ownerUser.id,
      currency: "MXN",
      pointsPerCurrency: 1,
      pointValue: 0.1,
      loyaltyEnabled: true,
    },
  })

  await prisma.companyProfile.create({
    data: {
      organizationId: org.id,
      legalName: "Supermercado Demo S.A. de C.V.",
      tradeName: "Super Demo",
      taxId: "SDM000101010",
      city: "Ciudad de México",
      state: "CDMX",
      postalCode: "06000",
      country: "México",
      phone: "5512340000",
      email: "contacto@demo.multi-pos.com",
      website: "https://demo.multi-pos.com",
      ticketFooter: "¡Gracias por su compra!",
    },
  })

  await prisma.appSettings.create({
    data: {
      organizationId: org.id,
      primaryHue: 160,
      accentHue: 30,
      theme: "system",
      fontFamily: "montserrat",
    },
  })

  // ── DeliveryPolicy ─────────────────────────────────────────────────────
  await prisma.deliveryPolicy.create({
    data: {
      organizationId: org.id,
      pickupEnabled: true,
      pickupMinAmount: 0,
      pickupFee: 0,
      pickupFeeEnabled: false,
      deliveryEnabled: true,
      deliveryMinAmount: 150,
      deliveryFee: 45,
      deliveryFeeEnabled: true,
      deliveryRadiusKm: 8,
      deliveryEstimatedMins: 45,
    },
  })

  // ── Memberships ──────────────────────────────────────────────────────────
  const membership = (
    userId: string,
    role: "owner" | "manager" | "cashier" | "superadmin" | "admin"
  ) =>
    prisma.membership.create({
      data: { userId, organizationId: org.id, role },
    })
  await membership(ownerUser.id, "owner")
  await membership(managerUser.id, "manager")
  await membership(cashier1User.id, "cashier")
  await membership(cashier2User.id, "cashier")

  // ── Puestos y empleados ──────────────────────────────────────────────────
  const positions: Record<string, string> = {}
  for (const name of [
    "Cajero",
    "Supervisor",
    "Repartidor",
    "Almacenero",
    "Cocinero",
  ]) {
    const p = await prisma.employeePosition.create({
      data: { organizationId: org.id, name },
    })
    positions[name] = p.id
  }

  const employee = (
    userId: string,
    employeeCode: string,
    fullName: string,
    position: string,
    phone?: string
  ) =>
    prisma.employee.create({
      data: {
        organizationId: org.id,
        userId,
        employeeCode,
        fullName,
        positionId: positions[position],
        phone,
      },
    })
  await employee(
    ownerUser.id,
    "EMP-001",
    "Ana López",
    "Supervisor",
    "5512340001"
  )
  await employee(
    managerUser.id,
    "EMP-002",
    "Carlos Ruiz",
    "Supervisor",
    "5512340002"
  )
  await employee(
    cashier1User.id,
    "EMP-003",
    "Luis Gómez",
    "Cajero",
    "5512340003"
  )
  await employee(
    cashier2User.id,
    "EMP-004",
    "María Pérez",
    "Cajero",
    "5512340004"
  )
  await employee(
    repartidorUser.id,
    "EMP-005",
    "Pedro Hernández",
    "Repartidor",
    "5512340005"
  )

  // ── Sucursales, CEDIS y cajas ────────────────────────────────────────────
  const locations = await Promise.all(
    [
      {
        name: "Matriz",
        code: "LOC-001",
        latitude: 19.4326,
        longitude: -99.1332,
        allowsDelivery: true,
      },
      {
        name: "Sucursal 2",
        code: "LOC-002",
        latitude: 19.37,
        longitude: -99.1,
        allowsDelivery: true,
      },
      {
        name: "Sucursal 3",
        code: "LOC-003",
        latitude: 19.45,
        longitude: -99.2,
        allowsPickup: true,
      },
    ].map((loc) =>
      prisma.location.create({
        data: {
          organizationId: org.id,
          name: loc.name,
          code: loc.code,
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: "Av. Principal 123",
          managerName: "Carlos Ruiz",
          allowsPickup: loc.allowsPickup ?? true,
          allowsDelivery: loc.allowsDelivery ?? false,
        },
      })
    )
  )

  await prisma.cedi.create({
    data: {
      organizationId: org.id,
      name: "CEDIS Central",
      code: "CED-001",
      address: "Parque Industrial Norte",
      managerName: "Almacenero Demo",
    },
  })

  const registers: { id: string; locationId: string }[] = []
  for (const loc of locations) {
    for (const name of ["Caja 1", "Caja 2"]) {
      const r = await prisma.cashRegister.create({
        data: {
          locationId: loc.id,
          organizationId: org.id,
          name,
          folioPrefix: name.replace(" ", ""),
        },
      })
      registers.push({ id: r.id, locationId: loc.id })
    }
  }

  // ── Clientes ─────────────────────────────────────────────────────────────
  const customers = []
  for (let i = 0; i < CUSTOMERS.length; i++) {
    const c = CUSTOMERS[i]
    const code = `CLI-${String(i + 1).padStart(3, "0")}`
    const user = await prisma.user.create({
      data: {
        email: `cli-${String(i + 1).padStart(3, "0")}@portal.local`,
        passwordHash,
        fullName: c.name,
        isActive: true,
      },
    })
    const customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        customerCode: code,
        fullName: c.name,
        phone: c.phone,
        points: round2(rnd() * 500),
      },
    })
    customers.push(customer)
  }

  // ── Direcciones de clientes ────────────────────────────────────────────
  const addressData = [
    { label: "Casa", address: "Av. Reforma 123, Col. Centro, CDMX", lat: 19.4326, lng: -99.1332 },
    { label: "Oficina", address: "Blvd. Insurgentes 456, Del. Miguel Hidalgo, CDMX", lat: 19.4350, lng: -99.1700 },
    { label: "Casa", address: "Calle Durango 789, Col. Roma Norte, CDMX", lat: 19.4195, lng: -99.1620 },
    { label: "Casa", address: "Calzada de Tlalpan 1010, Del. Coyoacán, CDMX", lat: 19.3000, lng: -99.1500 },
    { label: "Trabajo", address: "Av. Insurgentes Sur 2000, Del. Álvaro Obregón, CDMX", lat: 19.3500, lng: -99.2000 },
  ]
  for (let i = 0; i < Math.min(addressData.length, customers.length); i++) {
    const a = addressData[i]
    await prisma.customerAddress.create({
      data: {
        organizationId: org.id,
        customerId: customers[i].id,
        label: a.label,
        address: a.address,
        latitude: a.lat,
        longitude: a.lng,
      },
    })
  }

  // ── Categorías (jerarquía) ───────────────────────────────────────────────
  const catAbarrotes = await prisma.category.create({
    data: { organizationId: org.id, name: "Abarrotes" },
  })
  const catFrutas = await prisma.category.create({
    data: { organizationId: org.id, name: "Frutas y Verduras" },
  })
  const categoryIds: Record<string, string> = {
    Abarrotes: catAbarrotes.id,
    "Frutas y Verduras": catFrutas.id,
  }
  for (const name of [
    "Bebidas",
    "Lácteos y Huevo",
    "Carnes y Pescados",
    "Panadería",
    "Limpieza",
    "Electrónica",
    "Ropa",
    "Salud y Cuidado",
  ]) {
    const cat = await prisma.category.create({
      data: {
        organizationId: org.id,
        name,
        parentId:
          name === "Bebidas" ||
          name === "Lácteos y Huevo" ||
          name === "Panadería"
            ? catAbarrotes.id
            : undefined,
      },
    })
    categoryIds[name] = cat.id
  }

  // ── Unidades de medida (referencias del sistema) ─────────────────────────
  const units = await prisma.unitOfMeasure.findMany({
    where: {
      organizationId: null,
      abbreviation: { in: SYSTEM_UNITS.map((u) => u.abbreviation) },
    },
  })
  const unitByAbbr = Object.fromEntries(units.map((u) => [u.abbreviation, u]))
  const unitKg = unitByAbbr["kg"]
  const unitPza = unitByAbbr["pza"]

  // ── Productos + variantes + inventario ───────────────────────────────────
  const variants: {
    id: string
    name: string
    price: number
    productId: string
    productName: string
    bulk: boolean
  }[] = []
  const bulkProducts: { id: string; name: string; price: number }[] = []

  for (let i = 0; i < PRODUCTS.length; i++) {
    const def = PRODUCTS[i]
    const barcodeBase = `750${String(i + 1).padStart(8, "0")}`

    const product = await prisma.product.create({
      data: {
        organizationId: org.id,
        categoryId: categoryIds[def.category],
        name: def.name,
        taxRate: 0.16,
        trackInventory: true,
        productType: def.bulk ? "bulk" : "standard",
        bulkUnitId: def.bulk ? unitKg?.id : undefined,
        bulkPricePerUnit: def.bulk ? def.price : undefined,
        bulkMinQuantity: def.bulk ? 0.1 : undefined,
        bulkStep: def.bulk ? 0.05 : undefined,
        bulkMaxQuantity: def.bulk ? 0 : undefined,
        allowSplit: false,
      },
    })

    if (def.bulk) {
      bulkProducts.push({ id: product.id, name: def.name, price: def.price })
      continue
    }

    const variantDefs = def.variants ?? [{ name: "Default", price: def.price }]
    for (let v = 0; v < variantDefs.length; v++) {
      const vd = variantDefs[v]
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          organizationId: org.id,
          sku: `SKU-${String(i + 1).padStart(3, "0")}${v > 0 ? `-${v + 1}` : ""}`,
          barcode: v > 0 ? `${barcodeBase}${v + 1}` : barcodeBase,
          name: vd.name,
          price: vd.price,
          cost: round2(vd.price * 0.62),
        },
      })
      variants.push({
        id: variant.id,
        name: vd.name,
        price: vd.price,
        productId: product.id,
        productName: def.name,
        bulk: false,
      })
    }
  }

  // Inventario: por variante y por producto granel, en cada sucursal
  for (const loc of locations) {
    for (const v of variants) {
      await prisma.inventory.create({
        data: {
          organizationId: org.id,
          variantId: v.id,
          locationId: loc.id,
          locationType: "location",
          quantity: round2(20 + rnd() * 380),
          unitId: unitPza?.id,
          minThreshold: 10,
        },
      })
    }
    for (const bp of bulkProducts) {
      await prisma.inventory.create({
        data: {
          organizationId: org.id,
          productId: bp.id,
          locationId: loc.id,
          locationType: "location",
          quantity: round2(5 + rnd() * 100),
          unitId: unitKg?.id,
          minThreshold: 5,
        },
      })
    }
  }

  // ── Promociones ──────────────────────────────────────────────────────────
  const colaVariant = variants.find((v) => v.productName === "Refresco cola 2L")
  const lecheVariant = variants.find((v) => v.productName === "Leche entera 1L")

  const promoData: {
    name: string
    benefit: $Enums.PromoBenefit
    scope: $Enums.PromoScope
    value?: number
    minAmount?: number
    buyQuantity?: number
    getQuantity?: number
    weekdays?: string
  }[] = [
    {
      name: "10% en tu pedido",
      benefit: "percent_off",
      scope: "order",
      value: 10,
    },
    {
      name: "$20 de descuento +$300",
      benefit: "amount_off",
      scope: "order",
      value: 20,
      minAmount: 300,
    },
    {
      name: "2x1 Refresco cola 2L",
      benefit: "buy_x_get_y",
      scope: "product",
      buyQuantity: 2,
      getQuantity: 1,
    },
    {
      name: "Leche a $20",
      benefit: "fixed_price",
      scope: "product",
      value: 20,
    },
    {
      name: "15% en frutas y verduras",
      benefit: "percent_off",
      scope: "category",
      value: 15,
    },
    {
      name: "5% en electrónica",
      benefit: "percent_off",
      scope: "category",
      value: 5,
    },
    {
      name: "Cupón próxima compra +$500",
      benefit: "next_purchase_coupon",
      scope: "order",
      minAmount: 500,
    },
    {
      name: "Jueves de lácteos -10%",
      benefit: "percent_off",
      scope: "category",
      value: 10,
      weekdays: "[4]",
    },
    {
      name: "Artículo gratis +$400",
      benefit: "free_item",
      scope: "order",
      minAmount: 400,
    },
    {
      name: "$15 menos en Bebidas",
      benefit: "amount_off",
      scope: "category",
      value: 15,
      minAmount: 100,
    },
  ]

  const promotions: { id: string; name: string }[] = []
  for (const pd of promoData) {
    const promo = await prisma.promotion.create({
      data: {
        organizationId: org.id,
        name: pd.name,
        benefit: pd.benefit,
        scope: pd.scope,
        value: pd.value,
        buyQuantity: pd.buyQuantity,
        getQuantity: pd.getQuantity,
        minAmount: pd.minAmount,
        weekdays: pd.weekdays,
        isActive: true,
        createdBy: ownerUser.id,
        startsAt: new Date(Date.now() - 30 * 86400000),
        endsAt: new Date(Date.now() + 60 * 86400000),
      },
    })
    promotions.push(promo)
  }

  // Targets de promociones
  const promoTarget = (
    promotionName: string,
    kind: $Enums.PromotionTargetKind,
    targetId: string
  ) =>
    prisma.promotionTarget.create({
      data: {
        promotionId: promotions.find((p) => p.name === promotionName)!.id,
        kind,
        targetId,
      },
    })
  if (colaVariant)
    await promoTarget("2x1 Refresco cola 2L", "variant", colaVariant.id)
  if (lecheVariant) await promoTarget("Leche a $20", "variant", lecheVariant.id)
  await promoTarget("15% en frutas y verduras", "category", catFrutas.id)
  await promoTarget("5% en electrónica", "category", categoryIds["Electrónica"])
  await promoTarget("$15 menos en Bebidas", "category", categoryIds["Bebidas"])

  // ── Ventas históricas (100) ──────────────────────────────────────────────
  const cashiers = [
    { user: cashier1User, employeeId: undefined as string | undefined },
    { user: cashier2User, employeeId: undefined as string | undefined },
    { user: managerUser, employeeId: undefined as string | undefined },
  ]
  const empByUser = await prisma.employee.findMany({
    where: { organizationId: org.id },
  })
  const empIdByUserId = Object.fromEntries(
    empByUser.map((e) => [e.userId, e.id])
  )

  const now = Date.now()
  const saleSeqByLocation: Record<string, number> = {}
  for (const loc of locations) saleSeqByLocation[loc.id] = 0

  for (let s = 0; s < 100; s++) {
    const loc = pick(locations, rnd)
    const reg = pick(
      registers.filter((r) => r.locationId === loc.id),
      rnd
    )
    const cashier = pick(cashiers, rnd)
    const customer = rnd() < 0.7 ? pick(customers, rnd) : null
    const saleDate = new Date(now - Math.floor(rnd() * 90) * 86400000)
    saleDate.setHours(Math.floor(rnd() * 12) + 9, Math.floor(rnd() * 60), 0, 0)

    const itemCount = 1 + Math.floor(rnd() * 7)
    const items = []
    for (let k = 0; k < itemCount; k++) {
      if (rnd() < 0.3 && bulkProducts.length) {
        const bp = pick(bulkProducts, rnd)
        const qty = round2(0.1 + rnd() * 3)
        const unitPrice = bp.price
        const totalPrice = round2(qty * unitPrice)
        items.push({
          productId: bp.id,
          productName: bp.name,
          productType: "bulk" as const,
          quantity: qty,
          unitId: unitKg?.id,
          unitPrice,
          totalPrice,
          lineTotal: totalPrice,
          bulkQuantityDisplay: `${qty} kg`,
        })
      } else {
        const v = pick(variants, rnd)
        const qty = 1 + Math.floor(rnd() * 5)
        const lineTotal = round2(qty * v.price)
        items.push({
          variantId: v.id,
          productId: v.productId,
          productName: v.productName,
          variantName: v.name,
          productType: "standard" as const,
          quantity: qty,
          unitId: unitPza?.id,
          unitPrice: v.price,
          totalPrice: lineTotal,
          lineTotal,
        })
      }
    }

    const subtotal = round2(
      items.reduce((acc, it) => acc + (it.lineTotal as number), 0)
    )
    const hasDiscount = rnd() < 0.25
    const discount = hasDiscount ? round2(subtotal * (0.05 + rnd() * 0.1)) : 0
    const tax = round2((subtotal - discount) * 0.16)
    const total = round2(subtotal - discount + tax)
    const pointsEarned = customer ? round2(total) : 0

    saleSeqByLocation[loc.id] += 1
    const locationSaleNumber = BigInt(saleSeqByLocation[loc.id])

    const sale = await prisma.sale.create({
      data: {
        organizationId: org.id,
        locationId: loc.id,
        cashRegisterId: reg.id,
        cashierId: cashier.user.id,
        employeeId: cashier.employeeId ?? empIdByUserId[cashier.user.id],
        customerId: customer?.id,
        locationSaleNumber,
        subtotal,
        discount,
        tax,
        total,
        pointsEarned,
        status: "completed",
        notes: hasDiscount ? "Descuento manual aplicado" : null,
        createdAt: saleDate,
        items: { create: items },
      },
      include: { items: true },
    })

    const payCash = rnd() < 0.6
    if (payCash) {
      await prisma.salePayment.create({
        data: {
          saleId: sale.id,
          method: "cash",
          amount: total,
          reference: null,
        },
      })
    } else {
      await prisma.salePayment.create({
        data: {
          saleId: sale.id,
          method: "card",
          amount: total,
          reference: `AUTH-${100000 + s}`,
        },
      })
    }

    if (hasDiscount) {
      await prisma.saleDiscount.create({
        data: { saleId: sale.id, label: "Descuento manual", amount: discount },
      })
    }

    if (customer) {
      await prisma.loyaltyTransaction.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          saleId: sale.id,
          kind: "earn",
          points: pointsEarned,
          note: `Venta ${locationSaleNumber}`,
        },
      })
    }
  }

  // Actualizar folios de sucursal
  for (const loc of locations) {
    await prisma.location.update({
      where: { id: loc.id },
      data: { saleSeq: BigInt(saleSeqByLocation[loc.id]) },
    })
  }

  // ── Pedidos del portal (20) ──────────────────────────────────────────────
  const statuses = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "delivered",
    "cancelled",
  ] as const
  for (let o = 0; o < 20; o++) {
    const loc = pick(locations, rnd)
    const customer = customers[o % customers.length]
    const status = statuses[Math.floor(rnd() * statuses.length)]
    const deliveryMethod = rnd() < 0.5 ? "pickup" : "delivery"
    const orderDate = new Date(now - Math.floor(rnd() * 60) * 86400000)

    const itemCount = 1 + Math.floor(rnd() * 4)
    const items = []
    for (let k = 0; k < itemCount; k++) {
      const v = pick(variants, rnd)
      const qty = 1 + Math.floor(rnd() * 3)
      const lineTotal = round2(qty * v.price)
      items.push({
        productId: v.productId,
        variantId: v.id,
        productName: v.productName,
        variantName: v.name,
        productType: "standard" as const,
        quantity: qty,
        unitId: unitPza?.id,
        unitPrice: v.price,
        lineTotal,
      })
    }
    const subtotal = round2(
      items.reduce((acc, it) => acc + (it.lineTotal as number), 0)
    )
    const total = round2(subtotal * 1.16)
    const isDelivery = deliveryMethod === "delivery"
    const paymentMethod = pick(["cash", "card", "card"], rnd) as "cash" | "card"
    const isPaid = status === "delivered" || status === "ready" || (status === "confirmed" && rnd() < 0.5)
    const deliveryPin = isDelivery && (status === "ready" || status === "delivered")
      ? String(Math.floor(100000 + rnd() * 900000))
      : null
    const pointsRedeemed = rnd() < 0.2 ? round2(Math.floor(rnd() * 50)) : 0
    const pointsValue = pointsRedeemed > 0 ? round2(pointsRedeemed * 0.1) : 0

    const order = await prisma.order.create({
      data: {
        organizationId: org.id,
        locationId: loc.id,
        customerId: customer.id,
        status,
        deliveryMethod,
        subtotal,
        discount: 0,
        total,
        address: isDelivery ? addressData[o % addressData.length].address : null,
        latitude: isDelivery ? addressData[o % addressData.length].lat : null,
        longitude: isDelivery ? addressData[o % addressData.length].lng : null,
        paymentMethod,
        deliveryFee: isDelivery ? 45 : 0,
        deliveryPin,
        paidAt: isPaid ? orderDate : null,
        pointsRedeemed: pointsRedeemed > 0 ? pointsRedeemed : 0,
        pointsValue: pointsValue > 0 ? pointsValue : 0,
        createdAt: orderDate,
        updatedAt: orderDate,
        items: { create: items },
      },
    })

    // Historial de estados
    const historyFlow: typeof statuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivered",
      "cancelled",
    ]
    const flowIndex = statuses.indexOf(status)
    for (let hi = 0; hi <= Math.max(flowIndex, 0); hi++) {
      const st = historyFlow[hi]
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: st,
          employeeId: hi === 0 ? undefined : empIdByUserId[managerUser.id],
          userId: hi === 0 ? undefined : managerUser.id,
          notes: st === "delivered" ? "Entregado al cliente" : null,
        },
      })
    }

    // Preparación para algunos
    if (
      status === "preparing" ||
      status === "ready" ||
      status === "delivered"
    ) {
      await prisma.orderPreparation.create({
        data: {
          orderId: order.id,
          employeeId: empIdByUserId[cashier1User.id],
          startedAt: orderDate,
          completedAt:
            status === "ready" || status === "delivered"
              ? new Date(orderDate.getTime() + 15 * 60000)
              : null,
          elapsedSeconds:
            status === "ready" || status === "delivered" ? 900 : null,
        },
      })
    }
  }

  // ── Notificaciones de ejemplo ────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: ownerUser.id,
        kind: "new_order",
        title: "Nuevo pedido recibido",
        body: "Un cliente realizó un pedido por pickup.",
        severity: "info",
        link: "/orders",
      },
      {
        organizationId: org.id,
        userId: managerUser.id,
        kind: "low_stock",
        title: "Stock bajo",
        body: "El producto 'Tomate rojo' está por debajo del mínimo.",
        severity: "warning",
        link: "/inventory",
      },
      {
        organizationId: org.id,
        userId: cashier1User.id,
        kind: "sale",
        title: "Venta completada",
        body: "La venta #1 se completó correctamente.",
        severity: "success",
        link: "/sales",
      },
    ],
  })

  // ── Publicaciones de ejemplo ─────────────────────────────────────────────
  await prisma.publication.createMany({
    data: [
      {
        organizationId: org.id,
        title: "¡Nueva llegada! Bocina bluetooth",
        content:
          "Ya está disponible la bocina bluetooth a un precio increíble.",
        type: "product_new",
        isActive: true,
        publishedAt: new Date(now - 2 * 86400000),
      },
      {
        organizationId: org.id,
        title: "Promoción de frutas y verduras",
        content: "15% de descuento en toda la sección de frutas y verduras.",
        type: "promotion",
        isActive: true,
        publishedAt: new Date(now - 5 * 86400000),
      },
      {
        organizationId: org.id,
        title: "Aviso: horario de temporada",
        content: "Extendemos el horario los fines de semana.",
        type: "notice",
        isActive: true,
        publishedAt: new Date(now - 10 * 86400000),
      },
    ],
  })

  return {
    org,
    ownerUser,
    managerUser,
    cashier1User,
    cashier2User,
    locations,
    customers,
  }
}

export { DEMO_ORG_NAME, DEMO_PASSWORD }
