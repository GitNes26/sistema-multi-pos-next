import test from "node:test"
import assert from "node:assert/strict"
import { prisma } from "../src/lib/db/client.ts"
import {
  changeOrderStatus,
  createOrder,
  createQuote,
  createSupplier,
  linkSupplierProduct,
  receiveOrder,
} from "../src/lib/purchasing/server.ts"

test("proveedor → cotización → orden → recepciones → inventario", async () => {
  const organization = await prisma.organization.findFirst({
    where: { name: "Supermercado Demo" },
  })
  assert.ok(organization, "La base demo debe contener Supermercado Demo")
  const [product, location, user] = await Promise.all([
    prisma.product.findFirst({
      where: { organizationId: organization.id, isActive: true },
      include: { variants: { where: { isActive: true }, take: 1 } },
    }),
    prisma.location.findFirst({
      where: { organizationId: organization.id, isActive: true },
    }),
    prisma.user.findFirst({
      where: { memberships: { some: { organizationId: organization.id } } },
    }),
  ])
  assert.ok(product && location && user)
  const variant = product.variants[0] ?? null
  const suffix = Date.now().toString(36)
  const supplier = await createSupplier(organization.id, {
    code: `TEST-${suffix}`,
    businessName: `Proveedor integración ${suffix}`,
  })
  await linkSupplierProduct(organization.id, {
    supplierId: supplier.id,
    productId: product.id,
    variantId: variant?.id ?? null,
    unitCost: 12.5,
    minimumOrder: 4,
    isPreferred: true,
  })
  const item = {
    productId: product.id,
    variantId: variant?.id ?? null,
    description: product.name,
    quantity: 4,
    unitCost: 12.5,
    taxRate: 0.16,
  }
  const quote = await createQuote(organization.id, user.id, {
    supplierId: supplier.id,
    items: [item],
  })
  const order = await createOrder(organization.id, user.id, {
    supplierId: supplier.id,
    quoteId: quote.id,
    locationType: "location",
    locationId: location.id,
    items: [item],
  })
  await changeOrderStatus(organization.id, user.id, order.id, "approved")
  const inventoryTarget = variant
    ? { variantId: variant.id }
    : { productId: product.id, variantId: null }
  const before = await prisma.inventory.findFirst({
    where: {
      organizationId: organization.id,
      locationType: "location",
      locationId: location.id,
      ...inventoryTarget,
    },
  })
  const initial = Number(before?.quantity ?? 0)
  await receiveOrder(organization.id, user.id, {
    orderId: order.id,
    items: [{ orderItemId: order.items[0].id, quantity: 1.5 }],
  })
  let refreshed = await prisma.purchaseOrder.findUnique({
    where: { id: order.id },
    include: { items: true },
  })
  assert.equal(refreshed?.status, "partially_received")
  assert.equal(Number(refreshed?.items[0].receivedQuantity), 1.5)
  await receiveOrder(organization.id, user.id, {
    orderId: order.id,
    items: [{ orderItemId: order.items[0].id, quantity: 2.5 }],
  })
  refreshed = await prisma.purchaseOrder.findUnique({
    where: { id: order.id },
    include: { items: true },
  })
  const after = await prisma.inventory.findFirst({
    where: {
      organizationId: organization.id,
      locationType: "location",
      locationId: location.id,
      ...inventoryTarget,
    },
  })
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      organizationId: organization.id,
      type: "purchase",
      referenceId: {
        in: (
          await prisma.goodsReceipt.findMany({
            where: { orderId: order.id },
            select: { id: true },
          })
        ).map((r) => r.id),
      },
    },
  })
  assert.equal(refreshed?.status, "received")
  assert.equal(Number(after?.quantity), initial + 4)
  assert.equal(movements.length, 2)
  assert.equal(
    movements.reduce((sum, movement) => sum + Number(movement.quantity), 0),
    4
  )
})

test.after(async () => prisma.$disconnect())
