import { prisma } from "@/lib/db";

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

interface Period {
  from?: string;
  to?: string;
  locationId?: string;
}

// El rango se interpreta en la hora local del servidor (igual que los filtros
// "desde/hasta" del panel), así que los días y meses también se agrupan en
// hora local: con toISOString las ventas de la noche caían en el día siguiente.
const pad = (n: number) => String(n).padStart(2, "0");
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localMonth = (d: Date) => localDay(d).slice(0, 7);

function dateRange(f: Period) {
  const to = f.to ? new Date(`${f.to}T23:59:59.999`) : new Date();
  const from = f.from ? new Date(`${f.from}T00:00:00`) : new Date(Date.now() - 30 * 86400000);
  return { from, to };
}

/** Filtro base de ventas completadas del periodo (y sucursal, si se eligió). */
function completedSales(orgId: string, from: Date, to: Date, locationId?: string) {
  return {
    organizationId: orgId,
    status: "completed" as const,
    createdAt: { gte: from, lte: to },
    ...(locationId ? { locationId } : {}),
  };
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  wallet: "Monedero / transferencia",
  points: "Puntos",
  credit: "Crédito",
  other: "Otro",
};

const SEGMENT_LABELS: Record<string, string> = {
  vip: "VIP",
  regular: "Frecuentes",
  at_risk: "En riesgo",
  dormant: "Inactivos",
  new: "Nuevos",
  coupon_hunter: "Buscadores de promociones",
};

/** Nombres de sucursales y CEDIS: el inventario puede vivir en cualquiera. */
async function stockPlaceNames(orgId: string) {
  const [locations, cedis] = await Promise.all([
    prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.cedi.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
  ]);
  return new Map([...locations, ...cedis].map((l) => [l.id, l.name]));
}

// ── Resumen del periodo (con comparación contra el periodo anterior) ─────

export interface PeriodTotals {
  sales: number;
  tickets: number;
  avgTicket: number;
  units: number;
  grossMargin: number;
  marginPct: number;
  discounts: number;
  refunds: number;
  customers: number;
}

async function periodTotals(orgId: string, from: Date, to: Date, locationId?: string): Promise<PeriodTotals> {
  const where = completedSales(orgId, from, to, locationId);
  const [agg, items, customers, refunds] = await Promise.all([
    prisma.sale.aggregate({ where, _sum: { total: true, discount: true }, _count: true }),
    prisma.saleItem.findMany({ where: { sale: where }, select: { quantity: true, unitCost: true, lineTotal: true, totalPrice: true } }),
    prisma.sale.groupBy({ by: ["customerId"], where: { ...where, customerId: { not: null } } }),
    prisma.saleReturn.aggregate({
      where: { organizationId: orgId, status: "completed", returnType: "refund", createdAt: { gte: from, lte: to }, ...(locationId ? { locationId } : {}) },
      _sum: { total: true },
    }),
  ]);
  const sales = num(agg._sum.total);
  let units = 0;
  let revenue = 0;
  let cost = 0;
  for (const i of items) {
    units += num(i.quantity);
    revenue += num(i.lineTotal ?? i.totalPrice);
    cost += num(i.unitCost) * num(i.quantity);
  }
  const grossMargin = revenue - cost;
  return {
    sales: round2(sales),
    tickets: agg._count,
    avgTicket: agg._count > 0 ? round2(sales / agg._count) : 0,
    units: round2(units),
    grossMargin: round2(grossMargin),
    marginPct: pct(grossMargin, revenue),
    discounts: round2(num(agg._sum.discount)),
    refunds: round2(num(refunds._sum.total)),
    customers: customers.length,
  };
}

export async function getPeriodSummary(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  const [current, previous] = await Promise.all([
    periodTotals(orgId, from, to, f.locationId),
    periodTotals(orgId, prevFrom, prevTo, f.locationId),
  ]);
  return {
    current,
    previous,
    range: { from: localDay(from), to: localDay(to) },
    previousRange: { from: localDay(prevFrom), to: localDay(prevTo) },
  };
}

// ── 7. Omnichannel Sales ─────────────────────────────────────────────────

export interface OmnichannelRow {
  locationName: string;
  posSales: number;
  portalSales: number;
  total: number;
  pctWeb: number;
  aovPos: number;
  aovPortal: number;
  posCount: number;
  portalCount: number;
}

export async function getOmnichannelReport(orgId: string, f: Period) {
  const { from, to } = dateRange(f);

  // La venta es la fuente contable. Un pedido del portal puede existir antes
  // del pago y, cuando se cobra, queda ligado a una Sale; sumar ambas tablas
  // duplicaba el ingreso y además incluía pedidos pendientes/cancelados.
  const sales = await prisma.sale.findMany({
    where: completedSales(orgId, from, to, f.locationId),
    select: { locationId: true, total: true, location: { select: { name: true } }, orders: { take: 1, select: { id: true } } },
  });

  const locationMap = new Map<string, { name: string; pos: number; posCount: number; portal: number; portalCount: number }>();
  for (const s of sales) {
    const loc = locationMap.get(s.locationId) ?? { name: s.location.name, pos: 0, posCount: 0, portal: 0, portalCount: 0 };
    if (s.orders.length > 0) {
      loc.portal += num(s.total);
      loc.portalCount += 1;
    } else {
      loc.pos += num(s.total);
      loc.posCount += 1;
    }
    locationMap.set(s.locationId, loc);
  }

  const rows: OmnichannelRow[] = [...locationMap.values()].map((v) => {
    const total = v.pos + v.portal;
    return {
      locationName: v.name,
      posSales: round2(v.pos),
      portalSales: round2(v.portal),
      total: round2(total),
      pctWeb: pct(v.portal, total),
      aovPos: v.posCount > 0 ? round2(v.pos / v.posCount) : 0,
      aovPortal: v.portalCount > 0 ? round2(v.portal / v.portalCount) : 0,
      posCount: v.posCount,
      portalCount: v.portalCount,
    };
  }).sort((a, b) => b.total - a.total);

  const t = rows.reduce(
    (acc, r) => ({
      posSales: acc.posSales + r.posSales,
      portalSales: acc.portalSales + r.portalSales,
      total: acc.total + r.total,
      posCount: acc.posCount + r.posCount,
      portalCount: acc.portalCount + r.portalCount,
    }),
    { posSales: 0, portalSales: 0, total: 0, posCount: 0, portalCount: 0 }
  );

  return {
    rows,
    totals: {
      posSales: round2(t.posSales),
      portalSales: round2(t.portalSales),
      total: round2(t.total),
      posCount: t.posCount,
      portalCount: t.portalCount,
      aovPos: t.posCount > 0 ? round2(t.posSales / t.posCount) : 0,
      aovPortal: t.portalCount > 0 ? round2(t.portalSales / t.portalCount) : 0,
      pctWeb: pct(t.portalSales, t.total),
    },
  };
}

