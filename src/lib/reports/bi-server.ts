import { prisma } from "@/lib/db";

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface Period {
  from?: string;
  to?: string;
  locationId?: string;
}

function dateRange(f: Period) {
  const to = f.to ? new Date(`${f.to}T23:59:59.999`) : new Date();
  const from = f.from ? new Date(`${f.from}T00:00:00`) : new Date(Date.now() - 30 * 86400000);
  return { from, to };
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
}

export async function getOmnichannelReport(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const locFilter = f.locationId ? { locationId: f.locationId } : {};

  const [posSales, portalOrders] = await Promise.all([
    prisma.sale.findMany({
      where: { organizationId: orgId, status: "completed", createdAt: { gte: from, lte: to }, ...locFilter },
      select: { locationId: true, total: true },
    }),
    prisma.order.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: from, lte: to },
        ...(f.locationId ? { locationId: f.locationId } : {}),
      },
      select: { locationId: true, total: true, deliveryMethod: true },
    }),
  ]);

  // Group by location
  const locationMap = new Map<string, { pos: number; posCount: number; portal: number; portalCount: number }>();

  for (const s of posSales) {
    const loc = locationMap.get(s.locationId) ?? { pos: 0, posCount: 0, portal: 0, portalCount: 0 };
    loc.pos += num(s.total);
    loc.posCount += 1;
    locationMap.set(s.locationId, loc);
  }

  for (const o of portalOrders) {
    const locId = o.locationId ?? "unassigned";
    const loc = locationMap.get(locId) ?? { pos: 0, posCount: 0, portal: 0, portalCount: 0 };
    loc.portal += num(o.total);
    loc.portalCount += 1;
    locationMap.set(locId, loc);
  }

  // Fetch location names
  const locIds = [...locationMap.keys()];
  const locations = await prisma.location.findMany({
    where: { id: { in: locIds } },
    select: { id: true, name: true },
  });
  const locNames = new Map(locations.map((l) => [l.id, l.name]));

  const rows: OmnichannelRow[] = [...locationMap.entries()].map(([locId, v]) => {
    const total = v.pos + v.portal;
    return {
      locationName: locNames.get(locId) ?? locId,
      posSales: round2(v.pos),
      portalSales: round2(v.portal),
      total: round2(total),
      pctWeb: total > 0 ? round2((v.portal / total) * 100) : 0,
      aovPos: v.posCount > 0 ? round2(v.pos / v.posCount) : 0,
      aovPortal: v.portalCount > 0 ? round2(v.portal / v.portalCount) : 0,
    };
  }).sort((a, b) => b.total - a.total);

  const totals = rows.reduce((acc, r) => ({
    posSales: acc.posSales + r.posSales,
    portalSales: acc.portalSales + r.portalSales,
    total: acc.total + r.total,
  }), { posSales: 0, portalSales: 0, total: 0 });

  return {
    rows,
    totals: {
      ...totals,
      pctWeb: totals.total > 0 ? round2((totals.portalSales / totals.total) * 100) : 0,
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
  const locFilter = f.locationId ? { locationId: f.locationId } : {};

  const sales = await prisma.sale.findMany({
    where: { organizationId: orgId, status: "completed", createdAt: { gte: from, lte: to }, ...locFilter },
    select: { createdAt: true, total: true },
  });

  // Build 7×24 grid
  const grid: HeatmapCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, (_, h) => ({ dayOfWeek: 0, hour: h, sales: 0, count: 0 }))
  );

  for (const s of sales) {
    const d = s.createdAt;
    const dow = d.getDay();
    const hour = d.getHours();
    grid[dow][hour].dayOfWeek = dow;
    grid[dow][hour].sales += num(s.total);
    grid[dow][hour].count += 1;
  }

  // Round
  for (const row of grid) {
    for (const cell of row) {
      cell.sales = round2(cell.sales);
    }
  }

  return { grid };
}

// ── 9. Inventory Valuation ───────────────────────────────────────────────

export interface InventoryValuationRow {
  categoryName: string;
  valueAtCost: number;
  valueAtRetail: number;
  rotation: number;
  productCount: number;
  outOfStock: number;
}

