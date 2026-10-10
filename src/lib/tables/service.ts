import { prisma } from "@/lib/db"

/** Avance del servicio de una mesa con cuenta abierta (según los artículos de su comanda). */
export interface TableService {
  total: number
  /** Pedidos o en preparación en cocina. */
  inKitchen: number
  /** Listos en cocina, faltan por llevar a la mesa. */
  toServe: number
  served: number
  amount: number
}

const OPEN = ["pending", "confirmed", "preparing", "ready"] as const

export async function tableServiceSummary(organizationId: string, tableIds: string[]): Promise<Map<string, TableService>> {
  const out = new Map<string, TableService>()
  if (!tableIds.length) return out
  const orders = await prisma.order.findMany({
    where: { organizationId, tableId: { in: tableIds }, deliveryMethod: "pickup", status: { in: [...OPEN] }, saleId: null },
    select: {
      tableId: true,
      items: { select: { itemStatus: true, quantity: true, unitPrice: true } },
    },
  })
  for (const o of orders) {
    if (!o.tableId) continue
    const s = out.get(o.tableId) ?? { total: 0, inKitchen: 0, toServe: 0, served: 0, amount: 0 }
    for (const i of o.items) {
      const q = Number(i.quantity)
      s.total += q
      s.amount += q * Number(i.unitPrice)
      if (i.itemStatus === "served") s.served += q
      else if (i.itemStatus === "ready") s.toServe += q
      else s.inKitchen += q
    }
    out.set(o.tableId, s)
  }
  return out
}
