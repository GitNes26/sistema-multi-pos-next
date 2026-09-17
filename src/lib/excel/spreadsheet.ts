import ExcelJS from "exceljs";
import type { CrudContext } from "@/lib/crud/types";
import { prisma } from "@/lib/db";
import { categoriesModule } from "@/lib/crud/modules/categories";
import { customersModule } from "@/lib/crud/modules/customers";
import { productsModule } from "@/lib/crud/modules/products";
import { IMPORT_MAX_COLUMNS, IMPORT_MAX_ROWS, parseOptionalNumber, validateEmail, validatePhone } from "@/lib/excel/import-schema";

// FASE 7.10 — Importación/exportación masiva en Excel (.xlsx).
// Se reutilizan los módulos CRUD para garantizar la misma validación/efectos.

type Cell = string | number | boolean | null;

export interface ImportContext {
  categoryByName: Map<string, string>;
  unitByLabel: Map<string, string>;
  customerCodes: Set<string>;
  customerPhones: Set<string>;
  customerEmails: Set<string>;
  variantSkus: Set<string>;
  variantBarcodes: Set<string>;
}

export type ImportResult = { ok: boolean; imported: number; errors: { row: number; message: string }[] };

const FIELD_KEYS: Record<string, string[]> = {
  categories: ["name", "parentName", "imageUrl", "isActive"],
  customers: ["fullName", "customerCode", "phone", "email", "address", "points", "isActive"],
  products: [
    "name", "description", "categoryName", "productType", "price", "cost", "sku", "barcode",
    "taxRate", "isActive", "trackInventory", "bulkUnitName", "bulkPricePerUnit",
    "bulkMinQuantity", "bulkStep", "bulkMaxQuantity", "allowSplit", "splitUnitName", "splitPricePerUnit",
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const yes = (v: unknown): Cell => (v == null || v === "" ? null : "Sí");
const blank = (v: unknown): Cell => (v == null || v === "" ? "" : String(v));

function toBool(raw: Cell): boolean | undefined {
  const s = String(raw ?? "").trim().toLowerCase();
  if (["1", "si", "sí", "true", "activo", "activa", "yes"].includes(s)) return true;
  if (["0", "no", "false", "inactivo", "inactiva"].includes(s)) return false;
  return undefined;
}

function toNum(raw: Cell): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

function importBool(raw: Cell, fallback = true): Cell {
  if (raw == null || String(raw).trim() === "") return fallback;
  return toBool(raw) ?? `__invalid_bool__:${String(raw)}`;
}

async function buildImportContext(orgId: string): Promise<ImportContext> {
  const [categories, units, customers, variants] = await Promise.all([
    prisma.category.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.unitOfMeasure.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }], isActive: true },
      select: { id: true, name: true, abbreviation: true },
    }),
    prisma.customer.findMany({ where: { organizationId: orgId }, select: { customerCode: true, phone: true, email: true } }),
    prisma.productVariant.findMany({ where: { organizationId: orgId }, select: { sku: true, barcode: true } }),
  ]);
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const unitByLabel = new Map<string, string>();
  for (const u of units) {
    if (!unitByLabel.has(u.abbreviation.toLowerCase())) unitByLabel.set(u.abbreviation.toLowerCase(), u.id);
    if (!unitByLabel.has(u.name.toLowerCase())) unitByLabel.set(u.name.toLowerCase(), u.id);
  }
  const keys = (values: (string | null)[]) => new Set(values.filter(Boolean).map((value) => String(value).trim().toLowerCase()));
  return {
    categoryByName,
    unitByLabel,
    customerCodes: keys(customers.map((row) => row.customerCode)),
    customerPhones: keys(customers.map((row) => row.phone)),
    customerEmails: keys(customers.map((row) => row.email)),
    variantSkus: keys(variants.map((row) => row.sku)),
    variantBarcodes: keys(variants.map((row) => row.barcode)),
  };
}

// ── Especificaciones por módulo ──────────────────────────────────────────────

interface Spec {
  module: string;
  filename: string;
  headers: string[];
  /** Columnas obligatorias: si faltan en la cabecera, se aborta con error. */
  requiredHeaders: string[];
  exportRow: (row: Record<string, unknown>) => Cell[];
  parseCell: (key: string, raw: Cell, ctx: ImportContext) => Cell;
  create: (orgId: string, record: Record<string, Cell>, ctx: CrudContext) => Promise<string | null>;
}

