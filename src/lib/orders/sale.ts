import type { $Enums, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

// Un pedido del portal ES una venta: la mercancía sale de una sucursal y el
// dinero llega a caja. Al cobrarse en tienda o al entregarse, el pedido se
// convierte en una venta real (una sola vez):
//   • folio de la sucursal y ticket reimprimible (se muestra como "PED-<nº>");
//   • descuenta el inventario de la sucursal con su movimiento;
//   • queda en la caja abierta de esa sucursal → entra al corte;
//   • pagos con su método, puntos ganados, reportes y ventas.
// No repite lo que ya ocurrió al hacer el pedido: el cargo a crédito, el canje
// de puntos y el consumo de insumos de receta ya se registraron entonces.
//
// Los pedidos de mesa no pasan por aquí: se cobran en el POS con su cuenta.

const num = (v: unknown) => (v == null ? 0 : Number(v))
const round2 = (n: number) => Math.round(n * 100) / 100

/** Folio visible de una venta generada por un pedido. */
export const orderSaleFolio = (orderNumber: number | bigint) => `PED-${Number(orderNumber)}`

export interface OrderSaleCtx {
  userId?: string | null
  employeeId?: string | null
  /** Caja donde se cobró (cobro en tienda); si no, la caja abierta de la sucursal. */
  cashSessionId?: string | null
}

/**
 * Registra la venta de un pedido si aún no la tiene. Devuelve el id de la
 * venta (nueva o existente) o null si el pedido no aplica (mesa, cancelado).
 */
export async function recordOrderSale(organizationId: string, orderId: string, ctx: OrderSaleCtx = {}): Promise<string | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId },
    include: {
      items: { include: { product: { select: { taxRate: true, trackInventory: true, productType: true } } } },
      location: { select: { id: true } },
    },
  })
  if (!order) return null
  if (order.saleId) return order.saleId
  if (order.tableId || order.status === "cancelled") return null

  const locationId =
    order.locationId ??
    (await prisma.location.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id
  if (!locationId) return null

  const [org, creditPolicy] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { loyaltyEnabled: true, pointsPerCurrency: true } }),
    prisma.creditPolicy.findUnique({ where: { organizationId }, select: { creditEarnsPoints: true } }),
  ])

  // Caja: la indicada (cobro en tienda) o la que esté abierta en la sucursal.
  const session = ctx.cashSessionId
    ? await prisma.cashSession.findFirst({ where: { id: ctx.cashSessionId, organizationId, status: "open" }, select: { id: true, cashRegisterId: true } })
    : await prisma.cashSession.findFirst({ where: { organizationId, locationId, status: "open" }, orderBy: { openedAt: "desc" }, select: { id: true, cashRegisterId: true } })

  const total = num(order.total)
  const subtotal = num(order.subtotal)
  const discount = num(order.discount)
  const deliveryFee = num(order.deliveryFee)
  const tip = num(order.tip)
  const pointsValue = num(order.pointsValue)
  // El impuesto no se guarda aparte en el pedido: es lo que resta del total.
  const tax = round2(Math.max(0, total + pointsValue - subtotal + discount - deliveryFee - tip))
  const method = (order.paymentMethod ?? "cash") as $Enums.PaymentMethod
  const isCredit = method === "credit"
  const pointsEarned =
    order.customerId && org?.loyaltyEnabled && !(isCredit && creditPolicy && !creditPolicy.creditEarnsPoints)
      ? round2(total * num(org.pointsPerCurrency))
      : 0
  const folio = orderSaleFolio(order.orderNumber)

  try {
    return await prisma.$transaction(async (tx) => {
      const loc = await tx.location.update({ where: { id: locationId }, data: { saleSeq: { increment: 1 } }, select: { saleSeq: true } })

      const sale = await tx.sale.create({
        data: {
          organizationId,
          locationId,
          cashSessionId: session?.id ?? null,
          cashRegisterId: session?.cashRegisterId ?? null,
          cashierId: ctx.userId ?? null,
          employeeId: ctx.employeeId ?? null,
          customerId: order.customerId,
          locationSaleNumber: loc.saleSeq,
          subtotal,
          discount,
          tax,
          total,
          tip,
          pointsEarned,
          pointsRedeemed: num(order.pointsRedeemed),
          changeGiven: 0,
          status: "completed",
          notes: [
            `Venta por pedido ${folio} (${order.deliveryMethod === "delivery" ? "a domicilio" : "recoger en sucursal"})`,
            deliveryFee > 0 ? `Envío $${deliveryFee.toFixed(2)}` : null,
            order.notes,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      })

      // Enlace pedido → venta; si otra solicitud ya lo enlazó, se revierte todo.
      const linked = await tx.order.updateMany({ where: { id: order.id, saleId: null }, data: { saleId: sale.id, paidAt: order.paidAt ?? new Date() } })
      if (!linked.count) throw new AlreadyLinked()

      await tx.saleItem.createMany({
        data: order.items.map((i) => ({
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
          totalPrice: i.lineTotal,
          discount: 0,
          taxRate: num(i.product?.taxRate),
          lineTotal: i.lineTotal,
          bulkQuantityDisplay: i.bulkQuantityDisplay,
          notes: i.comment ?? undefined,
          selectedOptions: (i.selectedOptions ?? undefined) as Prisma.InputJsonValue | undefined,
          extraPrice: i.extraPrice,
        })),
      })

      await tx.salePayment.create({ data: { saleId: sale.id, method, amount: total, reference: order.paymentReference } })

      // Inventario: la mercancía ya salió, así que se descuenta aunque quede en
      // negativo (el faltante se ve en inventario en lugar de ocultarse).
      for (const item of order.items) {
        if (!item.product?.trackInventory || !item.productId) continue
        const inv = item.variantId
          ? await tx.inventory.findFirst({ where: { organizationId, variantId: item.variantId, locationId, locationType: "location" }, select: { id: true } })
          : await tx.inventory.findFirst({ where: { organizationId, productId: item.productId, variantId: null, locationId, locationType: "location" }, select: { id: true } })
        if (inv) await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: item.quantity } } })
        await tx.inventoryMovement.create({
          data: {
            organizationId,
            productId: item.variantId ? null : item.productId,
            variantId: item.variantId,
            locationId,
            locationType: "location",
            type: "sale",
            quantity: -num(item.quantity),
            unitId: item.unitId,
            reason: `Venta por pedido ${folio}`,
            referenceId: sale.id,
            userId: ctx.userId ?? null,
            employeeId: ctx.employeeId ?? null,
          },
        })
      }

      if (pointsEarned > 0 && order.customerId) {
        await tx.customer.update({ where: { id: order.customerId }, data: { points: { increment: pointsEarned } } })
        await tx.loyaltyTransaction.create({
          data: { organizationId, customerId: order.customerId, saleId: sale.id, kind: "earn", points: pointsEarned, note: `Pedido ${folio}` },
        })
      }
      return sale.id
    })
  } catch (err) {
    if (err instanceof AlreadyLinked) {
      return (await prisma.order.findUnique({ where: { id: order.id }, select: { saleId: true } }))?.saleId ?? null
    }
    throw err
  }
}

class AlreadyLinked extends Error {}