// ── 8. Hourly Heatmap ────────────────────────────────────────────────────

export interface HeatmapCell {
  dayOfWeek: number; // 0=Sun..6=Sat
  hour: number;
  sales: number;
  count: number;
}

export async function getHourlyHeatmap(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const sales = await prisma.sale.findMany({
    where: completedSales(orgId, from, to, f.locationId),
    select: { createdAt: true, total: true },
  });

  const grid: HeatmapCell[][] = Array.from({ length: 7 }, (_, dow) =>
    Array.from({ length: 24 }, (_, h) => ({ dayOfWeek: dow, hour: h, sales: 0, count: 0 }))
  );
  for (const s of sales) {
    const cell = grid[s.createdAt.getDay()][s.createdAt.getHours()];
    cell.sales += num(s.total);
    cell.count += 1;
  }
  for (const row of grid) for (const cell of row) cell.sales = round2(cell.sales);

  // Resúmenes útiles para leer el mapa sin tener que buscar la celda.
  const cells = grid.flat();
  const peak = cells.reduce((best, c) => (c.sales > best.sales ? c : best), cells[0]);
  const byDay = grid.map((row, dow) => ({ dayOfWeek: dow, sales: round2(row.reduce((s, c) => s + c.sales, 0)), count: row.reduce((s, c) => s + c.count, 0) }));
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: round2(grid.reduce((s, row) => s + row[h].sales, 0)), count: grid.reduce((s, row) => s + row[h].count, 0) }));

  return { grid, peak: peak.sales > 0 ? peak : null, byDay, byHour, totalCount: sales.length };
}

// ── 9. Inventory Valuation ───────────────────────────────────────────────

export interface InventoryValuationRow {
  categoryName: string;
  valueAtCost: number;
  valueAtRetail: number;
  potentialMargin: number;
  units: number;
  rotation: number;
  productCount: number;
  outOfStock: number;
}

export async function getInventoryValuation(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const locFilter = f.locationId ? { locationId: f.locationId } : {};

  const [inventory, soldItems] = await Promise.all([
    prisma.inventory.findMany({
      where: { organizationId: orgId, ...locFilter },
      include: {
        product: { select: { id: true, categoryId: true, category: { select: { name: true } } } },
        variant: { select: { price: true, cost: true, product: { select: { categoryId: true, category: { select: { name: true } } } } } },
      },
    }),
    prisma.saleItem.findMany({
      where: { sale: completedSales(orgId, from, to, f.locationId) },
      select: { quantity: true, product: { select: { categoryId: true } } },
    }),
  ]);

  // Precio del producto sin variante específica: su variante "Default".
  const productIds = [...new Set(inventory.filter((i) => !i.variantId).map((i) => i.productId).filter(Boolean))] as string[];
  const defaultVariants = await prisma.productVariant.findMany({
    where: { productId: { in: productIds }, name: "Default" },
    select: { productId: true, price: true, cost: true },
  });
  const defaultPrices = new Map(defaultVariants.map((v) => [v.productId, { price: num(v.price), cost: num(v.cost) }]));

  const soldByCategory = new Map<string, number>();
  for (const item of soldItems) {
    const catId = item.product?.categoryId ?? "uncategorized";
    soldByCategory.set(catId, (soldByCategory.get(catId) ?? 0) + num(item.quantity));
  }

  const catMap = new Map<string, { name: string; cost: number; retail: number; stock: number; count: number; outOfStock: number }>();
  for (const inv of inventory) {
    const product = inv.product ?? inv.variant?.product ?? null;
    const catId = product?.categoryId ?? "uncategorized";
    const catName = product?.category?.name ?? "Sin categoría";
    const qty = num(inv.quantity);
    const costPrice = inv.variant ? num(inv.variant.cost) : (defaultPrices.get(inv.productId ?? "")?.cost ?? 0);
    const retailPrice = inv.variant ? num(inv.variant.price) : (defaultPrices.get(inv.productId ?? "")?.price ?? 0);

    const cat = catMap.get(catId) ?? { name: catName, cost: 0, retail: 0, stock: 0, count: 0, outOfStock: 0 };
    const positive = Math.max(0, qty);
    cat.cost += positive * costPrice;
    cat.retail += positive * retailPrice;
    cat.stock += positive;
    cat.count += 1;
    if (qty <= 0) cat.outOfStock += 1;
    catMap.set(catId, cat);
  }

  const rows: InventoryValuationRow[] = [...catMap.entries()].map(([catId, v]) => ({
    categoryName: v.name,
    valueAtCost: round2(v.cost),
    valueAtRetail: round2(v.retail),
    potentialMargin: round2(v.retail - v.cost),
    units: round2(v.stock),
    rotation: v.stock > 0 ? round2((soldByCategory.get(catId) ?? 0) / v.stock) : 0,
    productCount: v.count,
    outOfStock: v.outOfStock,
  })).sort((a, b) => b.valueAtCost - a.valueAtCost);

  const totalCost = rows.reduce((a, r) => a + r.valueAtCost, 0);
  const totalRetail = rows.reduce((a, r) => a + r.valueAtRetail, 0);

  return {
    rows,
    totals: {
      valueAtCost: round2(totalCost),
      valueAtRetail: round2(totalRetail),
      potentialMargin: round2(totalRetail - totalCost),
      units: round2(rows.reduce((a, r) => a + r.units, 0)),
      productCount: rows.reduce((a, r) => a + r.productCount, 0),
      outOfStock: rows.reduce((a, r) => a + r.outOfStock, 0),
    },
  };
}

