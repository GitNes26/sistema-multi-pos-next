import { prisma } from "@/lib/db";

/**
 * Conteos de relaciones para las páginas de una lista.
 *
 * Por qué existe: `include: { _count: { select: { items: true } } }` hace que Prisma una cada fila con
 * `(SELECT saleId, COUNT(*) FROM sale_items GROUP BY saleId)` SIN filtrar, es decir, agrupa la tabla
 * completa en cada petición (con 360 mil partidas tardaba más de 1 s por lista). Aquí se cuenta solo
 * para los ids de la página, usando el índice de la llave foránea.
 */

const toMap = <T extends string>(rows: { key: T | null; n: number }[]) => new Map(rows.filter((r) => r.key !== null).map((r) => [r.key as string, r.n]));

export async function saleItemCounts(saleIds: string[]): Promise<Map<string, number>> {
  if (!saleIds.length) return new Map();
  const rows = await prisma.saleItem.groupBy({ by: ["saleId"], where: { saleId: { in: saleIds } }, _count: { _all: true } });
  return toMap(rows.map((r) => ({ key: r.saleId, n: r._count._all })));
}

export async function orderItemCounts(orderIds: string[]): Promise<Map<string, number>> {
  if (!orderIds.length) return new Map();
  const rows = await prisma.orderItem.groupBy({ by: ["orderId"], where: { orderId: { in: orderIds } }, _count: { _all: true } });
  return toMap(rows.map((r) => ({ key: r.orderId, n: r._count._all })));
}

/** Ventas y pedidos por cliente (para la ficha y la lista de clientes). */
export async function customerActivityCounts(customerIds: string[]): Promise<Map<string, { sales: number; orders: number }>> {
  const out = new Map<string, { sales: number; orders: number }>(customerIds.map((id) => [id, { sales: 0, orders: 0 }]));
  if (!customerIds.length) return out;
  const [sales, orders] = await Promise.all([
    prisma.sale.groupBy({ by: ["customerId"], where: { customerId: { in: customerIds } }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["customerId"], where: { customerId: { in: customerIds } }, _count: { _all: true } }),
  ]);
  for (const row of sales) if (row.customerId) out.get(row.customerId)!.sales = row._count._all;
  for (const row of orders) if (row.customerId) out.get(row.customerId)!.orders = row._count._all;
  return out;
}

/** Ventas por empleado. */
export async function employeeSalesCounts(employeeIds: string[]): Promise<Map<string, number>> {
  if (!employeeIds.length) return new Map();
  const rows = await prisma.sale.groupBy({ by: ["employeeId"], where: { employeeId: { in: employeeIds } }, _count: { _all: true } });
  return toMap(rows.map((r) => ({ key: r.employeeId, n: r._count._all })));
}
