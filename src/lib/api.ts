// FASE 7 — Cliente HTTP para los endpoints CRUD genéricos del admin.

export class ApiError extends Error {
  status: number;
  field?: string | null;
  constructor(message: string, status = 500, field?: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field ?? null;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    field?: string | null;
  } | null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Error de red", res.status, data?.field);
  }
  return data as T;
}

export interface CrudListResponse {
  ok: boolean;
  rows: Record<string, unknown>[];
  total: number;
}

async function list(
  module: string,
  params: Record<string, string | number> = {}
): Promise<CrudListResponse> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  );
  return request<CrudListResponse>(`/api/crud/${module}?${qs.toString()}`);
}

async function get(module: string, id: string) {
  return request<{ ok: boolean; row: Record<string, unknown> }>(
    `/api/crud/${module}/${id}`
  );
}

async function create(module: string, body: Record<string, unknown>) {
  return request<{ ok: boolean; row: Record<string, unknown> }>(
    `/api/crud/${module}`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

async function update(module: string, id: string, body: Record<string, unknown>) {
  return request<{ ok: boolean; row: Record<string, unknown> }>(
    `/api/crud/${module}/${id}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

async function remove(module: string, id: string) {
  return request<{ ok: boolean }>(`/api/crud/${module}/${id}`, {
    method: "DELETE",
  });
}

async function restore(module: string, id: string) {
  return request<{ ok: boolean }>(`/api/crud/${module}/${id}?action=restore`, {
    method: "POST",
  });
}

export const crudApi = { list, get, create, update, remove, restore };

// ── Inventario (FASE 8) ───────────────────────────────────────────────────────

export interface InventoryRow {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  productImage: string | null;
  variantName: string | null;
  sku: string | null;
  barcode: string | null;
  productType: "standard" | "bulk";
  quantity: number;
  unit: string | null;
  minThreshold: number;
  status: "ok" | "low" | "empty";
  trackInventory: boolean;
}

export interface InventoryMovement {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  productName: string;
  variantName: string | null;
  unit: string | null;
  performer: string | null;
  createdAt: string;
}

// ── Devoluciones ─────────────────────────────────────────────────────────────

export interface SaleReturnItem {
  id: string;
  saleItemId: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  reason: string | null;
  restockable: boolean;
}

export interface SaleReturn {
  id: string;
  saleId: string;
  returnType: "exchange" | "refund" | "coupon" | "points";
  status: "pending" | "approved" | "completed" | "rejected";
  reason: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  couponCode: string | null;
  couponAmount: number | null;
  couponExpiresAt: string | null;
  pointsAwarded: number | null;
  createdAt: string;
  items: SaleReturnItem[];
}

export interface SaleReturnWithSale extends SaleReturn {
  sale: {
    saleNumber: number;
    locationSaleNumber: number | null;
    total: number;
    customer: { fullName: string } | null;
  };
}

export interface SaleReturnDetail extends SaleReturn {
  sale: SaleDetail;
  employee: { fullName: string } | null;
  user: { fullName: string } | null;
}

export type RevisionStatus = "draft" | "in_progress" | "completed" | "cancelled";

export interface InventoryRevision {
  id: string;
  revisionNumber: number;
  status: RevisionStatus;
  notes: string | null;
  locationType: string;
  locationId: string;
  itemCount: number;
  countedCount: number;
  differenceCount: number;
  performedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RevisionItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  barcode: string | null;
  productType: "standard" | "bulk";
  unit: string | null;
  expectedQuantity: number;
  countedQuantity: number | null;
  difference: number | null;
  scanned: boolean;
}

export interface RevisionDetailData {
  id: string;
  revisionNumber: number;
  status: RevisionStatus;
  notes: string | null;
  locationType: string;
  locationId: string;
  performedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: RevisionItem[];
}

async function inventoryRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok) throw new ApiError(data?.error ?? "Error de red", res.status);
  return data as T;
}

async function downloadBlob(url: string, fallbackName: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(data?.error ?? "Error al exportar", res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;
  const urlObj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = urlObj;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(urlObj);
}

function downloadInventoryExport(params: Record<string, string>, fallbackName: string) {
  return downloadBlob(`/api/inventory/export?${new URLSearchParams(params)}`, fallbackName);
}

export const inventoryApi = {
  snapshot: (params: { locationType: string; locationId: string; q?: string; productType?: string; lowOnly?: boolean }) =>
    inventoryRequest<{ ok: boolean; rows: InventoryRow[] }>(
      `/api/inventory?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
      )}`
    ),
  movements: (params: { locationType: string; locationId: string; q?: string; type?: string; from?: string; to?: string; page?: number; pageSize?: number }) =>
    inventoryRequest<{ ok: boolean; rows: InventoryMovement[]; total: number }>(
      `/api/inventory/movements?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
      )}`
    ),
  register: (body: { inventoryId: string; type: string; quantity: number; reason?: string }) =>
    inventoryRequest<{ ok: boolean; row: InventoryMovement }>(`/api/inventory/movements`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setThreshold: (inventoryId: string, minThreshold: number) =>
    inventoryRequest<{ ok: boolean; minThreshold: number }>(`/api/inventory/threshold`, {
      method: "POST",
      body: JSON.stringify({ inventoryId, minThreshold }),
    }),
  transfer: (body: {
    fromInventoryId: string;
    toLocationType: string;
    toLocationId: string;
    quantity: number;
    reason?: string;
  }) =>
    inventoryRequest<{ ok: boolean }>(`/api/inventory/transfers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revisions: (params: { locationType: string; locationId: string; page?: number; pageSize?: number }) =>
    inventoryRequest<{ ok: boolean; rows: InventoryRevision[]; total: number }>(
      `/api/inventory/revisions?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
      )}`
    ),
  createRevision: (body: { locationType: string; locationId: string; notes?: string }) =>
    inventoryRequest<{ ok: boolean; revision: RevisionDetailData }>(`/api/inventory/revisions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getRevision: (id: string) =>
    inventoryRequest<{ ok: boolean; revision: RevisionDetailData }>(`/api/inventory/revisions/${id}`),
  setRevisionCount: (revisionId: string, itemId: string, body: { countedQuantity: number; scanned?: boolean }) =>
    inventoryRequest<{ ok: boolean }>(`/api/inventory/revisions/${revisionId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  finishRevision: (id: string, action: "complete" | "cancel") =>
    inventoryRequest<{ ok: boolean }>(`/api/inventory/revisions/${id}/${action}`, { method: "POST" }),
  updateRevisionNotes: (id: string, notes: string | null) =>
    inventoryRequest<{ ok: boolean; notes: string | null }>(`/api/inventory/revisions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    }),
  importStock: async (params: {
    locationType: string;
    locationId: string;
    file: File;
  }): Promise<ExcelImportResult> => {
    const form = new FormData();
    form.append("file", params.file);
    form.append("locationType", params.locationType);
    form.append("locationId", params.locationId);
    const res = await fetch("/api/inventory/import", { method: "POST", body: form });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      result?: ExcelImportResult;
    } | null;
    if (!res.ok) {
      throw new ApiError(data?.error ?? "Error al importar", res.status);
    }
    if (!data?.result) throw new ApiError("Respuesta inválida del servidor", 500);
    return data.result;
  },
  exportPdf: (params: { locationType: string; locationId: string }) =>
    downloadInventoryExport({ ...params, format: "pdf" }, "inventario.pdf"),
  exportXlsx: (params: { locationType: string; locationId: string }) =>
    downloadInventoryExport({ ...params, format: "xlsx" }, "inventario.xlsx"),
  exportMovementsXlsx: (params: { locationType: string; locationId: string; type?: string; from?: string; to?: string }) =>
    downloadBlob(
      `/api/inventory/movements/export?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
      )}`,
      "movimientos-inventario.xlsx"
    ),
  exportRevisionPdf: (id: string) => downloadBlob(`/api/inventory/revisions/${id}/export`, `revision-${id}.pdf`),
};

// ── Ventas (FASE 9) ───────────────────────────────────────────────────────────

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

export const salesApi = {
  list(params: Record<string, string | number | undefined> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)])
    );
    return request<{ ok: boolean; rows: SaleRow[]; total: number }>(`/api/sales?${qs.toString()}`);
  },
  detail: (id: string) => request<{ ok: boolean; sale: SaleDetail }>(`/api/sales/${id}`),
  exportXlsx: (params: Record<string, string | undefined> = {}) =>
    download(`/api/sales/export?${new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
    )}`),
  exportPdf: (params: Record<string, string | undefined> = {}) =>
    download(`/api/sales/export?format=pdf&${new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
    )}`, "ventas.pdf"),

  // Devoluciones
  createReturn: (saleId: string, data: {
    returnType: "exchange" | "refund" | "coupon" | "points";
    reason?: string;
    notes?: string;
    items: { saleItemId: string; quantity: number; reason?: string; restockable?: boolean }[];
    exchangeVariantId?: string;
  }) => request<{ ok: boolean; return: SaleReturn }>(`/api/sales/${saleId}/return`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }),
  saleReturns: (saleId: string) =>
    request<{ ok: boolean; returns: SaleReturn[] }>(`/api/sales/${saleId}/returns`),
  listReturns: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
    );
    return request<{ ok: boolean; rows: SaleReturnWithSale[]; total: number }>(`/api/sales/returns?${qs.toString()}`);
  },
  returnDetail: (returnId: string) =>
    request<{ ok: boolean; return: SaleReturnDetail }>(`/api/sales/returns/${returnId}`),
  approveReturn: (returnId: string) =>
    request<{ ok: boolean; return: SaleReturn }>(`/api/sales/returns/${returnId}/approve`, { method: "PUT" }),
  rejectReturn: (returnId: string) =>
    request<{ ok: boolean; return: SaleReturn }>(`/api/sales/returns/${returnId}/reject`, { method: "PUT" }),
  completeReturn: (returnId: string) =>
    request<{ ok: boolean; return: SaleReturn }>(`/api/sales/returns/${returnId}/complete`, { method: "POST" }),
  returnTicketUrl: (returnId: string) => `/api/sales/returns/${returnId}/ticket`,
};

async function download(url: string, fallbackName?: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(data?.error ?? "Error al exportar", res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName ?? "export.pdf";
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

// ── Reportes (FASE 10) ─────────────────────────────────────────────────────────

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

export type ReportType = "dashboard" | "sales" | "cash" | "orders" | "customers" | "credit";
export type ReportFilters = Record<string, string | undefined>;

function reportParams(type: string, filters?: ReportFilters): string {
  const params: Record<string, string> = { type };
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
  }
  return new URLSearchParams(params).toString();
}

export const reportsApi = {
  dashboard: () =>
    request<{ ok: boolean; data: DashboardData }>(`/api/reports?type=dashboard`).then((r) => r.data),
  sales: (filters?: ReportFilters) =>
    request<{ ok: boolean; rows: SalesReportRow[]; count: number; totals: { subtotal: number; discount: number; tax: number; total: number; pointsEarned: number } }>(
      `/api/reports?${reportParams("sales", filters)}`
    ),
  cash: (filters?: ReportFilters) =>
    request<{ ok: boolean; rows: CashReportRow[]; count: number; totals: { totalSales: number; salesCount: number; cashPayments: number; expectedCash: number } }>(
      `/api/reports?${reportParams("cash", filters)}`
    ),
  orders: (filters?: ReportFilters) =>
    request<{ ok: boolean; rows: OrdersReportRow[]; count: number; totals: { total: number; delivery: number; pickup: number }; byStatus: { status: string; count: number }[] }>(
      `/api/reports?${reportParams("orders", filters)}`
    ),
  customers: (filters?: ReportFilters) =>
    request<{ ok: boolean; rows: CustomersReportRow[]; count: number }>(
      `/api/reports?${reportParams("customers", filters)}`
    ),
  credit: (filters?: ReportFilters) =>
    request<{
      ok: boolean;
      rows: CreditReportRow[];
      count: number;
      totals: {
        totalDebt: number;
        totalCharges: number;
        totalPayments: number;
        totalOverdue: number;
        totalCreditLimit: number;
        overdueCount: number;
        activeCount: number;
      };
    }>(`/api/reports?${reportParams("credit", filters)}`),
  export: (type: ReportType, format: "xlsx" | "pdf", filters?: ReportFilters) => {
    const params: Record<string, string> = { type, format };
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
    }
    return download(`/api/reports/export?${new URLSearchParams(params).toString()}`, `${type}.${format}`);
  },
};

// ── Excel (import/export masivo) ──────────────────────────────────────────────

async function downloadResponse(res: Response, fallbackName: string) {
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(data?.error ?? "Error al descargar", res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportExcel(module: string) {
  await downloadResponse(await fetch(`/api/crud/${module}/export`), `${module}.xlsx`);
}

/** Descarga la plantilla vacía (con instrucciones y dropdowns de catálogo). */
export async function exportTemplate(module: string) {
  await downloadResponse(await fetch(`/api/crud/${module}/export?template=1`), `plantilla-${module}.xlsx`);
}

export interface ExcelImportResult {
  ok: boolean;
  imported: number;
  errors: { row: number; message: string }[];
}

export interface CustomerActivityData {
  customerId: string;
  points: number;
  loyalty: { id: string; kind: string; points: number; note: string | null; createdAt: string }[];
  sales: { id: string; saleNumber: number; total: number; itemCount: number; createdAt: string }[];
  orders: { id: string; orderNumber: number; status: string; total: number; deliveryMethod: string | null; createdAt: string }[];
  favorites: { id: string; productName: string; variantName: string | null; variantId: string; createdAt: string }[];
  paymentMethods: { id: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; isDefault: boolean }[];
}

export async function getCustomerActivity(customerId: string): Promise<CustomerActivityData> {
  const res = await request<{ ok: boolean; activity: CustomerActivityData }>(
    `/api/crud/customers/${customerId}/detail`
  );
  return res.activity;
}

export async function importExcel(module: string, file: File): Promise<ExcelImportResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/crud/${module}/import`, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    result?: ExcelImportResult;
  } | null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Error al importar", res.status);
  }
  if (!data?.result) throw new ApiError("Respuesta inválida del servidor", 500);
  return data.result;
}