// ── 11. Product Ranking ──────────────────────────────────────────────────

export interface ProductRankingRow {
  productName: string;
  categoryName: string;
  quantity: number;
  revenue: number;
  margin: number;
  marginPct: number;
  sharePct: number;
}

export async function getProductRanking(orgId: string, f: Period, sort: "quantity" | "revenue" | "margin" = "revenue") {
  const { from, to } = dateRange(f);
  const items = await prisma.saleItem.findMany({
    where: { sale: completedSales(orgId, from, to, f.locationId) },
    select: {
      productId: true,
      productName: true,
      quantity: true,
      lineTotal: true,
      totalPrice: true,
      unitCost: true,
      product: { select: { category: { select: { name: true } } } },
    },
  });

  // Se agrupa por producto (no por nombre): dos productos homónimos no se mezclan.
  const productMap = new Map<string, { name: string; category: string; qty: number; revenue: number; cost: number }>();
  for (const i of items) {
    const key = i.productId ?? `name:${i.productName}`;
    const p = productMap.get(key) ?? { name: i.productName, category: i.product?.category?.name ?? "Sin categoría", qty: 0, revenue: 0, cost: 0 };
    p.qty += num(i.quantity);
    p.revenue += num(i.lineTotal ?? i.totalPrice);
    p.cost += num(i.unitCost) * num(i.quantity);
    productMap.set(key, p);
  }

  const totalRevenue = [...productMap.values()].reduce((s, p) => s + p.revenue, 0);
  const rows: ProductRankingRow[] = [...productMap.values()].map((p) => ({
    productName: p.name,
    categoryName: p.category,
    quantity: round2(p.qty),
    revenue: round2(p.revenue),
    margin: round2(p.revenue - p.cost),
    marginPct: pct(p.revenue - p.cost, p.revenue),
    sharePct: pct(p.revenue, totalRevenue),
  }));

  rows.sort((a, b) => (sort === "quantity" ? b.quantity - a.quantity : sort === "margin" ? b.margin - a.margin : b.revenue - a.revenue));
  return { rows: rows.slice(0, 50), total: rows.length, totalRevenue: round2(totalRevenue) };
}

// ── 13. Customer Cohorts ─────────────────────────────────────────────────

export interface CohortRow {
  cohort: string; // "2026-01"
  initialCount: number;
  retention: (number | null)[]; // % per month offset
}

export async function getCustomerCohorts(orgId: string, months: number = 6, locationId?: string) {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  // La primera compra se busca en TODO el historial: si solo se miraba la
  // ventana, un cliente antiguo aparecía como "nuevo" en el primer mes.
  const [windowSales, earlier] = await Promise.all([
    prisma.sale.findMany({
      where: { organizationId: orgId, status: "completed", customerId: { not: null }, createdAt: { gte: startMonth }, ...(locationId ? { locationId } : {}) },
      select: { customerId: true, createdAt: true },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: { organizationId: orgId, status: "completed", customerId: { not: null }, createdAt: { lt: startMonth }, ...(locationId ? { locationId } : {}) },
    }),
  ]);
  const returning = new Set(earlier.map((e) => e.customerId!));

  const firstPurchase = new Map<string, string>();
  const customerMonths = new Map<string, Set<string>>();
  for (const s of windowSales) {
    const cid = s.customerId!;
    const month = localMonth(s.createdAt);
    const existing = firstPurchase.get(cid);
    if (!existing || month < existing) firstPurchase.set(cid, month);
    const set = customerMonths.get(cid) ?? new Set<string>();
    set.add(month);
    customerMonths.set(cid, set);
  }

  const cohortMonths: string[] = [];
  for (let i = 0; i < months; i++) cohortMonths.push(localMonth(new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1)));

  const cohorts: CohortRow[] = cohortMonths.map((cohortMonth, cohortIdx) => {
    const members = [...firstPurchase.entries()].filter(([cid, fp]) => fp === cohortMonth && !returning.has(cid)).map(([cid]) => cid);
    if (members.length === 0) return { cohort: cohortMonth, initialCount: 0, retention: [] };
    const retention: (number | null)[] = [];
    for (let offset = 0; offset < months - cohortIdx; offset++) {
      const target = cohortMonths[cohortIdx + offset];
      const active = members.filter((cid) => customerMonths.get(cid)?.has(target)).length;
      retention.push(pct(active, members.length));
    }
    return { cohort: cohortMonth, initialCount: members.length, retention };
  });

  return { cohorts, months: cohortMonths, newCustomers: cohorts.reduce((s, c) => s + c.initialCount, 0) };
}

// ── 11. Employee Ranking ───────────────────────────────────────────────

export interface EmployeeRankingRow {
  employeeName: string;
  totalSales: number;
  saleCount: number;
  avgTicket: number;
  totalUnits: number;
  unitsPerTicket: number;
  sharePct: number;
}

export async function getEmployeeRanking(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const sales = await prisma.sale.findMany({
    where: completedSales(orgId, from, to, f.locationId),
    select: { total: true, employeeId: true, employee: { select: { fullName: true } }, items: { select: { quantity: true } } },
  });

  const map = new Map<string, { name: string; total: number; count: number; units: number }>();
  for (const s of sales) {
    const key = s.employeeId ?? "none";
    const e = map.get(key) ?? { name: s.employee?.fullName ?? "Sin empleado", total: 0, count: 0, units: 0 };
    e.total += num(s.total);
    e.count += 1;
    e.units += s.items.reduce((a, i) => a + num(i.quantity), 0);
    map.set(key, e);
  }
  const grand = [...map.values()].reduce((s, e) => s + e.total, 0);
  const rows: EmployeeRankingRow[] = [...map.values()].map((e) => ({
    employeeName: e.name,
    totalSales: round2(e.total),
    saleCount: e.count,
    avgTicket: e.count > 0 ? round2(e.total / e.count) : 0,
    totalUnits: round2(e.units),
    unitsPerTicket: e.count > 0 ? round2(e.units / e.count) : 0,
    sharePct: pct(e.total, grand),
  })).sort((a, b) => b.totalSales - a.totalSales);
  return { rows };
}