const PRODUCT_HEADERS = [
  "Nombre",
  "Descripción",
  "Categoría",
  "Tipo",
  "Precio",
  "Costo",
  "SKU",
  "Código de barras",
  "Impuesto %",
  "Activo",
  "trackInventory",
  "Unidad (granel)",
  "Precio por unidad",
  "Cant. mínima",
  "Step",
  "Cant. máxima",
  "Permite fraccionar",
  "Unidad alternativa",
  "Precio alternativo",
];

const SPECS: Record<string, Spec> = {
  categories: {
    module: "categories",
    filename: "categorias",
    headers: ["Nombre", "Categoría padre", "URL de imagen", "Activa"],
    requiredHeaders: ["Nombre"],
    exportRow: (r) => [
      String(r.name ?? ""),
      blank(r.parentName),
      blank(r.imageUrl),
      yes(r.isActive),
    ],
    parseCell(key, raw, ctx) {
      if (key === "parentName") {
        const name = String(raw ?? "").trim();
        return name ? (ctx.categoryByName.get(name.toLowerCase()) ?? `__missing__:${name}`) : null;
      }
      if (key === "isActive") return importBool(raw);
      return raw;
    },
    async create(orgId, record) {
      const name = String(record.name ?? "").trim();
      if (!name) return "Falta el nombre";
      const existing = await prisma.category.findFirst({ where: { organizationId: orgId, name } });
      if (existing) return `La categoría «${name}» ya existe`;
      try {
        await categoriesModule.create(orgId, record as unknown, { userId: "" });
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Error al crear";
      }
    },
  },

  customers: {
    module: "customers",
    filename: "clientes",
    headers: ["Nombre completo", "Nº de cliente", "Teléfono", "Correo", "Dirección", "Puntos", "Activo"],
    requiredHeaders: ["Nombre completo"],
    exportRow: (r) => [
      String(r.fullName ?? ""),
      blank(r.customerCode),
      blank(r.phone),
      blank(r.email),
      blank(r.address),
      Number(r.points ?? 0),
      yes(r.isActive),
    ],
    parseCell(key, raw) {
      if (key === "points") return toNum(raw);
      if (key === "isActive") return importBool(raw);
      return raw;
    },
    async create(orgId, record) {
      if (!String(record.fullName ?? "").trim()) return "Falta el nombre";
      try {
        await customersModule.create(orgId, record as unknown, { userId: "" });
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Error al crear";
      }
    },
  },

  products: {
    module: "products",
    filename: "productos",
    headers: PRODUCT_HEADERS,
    requiredHeaders: ["Nombre", "Tipo"],
    exportRow: (r) => {
      const variants = (r.variants as Record<string, unknown>[] | undefined) ?? [];
      const v = variants[0] ?? {};
      const bulk = r.productType === "bulk";
      return [
        String(r.name ?? ""),
        blank(r.description),
        blank(r.categoryName),
        bulk ? "Granel" : "Estándar",
        v.price != null ? Number(v.price) : "",
        v.cost != null ? Number(v.cost) : "",
        blank(v.sku),
        blank(v.barcode),
        Number(r.taxRate ?? 0) * 100,
        yes(r.isActive),
        yes(r.trackInventory),
        bulk ? blank(r.bulkUnitAbbrev) : "",
        bulk ? Number(r.bulkPricePerUnit ?? 0) : "",
        bulk ? Number(r.bulkMinQuantity ?? 0) : "",
        bulk ? Number(r.bulkStep ?? 0) : "",
        bulk ? Number(r.bulkMaxQuantity ?? 0) : "",
        bulk ? (r.allowSplit ? "Sí" : "No") : "",
        bulk && r.allowSplit ? blank(r.splitUnitAbbrev) : "",
        bulk && r.allowSplit ? Number(r.splitPricePerUnit ?? 0) : "",
      ];
    },
    parseCell(key, raw, ctx) {
      if (key === "categoryName") {
        const name = String(raw ?? "").trim();
        return name ? (ctx.categoryByName.get(name.toLowerCase()) ?? `__missing__:${name}`) : null;
      }
      if (key === "productType") {
        const s = String(raw ?? "").trim().toLowerCase();
        if (["granel", "bulk", "peso"].includes(s)) return "bulk";
        if (["estándar", "estandar", "standard"].includes(s)) return "standard";
        return `__invalid_type__:${String(raw ?? "")}`;
      }
      if (key === "bulkUnitName" || key === "splitUnitName") {
        const name = String(raw ?? "").trim();
        return name ? (ctx.unitByLabel.get(name.toLowerCase()) ?? `__missing__:${name}`) : null;
      }
      if (key === "price" || key === "cost") return toNum(raw);
      if (key === "taxRate") return toNum(raw) / 100;
      if (key === "isActive" || key === "trackInventory") return importBool(raw);
      if (key === "allowSplit") return importBool(raw, false);
      return raw;
    },
    async create(orgId, record) {
      const name = String(record.name ?? "").trim();
      if (!name) return "Falta el nombre";
      const type = record.productType === "bulk" ? "bulk" : "standard";
      const payload: Record<string, unknown> = {
        name,
        description: record.description,
        categoryId: record.categoryName,
        imageUrl: record.imageUrl,
        taxRate: record.taxRate,
        isActive: record.isActive,
        trackInventory: record.trackInventory,
        productType: type,
      };
      if (type === "bulk") {
        payload.bulkUnitId = record.bulkUnitName || null;
        payload.bulkPricePerUnit = Number(record.bulkPricePerUnit) || 0;
        payload.bulkMinQuantity = Number(record.bulkMinQuantity) || 0;
        payload.bulkStep = Number(record.bulkStep) || 0.01;
        payload.bulkMaxQuantity = Number(record.bulkMaxQuantity) || 0;
        payload.allowSplit = record.allowSplit === true && Boolean(record.splitUnitName);
        payload.splitUnitId = payload.allowSplit ? record.splitUnitName || null : null;
        payload.splitPricePerUnit = payload.allowSplit ? Number(record.splitPricePerUnit) || 0 : 0;
      } else {
        payload.initialVariant = {
          name: "Default",
          sku: record.sku,
          barcode: record.barcode,
          price: Number(record.price) || 0,
          cost: Number(record.cost) || 0,
        };
      }
      try {
        await productsModule.create(orgId, payload, { userId: "" });
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Error al crear";
      }
    },
  },
};