export interface ExcelPreviewResult {
  ok: boolean;
  total: number;
  missingColumns: string[];
  headers: string[];
  sample: { line: number; cells: string[] }[];
}

export async function previewExcel(module: string, file: File): Promise<ExcelPreviewResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("preview", "true");
  const res = await fetch(`/api/crud/${module}/import`, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    result?: ExcelPreviewResult;
  } | null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Error al analizar", res.status);
  }
  if (!data?.result) throw new ApiError("Respuesta inválida del servidor", 500);
  return data.result;
}

// ── Variantes (endpoints dedicados de products) ─────────────────────────────

export interface VariantRow {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost: number;
  imageUrl: string | null;
  isActive: boolean;
  optionValues?: { optionId: string; optionName: string; valueId: string; value: string }[];
}

export const variantApi = {
  list: (productId: string) =>
    request<{ ok: boolean; rows: VariantRow[] }>(
      `/api/crud/products/${productId}/variants`
    ),
  create: (productId: string, body: Partial<VariantRow>) =>
    request<{ ok: boolean; row: VariantRow }>(`/api/crud/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (productId: string, variantId: string, body: Partial<VariantRow>) =>
    request<{ ok: boolean; row: VariantRow }>(
      `/api/crud/products/${productId}/variants/${variantId}`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),
  remove: (productId: string, variantId: string) =>
    request<{ ok: boolean }>(
      `/api/crud/products/${productId}/variants/${variantId}`,
      { method: "DELETE" }
    ),
};

// ── Opciones de variante (FASE 7.1) ─────────────────────────────────────────

export interface ProductOptionValue {
  id?: string;
  value: string;
}

export interface ProductOption {
  id?: string;
  name: string;
  values: ProductOptionValue[];
}

export const optionsApi = {
  list: (productId: string) =>
    request<{ ok: boolean; rows: ProductOption[] }>(`/api/crud/products/${productId}/options`),
  save: (productId: string, options: ProductOption[]) =>
    request<{ ok: boolean; rows: ProductOption[] }>(`/api/crud/products/${productId}/options`, {
      method: "PUT",
      body: JSON.stringify({ options }),
    }),
};