export async function getInventoryValuation(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const locFilter = f.locationId ? { locationId: f.locationId } : {};

  const inventory = await prisma.inventory.findMany({
    where: {
      organizationId: orgId,
      ...locFilter,
    },
    include: {
      product: { select: { id: true, name: true, categoryId: true } },
      variant: { select: { id: true, price: true, cost: true } },
    },
  });

  // Fetch categories
  const catIds = [...new Set(inventory.map((i) => i.product?.categoryId).filter(Boolean))] as string[];
  const categories = await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true },
  });
  const catNames = new Map(categories.map((c) => [c.id, c.name]));

  // Fetch default variant prices (for products without specific variant)
  const productIds = [...new Set(inventory.filter((i) => !i.variantId).map((i) => i.productId).filter(Boolean))] as string[];
  const defaultVariants = await prisma.productVariant.findMany({
    where: { productId: { in: productIds }, name: "Default" },
    select: { productId: true, price: true, cost: true },
  });
  const defaultPrices = new Map(defaultVariants.map((v) => [v.productId, { price: num(v.price), cost: num(v.cost) }]));

  const catMap = new Map<string, { cost: number; retail: number; count: number; outOfStock: number }>();

  for (const inv of inventory) {
    const catId = inv.product?.categoryId ?? "uncategorized";
    const qty = num(inv.quantity);
    const costPrice = inv.variant ? num(inv.variant.cost) : (defaultPrices.get(inv.productId ?? "")?.cost ?? 0);
    const retailPrice = inv.variant ? num(inv.variant.price) : (defaultPrices.get(inv.productId ?? "")?.price ?? 0);

    const cat = catMap.get(catId) ?? { cost: 0, retail: 0, count: 0, outOfStock: 0 };
    cat.cost += qty * costPrice;
    cat.retail += qty * retailPrice;
    cat.count += 1;
    if (qty <= 0) cat.outOfStock += 1;
    catMap.set(catId, cat);
  }

  const rows: InventoryValuationRow[] = [...catMap.entries()].map(([catId, v]) => ({
    categoryName: catNames.get(catId) ?? catId,
    valueAtCost: round2(v.cost),
    valueAtRetail: round2(v.retail),
    rotation: 0,
    productCount: v.count,
    outOfStock: v.outOfStock,
  })).sort((a, b) => b.valueAtCost - a.valueAtCost);

  const totalCost = rows.reduce((a, r) => a + r.valueAtCost, 0);
  const totalRetail = rows.reduce((a, r) => a + r.valueAtRetail, 0);

  return {
    rows,
    totals: { valueAtCost: round2(totalCost), valueAtRetail: round2(totalRetail), outOfStock: rows.reduce((a, r) => a + r.outOfStock, 0) },
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
}

export async function getProductRanking(orgId: string, f: Period, sort: "quantity" | "revenue" | "margin" = "revenue") {
  const { from, to } = dateRange(f);

  const items = await prisma.saleItem.findMany({
    where: {
      sale: { organizationId: orgId, status: "completed", createdAt: { gte: from, lte: to } },
    },
    select: {
      productName: true,
      quantity: true,
      lineTotal: true,
      unitCost: true,
      product: { select: { categoryId: true } },
    },
  });

  const productMap = new Map<string, { name: string; catId: string; qty: number; revenue: number; cost: number }>();

  for (const i of items) {
    const key = i.productName;
    const p = productMap.get(key) ?? { name: key, catId: i.product?.categoryId ?? "", qty: 0, revenue: 0, cost: 0 };
    p.qty += num(i.quantity);
    p.revenue += num(i.lineTotal);
    p.cost += num(i.unitCost) * num(i.quantity);
    productMap.set(key, p);
  }

  // Fetch category names
  const catIds = [...new Set([...productMap.values()].map((p) => p.catId).filter(Boolean))];
  const categories = await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } });
  const catNames = new Map(categories.map((c) => [c.id, c.name]));

  const rows: ProductRankingRow[] = [...productMap.values()].map((p) => {
    const margin = p.revenue - p.cost;
    return {
      productName: p.name,
      categoryName: catNames.get(p.catId) ?? "—",
      quantity: round2(p.qty),
      revenue: round2(p.revenue),
      margin: round2(margin),
      marginPct: p.revenue > 0 ? round2((margin / p.revenue) * 100) : 0,
    };
  });

  const sorted = rows.sort((a, b) => {
    if (sort === "quantity") return b.quantity - a.quantity;
    if (sort === "margin") return b.margin - a.margin;
    return b.revenue - a.revenue;
  });

  return { rows: sorted.slice(0, 50), total: rows.length };
}

