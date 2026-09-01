import { prisma } from "@/lib/db";

// FASE 10 — Agregaciones de reportes y analytics (dashboard + reportes filtrados).

export interface ReportFilters {
  from?: string;
  to?: string;
  locationId?: string;
  employeeId?: string;
  cashRegisterId?: string;
  status?: string;
  limit?: number;
}

export interface DashboardData {
  today: { sales: number; count: number; avgTicket: number };
  period: {
    from: string;
    to: string;
    sales: number;
    count: number;
    margin: number;
    marginPct: number;
    byDay: { day: string; label: string; total: number; count: number }[];
    byPayment: { method: string; amount: number }[];
    topProducts: { name: string; quantity: number; total: number; sharePct: number }[];
  };
  customers: number;
  orgName: string;
}

export interface CashReportRow {
  id: string;
  registerName: string | null;
  locationName: string;
  employeeName: string | null;
  openedAt: string | null;
  closedAt: string | null;
  status: string;
  openingCash: number;
  salesCount: number;
  totalSales: number;
  cashPayments: number;
  changeGiven: number;
  expectedCash: number;
  closingCash: number | null;
  difference: number | null;
}

export interface OrdersReportRow {
  id: string;
  orderNumber: number;
  status: string;
  deliveryMethod: string;
  customerName: string | null;
  locationName: string | null;
  itemsCount: number;
  total: number;
  createdAt: string;
}

export interface CustomersReportRow {
  id: string;
  fullName: string;
  customerCode: string | null;
  phone: string | null;
  points: number;
  salesCount: number;
  totalSpent: number;
  lastPurchaseAt: string | null;
}

const toNum = (v: unknown): number => (v == null ? 0 : Number(v));

