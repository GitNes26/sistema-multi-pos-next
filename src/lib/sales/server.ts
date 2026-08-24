import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";
import { buildSalesPdf } from "@/lib/sales/pdf";

// FASE 9 — Historial de ventas, detalle, reimpresión y exportación.

export interface SalesListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  locationId?: string;
  employeeId?: string;
  cashRegisterId?: string;
  from?: string;
  to?: string;
  status?: string;
}

export interface SaleRow {
  id: string;
  saleNumber: number;
  locationSaleNumber: number | null;
  locationName: string;
  registerName: string | null;
  cashierName: string | null;
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
  status: string;
  createdAt: string;
}

export interface SaleItemDetail {
  id: string;
  productName: string;
  variantName: string | null;
  productType: "standard" | "bulk";
  quantity: number;
  unitAbbrev: string | null;
  unitPrice: number;
  totalPrice: number | null;
  discount: number;
  taxRate: number;
  lineTotal: number | null;
  bulkQuantityDisplay: string | null;
}

export interface SaleDetail {
  id: string;
  saleNumber: number;
  locationSaleNumber: number | null;
  locationName: string;
  registerName: string | null;
  cashierName: string | null;
  employeeName: string | null;
  customerName: string | null;
  customerCode: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  pointsEarned: number;
  pointsRedeemed: number;
  changeGiven: number;
  pointsRedeemedValue: number;
  status: string;
  notes: string | null;
  createdAt: string;
  items: SaleItemDetail[];
  payments: { method: string; amount: number; reference: string | null }[];
  discounts: { label: string; amount: number }[];
}

const toNum = (v: unknown): number => (v == null ? 0 : Number(v));