// ── 12. Customer Loyalty Summary ───────────────────────────────────────

export interface LoyaltyRow {
  customerId: string;
  customerName: string;
  totalPoints: number;
  pointsBalance: number;
  totalSpent: number;
  orderCount: number;
  avgTicket: number;
  lastOrderDate: string | null;
}

export async function getLoyaltySummary(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const saleWhere = { status: "completed" as const, createdAt: { gte: from, lte: to }, ...(f.locationId ? { locationId: f.locationId } : {}) };
  // Solo clientes con actividad en el periodo: antes se listaban todos.
  const customers = await prisma.customer.findMany({
    where: {
      organizationId: orgId,
      OR: [{ sales: { some: saleWhere } }, { loyaltyTransactions: { some: { createdAt: { gte: from, lte: to } } } }],
    },
    select: {
      id: true,
      fullName: true,
      points: true,
      loyaltyTransactions: { where: { createdAt: { gte: from, lte: to } }, select: { points: true } },
      sales: { where: saleWhere, select: { total: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });

  const rows: LoyaltyRow[] = customers.map((c) => {
    const spent = c.sales.reduce((a, s) => a + num(s.total), 0);
    return {
      customerId: c.id,
      customerName: c.fullName,
      totalPoints: round2(c.loyaltyTransactions.reduce((a, t) => a + num(t.points), 0)),
      pointsBalance: round2(num(c.points)),
      totalSpent: round2(spent),
      orderCount: c.sales.length,
      avgTicket: c.sales.length > 0 ? round2(spent / c.sales.length) : 0,
      lastOrderDate: c.sales[0] ? localDay(c.sales[0].createdAt) : null,
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent);

  return {
    rows: rows.slice(0, 200),
    totals: {
      activeCustomers: rows.length,
      pointsIssued: round2(rows.reduce((a, r) => a + Math.max(0, r.totalPoints), 0)),
      pointsBalance: round2(rows.reduce((a, r) => a + r.pointsBalance, 0)),
      repeatCustomers: rows.filter((r) => r.orderCount > 1).length,
    },
  };
}

// ── 13. Credit Aging ───────────────────────────────────────────────────

export interface CreditAgingRow {
  customerId: string;
  customerName: string;
  balance: number;
  creditLimit: number | null;
  usagePct: number | null;
  oldestDebtDate: string | null;
  daysOverdue: number;
  agingBucket: string;
}

export const AGING_BUCKETS = ["Al corriente", "1–30 días", "31–60 días", "61–90 días", "Más de 90 días"] as const;

function agingBucket(days: number) {
  if (days > 90) return AGING_BUCKETS[4];
  if (days > 60) return AGING_BUCKETS[3];
  if (days > 30) return AGING_BUCKETS[2];
  if (days > 0) return AGING_BUCKETS[1];
  return AGING_BUCKETS[0];
}

export async function getCreditAging(orgId: string) {
  const credits = await prisma.customerCredit.findMany({
    where: { organizationId: orgId, currentBalance: { gt: 0 } },
    include: {
      customer: { select: { fullName: true } },
      transactions: { select: { createdAt: true, dueDate: true, balanceAfter: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const now = Date.now();
  const rows: CreditAgingRow[] = credits.map((c) => {
    // FIFO: cada aumento de saldo abre una "capa" de deuda y cada abono
    // liquida primero la más antigua. La deuda vigente más vieja define la
    // antigüedad (antes se tomaba el primer cargo, aunque ya estuviera pagado).
    const layers: { amount: number; createdAt: Date; dueDate: Date | null }[] = [];
    let prev = 0;
    for (const t of c.transactions) {
      const after = num(t.balanceAfter);
      let delta = round2(after - prev);
      prev = after;
      if (delta > 0) layers.push({ amount: delta, createdAt: t.createdAt, dueDate: t.dueDate });
      while (delta < 0 && layers.length) {
        const head = layers[0];
        const used = Math.min(head.amount, -delta);
        head.amount = round2(head.amount - used);
        delta = round2(delta + used);
        if (head.amount <= 0) layers.shift();
      }
    }
    const oldest = layers[0];
    const reference = oldest?.dueDate ?? oldest?.createdAt ?? null;
    const daysOverdue = reference ? Math.max(0, Math.floor((now - reference.getTime()) / 86400000)) : 0;
    const balance = num(c.currentBalance);
    const limit = c.creditLimit != null ? num(c.creditLimit) : null;
    return {
      customerId: c.customerId,
      customerName: c.customer.fullName,
      balance: round2(balance),
      creditLimit: limit,
      usagePct: limit && limit > 0 ? pct(balance, limit) : null,
      oldestDebtDate: oldest ? localDay(oldest.createdAt) : null,
      daysOverdue,
      agingBucket: agingBucket(daysOverdue),
    };
  }).sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);

  const buckets = AGING_BUCKETS.map((label) => {
    const inBucket = rows.filter((r) => r.agingBucket === label);
    return { label, count: inBucket.length, balance: round2(inBucket.reduce((s, r) => s + r.balance, 0)) };
  });
  const total = rows.reduce((s, r) => s + r.balance, 0);
  const overdue = rows.filter((r) => r.daysOverdue > 0).reduce((s, r) => s + r.balance, 0);
  return { rows, buckets, totals: { balance: round2(total), overdue: round2(overdue), overduePct: pct(overdue, total), customers: rows.length } };
}

// ── 14. Promotions ROI ─────────────────────────────────────────────────

export interface PromoRoiRow {
  promotionId: string;
  promotionName: string;
  discountGiven: number;
  ordersCount: number;
  revenueGenerated: number;
  avgTicket: number;
  roi: number;
}

export async function getPromotionsRoi(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const saleWhere = { createdAt: { gte: from, lte: to }, status: "completed" as const, ...(f.locationId ? { locationId: f.locationId } : {}) };
  const promos = await prisma.promotion.findMany({
    where: { organizationId: orgId, saleDiscounts: { some: { sale: saleWhere } } },
    include: {
      saleDiscounts: { where: { sale: saleWhere }, select: { amount: true, saleId: true, sale: { select: { total: true } } } },
    },
  });

  const rows: PromoRoiRow[] = promos.map((p) => {
    // Una venta puede tener varias líneas de la misma promoción: el ingreso
    // se cuenta una vez por venta.
    const perSale = new Map<string, number>();
    for (const d of p.saleDiscounts) perSale.set(d.saleId, num(d.sale?.total));
    const revenueGenerated = [...perSale.values()].reduce((a, v) => a + v, 0);
    const discountGiven = p.saleDiscounts.reduce((a, d) => a + num(d.amount), 0);
    return {
      promotionId: p.id,
      promotionName: p.name,
      discountGiven: round2(discountGiven),
      ordersCount: perSale.size,
      revenueGenerated: round2(revenueGenerated),
      avgTicket: perSale.size > 0 ? round2(revenueGenerated / perSale.size) : 0,
      roi: discountGiven > 0 ? round2(((revenueGenerated - discountGiven) / discountGiven) * 100) : 0,
    };
  }).sort((a, b) => b.revenueGenerated - a.revenueGenerated);

  return { rows };
}

// ── 15. Delivery Performance ────────────────────────────────────────────

export interface DeliveryPerfRow {
  locationName: string;
  totalOrders: number;
  delivered: number;
  revenue: number;
  avgPrepMinutes: number | null;
  avgDeliveryMinutes: number | null;
  avgTotalMinutes: number | null;
  onTimeRate: number | null;
  cancelRate: number;
}

export async function getDeliveryPerformance(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const orders = await prisma.order.findMany({
    where: { organizationId: orgId, createdAt: { gte: from, lte: to }, deliveryMethod: "delivery", ...(f.locationId ? { locationId: f.locationId } : {}) },
    select: {
      total: true, status: true, createdAt: true,
      location: { select: { name: true } },
      preparation: { select: { startedAt: true, completedAt: true, elapsedSeconds: true } },
      statusHistory: { select: { status: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });

  type Acc = { total: number; delivered: number; cancelled: number; revenue: number; prep: number; prepN: number; ride: number; rideN: number; full: number; fullN: number };
  const map = new Map<string, Acc>();
  for (const o of orders) {
    const loc = o.location?.name ?? "Sin sucursal";
    const a = map.get(loc) ?? { total: 0, delivered: 0, cancelled: 0, revenue: 0, prep: 0, prepN: 0, ride: 0, rideN: 0, full: 0, fullN: 0 };
    a.total += 1;
    if (o.status === "cancelled") a.cancelled += 1;
    const prepSeconds = o.preparation?.elapsedSeconds ?? (
      o.preparation?.startedAt && o.preparation.completedAt
        ? Math.max(0, (o.preparation.completedAt.getTime() - o.preparation.startedAt.getTime()) / 1000)
        : null
    );
    if (prepSeconds != null) { a.prep += prepSeconds / 60; a.prepN += 1; }
    const departed = o.statusHistory.find((h) => h.status === "in_transit")?.createdAt;
    const delivered = o.statusHistory.find((h) => h.status === "delivered")?.createdAt;
    if (delivered) {
      a.delivered += 1;
      a.revenue += num(o.total);
      a.full += (delivered.getTime() - o.createdAt.getTime()) / 60000;
      a.fullN += 1;
    }
    if (departed && delivered && delivered >= departed) { a.ride += (delivered.getTime() - departed.getTime()) / 60000; a.rideN += 1; }
    map.set(loc, a);
  }

  const avg = (s: number, n: number) => (n > 0 ? round2(s / n) : null);
  const rows: DeliveryPerfRow[] = [...map.entries()].map(([name, a]) => ({
    locationName: name,
    totalOrders: a.total,
    delivered: a.delivered,
    revenue: round2(a.revenue),
    avgPrepMinutes: avg(a.prep, a.prepN),
    avgDeliveryMinutes: avg(a.ride, a.rideN),
    avgTotalMinutes: avg(a.full, a.fullN),
    // No existe una promesa/ETA persistida contra la cual medir puntualidad.
    onTimeRate: null,
    cancelRate: pct(a.cancelled, a.total),
  })).sort((x, y) => y.totalOrders - x.totalOrders);

  return { rows };
}

// ── 16. Low Stock Alerts ───────────────────────────────────────────────

export interface LowStockRow {
  productId: string;
  productName: string;
  locationName: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  deficit: number;
  coveragePct: number;
}

export async function getLowStockAlerts(orgId: string, locationId?: string) {
  const [inventories, places] = await Promise.all([
    prisma.inventory.findMany({
      where: { organizationId: orgId, minThreshold: { gt: 0 }, ...(locationId ? { locationId } : {}) },
      include: {
        product: { select: { id: true, name: true, isActive: true } },
        variant: { select: { name: true, product: { select: { id: true, name: true, isActive: true } } } },
      },
    }),
    stockPlaceNames(orgId),
  ]);

  const rows: LowStockRow[] = inventories
    .filter((inv) => num(inv.quantity) <= num(inv.minThreshold))
    .flatMap((inv) => {
      const product = inv.product ?? inv.variant?.product ?? null;
      if (!product || product.isActive === false) return [];
      const min = num(inv.minThreshold);
      const qty = num(inv.quantity);
      const variant = inv.variant?.name && inv.variant.name !== "Default" ? ` · ${inv.variant.name}` : "";
      return [{
        productId: product.id,
        productName: `${product.name}${variant}`,
        locationName: places.get(inv.locationId) ?? "Sin ubicación",
        currentStock: round2(qty),
        minStock: round2(min),
        // Nivel objetivo sugerido: el doble del mínimo configurado.
        maxStock: round2(min * 2),
        deficit: round2(Math.max(0, min * 2 - qty)),
        coveragePct: pct(Math.max(0, qty), min),
      }];
    })
    // Lo más crítico primero: menor cobertura del mínimo.
    .sort((a, b) => a.coveragePct - b.coveragePct || b.deficit - a.deficit);

  return {
    rows,
    totals: { alerts: rows.length, empty: rows.filter((r) => r.currentStock <= 0).length, unitsToOrder: round2(rows.reduce((s, r) => s + r.deficit, 0)) },
  };
}

// ── 17. Customer Segmentation ───────────────────────────────────────────

export interface SegmentationRow {
  segment: string;
  segmentType: string;
  customerCount: number;
  sharePct: number;
  avgSpent: number;
  avgOrders: number;
}

export async function getCustomerSegmentation(orgId: string) {
  const segments = await prisma.customerSegment.findMany({
    where: { organizationId: orgId },
    include: { customer: { select: { sales: { where: { status: "completed" }, select: { total: true } } } } },
  });

  const map = new Map<string, { count: number; totalSpent: number; totalOrders: number }>();
  for (const s of segments) {
    const bucket = map.get(s.segment) ?? { count: 0, totalSpent: 0, totalOrders: 0 };
    bucket.count += 1;
    bucket.totalSpent += s.customer.sales.reduce((sum, sale) => sum + num(sale.total), 0);
    bucket.totalOrders += s.customer.sales.length;
    map.set(s.segment, bucket);
  }

  const totalCustomers = [...map.values()].reduce((s, b) => s + b.count, 0);
  const rows: SegmentationRow[] = [...map.entries()].map(([type, d]) => ({
    segment: type,
    segmentType: SEGMENT_LABELS[type] ?? type.replace(/_/g, " "),
    customerCount: d.count,
    sharePct: pct(d.count, totalCustomers),
    avgSpent: d.count > 0 ? round2(d.totalSpent / d.count) : 0,
    avgOrders: d.count > 0 ? round2(d.totalOrders / d.count) : 0,
  })).sort((a, b) => b.customerCount - a.customerCount);

  return { rows };
}

// ── 18. Margin Analysis ────────────────────────────────────────────────

export interface MarginRow {
  categoryName: string;
  revenue: number;
  costOfGoods: number;
  margin: number;
  marginPct: number;
  units: number;
}

export async function getMarginAnalysis(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const items = await prisma.saleItem.findMany({
    where: { sale: completedSales(orgId, from, to, f.locationId) },
    select: { lineTotal: true, totalPrice: true, unitCost: true, quantity: true, product: { select: { category: { select: { name: true } } } } },
  });

  const map = new Map<string, { revenue: number; cost: number; units: number }>();
  for (const item of items) {
    const cat = item.product?.category?.name ?? "Sin categoría";
    const e = map.get(cat) ?? { revenue: 0, cost: 0, units: 0 };
    e.revenue += num(item.lineTotal ?? item.totalPrice);
    e.cost += num(item.unitCost) * num(item.quantity);
    e.units += num(item.quantity);
    map.set(cat, e);
  }

  const rows: MarginRow[] = [...map.entries()].map(([name, d]) => ({
    categoryName: name,
    revenue: round2(d.revenue),
    costOfGoods: round2(d.cost),
    margin: round2(d.revenue - d.cost),
    marginPct: pct(d.revenue - d.cost, d.revenue),
    units: round2(d.units),
  })).sort((a, b) => b.margin - a.margin);

  // Productos vendidos sin costo capturado inflan el margen: se reporta.
  const missingCost = items.filter((i) => num(i.unitCost) <= 0).length;
  return { rows, missingCost, itemCount: items.length };
}

// ── 19. Daily Sales Trend ──────────────────────────────────────────────

export interface DailyTrendRow {
  date: string;
  totalSales: number;
  orderCount: number;
  avgTicket: number;
}

export async function getDailyTrend(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const sales = await prisma.sale.findMany({
    where: completedSales(orgId, from, to, f.locationId),
    select: { total: true, createdAt: true },
  });

  const map = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    const day = localDay(s.createdAt);
    const e = map.get(day) ?? { total: 0, count: 0 };
    e.total += num(s.total);
    e.count += 1;
    map.set(day, e);
  }

  // Se incluyen los días sin venta (en cero): omitirlos deformaba la gráfica.
  const rows: DailyTrendRow[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; cursor <= to && i < 400; i++) {
    const key = localDay(cursor);
    const d = map.get(key);
    rows.push({ date: key, totalSales: round2(d?.total ?? 0), orderCount: d?.count ?? 0, avgTicket: d && d.count > 0 ? round2(d.total / d.count) : 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { rows };
}

// ── 20. Payment Method Mix ─────────────────────────────────────────────

export interface PaymentMixRow {
  method: string;
  methodKey: string;
  count: number;
  total: number;
  avgAmount: number;
  pct: number;
}

export async function getPaymentMix(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const payments = await prisma.salePayment.findMany({
    where: { sale: completedSales(orgId, from, to, f.locationId) },
    select: { method: true, amount: true },
  });

  const grandTotal = payments.reduce((a, p) => a + num(p.amount), 0);
  const map = new Map<string, { count: number; total: number }>();
  for (const p of payments) {
    const method = p.method ?? "other";
    const e = map.get(method) ?? { count: 0, total: 0 };
    e.count += 1;
    e.total += num(p.amount);
    map.set(method, e);
  }

  const rows: PaymentMixRow[] = [...map.entries()].map(([method, d]) => ({
    method: PAYMENT_LABELS[method] ?? method,
    methodKey: method,
    count: d.count,
    total: round2(d.total),
    avgAmount: d.count > 0 ? round2(d.total / d.count) : 0,
    pct: pct(d.total, grandTotal),
  })).sort((a, b) => b.total - a.total);

  return { rows };
}

// ── 21. Product Pairs (Market Basket) ──────────────────────────────────

export interface ProductPairRow {
  productA: string;
  productB: string;
  timesTogether: number;
  supportPct: number;
  avgRevenue: number;
}

export async function getProductPairs(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const sales = await prisma.sale.findMany({
    where: completedSales(orgId, from, to, f.locationId),
    select: { total: true, items: { where: { productId: { not: null } }, select: { productId: true, productName: true } } },
  });
  const pairs = new Map<string, { productA: string; productB: string; count: number; revenue: number }>();
  let multiItem = 0;
  for (const sale of sales) {
    const products = [...new Map(sale.items.map((item) => [item.productId!, item.productName])).entries()].sort(([a], [b]) => a.localeCompare(b));
    if (products.length > 1) multiItem += 1;
    for (let i = 0; i < products.length; i += 1) {
      for (let j = i + 1; j < products.length; j += 1) {
        const key = `${products[i][0]}:${products[j][0]}`;
        const pair = pairs.get(key) ?? { productA: products[i][1], productB: products[j][1], count: 0, revenue: 0 };
        pair.count += 1;
        pair.revenue += num(sale.total);
        pairs.set(key, pair);
      }
    }
  }
  const rows: ProductPairRow[] = [...pairs.values()]
    .map((pair) => ({
      productA: pair.productA,
      productB: pair.productB,
      timesTogether: pair.count,
      // Soporte: en qué porcentaje de todos los tickets aparece la pareja.
      supportPct: pct(pair.count, sales.length),
      avgRevenue: pair.count > 0 ? round2(pair.revenue / pair.count) : 0,
    }))
    .sort((a, b) => b.timesTogether - a.timesTogether || b.avgRevenue - a.avgRevenue)
    .slice(0, 20);
  return { rows, tickets: sales.length, multiItemPct: pct(multiItem, sales.length) };
}

// ── 22. Transfer Efficiency ────────────────────────────────────────────

export interface TransferRow {
  id: string;
  fromLocation: string;
  toLocation: string;
  status: string;
  itemCount: number;
  totalQty: number;
  createdAt: string;
}

export async function getTransferEfficiency(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const transfers = await prisma.transfer.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: from, lte: to },
      ...(f.locationId ? { OR: [{ fromLocationId: f.locationId }, { toLocationId: f.locationId }] } : {}),
    },
    include: { items: { select: { quantity: true } } },
    orderBy: { createdAt: "desc" },
  });
  const places = await stockPlaceNames(orgId);

  const rows: TransferRow[] = transfers.map((t) => ({
    id: t.id,
    fromLocation: places.get(t.fromLocationId) ?? "—",
    toLocation: places.get(t.toLocationId) ?? "—",
    status: t.status,
    itemCount: t.items.length,
    totalQty: round2(t.items.reduce((a, i) => a + num(i.quantity), 0)),
    createdAt: localDay(t.createdAt),
  }));

  const byStatus = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    rows,
    totals: { total: rows.length, received: byStatus("received"), inTransit: byStatus("in_transit"), pending: byStatus("pending"), cancelled: byStatus("cancelled"), units: round2(rows.reduce((s, r) => s + r.totalQty, 0)) },
  };
}

// ── 23. Inventory Fill Rate ────────────────────────────────────────────

export interface FillRateRow {
  locationName: string;
  totalProducts: number;
  inStock: number;
  outOfStock: number;
  fillRate: number;
}

export async function getInventoryFillRate(orgId: string, locationId?: string) {
  const [inventories, places] = await Promise.all([
    prisma.inventory.findMany({ where: { organizationId: orgId, ...(locationId ? { locationId } : {}) }, select: { quantity: true, locationId: true } }),
    stockPlaceNames(orgId),
  ]);

  const map = new Map<string, { total: number; inStock: number }>();
  for (const inv of inventories) {
    const loc = places.get(inv.locationId) ?? "Sin ubicación";
    const e = map.get(loc) ?? { total: 0, inStock: 0 };
    e.total += 1;
    if (num(inv.quantity) > 0) e.inStock += 1;
    map.set(loc, e);
  }

  const rows: FillRateRow[] = [...map.entries()].map(([name, d]) => ({
    locationName: name,
    totalProducts: d.total,
    inStock: d.inStock,
    outOfStock: d.total - d.inStock,
    fillRate: pct(d.inStock, d.total),
  })).sort((a, b) => a.fillRate - b.fillRate);

  const total = rows.reduce((s, r) => s + r.totalProducts, 0);
  const inStock = rows.reduce((s, r) => s + r.inStock, 0);
  return { rows, totals: { totalProducts: total, inStock, outOfStock: total - inStock, fillRate: pct(inStock, total) } };
}

// ── 24. Employee Margin Analysis ───────────────────────────────────────

export interface EmployeeMarginRow {
  employeeName: string;
  totalRevenue: number;
  totalCost: number;
  margin: number;
  marginPct: number;
  saleCount: number;
  marginPerSale: number;
}

export async function getEmployeeMargin(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const sales = await prisma.sale.findMany({
    where: completedSales(orgId, from, to, f.locationId),
    select: {
      employeeId: true,
      employee: { select: { fullName: true } },
      items: { select: { lineTotal: true, totalPrice: true, unitCost: true, quantity: true } },
    },
  });

  const map = new Map<string, { name: string; revenue: number; cost: number; count: number }>();
  for (const s of sales) {
    const key = s.employeeId ?? "none";
    const e = map.get(key) ?? { name: s.employee?.fullName ?? "Sin empleado", revenue: 0, cost: 0, count: 0 };
    e.count += 1;
    for (const item of s.items) {
      e.revenue += num(item.lineTotal ?? item.totalPrice);
      e.cost += num(item.unitCost) * num(item.quantity);
    }
    map.set(key, e);
  }

  const rows: EmployeeMarginRow[] = [...map.values()].map((d) => ({
    employeeName: d.name,
    totalRevenue: round2(d.revenue),
    totalCost: round2(d.cost),
    margin: round2(d.revenue - d.cost),
    marginPct: pct(d.revenue - d.cost, d.revenue),
    saleCount: d.count,
    marginPerSale: d.count > 0 ? round2((d.revenue - d.cost) / d.count) : 0,
  })).sort((a, b) => b.margin - a.margin);

  return { rows };
}

// ── 25. Sales Forecast ─────────────────────────────────────────────────

export interface ForecastRow {
  date: string;
  predictedSales: number;
  low: number;
  high: number;
  confidence: number;
  sampleSize: number;
}

export async function getSalesForecast(orgId: string, days: number = 7, f: Period = {}) {
  const { from, to } = f.from || f.to ? dateRange(f) : { from: new Date(Date.now() - 60 * 86400000), to: new Date() };

  const sales = await prisma.sale.findMany({
    where: completedSales(orgId, from, to, f.locationId),
    select: { total: true, createdAt: true },
  });

  // Primero sumar por fecha (local); promediar tickets individuales
  // pronosticaba el ticket medio, no la venta diaria.
  const dailyTotals = new Map<string, number>();
  for (const s of sales) {
    const day = localDay(s.createdAt);
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + num(s.total));
  }
  const samplesByDow = new Map<number, number[]>();
  for (const [day, total] of dailyTotals) {
    const dow = new Date(`${day}T12:00:00`).getDay();
    const samples = samplesByDow.get(dow) ?? [];
    samples.push(total);
    samplesByDow.set(dow, samples);
  }

  const history = [...dailyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-21).map(([date, total]) => ({ date, total: round2(total) }));

  const rows: ForecastRow[] = [];
  for (let i = 1; i <= days; i++) {
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + i);
    const samples = samplesByDow.get(forecastDate.getDay()) ?? [];
    if (samples.length === 0) continue;
    const predicted = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const variance = samples.reduce((sum, value) => sum + (value - predicted) ** 2, 0) / samples.length;
    const sd = Math.sqrt(variance);
    const coefficientOfVariation = predicted > 0 ? sd / predicted : 1;
    const confidence = Math.max(10, Math.min(90, 35 + samples.length * 8 - coefficientOfVariation * 25));
    rows.push({
      date: localDay(forecastDate),
      predictedSales: round2(predicted),
      low: round2(Math.max(0, predicted - sd)),
      high: round2(predicted + sd),
      confidence: Math.round(confidence),
      sampleSize: samples.length,
    });
  }

  return { rows, history };
}

// ── Operación: mesas, citas, rentas ────────────────────────────────────

export async function getTablePerformance(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const sessions = await prisma.tableSession.findMany({
    where: { table: { organizationId: orgId, ...(f.locationId ? { locationId: f.locationId } : {}) }, startedAt: { gte: from, lte: to } },
    include: { table: { select: { number: true, name: true } }, order: { select: { total: true, status: true } } },
  });
  const map = new Map<string, { sessions: number; minutes: number; revenue: number }>();
  for (const session of sessions) {
    const name = session.table.name || `Mesa ${session.table.number}`;
    const row = map.get(name) ?? { sessions: 0, minutes: 0, revenue: 0 };
    row.sessions += 1;
    row.minutes += Math.max(0, Math.round(((session.endedAt ?? new Date()).getTime() - session.startedAt.getTime()) / 60000));
    if (session.order?.status === "delivered") row.revenue += num(session.order.total);
    map.set(name, row);
  }
  return {
    rows: [...map].map(([tableName, row]) => ({
      tableName,
      sessions: row.sessions,
      avgMinutes: row.sessions ? Math.round(row.minutes / row.sessions) : 0,
      revenue: round2(row.revenue),
      avgTicket: row.sessions ? round2(row.revenue / row.sessions) : 0,
    })).sort((a, b) => b.revenue - a.revenue),
  };
}

export async function getAppointmentsPerformance(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const appointments = await prisma.appointment.findMany({
    where: { organizationId: orgId, startsAt: { gte: from, lte: to }, ...(f.locationId ? { locationId: f.locationId } : {}) },
    include: { employee: { select: { fullName: true } }, sale: { select: { total: true } } },
  });
  const map = new Map<string, { total: number; completed: number; cancelled: number; noShow: number; revenue: number }>();
  for (const item of appointments) {
    const name = item.employee.fullName;
    const row = map.get(name) ?? { total: 0, completed: 0, cancelled: 0, noShow: 0, revenue: 0 };
    row.total++;
    if (item.status === "completed") row.completed++;
    if (item.status === "cancelled") row.cancelled++;
    if (item.status === "no_show") row.noShow++;
    row.revenue += num(item.sale?.total);
    map.set(name, row);
  }
  return {
    rows: [...map].map(([employeeName, row]) => ({ employeeName, ...row, attendancePct: pct(row.completed, row.total), revenue: round2(row.revenue) })).sort((a, b) => b.revenue - a.revenue),
  };
}

export async function getRentalPerformance(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const reservations = await prisma.reservation.findMany({
    where: { organizationId: orgId, startsAt: { gte: from, lte: to }, ...(f.locationId ? { locationId: f.locationId } : {}) },
    include: { location: { select: { name: true } }, items: { select: { quantity: true, lineTotal: true } }, sale: { select: { total: true } } },
  });
  const map = new Map<string, { reservations: number; completed: number; cancelled: number; units: number; revenue: number }>();
  for (const item of reservations) {
    const name = item.location?.name ?? "Sin sucursal";
    const row = map.get(name) ?? { reservations: 0, completed: 0, cancelled: 0, units: 0, revenue: 0 };
    row.reservations++;
    if (item.status === "completed") row.completed++;
    if (item.status === "cancelled") row.cancelled++;
    row.units += item.items.reduce((s, x) => s + num(x.quantity), 0);
    row.revenue += num(item.sale?.total) || item.items.reduce((s, x) => s + num(x.lineTotal), 0);
    map.set(name, row);
  }
  return { rows: [...map].map(([locationName, row]) => ({ locationName, ...row, units: round2(row.units), revenue: round2(row.revenue) })).sort((a, b) => b.revenue - a.revenue) };
}