function whereFrom(organizationId: string, f: ReportFilters) {
  const where: Record<string, unknown> = { organizationId };
  if (f.locationId) where.locationId = f.locationId;
  if (f.employeeId) where.employeeId = f.employeeId;
  if (f.cashRegisterId) where.cashRegisterId = f.cashRegisterId;
  if (f.status) where.status = f.status;
  if (f.from || f.to) {
    where.createdAt = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00`) } : {}),
      ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}),
    };
  }
  return where;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" });
}

function rangeOrDefault(f: ReportFilters): { from: Date; to: Date } {
  const to = f.to ? new Date(`${f.to}T23:59:59.999`) : new Date();
  const from = f.from
    ? new Date(`${f.from}T00:00:00`)
    : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  return { from, to };
}

export async function getDashboardData(organizationId: string): Promise<DashboardData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [{ _sum, _count: todayCount }, period, customers] = await Promise.all([
    prisma.sale.aggregate({
      where: { organizationId, status: "completed", createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { total: true },
      _count: true,
    }),
    (async () => {
      const { from, to } = rangeOrDefault({});
      const sales = await prisma.sale.findMany({
        where: { organizationId, status: "completed", createdAt: { gte: from, lte: to } },
        select: {
          total: true,
          createdAt: true,
          items: { select: { lineTotal: true, totalPrice: true, unitCost: true, quantity: true, productName: true } },
          payments: { select: { method: true, amount: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      const byDayMap = new Map<string, { total: number; count: number }>();
      const byPaymentMap = new Map<string, number>();
      const topMap = new Map<string, { quantity: number; total: number }>();
      let margin = 0;

      for (const s of sales) {
        const key = s.createdAt.toISOString().slice(0, 10);
        const d = byDayMap.get(key) ?? { total: 0, count: 0 };
        d.total += toNum(s.total);
        d.count += 1;
        byDayMap.set(key, d);

        for (const p of s.payments) byPaymentMap.set(p.method, (byPaymentMap.get(p.method) ?? 0) + toNum(p.amount));

        for (const i of s.items) {
          const cost = toNum(i.unitCost) * toNum(i.quantity);
          const revenue = toNum(i.lineTotal ?? i.totalPrice ?? 0);
          margin += revenue - cost;
          const t = topMap.get(i.productName) ?? { quantity: 0, total: 0 };
          t.quantity += toNum(i.quantity);
          t.total += revenue;
          topMap.set(i.productName, t);
        }
      }

      const periodTotal = sales.reduce((a, s) => a + toNum(s.total), 0);
      const byDay = [...byDayMap.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([day, v]) => ({ day, label: dayLabel(new Date(`${day}T12:00:00`)), total: round2(v.total), count: v.count }));
      const byPayment = [...byPaymentMap.entries()].map(([method, amount]) => ({ method, amount: round2(amount) }));
      const topProducts = [...topMap.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)
        .map(([name, v]) => ({
          name,
          quantity: round2(v.quantity),
          total: round2(v.total),
          sharePct: periodTotal > 0 ? Math.round((v.total / periodTotal) * 1000) / 10 : 0,
        }));

      return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        sales: round2(periodTotal),
        count: sales.length,
        margin: round2(margin),
        marginPct: periodTotal > 0 ? Math.round((margin / periodTotal) * 1000) / 10 : 0,
        byDay,
        byPayment,
        topProducts,
      };
    })(),
    prisma.customer.count({ where: { organizationId } }),
  ]);

  const todaySales = toNum(_sum?.total ?? 0);

  // Get org name for onboarding prompt
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  return {
    today: {
      sales: round2(todaySales),
      count: todayCount,
      avgTicket: todayCount > 0 ? round2(todaySales / todayCount) : 0,
    },
    period,
    customers,
    orgName: org?.name ?? "",
  };
}

export interface SalesReportRow {
  id: string;
  folio: number;
  date: string;
  locationName: string;
  registerName: string | null;
  employeeName: string | null;
  customerName: string | null;
  itemCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  pointsEarned: number;
  pointsRedeemed: number;
  changeGiven: number;
}

export async function getSalesReport(organizationId: string, f: ReportFilters) {
  const rows = await prisma.sale.findMany({
    where: whereFrom(organizationId, f),
    include: {
      location: { select: { name: true } },
      cashRegister: { select: { name: true } },
      employee: { select: { fullName: true } },
      customer: { select: { fullName: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(5000, f.limit ?? 2000),
  });

  const mapped: SalesReportRow[] = rows.map((s) => ({
    id: s.id,
    folio: s.locationSaleNumber == null ? Number(s.saleNumber) : Number(s.locationSaleNumber),
    date: s.createdAt.toISOString(),
    locationName: s.location.name,
    registerName: s.cashRegister?.name ?? null,
    employeeName: s.employee?.fullName ?? null,
    customerName: s.customer?.fullName ?? null,
    itemCount: s._count.items,
    subtotal: toNum(s.subtotal),
    discount: toNum(s.discount),
    tax: toNum(s.tax),
    total: toNum(s.total),
    pointsEarned: toNum(s.pointsEarned),
    pointsRedeemed: toNum(s.pointsRedeemed),
    changeGiven: toNum(s.changeGiven),
  }));

  const totals = mapped.reduce(
    (acc, r) => {
      acc.subtotal += r.subtotal;
      acc.discount += r.discount;
      acc.tax += r.tax;
      acc.total += r.total;
      acc.pointsEarned += r.pointsEarned;
      return acc;
    },
    { subtotal: 0, discount: 0, tax: 0, total: 0, pointsEarned: 0 }
  );

  return { rows: mapped, count: mapped.length, totals: mapValues(totals, round2) };
}

export async function getCashReport(organizationId: string, f: ReportFilters) {
  const where: Record<string, unknown> = { organizationId };
  if (f.locationId) where.locationId = f.locationId;
  if (f.from || f.to) {
    where.openedAt = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00`) } : {}),
      ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}),
    };
  }

  const sessions = await prisma.cashSession.findMany({
    where,
    include: {
      cashRegister: { select: { name: true } },
      location: { select: { name: true } },
      employee: { select: { fullName: true } },
      sales: { where: { status: "completed" }, select: { total: true, payments: true, changeGiven: true } },
    },
    orderBy: { openedAt: "desc" },
    take: Math.min(2000, f.limit ?? 500),
  });

  const rows: CashReportRow[] = sessions.map((s) => {
    const totalSales = s.sales.reduce((a, x) => a + toNum(x.total), 0);
    const cashPayments = s.sales.reduce(
      (a, x) => a + x.payments.filter((p) => p.method === "cash").reduce((y, p) => y + toNum(p.amount), 0),
      0
    );
    const changeGiven = s.sales.reduce((a, x) => a + toNum(x.changeGiven), 0);
    const opening = toNum(s.openingCash);
    const expectedCash = opening + cashPayments - changeGiven;
    const closing = s.closingCash == null ? null : toNum(s.closingCash);
    return {
      id: s.id,
      registerName: s.cashRegister?.name ?? null,
      locationName: s.location.name,
      employeeName: s.employee?.fullName ?? null,
      openedAt: s.openedAt?.toISOString() ?? null,
      closedAt: s.closedAt?.toISOString() ?? null,
      status: s.status,
      openingCash: opening,
      salesCount: s.sales.length,
      totalSales: round2(totalSales),
      cashPayments: round2(cashPayments),
      changeGiven: round2(changeGiven),
      expectedCash: round2(expectedCash),
      closingCash: closing == null ? null : round2(closing),
      difference: closing == null ? null : round2(closing - expectedCash),
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.totalSales += r.totalSales;
      acc.salesCount += r.salesCount;
      acc.cashPayments += r.cashPayments;
      acc.expectedCash += r.expectedCash;
      return acc;
    },
    { totalSales: 0, salesCount: 0, cashPayments: 0, expectedCash: 0 }
  );

  return { rows, count: rows.length, totals: mapValues(totals, round2) };
}

