import { prisma } from "@/lib/db"
import { broadcastKdsUpdate } from "@/lib/kds/live"
import { broadcastOrderStatus } from "@/lib/portal/live"

const KITCHEN_OPEN = new Set(["pending", "confirmed", "preparing", "ready"])

/**
 * Avisa en vivo que un pedido cambió (estado, cobro, repartidor, preparación):
 * el portal del cliente recarga su seguimiento y los paneles internos
 * (Pedidos, KDS) refrescan. Nunca debe romper la operación que lo invoca.
 */
export async function announceOrderChange(organizationId: string, orderId: string, opts: { created?: boolean } = {}) {
  try {
    const o = await prisma.order.findFirst({
      where: { id: orderId, organizationId },
      select: {
        id: true, orderNumber: true, status: true, source: true, serviceType: true, locationId: true, updatedAt: true,
        table: { select: { id: true, number: true, name: true } },
        items: { select: { id: true, productName: true, variantName: true, quantity: true, itemStatus: true } },
      },
    })
    if (!o) return
    broadcastOrderStatus({ orderId: o.id, orderNumber: Number(o.orderNumber), status: o.status, updatedAt: o.updatedAt.toISOString() })
    broadcastKdsUpdate(organizationId, {
      type: opts.created ? "order_new" : KITCHEN_OPEN.has(o.status) ? "order_updated" : "order_removed",
      orderId: o.id,
      orderNumber: Number(o.orderNumber),
      status: o.status,
      source: o.source,
      serviceType: o.serviceType,
      locationId: o.locationId,
      table: o.table,
      items: o.items.map((i) => ({ ...i, quantity: Number(i.quantity) })),
    })
  } catch (err) {
    console.error("[orders/live]", err)
  }
}