export async function listSales(
  organizationId: string,
  query: SalesListQuery
): Promise<{ rows: SaleRow[]; total: number }> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 25));

  const where: Record<string, unknown> = { organizationId };

  if (query.locationId) where.locationId = query.locationId;
  if (query.cashRegisterId) where.cashRegisterId = query.cashRegisterId;
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.status) where.status = query.status;

  if (query.from || query.to) {
    const gte = query.from ? new Date(`${query.from}T00:00:00`) : undefined;
    const lte = query.to ? new Date(`${query.to}T23:59:59.999`) : undefined;
    where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }

  if (query.q) {
    const term = query.q.trim();
    const numeric = /^\d+$/.test(term) ? Number(term) : null;
    where.OR = [
      { customer: { fullName: { contains: term } } },
      { customer: { customerCode: { contains: term } } },
      { cashier: { fullName: { contains: term } } },
      { employee: { fullName: { contains: term } } },
      ...(numeric != null ? [{ locationSaleNumber: numeric }] : []),
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        location: { select: { name: true } },
        cashRegister: { select: { name: true } },
        cashier: { select: { fullName: true } },
        employee: { select: { fullName: true } },
        customer: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    rows: rows.map((s) => ({
      id: s.id,
      saleNumber: Number(s.saleNumber),
      locationSaleNumber: s.locationSaleNumber == null ? null : Number(s.locationSaleNumber),
      locationName: s.location.name,
      registerName: s.cashRegister?.name ?? null,
      cashierName: s.cashier?.fullName ?? null,
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
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
    total,
  };
}

export async function getSaleDetail(organizationId: string, saleId: string): Promise<SaleDetail> {
  const [sale, org] = await Promise.all([
    prisma.sale.findFirst({
      where: { id: saleId, organizationId },
      include: {
        location: { select: { name: true } },
        cashRegister: { select: { name: true } },
        cashier: { select: { fullName: true } },
        employee: { select: { fullName: true } },
        customer: { select: { fullName: true, customerCode: true } },
        items: { include: { unit: { select: { abbreviation: true } } } },
        payments: true,
        discounts: true,
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { pointValue: true },
    }),
  ]);
  if (!sale) throw new Error("Venta no encontrada");

  const pointValue = toNum(org?.pointValue ?? null) || 0.01;
  const pointsValue = sale.pointsRedeemed != null ? toNum(sale.pointsRedeemed) * pointValue : 0;

  return {
    id: sale.id,
    saleNumber: Number(sale.saleNumber),
    locationSaleNumber: sale.locationSaleNumber == null ? null : Number(sale.locationSaleNumber),
    locationName: sale.location.name,
    registerName: sale.cashRegister?.name ?? null,
    cashierName: sale.cashier?.fullName ?? null,
    employeeName: sale.employee?.fullName ?? null,
    customerName: sale.customer?.fullName ?? null,
    customerCode: sale.customer?.customerCode ?? null,
    subtotal: toNum(sale.subtotal),
    discount: toNum(sale.discount),
    tax: toNum(sale.tax),
    total: toNum(sale.total),
    pointsEarned: toNum(sale.pointsEarned),
    pointsRedeemed: toNum(sale.pointsRedeemed),
    changeGiven: toNum(sale.changeGiven),
    pointsRedeemedValue: round2(pointsValue),
    status: sale.status,
    notes: sale.notes,
    createdAt: sale.createdAt.toISOString(),
    items: sale.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName,
      productType: i.productType,
      quantity: toNum(i.quantity),
      unitAbbrev: i.unit?.abbreviation ?? null,
      unitPrice: toNum(i.unitPrice),
      totalPrice: i.totalPrice == null ? null : toNum(i.totalPrice),
      discount: toNum(i.discount),
      taxRate: toNum(i.taxRate),
      lineTotal: i.lineTotal == null ? null : toNum(i.lineTotal),
      bulkQuantityDisplay: i.bulkQuantityDisplay,
    })),
    payments: sale.payments.map((p) => ({
      method: p.method,
      amount: toNum(p.amount),
      reference: p.reference,
    })),
    discounts: sale.discounts.map((d) => ({ label: d.label, amount: toNum(d.amount) })),
  };
}

export async function exportSalesXlsx(organizationId: string, query: SalesListQuery) {
  const { rows } = await listSales(organizationId, { ...query, page: 1, pageSize: 100000 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ventas");
  ws.columns = [
    { header: "Folio", width: 12 },
    { header: "Fecha", width: 18 },
    { header: "Sucursal", width: 22 },
    { header: "Caja", width: 14 },
    { header: "Cajero", width: 20 },
    { header: "Empleado", width: 20 },
    { header: "Cliente", width: 22 },
    { header: "Artículos", width: 10 },
    { header: "Subtotal", width: 12 },
    { header: "Descuento", width: 12 },
    { header: "Impuesto", width: 12 },
    { header: "Total", width: 12 },
    { header: "Puntos ganados", width: 14 },
    { header: "Puntos canjeados", width: 14 },
    { header: "Cambio", width: 10 },
    { header: "Estado", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const r of rows) {
    ws.addRow([
      r.locationSaleNumber ?? r.saleNumber,
      new Date(r.createdAt).toLocaleString("es-MX"),
      r.locationName,
      r.registerName ?? "",
      r.cashierName ?? "",
      r.employeeName ?? "",
      r.customerName ?? "",
      r.itemCount,
      r.subtotal,
      r.discount,
      r.tax,
      r.total,
      r.pointsEarned,
      r.pointsRedeemed,
      r.changeGiven,
      r.status,
    ]);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `ventas-${new Date().toISOString().slice(0, 10)}.xlsx` };
}

export async function exportSalesPdf(
  organizationId: string,
  organizationName: string,
  query: SalesListQuery
) {
  const { rows } = await listSales(organizationId, { ...query, page: 1, pageSize: 100000 });
  const buffer = await buildSalesPdf({ organizationName, rows });
  return { buffer, filename: `ventas-${new Date().toISOString().slice(0, 10)}.pdf` };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}