export async function getOrdersReport(organizationId: string, f: ReportFilters) {
  const where: Record<string, unknown> = { organizationId };
  if (f.locationId) where.locationId = f.locationId;
  if (f.status) where.status = f.status;
  if (f.from || f.to) {
    where.createdAt = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00`) } : {}),
      ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}),
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: { select: { fullName: true } },
      location: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(5000, f.limit ?? 2000),
  });

  const rows: OrdersReportRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: Number(o.orderNumber),
    status: o.status,
    deliveryMethod: o.deliveryMethod,
    customerName: o.customer?.fullName ?? null,
    locationName: o.location?.name ?? null,
    itemsCount: o._count.items,
    total: toNum(o.total),
    createdAt: o.createdAt.toISOString(),
  }));

  const byStatus = new Map<string, number>();
  for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);

  return {
    rows,
    count: rows.length,
    totals: {
      total: round2(rows.reduce((a, r) => a + r.total, 0)),
      delivery: rows.filter((r) => r.deliveryMethod === "delivery").length,
      pickup: rows.filter((r) => r.deliveryMethod === "pickup").length,
    },
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
  };
}

export async function getCustomersReport(organizationId: string, f: ReportFilters) {
  const customers = await prisma.customer.findMany({
    where: { organizationId },
    include: {
      sales: {
        where: {
          status: "completed",
          ...(f.from || f.to
            ? { createdAt: { ...(f.from ? { gte: new Date(`${f.from}T00:00:00`) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}) } }
            : {}),
        },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { fullName: "asc" },
    take: Math.min(1000, f.limit ?? 500),
  });

  const rows: CustomersReportRow[] = customers
    .map((c) => ({
      id: c.id,
      fullName: c.fullName,
      customerCode: c.customerCode,
      phone: c.phone,
      points: toNum(c.points),
      salesCount: c.sales.length,
      totalSpent: round2(c.sales.reduce((a, s) => a + toNum(s.total), 0)),
      lastPurchaseAt: c.sales[0]?.createdAt?.toISOString() ?? null,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  return { rows, count: rows.length };
}

function mapValues<T extends Record<string, number>>(obj: T, fn: (n: number) => number): T {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)])) as T;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Reporte de cartera de crédito ───────────────────────────────────────────

export interface CreditReportRow {
  id: string;
  customerId: string;
  customerName: string;
  customerCode: string | null;
  customerPhone: string | null;
  creditLimit: number | null;
  currentBalance: number;
  status: string;
  totalCharges: number;
  totalPayments: number;
  oldestDueDate: string | null;
  latestDueDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
}

export async function getCreditReport(organizationId: string, _filters?: ReportFilters) {
  const now = new Date();

  const credits = await prisma.customerCredit.findMany({
    where: {
      organizationId,
      currentBalance: { gt: 0 },
    },
    include: {
      customer: {
        select: { id: true, fullName: true, customerCode: true, phone: true },
      },
      transactions: {
        select: { type: true, amount: true, dueDate: true, paidAt: true },
      },
    },
    orderBy: { currentBalance: "desc" },
  });

  const rows: CreditReportRow[] = credits.map((c) => {
    const charges = c.transactions.filter((t) => t.type === "charge");
    const payments = c.transactions.filter((t) => t.type === "payment");
    const dueDates = charges
      .filter((t) => t.dueDate && !t.paidAt)
      .map((t) => t.dueDate!)
      .sort((a, b) => a.getTime() - b.getTime());

    const oldestDue = dueDates[0] ?? null;
    const isOverdue = oldestDue ? oldestDue < now : false;
    const daysOverdue = isOverdue ? Math.ceil((now.getTime() - oldestDue!.getTime()) / 86400000) : 0;

    return {
      id: c.id,
      customerId: c.customerId,
      customerName: c.customer.fullName,
      customerCode: c.customer.customerCode,
      customerPhone: c.customer.phone,
      creditLimit: c.creditLimit != null ? toNum(c.creditLimit) : null,
      currentBalance: toNum(c.currentBalance),
      status: c.status,
      totalCharges: round2(charges.reduce((a, t) => a + toNum(t.amount), 0)),
      totalPayments: round2(payments.reduce((a, t) => a + toNum(t.amount), 0)),
      oldestDueDate: oldestDue?.toISOString() ?? null,
      latestDueDate: dueDates.length > 0 ? dueDates[dueDates.length - 1].toISOString() : null,
      isOverdue,
      daysOverdue,
    };
  });

  // Resumen
  const totalDebt = round2(rows.reduce((a, r) => a + r.currentBalance, 0));
  const totalCharges = round2(rows.reduce((a, r) => a + r.totalCharges, 0));
  const totalPayments = round2(rows.reduce((a, r) => a + r.totalPayments, 0));
  const totalOverdue = round2(rows.filter((r) => r.isOverdue).reduce((a, r) => a + r.currentBalance, 0));
  const totalCreditLimit = round2(rows.reduce((a, r) => a + (r.creditLimit ?? 0), 0));

  return {
    rows,
    count: rows.length,
    totals: {
      totalDebt,
      totalCharges,
      totalPayments,
      totalOverdue,
      totalCreditLimit,
      overdueCount: rows.filter((r) => r.isOverdue).length,
      activeCount: rows.filter((r) => r.status === "active").length,
    },
  };
}