// ── Acciones ─────────────────────────────────────────────────────────────────

function addInstructionsSheet(wb: ExcelJS.Workbook, spec: Spec) {
  const ws = wb.addWorksheet("Instrucciones");
  ws.columns = [{ width: 40 }, { width: 80 }];
  ws.addRow(["INSTRUCCIONES DE LLENADO", ""]).font = { bold: true, size: 14 };
  ws.addRow(["", ""]);
  ws.addRow(["Columnas requeridas (*)", spec.requiredHeaders.join(", ")]).font = { bold: true };
  ws.addRow(["", ""]);
  ws.addRow(["Columna", "Descripción"]);
  const descriptions: Record<string, string> = {
    Nombre: "Nombre visible del producto (obligatorio).",
    Descripción: "Texto descriptivo (opcional).",
    Categoría: "Nombre de la categoría existente (se valida contra el catálogo).",
    Tipo: "Estándar (usa variantes) o Granel (precio por unidad).",
    Precio: "Precio de venta de la variante (estándar).",
    Costo: "Costo de la variante (estándar).",
    SKU: "Código interno (opcional).",
    "Código de barras": "Código de barras (opcional).",
    "Impuesto %": "Porcentaje de impuesto, ej. 16.",
    Activo: "Sí / No.",
    trackInventory: "Sí / No (si controla inventario).",
    "Unidad (granel)": "Abreviatura de la unidad (kg, pza, lt…).",
    "Precio por unidad": "Precio por unidad de medida (granel).",
    "Cant. mínima": "Cantidad mínima de venta (granel).",
    Step: "Incremento permitido (granel).",
    "Cant. máxima": "Cantidad máxima, 0 = sin límite (granel).",
    "Permite fraccionar": "Sí / No (granel).",
    "Unidad alternativa": "Unidad alternativa para venta fraccionada (granel).",
    "Precio alternativo": "Precio por unidad alternativa (granel).",
    "Nombre completo": "Nombre del cliente (obligatorio).",
    "Nº de cliente": "Código de cliente (opcional).",
    Teléfono: "Teléfono (10 dígitos).",
    Correo: "Email (opcional).",
    Dirección: "Dirección (opcional).",
    Puntos: "Puntos iniciales.",
    "Categoría padre": "Nombre de la categoría padre (opcional).",
    "URL de imagen": "URL de la imagen (opcional).",
    Activa: "Sí / No.",
  };
  for (const h of spec.headers) {
    ws.addRow([h, descriptions[h] ?? ""]);
  }
}

