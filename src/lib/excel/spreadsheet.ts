import ExcelJS from "exceljs";
import type { CrudContext } from "@/lib/crud/types";
import { prisma } from "@/lib/db";
import { categoriesModule } from "@/lib/crud/modules/categories";
import { customersModule } from "@/lib/crud/modules/customers";
import { productsModule } from "@/lib/crud/modules/products";

// FASE 7.10 — Importación/exportación masiva en Excel (.xlsx).
// Se reutilizan los módulos CRUD para garantizar la misma validación/efectos.

type Cell = string | number | boolean | null;

export interface ImportContext {
  categoryByName: Map<string, string>;
  unitByLabel: Map<string, string>;
}

export type ImportResult = { ok: boolean; imported: number; errors: { row: number; message: string }[] };

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
  return Number.isFinite(n) ? n : 0;
}

async function buildImportContext(orgId: string): Promise<ImportContext> {
  const [categories, units] = await Promise.all([
    prisma.category.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.unitOfMeasure.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, abbreviation: true },
    }),
  ]);
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const unitByLabel = new Map<string, string>();
  for (const u of units) {
    if (!unitByLabel.has(u.abbreviation.toLowerCase())) unitByLabel.set(u.abbreviation.toLowerCase(), u.id);
    if (!unitByLabel.has(u.name.toLowerCase())) unitByLabel.set(u.name.toLowerCase(), u.id);
  }
  return { categoryByName, unitByLabel };
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
    headers: ["Nombre", "Descripción", "Categoría padre", "URL de imagen", "Activa"],
    requiredHeaders: ["Nombre"],
    exportRow: (r) => [
      String(r.name ?? ""),
      blank(r.description),
      blank(r.parentName),
      blank(r.imageUrl),
      yes(r.isActive),
    ],
    parseCell(key, raw, ctx) {
      if (key === "parentName") {
        const name = String(raw ?? "").trim();
        return name ? (ctx.categoryByName.get(name.toLowerCase()) ?? null) : null;
      }
      if (key === "isActive") return toBool(raw) ?? true;
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
      if (key === "isActive") return toBool(raw) ?? true;
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
    requiredHeaders: ["Nombre"],
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
        return name ? (ctx.categoryByName.get(name.toLowerCase()) ?? null) : null;
      }
      if (key === "productType") {
        const s = String(raw ?? "").trim().toLowerCase();
        return ["granel", "bulk", "peso"].includes(s) ? "bulk" : "standard";
      }
      if (key === "bulkUnitName" || key === "splitUnitName") {
        const name = String(raw ?? "").trim();
        return name ? (ctx.unitByLabel.get(name.toLowerCase()) ?? null) : null;
      }
      if (key === "price" || key === "cost") return toNum(raw);
      if (key === "taxRate") return toNum(raw) / 100;
      if (key === "isActive" || key === "trackInventory" || key === "allowSplit") return toBool(raw) ?? true;
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

function addListValidation(ws: ExcelJS.Worksheet, headerName: string, options: string[], spec: Spec) {
  const idx = spec.headers.indexOf(headerName);
  if (idx < 0 || options.length === 0) return;
  const col = idx + 1; // 1-based
  const formula = `"${options.join(",")}"`;
  for (let r = 2; r <= 1000; r++) {
    ws.getCell(r, col).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      error: "Selecciona un valor de la lista",
    };
  }
}

export async function exportWorkbook(orgId: string, module: string): Promise<{ buffer: Buffer; filename: string }> {
  const spec = SPECS[module];
  if (!spec) throw new Error("Módulo sin exportación disponible");

  const pageSize = 100000;
  const { rows } =
    module === "products"
      ? await productsModule.list(orgId, { page: 1, pageSize })
      : module === "categories"
        ? await categoriesModule.list(orgId, { page: 1, pageSize })
        : await customersModule.list(orgId, { page: 1, pageSize });

  // Catálogo de categorías para los dropdowns (19.2).
  const categoryNames = (
    await prisma.category.findMany({ where: { organizationId: orgId }, select: { name: true }, orderBy: { name: "asc" } })
  ).map((c) => c.name);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Datos");
  ws.columns = spec.headers.map((h) => ({ header: h, width: 22 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of rows) {
    ws.addRow(spec.exportRow(row as unknown as Record<string, unknown>));
  }

  // Dropdowns en celdas (19.2).
  if (module === "products") {
    addListValidation(ws, "Categoría", categoryNames, spec);
    addListValidation(ws, "Tipo", ["Estándar", "Granel"], spec);
  }
  if (module === "categories") {
    addListValidation(ws, "Categoría padre", categoryNames, spec);
  }

  // Hoja de instrucciones (19.2).
  addInstructionsSheet(wb, spec);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `${spec.filename}-${new Date().toISOString().slice(0, 10)}.xlsx` };
}

interface ParsedWorkbook {
  items: { record: Record<string, Cell>; line: number }[];
  missingColumns: string[];
}

async function parseWorkbook(orgId: string, module: string, buffer: Buffer): Promise<{ spec: Spec; parsed: ParsedWorkbook }> {
  const spec = SPECS[module];
  if (!spec) throw new Error("Módulo sin importación disponible");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El archivo no contiene hojas");

  const ctx = await buildImportContext(orgId);
  const headerSet = new Set<string>();
  const items: { record: Record<string, Cell>; line: number }[] = [];

  ws.eachRow((row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1) as Cell[];
    if (rowNumber === 1) {
      values.forEach((cell) => {
        const label = String(cell ?? "").trim();
        if (label && spec.headers.includes(label)) headerSet.add(label);
      });
      return;
    }
    if (!values.some((v) => v != null && String(v).trim() !== "")) return;
    const record: Record<string, Cell> = {};
    spec.headers.forEach((h, i) => {
      record[h] = spec.parseCell(h, values[i] ?? "", ctx);
    });
    items.push({ record, line: rowNumber });
  });

  const missingColumns = spec.requiredHeaders.filter((h) => !headerSet.has(h));
  return { spec, parsed: { items, missingColumns } };
}

export interface PreviewRow {
  line: number;
  cells: string[];
}

export interface PreviewResult {
  ok: boolean;
  total: number;
  missingColumns: string[];
  headers: string[];
  sample: PreviewRow[];
}

/** Vista previa (19.2): parsea sin crear registros; valida columnas requeridas. */
export async function previewWorkbook(orgId: string, module: string, buffer: Buffer): Promise<PreviewResult> {
  const { spec, parsed } = await parseWorkbook(orgId, module, buffer);
  return {
    ok: parsed.missingColumns.length === 0,
    total: parsed.items.length,
    missingColumns: parsed.missingColumns,
    headers: spec.headers,
    sample: parsed.items.slice(0, 20).map((i) => ({ line: i.line, cells: spec.headers.map((h) => String(i.record[h] ?? "")) })),
  };
}

export async function importWorkbook(orgId: string, module: string, buffer: Buffer): Promise<ImportResult> {
  const { spec, parsed } = await parseWorkbook(orgId, module, buffer);

  if (parsed.missingColumns.length > 0) {
    throw new Error(`Falta(n) columna(s) requerida(s): ${parsed.missingColumns.join(", ")}`);
  }

  const result: ImportResult = { ok: true, imported: 0, errors: [] };
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