// ── 13. Customer Cohorts ─────────────────────────────────────────────────

export interface CohortRow {
  cohort: string; // "2026-01"
  initialCount: number;
  retention: (number | null)[]; // % per month offset
}

export async function getCustomerCohorts(orgId: string, months: number = 6) {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  // Get all sales with customer and date
  const sales = await prisma.sale.findMany({
    where: {
      organizationId: orgId,
      status: "completed",
      customerId: { not: null },
      createdAt: { gte: startMonth },
    },
    select: { customerId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Also get portal orders
  const orders = await prisma.order.findMany({
    where: {
      organizationId: orgId,
      customerId: { not: null },
      createdAt: { gte: startMonth },
    },
    select: { customerId: true, createdAt: true },
  });

  // Combine and build customer-month map
  interface Purchase { customerId: string; month: string }
  const purchases: Purchase[] = [];
  for (const s of sales) {
    purchases.push({ customerId: s.customerId!, month: s.createdAt.toISOString().slice(0, 7) });
  }
  for (const o of orders) {
    purchases.push({ customerId: o.customerId!, month: o.createdAt.toISOString().slice(0, 7) });
  }

  // Find first purchase month per customer
  const firstPurchase = new Map<string, string>();
  for (const p of purchases) {
    const existing = firstPurchase.get(p.customerId);
    if (!existing || p.month < existing) {
      firstPurchase.set(p.customerId, p.month);
    }
  }

  // Build purchases by customer-month
  const customerMonths = new Map<string, Set<string>>();
  for (const p of purchases) {
    const set = customerMonths.get(p.customerId) ?? new Set();
    set.add(p.month);
    customerMonths.set(p.customerId, set);
  }

  // Build cohort table
  const cohortMonths: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    cohortMonths.push(d.toISOString().slice(0, 7));
  }

  const cohorts: CohortRow[] = cohortMonths.map((cohortMonth) => {
    const cohortCustomers = [...firstPurchase.entries()]
      .filter(([, fp]) => fp === cohortMonth)
      .map(([cid]) => cid);

    const initialCount = cohortCustomers.length;
    if (initialCount === 0) {
      return { cohort: cohortMonth, initialCount: 0, retention: [] };
    }

    const retention: (number | null)[] = [];
    const cohortIdx = cohortMonths.indexOf(cohortMonth);

    for (let offset = 0; offset < months - cohortIdx; offset++) {
      const targetMonthIdx = cohortIdx + offset;
      if (targetMonthIdx >= cohortMonths.length) {
        retention.push(null);
        continue;
      }
      const targetMonth = cohortMonths[targetMonthIdx];
      const active = cohortCustomers.filter((cid) => customerMonths.get(cid)?.has(targetMonth)).length;
      retention.push(round2((active / initialCount) * 100));
    }

    return { cohort: cohortMonth, initialCount, retention };
  });

  return { cohorts, months: cohortMonths };
}

// ── 11. Employee Ranking ───────────────────────────────────────────────

export interface EmployeeRankingRow {
  employeeName: string;
  totalSales: number;
  saleCount: number;
  avgTicket: number;
  totalUnits: number;
}

export async function getEmployeeRanking(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const sales = await prisma.sale.findMany({
    where: { organizationId: orgId, createdAt: { gte: from, lte: to }, status: "completed" },
    include: { employee: { select: { fullName: true } }, items: { select: { quantity: true } } },
  });

  const map = new Map<string, EmployeeRankingRow>();
  for (const s of sales) {
    const name = s.employee?.fullName ?? "Sin empleado";
    const existing = map.get(name) ?? { employeeName: name, totalSales: 0, saleCount: 0, avgTicket: 0, totalUnits: 0 };
    existing.totalSales += num(s.total);
    existing.saleCount += 1;
    existing.totalUnits += s.items.reduce((a: number, i: { quantity: unknown }) => a + Number(i.quantity), 0);
    map.set(name, existing);
  }

  const rows = [...map.values()].map((r) => ({ ...r, avgTicket: r.saleCount > 0 ? round2(r.totalSales / r.saleCount) : 0 }));
  rows.sort((a, b) => b.totalSales - a.totalSales);
  return { rows };
}

// ── 12. Customer Loyalty Summary ───────────────────────────────────────

export interface LoyaltyRow {
  customerId: string;
  customerName: string;
  totalPoints: number;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: string | null;
}

export async function getLoyaltySummary(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const customers = await prisma.customer.findMany({
    where: { organizationId: orgId },
    include: {
      loyaltyTransactions: { where: { createdAt: { gte: from, lte: to } }, select: { points: true } },
      orders: { where: { createdAt: { gte: from, lte: to }, status: "delivered" }, select: { total: true, createdAt: true } },
    },
  });

  const rows: LoyaltyRow[] = customers.map((c) => ({
    customerId: c.id,
    customerName: c.fullName,
    totalPoints: c.loyaltyTransactions.reduce((a: number, t: { points: unknown }) => a + num(t.points), 0),
    totalSpent: c.orders.reduce((a: number, o: { total: unknown }) => a + num(o.total), 0),
    orderCount: c.orders.length,
    lastOrderDate: c.orders.length > 0 ? c.orders.sort((a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt.toISOString().slice(0, 10) : null,
  }));

  rows.sort((a, b) => b.totalSpent - a.totalSpent);
  return { rows };
}

// ── 13. Credit Aging ───────────────────────────────────────────────────

export interface CreditAgingRow {
  customerId: string;
  customerName: string;
  balance: number;
  creditLimit: number | null;
  oldestDebtDate: string | null;
  daysOverdue: number;
  agingBucket: string;
}

export async function getCreditAging(orgId: string) {
  const credits = await prisma.customerCredit.findMany({
    where: { organizationId: orgId, currentBalance: { gt: 0 } },
    include: {
      customer: { select: { fullName: true } },
      transactions: { select: { createdAt: true, amount: true, type: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const now = new Date();
  const rows: CreditAgingRow[] = credits.map((c) => {
    const oldestTx = c.transactions.find((t) => t.type === "charge");
    const oldestDate = oldestTx?.createdAt ?? c.createdAt;
    const daysOverdue = Math.floor((now.getTime() - oldestDate.getTime()) / 86400000);
    let agingBucket = "Current";
    if (daysOverdue > 90) agingBucket = "90+ days";
    else if (daysOverdue > 60) agingBucket = "61-90 days";
    else if (daysOverdue > 30) agingBucket = "31-60 days";
    else if (daysOverdue > 0) agingBucket = "1-30 days";
    return {
      customerId: c.customerId,
      customerName: c.customer.fullName,
      balance: num(c.currentBalance),
      creditLimit: c.creditLimit != null ? num(c.creditLimit) : null,
      oldestDebtDate: oldestDate.toISOString().slice(0, 10),
      daysOverdue,
      agingBucket,
    };
  });

  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { rows };
}

// ── 14. Promotions ROI ─────────────────────────────────────────────────

export interface PromoRoiRow {
  promotionId: string;
  promotionName: string;
  discountGiven: number;
  ordersCount: number;
  revenueGenerated: number;
  roi: number;
}

export async function getPromotionsRoi(orgId: string, f: Period) {
  const { from, to } = dateRange(f);    const promos = await prisma.promotion.findMany({
    where: { organizationId: orgId },
    include: {
      saleDiscounts: {
        where: { sale: { createdAt: { gte: from, lte: to }, status: "completed" } },
        select: { amount: true, sale: { select: { total: true } } },
      },
    },
  });

  const rows: PromoRoiRow[] = promos.map((p) => {
    const revenueGenerated = p.saleDiscounts.reduce((a, d) => a + num(d.sale?.total ?? 0), 0);
    const discountGiven = p.saleDiscounts.reduce((a, d) => a + num(d.amount), 0);
    return {
      promotionId: p.id,
      promotionName: p.name,
      discountGiven: round2(discountGiven),
      ordersCount: p.saleDiscounts.length,
      revenueGenerated: round2(revenueGenerated),
      roi: discountGiven > 0 ? round2(((revenueGenerated - discountGiven) / discountGiven) * 100) : 0,
    };
  });

  rows.sort((a, b) => b.revenueGenerated - a.revenueGenerated);
  return { rows };
}

// ── 15. Delivery Performance ────────────────────────────────────────────

export interface DeliveryPerfRow {
  locationName: string;
  totalOrders: number;
  avgPrepMinutes: number;
  avgDeliveryMinutes: number;
  onTimeRate: number;
  cancelRate: number;
}

export async function getDeliveryPerformance(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const orders = await prisma.order.findMany({
    where: { organizationId: orgId, createdAt: { gte: from, lte: to }, deliveryMethod: "delivery" },
    select: {
      total: true, status: true, createdAt: true,
      location: { select: { name: true } },
    },
  });

  const map = new Map<string, { total: number; cancelled: number }>();
  for (const o of orders) {
    const loc = o.location?.name ?? "N/A";
    const existing = map.get(loc) ?? { total: 0, cancelled: 0 };
    existing.total += 1;
    if (o.status === "cancelled") existing.cancelled += 1;
    map.set(loc, existing);
  }

  const rows: DeliveryPerfRow[] = [...map.entries()].map(([name, d]) => ({
    locationName: name,
    totalOrders: d.total,
    avgPrepMinutes: 0,
    avgDeliveryMinutes: 0,
    onTimeRate: 0,
    cancelRate: d.total > 0 ? round2((d.cancelled / d.total) * 100) : 0,
  }));

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
}

export async function getLowStockAlerts(orgId: string) {
  const inventories = await prisma.inventory.findMany({
    where: { organizationId: orgId, product: { isActive: true } },
    include: {
      product: { select: { name: true, id: true } },
    },
  });

  const locations = await prisma.location.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  });
  const locMap = new Map(locations.map((l) => [l.id, l.name]));

  const rows: LowStockRow[] = inventories
    .filter((inv) => Number(inv.minThreshold) > 0 && Number(inv.quantity) <= Number(inv.minThreshold))
    .map((inv) => {
      const minThreshold = Number(inv.minThreshold);
      return {
        productId: inv.product?.id ?? "",
        productName: inv.product?.name ?? "-",
        locationName: locMap.get(inv.locationId) ?? "N/A",
        currentStock: Number(inv.quantity),
        minStock: minThreshold,
        maxStock: minThreshold * 2,
        deficit: minThreshold * 2 - Number(inv.quantity),
      };
    })
    .sort((a, b) => a.deficit - b.deficit);

  return { rows };
}

// ── 17. Customer Segmentation ───────────────────────────────────────────

export interface SegmentationRow {
  segmentType: string;
  customerCount: number;
  avgSpent: number;
  avgOrders: number;
}

export async function getCustomerSegmentation(orgId: string) {
  const segments = await prisma.customerSegment.findMany({
    where: { organizationId: orgId },
    include: { customer: { select: { fullName: true } } },
  });

  const map = new Map<string, { count: number; totalSpent: number; totalOrders: number }>();
  for (const s of segments) {
    const bucket = map.get(s.segment) ?? { count: 0, totalSpent: 0, totalOrders: 0 };
    bucket.count += 1;
    map.set(s.segment, bucket);
  }

  const rows: SegmentationRow[] = [...map.entries()].map(([type, d]) => ({
    segmentType: type.replace(/_/g, " "),
    customerCount: d.count,
    avgSpent: d.count > 0 ? round2(d.totalSpent / d.count) : 0,
    avgOrders: d.count > 0 ? round2(d.totalOrders / d.count) : 0,
  }));

  return { rows };
}

// ── 18. Margin Analysis ────────────────────────────────────────────────

export interface MarginRow {
  categoryName: string;
  revenue: number;
  costOfGoods: number;
  margin: number;
  marginPct: number;
}

export async function getMarginAnalysis(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const items = await prisma.orderItem.findMany({
    where: { order: { organizationId: orgId, createdAt: { gte: from, lte: to }, status: "delivered" } },
    include: {
      product: { select: { name: true, category: { select: { name: true } } } },
      variant: { select: { cost: true } },
    },
  });

  const map = new Map<string, { revenue: number; costOfGoods: number }>();
  for (const item of items) {
    const cat = item.product?.category?.name ?? "Sin categoría";
    const existing = map.get(cat) ?? { revenue: 0, costOfGoods: 0 };
    existing.revenue += num(item.unitPrice) * Number(item.quantity);
    existing.costOfGoods += num(item.variant?.cost ?? 0) * Number(item.quantity);
    map.set(cat, existing);
  }

  const rows: MarginRow[] = [...map.entries()].map(([name, d]) => ({
    categoryName: name,
    revenue: round2(d.revenue),
    costOfGoods: round2(d.costOfGoods),
    margin: round2(d.revenue - d.costOfGoods),
    marginPct: d.revenue > 0 ? round2(((d.revenue - d.costOfGoods) / d.revenue) * 100) : 0,
  }));

  rows.sort((a, b) => b.margin - a.margin);
  return { rows };
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
    where: { organizationId: orgId, createdAt: { gte: from, lte: to }, status: "completed" },
    select: { total: true, createdAt: true },
  });

  const map = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    const day = s.createdAt.toISOString().slice(0, 10);
    const existing = map.get(day) ?? { total: 0, count: 0 };
    existing.total += num(s.total);
    existing.count += 1;
    map.set(day, existing);
  }

  const rows: DailyTrendRow[] = [...map.entries()]
    .map(([date, d]) => ({ date, totalSales: round2(d.total), orderCount: d.count, avgTicket: d.count > 0 ? round2(d.total / d.count) : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { rows };
}

// ── 20. Payment Method Mix ─────────────────────────────────────────────

export interface PaymentMixRow {
  method: string;
  count: number;
  total: number;
  pct: number;
}

export async function getPaymentMix(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const payments = await prisma.salePayment.findMany({
    where: { sale: { organizationId: orgId, createdAt: { gte: from, lte: to }, status: "completed" } },
    select: { method: true, amount: true },
  });

  const grandTotal = payments.reduce((a: number, p) => a + num(p.amount), 0);
  const map = new Map<string, { count: number; total: number }>();
  for (const p of payments) {
    const method = p.method ?? "other";
    const existing = map.get(method) ?? { count: 0, total: 0 };
    existing.count += 1;
    existing.total += num(p.amount);
    map.set(method, existing);
  }

  const rows: PaymentMixRow[] = [...map.entries()].map(([method, d]) => ({
    method,
    count: d.count,
    total: round2(d.total),
    pct: grandTotal > 0 ? round2((d.total / grandTotal) * 100) : 0,
  }));

  rows.sort((a, b) => b.total - a.total);
  return { rows };
}

// ── 21. Product Pairs (Market Basket) ──────────────────────────────────

export interface ProductPairRow {
  productA: string;
  productB: string;
  timesTogether: number;
  avgRevenue: number;
}

export async function getProductPairs(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const pairs = await prisma.productPair.findMany({
    where: { organizationId: orgId, lastSeenAt: { gte: from, lte: to } },
    include: {
      productA: { select: { name: true } },
      productB: { select: { name: true } },
    },
    orderBy: { coOccurrences: "desc" },
    take: 20,
  });

  const rows: ProductPairRow[] = pairs.map((p) => ({
    productA: p.productA.name,
    productB: p.productB.name,
    timesTogether: p.coOccurrences,
    avgRevenue: 0,
  }));

  return { rows };
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
    where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
    include: {
      items: { select: { quantity: true } },
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: TransferRow[] = transfers.map((t) => ({
    id: t.id,
    fromLocation: t.fromLocation.name,
    toLocation: t.toLocation.name,
    status: t.status,
    itemCount: t.items.length,
    totalQty: t.items.reduce((a, i) => a + Number(i.quantity), 0),
    createdAt: t.createdAt.toISOString().slice(0, 10),
  }));

  return { rows };
}

// ── 23. Inventory Fill Rate ────────────────────────────────────────────

export interface FillRateRow {
  locationName: string;
  totalProducts: number;
  inStock: number;
  outOfStock: number;
  fillRate: number;
}

export async function getInventoryFillRate(orgId: string) {
  const inventories = await prisma.inventory.findMany({
    where: { organizationId: orgId },
    select: { locationId: true, quantity: true },
  });

  const locs = await prisma.location.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  });
  const locMap = new Map(locs.map((l) => [l.id, l.name]));

  const map = new Map<string, { total: number; inStock: number }>();
  for (const inv of inventories) {
    const loc = locMap.get(inv.locationId) ?? "N/A";
    const existing = map.get(loc) ?? { total: 0, inStock: 0 };
    existing.total += 1;
    if (Number(inv.quantity) > 0) existing.inStock += 1;
    map.set(loc, existing);
  }

  const rows: FillRateRow[] = [...map.entries()].map(([name, d]) => ({
    locationName: name,
    totalProducts: d.total,
    inStock: d.inStock,
    outOfStock: d.total - d.inStock,
    fillRate: d.total > 0 ? round2((d.inStock / d.total) * 100) : 0,
  }));

  return { rows };
}

// ── 24. Employee Margin Analysis ───────────────────────────────────────

export interface EmployeeMarginRow {
  employeeName: string;
  totalRevenue: number;
  totalCost: number;
  margin: number;
  marginPct: number;
  saleCount: number;
}

export async function getEmployeeMargin(orgId: string, f: Period) {
  const { from, to } = dateRange(f);
  const sales = await prisma.sale.findMany({
    where: { organizationId: orgId, createdAt: { gte: from, lte: to }, status: "completed" },
    include: {
      employee: { select: { fullName: true } },
      items: { select: { unitPrice: true, quantity: true, variant: { select: { cost: true } } } },
    },
  });

  const map = new Map<string, { revenue: number; cost: number; count: number }>();
  for (const s of sales) {
    const name = s.employee?.fullName ?? "Sin empleado";
    const existing = map.get(name) ?? { revenue: 0, cost: 0, count: 0 };
    existing.count += 1;
    for (const item of s.items) {
      existing.revenue += num(item.unitPrice) * Number(item.quantity);
      existing.cost += num(item.variant?.cost ?? 0) * Number(item.quantity);
    }
    map.set(name, existing);
  }

  const rows: EmployeeMarginRow[] = [...map.entries()].map(([name, d]) => ({
    employeeName: name,
    totalRevenue: round2(d.revenue),
    totalCost: round2(d.cost),
    margin: round2(d.revenue - d.cost),
    marginPct: d.revenue > 0 ? round2(((d.revenue - d.cost) / d.revenue) * 100) : 0,
    saleCount: d.count,
  }));

  rows.sort((a, b) => b.margin - a.margin);
  return { rows };
}

// ── 25. Sales Forecast ─────────────────────────────────────────────────

export interface ForecastRow {
  date: string;
  predictedSales: number;
  confidence: number;
}

export async function getSalesForecast(orgId: string, days: number = 7) {
  // Simple moving average forecast based on last 30 days
  const from = new Date(Date.now() - 60 * 86400000);
  const to = new Date();

  const sales = await prisma.sale.findMany({
    where: { organizationId: orgId, createdAt: { gte: from, lte: to }, status: "completed" },
    select: { total: true, createdAt: true },
  });

  // Group by day of week
  const dowTotals = new Map<number, { total: number; count: number }>();
  for (const s of sales) {
    const dow = s.createdAt.getDay();
    const existing = dowTotals.get(dow) ?? { total: 0, count: 0 };
    existing.total += num(s.total);
    existing.count += 1;
    dowTotals.set(dow, existing);
  }

  const dowAvg = new Map<number, number>();
  for (const [dow, d] of dowTotals) {
    dowAvg.set(dow, d.count > 0 ? d.total / d.count : 0);
  }

  // Forecast for next N days
  const rows: ForecastRow[] = [];
  for (let i = 1; i <= days; i++) {
    const forecastDate = new Date(Date.now() + i * 86400000);
    const dow = forecastDate.getDay();
    const predicted = dowAvg.get(dow) ?? 0;
    rows.push({
      date: forecastDate.toISOString().slice(0, 10),
      predictedSales: round2(predicted),
      confidence: Math.min(95, 60 + (dowTotals.get(dow)?.count ?? 0) * 2),
    });
  }

  return { rows };
}