function addListValidation(ws: ExcelJS.Worksheet, headerName: string, options: string[], spec: Spec, formula?: string) {
  const idx = spec.headers.indexOf(headerName);
  if (idx < 0 || options.length === 0) return;
  const col = idx + 1; // 1-based
  const source = formula ?? `"${options.join(",")}"`;
  for (let r = 2; r <= 1000; r++) {
    ws.getCell(r, col).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [source],
      showErrorMessage: true,
      error: "Selecciona un valor de la lista",
    };
  }
}

export async function exportWorkbook(
  orgId: string,
  module: string,
  opts: { template?: boolean } = {}
): Promise<{ buffer: Buffer; filename: string }> {
  const spec = SPECS[module];
  if (!spec) throw new Error("Módulo sin exportación disponible");

  const pageSize = 100000;
  const { rows } = opts.template
    ? { rows: [] as Record<string, unknown>[] }
    : module === "products"
      ? await productsModule.list(orgId, { page: 1, pageSize })
      : module === "categories"
        ? await categoriesModule.list(orgId, { page: 1, pageSize })
        : await customersModule.list(orgId, { page: 1, pageSize });

  // Catálogo de categorías para los dropdowns (19.2).
  const [categoryNames, unitNames] = await Promise.all([
    prisma.category.findMany({ where: { organizationId: orgId, isActive: true }, select: { name: true }, orderBy: { name: "asc" } }).then((rows) => rows.map((c) => c.name)),
    prisma.unitOfMeasure.findMany({ where: { OR: [{ organizationId: orgId }, { organizationId: null }], isActive: true }, select: { abbreviation: true }, orderBy: { name: "asc" } }).then((rows) => rows.map((u) => u.abbreviation)),
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Datos");
  ws.columns = spec.headers.map((h) => ({ header: h, width: 22 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  if (!opts.template) {
    for (const row of rows) {
      ws.addRow(spec.exportRow(row as unknown as Record<string, unknown>));
    }
  }

  const catalogs = wb.addWorksheet("Catálogos");
  catalogs.columns = [{ header: "Categorías", width: 32 }, { header: "Unidades", width: 20 }];
  const catalogRows = Math.max(categoryNames.length, unitNames.length, 1);
  for (let index = 0; index < catalogRows; index += 1) catalogs.addRow([categoryNames[index] ?? "", unitNames[index] ?? ""]);
  catalogs.getRow(1).font = { bold: true };
  catalogs.state = "veryHidden";

  // Dropdowns en celdas (19.2).
  if (module === "products") {
    addListValidation(ws, "Categoría", categoryNames, spec, `'Catálogos'!$A$2:$A$${categoryNames.length + 1}`);
    addListValidation(ws, "Tipo", ["Estándar", "Granel"], spec);
    addListValidation(ws, "Unidad (granel)", unitNames, spec, `'Catálogos'!$B$2:$B$${unitNames.length + 1}`);
    addListValidation(ws, "Unidad alternativa", unitNames, spec, `'Catálogos'!$B$2:$B$${unitNames.length + 1}`);
    addListValidation(ws, "Activo", ["Sí", "No"], spec);
    addListValidation(ws, "trackInventory", ["Sí", "No"], spec);
    addListValidation(ws, "Permite fraccionar", ["Sí", "No"], spec);
  }
  if (module === "categories") {
    addListValidation(ws, "Categoría padre", categoryNames, spec, `'Catálogos'!$A$2:$A$${categoryNames.length + 1}`);
    addListValidation(ws, "Activa", ["Sí", "No"], spec);
  }
  if (module === "customers") addListValidation(ws, "Activo", ["Sí", "No"], spec);

  // Hoja de instrucciones (19.2).
  addInstructionsSheet(wb, spec);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const prefix = opts.template ? "plantilla" : spec.filename;
  return { buffer, filename: `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx` };
}

/** Descarga la plantilla vacía (headers + instrucciones + dropdowns de catálogo). */
export async function exportTemplate(orgId: string, module: string): Promise<{ buffer: Buffer; filename: string }> {
  return exportWorkbook(orgId, module, { template: true });
}

interface ParsedWorkbook {
  items: { record: Record<string, Cell>; line: number; errors: string[] }[];
  missingColumns: string[];
}

async function parseWorkbook(orgId: string, module: string, buffer: Buffer): Promise<{ spec: Spec; parsed: ParsedWorkbook }> {
  const spec = SPECS[module];
  if (!spec) throw new Error("Módulo sin importación disponible");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El archivo no contiene hojas");
  if (ws.rowCount > IMPORT_MAX_ROWS + 1) throw new Error(`El archivo supera el límite de ${IMPORT_MAX_ROWS} registros`);
  if (ws.columnCount > IMPORT_MAX_COLUMNS) throw new Error(`El archivo supera el límite de ${IMPORT_MAX_COLUMNS} columnas`);

  const ctx = await buildImportContext(orgId);
  const headerSet = new Set<string>();
  const headerPositions = new Map<string, number>();
  const items: { record: Record<string, Cell>; line: number; errors: string[] }[] = [];
  const keys = FIELD_KEYS[module];
  if (!keys || keys.length !== spec.headers.length) throw new Error("La configuración de importación es inválida");

  ws.eachRow((row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1) as Cell[];
    if (rowNumber === 1) {
      values.forEach((cell, index) => {
        const label = String(cell ?? "").trim();
        if (label && spec.headers.includes(label)) {
          if (headerPositions.has(label)) throw new Error(`La columna «${label}» está repetida`);
          headerSet.add(label);
          headerPositions.set(label, index);
        }
      });
      return;
    }
    if (!values.some((v) => v != null && String(v).trim() !== "")) return;
    const record: Record<string, Cell> = {};
    spec.headers.forEach((h, i) => {
      const key = keys[i];
      const position = headerPositions.get(h);
      record[key] = spec.parseCell(key, position === undefined ? "" : values[position] ?? "", ctx);
    });
    items.push({ record, line: rowNumber, errors: validateImportRecord(module, record) });
  });

  const missingColumns = spec.requiredHeaders.filter((h) => !headerSet.has(h));
  const seen = new Map<string, Set<string>>();
  const checkUnique = (item: { record: Record<string, Cell>; errors: string[] }, key: string, label: string, existing: Set<string>) => {
    const value = String(item.record[key] ?? "").trim().toLowerCase();
    if (!value) return;
    if (existing.has(value)) item.errors.push(`${label} ya existe en el sistema`);
    const values = seen.get(key) ?? new Set<string>();
    if (values.has(value)) item.errors.push(`${label} está repetido en el archivo`);
    values.add(value); seen.set(key, values);
  };
  for (const item of items) {
    if (module === "categories") checkUnique(item, "name", "La categoría", new Set(ctx.categoryByName.keys()));
    if (module === "customers") {
      checkUnique(item, "customerCode", "El número de cliente", ctx.customerCodes);
      checkUnique(item, "phone", "El teléfono", ctx.customerPhones);
      checkUnique(item, "email", "El correo", ctx.customerEmails);
    }
    if (module === "products" && item.record.productType !== "bulk") {
      checkUnique(item, "sku", "El SKU", ctx.variantSkus);
      checkUnique(item, "barcode", "El código de barras", ctx.variantBarcodes);
    }
  }
  return { spec, parsed: { items, missingColumns } };
}

export interface PreviewRow {
  line: number;
  cells: string[];
  errors: string[];
}

export interface PreviewResult {
  ok: boolean;
  total: number;
  missingColumns: string[];
  headers: string[];
  sample: PreviewRow[];
  valid: number;
  invalid: number;
}

export function validateImportRecord(module: string, record: Record<string, Cell>) {
  const errors: string[] = [];
  const missing = (value: Cell) => typeof value === "string" && value.startsWith("__missing__:");
  for (const key of ["isActive", "trackInventory", "allowSplit"]) if (typeof record[key] === "string" && record[key].startsWith("__invalid_bool__:")) errors.push(`${key}: usa Sí o No`);
  if (!String(record[module === "customers" ? "fullName" : "name"] ?? "").trim()) errors.push("Falta el nombre obligatorio");
  if (module === "categories" && missing(record.parentName)) errors.push(`La categoría padre «${String(record.parentName).slice(12)}» no existe`);
  if (module === "customers") {
    if (!validatePhone(record.phone)) errors.push("El teléfono debe tener 10 dígitos");
    if (!validateEmail(record.email)) errors.push("El correo no tiene un formato válido");
    const points = parseOptionalNumber(record.points);
    if (points !== null && (!Number.isFinite(points) || points < 0)) errors.push("Los puntos deben ser un número igual o mayor que cero");
  }
  if (module === "products") {
    if (typeof record.productType === "string" && record.productType.startsWith("__invalid_type__:")) errors.push("El tipo debe ser Estándar o Granel");
    if (missing(record.categoryName)) errors.push(`La categoría «${String(record.categoryName).slice(12)}» no existe`);
    const type = record.productType === "bulk" ? "bulk" : "standard";
    for (const key of type === "bulk" ? ["bulkPricePerUnit", "bulkMinQuantity", "bulkStep", "bulkMaxQuantity"] : ["price", "cost"]) {
      const value = parseOptionalNumber(record[key]);
      if (value !== null && (!Number.isFinite(value) || value < 0)) errors.push(`${key}: usa un número igual o mayor que cero`);
    }
    if (type === "bulk") {
      if (!record.bulkUnitName) errors.push("Selecciona la unidad del producto a granel");
      else if (missing(record.bulkUnitName)) errors.push(`La unidad «${String(record.bulkUnitName).slice(12)}» no existe`);
      if ((Number(record.bulkStep) || 0) <= 0) errors.push("El incremento de venta debe ser mayor que cero");
      if (record.allowSplit === true && (!record.splitUnitName || missing(record.splitUnitName))) errors.push("Selecciona una unidad alternativa válida para fraccionar");
    }
  }
  return errors;
}

/** Vista previa (19.2): parsea sin crear registros; valida columnas requeridas. */
export async function previewWorkbook(orgId: string, module: string, buffer: Buffer): Promise<PreviewResult> {
  const { spec, parsed } = await parseWorkbook(orgId, module, buffer);
  return {
    ok: parsed.missingColumns.length === 0,
    total: parsed.items.length,
    missingColumns: parsed.missingColumns,
    headers: spec.headers,
    sample: parsed.items.slice(0, 50).map((i) => ({
      line: i.line,
      cells: FIELD_KEYS[module].map((key) => {
        const value = i.record[key];
        return typeof value === "string" && value.startsWith("__missing__:") ? value.slice(12) : String(value ?? "");
      }),
      errors: i.errors,
    })),
    valid: parsed.items.filter((item) => item.errors.length === 0).length,
    invalid: parsed.items.filter((item) => item.errors.length > 0).length,
  };
}

export async function importWorkbook(orgId: string, module: string, buffer: Buffer): Promise<ImportResult> {
  const { spec, parsed } = await parseWorkbook(orgId, module, buffer);

  if (parsed.missingColumns.length > 0) {
    throw new Error(`Falta(n) columna(s) requerida(s): ${parsed.missingColumns.join(", ")}`);
  }

  const result: ImportResult = { ok: true, imported: 0, errors: [] };
  const validationErrors = parsed.items.filter((item) => item.errors.length).map((item) => ({ row: item.line, message: item.errors.join(" · ") }));
  if (validationErrors.length) return { ok: false, imported: 0, errors: validationErrors };
  for (const item of parsed.items) {
    const error = await spec.create(orgId, item.record, { userId: "" });
    if (error) {
      result.errors.push({ row: item.line, message: error });
    } else {
      result.imported += 1;
    }
  }
  result.ok = result.errors.length === 0;
  return result;
}
