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
  productNames: Set<string>;
  locationByName: Map<string, string>;
  /** Quien importa puede registrar existencias iniciales (permiso inventory.manage). */
  canManageInventory: boolean;
}

export type ImportResult = {
  ok: boolean;
  imported: number;
  errors: { row: number; message: string }[];
  /** Categorías que no existían y se crearon al importar productos. */
  createdCategories?: string[];
};

/** Contexto de quien importa: lo que puede hacer y quién es (para el historial de inventario). */
export type ImportActor = { userId: string; canManageInventory?: boolean };

const FIELD_KEYS: Record<string, string[]> = {
  categories: ["name", "parentName", "imageUrl", "isActive"],
  customers: ["fullName", "customerCode", "phone", "email", "address", "points", "isActive"],
  products: [
    "name", "description", "categoryName", "productType", "price", "cost", "sku", "barcode",
    "isActive", "trackInventory", "initialStock", "initialMinStock", "locationName",
    "bulkUnitName", "bulkPricePerUnit", "bulkCostPerUnit",
    "bulkMinQuantity", "bulkStep", "bulkMaxQuantity", "allowSplit", "splitUnitName", "splitPricePerUnit",
  ],
};

/** Nombres antiguos de columnas que siguen aceptándose (plantillas descargadas antes). */
const HEADER_ALIASES: Record<string, string> = {
  trackinventory: "Controla inventario",
  step: "Incremento",
  "impuesto %": "",
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

/** Texto comparable: sin mayúsculas, acentos ni espacios repetidos. */
function norm(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Número tolerante: acepta «$1,200.50», «1 200,5» o celdas numéricas. Vacío → null; inválido → NaN. */
function toNum(raw: Cell): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : Number.NaN;
  let text = String(raw).replace(/[$\s]/g, "").replace(/%$/, "");
  if (text === "") return null;
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) text = comma > dot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  else if (comma >= 0) text = /^\d+,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  const n = Number(text);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Celda de ExcelJS → valor simple (fórmulas, hipervínculos y texto con formato). */
function plainCell(value: unknown): Cell {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((part) => part.text).join("");
    if (v.result !== undefined) return plainCell(v.result);
    if (v.text !== undefined) return plainCell(v.text);
    return null;
  }
  return value as Cell;
}

function importBool(raw: Cell, fallback = true): Cell {
  if (raw == null || String(raw).trim() === "") return fallback;
  return toBool(raw) ?? `__invalid_bool__:${String(raw)}`;
}

async function buildImportContext(orgId: string, actor: ImportActor): Promise<ImportContext> {
  const [categories, units, customers, variants, products, locations] = await Promise.all([
    prisma.category.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.unitOfMeasure.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }], isActive: true },
      select: { id: true, name: true, abbreviation: true },
    }),
    prisma.customer.findMany({ where: { organizationId: orgId }, select: { customerCode: true, phone: true, email: true } }),
    prisma.productVariant.findMany({ where: { organizationId: orgId }, select: { sku: true, barcode: true } }),
    prisma.product.findMany({ where: { organizationId: orgId }, select: { name: true } }),
    prisma.location.findMany({ where: { organizationId: orgId, isActive: true }, select: { id: true, name: true } }),
  ]);
  const categoryByName = new Map(categories.map((c) => [norm(c.name), c.id]));
  const unitByLabel = new Map<string, string>();
  for (const u of units) {
    if (!unitByLabel.has(norm(u.abbreviation))) unitByLabel.set(norm(u.abbreviation), u.id);
    if (!unitByLabel.has(norm(u.name))) unitByLabel.set(norm(u.name), u.id);
  }
  const keys = (values: (string | null)[]) => new Set(values.filter(Boolean).map((value) => norm(value)));
  return {
    categoryByName,
    unitByLabel,
    customerCodes: keys(customers.map((row) => row.customerCode)),
    customerPhones: keys(customers.map((row) => row.phone)),
    customerEmails: keys(customers.map((row) => row.email)),
    variantSkus: keys(variants.map((row) => row.sku)),
    variantBarcodes: keys(variants.map((row) => row.barcode)),
    productNames: keys(products.map((row) => row.name)),
    locationByName: new Map(locations.map((l) => [norm(l.name), l.id])),
    canManageInventory: actor.canManageInventory === true,
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
  "Activo",
  "Controla inventario",
  "Existencia inicial",
  "Stock mínimo",
  "Sucursal de la existencia",
  "Unidad (granel)",
  "Precio por unidad",
  "Costo por unidad",
  "Cant. mínima",
  "Incremento",
  "Cant. máxima",
  "Permite fraccionar",
  "Unidad alternativa",
  "Precio alternativo",
];

/** Marca de una categoría que no existe todavía y se creará al importar. */
const NEW_CATEGORY = "__new__:";

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
    parseCell(key, raw) {
      // El padre se resuelve al importar: puede existir ya o venir en el mismo archivo.
      if (key === "parentName") return String(raw ?? "").trim() || null;
      if (key === "isActive") return importBool(raw);
      return raw;
    },
    async create(orgId, record) {
      const name = String(record.name ?? "").trim();
      if (!name) return "Falta el nombre";
      const existing = await prisma.category.findFirst({ where: { organizationId: orgId, name } });
      if (existing) return `La categoría «${name}» ya existe`;
      try {
        await categoriesModule.create(
          orgId,
          { name, parentId: record.parentId ?? null, imageUrl: record.imageUrl || null, isActive: record.isActive },
          { userId: "" }
        );
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
        yes(r.isActive),
        yes(r.trackInventory),
        "",
        "",
        "",
        bulk ? blank(r.bulkUnitAbbrev) : "",
        bulk ? Number(r.bulkPricePerUnit ?? 0) : "",
        bulk ? Number(r.bulkCostPerUnit ?? 0) : "",
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
        const name = String(raw ?? "").trim().replace(/\s+/g, " ");
        if (!name) return null;
        return ctx.categoryByName.get(norm(name)) ?? `${NEW_CATEGORY}${name}`;
      }
      if (key === "productType") {
        const s = norm(raw);
        if (!s || ["estandar", "standard"].includes(s)) return "standard";
        if (["granel", "bulk", "peso"].includes(s)) return "bulk";
        return `__invalid_type__:${String(raw ?? "")}`;
      }
      if (key === "bulkUnitName" || key === "splitUnitName") {
        const name = String(raw ?? "").trim();
        return name ? (ctx.unitByLabel.get(norm(name)) ?? `__missing__:${name}`) : null;
      }
      if (key === "locationName") {
        const name = String(raw ?? "").trim();
        return name ? (ctx.locationByName.get(norm(name)) ?? `__missing__:${name}`) : null;
      }
      if (["price", "cost", "initialStock", "initialMinStock", "bulkPricePerUnit", "bulkCostPerUnit", "bulkMinQuantity", "bulkMaxQuantity", "splitPricePerUnit"].includes(key)) return toNum(raw);
      // Sin incremento se vende de centésima en centésima, igual que al capturar el producto a mano.
      if (key === "bulkStep") return toNum(raw) ?? 0.01;
      if (key === "isActive" || key === "trackInventory") return importBool(raw);
      if (key === "allowSplit") return importBool(raw, false);
      return raw;
    },
    async create(orgId, record, ctx) {
      const name = String(record.name ?? "").trim();
      if (!name) return "Falta el nombre";
      const type = record.productType === "bulk" ? "bulk" : "standard";
      const payload: Record<string, unknown> = {
        name,
        description: record.description,
        categoryId: record.categoryName,
        isActive: record.isActive,
        trackInventory: record.trackInventory,
        productType: type,
        initialStock: Number(record.initialStock) || 0,
        initialMinStock: Number(record.initialMinStock) || 0,
        initialStockLocationId: record.locationName || null,
      };
      if (type === "bulk") {
        payload.bulkUnitId = record.bulkUnitName || null;
        payload.bulkPricePerUnit = Number(record.bulkPricePerUnit) || 0;
        payload.bulkCostPerUnit = Number(record.bulkCostPerUnit) || 0;
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
        await productsModule.create(orgId, payload, ctx);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Error al crear";
      }
    },
  },
};

// ── Acciones ─────────────────────────────────────────────────────────────────

const HEADER_HELP: Record<string, string> = {
  Nombre: "Nombre visible del producto (obligatorio). No puede repetirse ni existir ya en tu catálogo.",
  Descripción: "Texto descriptivo (opcional).",
  Categoría: "Escribe el nombre. Si la categoría todavía no existe, se crea sola al importar; no necesitas darla de alta antes.",
  Tipo: "Estándar (se vende por pieza) o Granel (se vende por peso o medida). Si lo dejas vacío es Estándar.",
  Precio: "Precio de venta en pesos, mayor que cero (obligatorio en productos Estándar).",
  Costo: "Lo que te cuesta a ti, para calcular tu ganancia (opcional, pero recomendado).",
  SKU: "Código interno (opcional, no puede repetirse).",
  "Código de barras": "Código de barras (opcional, no puede repetirse).",
  Activo: "Sí / No. Vacío = Sí.",
  "Controla inventario": "Sí / No. Vacío = Sí.",
  "Existencia inicial": "Cuántas piezas (o kilos, litros…) tienes hoy. Se registra como «Stock inicial» en la sucursal indicada. Requiere permiso de inventario.",
  "Stock mínimo": "Cantidad a partir de la cual el sistema te avisa que se está acabando (opcional).",
  "Sucursal de la existencia": "Nombre de la sucursal donde está la existencia inicial. Vacío = la primera sucursal activa.",
  "Unidad (granel)": "Obligatorio en Granel. Abreviatura o nombre de la unidad: kg, lt, pza…",
  "Precio por unidad": "Granel: precio de venta por cada unidad (obligatorio, mayor que cero).",
  "Costo por unidad": "Granel: lo que te cuesta cada unidad (opcional).",
  "Cant. mínima": "Granel: cantidad mínima de venta (opcional).",
  Incremento: "Granel: de cuánto en cuánto se puede vender, por ejemplo 0.05. Vacío = 0.01.",
  "Cant. máxima": "Granel: cantidad máxima por venta; 0 o vacío = sin límite.",
  "Permite fraccionar": "Granel: Sí / No. Si es Sí, indica unidad y precio alternativos.",
  "Unidad alternativa": "Granel con fracción: unidad alterna, por ejemplo pza.",
  "Precio alternativo": "Granel con fracción: precio por cada unidad alterna.",
  "Nombre completo": "Nombre del cliente (obligatorio).",
  "Nº de cliente": "Código de cliente (opcional; si lo dejas vacío se asigna uno).",
  Teléfono: "Teléfono de 10 dígitos (opcional).",
  Correo: "Correo electrónico (opcional).",
  Dirección: "Dirección (opcional).",
  Puntos: "Puntos de lealtad iniciales (opcional).",
  "Categoría padre": "Nombre de otra categoría, ya existente o escrita en este mismo archivo (opcional).",
  "URL de imagen": "Enlace de la imagen (opcional; sin imagen se genera una ilustración).",
  Activa: "Sí / No. Vacío = Sí.",
};

const EXAMPLES: Record<string, Cell[][]> = {
  products: [
    ["Refresco de cola 600 ml", "", "Bebidas", "Estándar", 22, 14, "REF600", "", "Sí", "Sí", 24, 6, "", "", "", "", "", "", "", "", "", ""],
    ["Arroz", "A granel", "Abarrotes", "Granel", "", "", "", "", "Sí", "Sí", 30, 5, "", "kg", 32, 24, 0.1, 0.05, 0, "No", "", ""],
  ],
  categories: [["Bebidas", "", "", "Sí"], ["Jugos", "Bebidas", "", "Sí"]],
  customers: [["Ana Pérez", "", "5512345678", "ana@ejemplo.mx", "Calle 1 #23", 0, "Sí"]],
};

function addInstructionsSheet(wb: ExcelJS.Workbook, spec: Spec) {
  const ws = wb.addWorksheet("Instrucciones");
  ws.columns = [{ width: 32 }, { width: 100 }];
  ws.addRow(["CÓMO LLENAR ESTA PLANTILLA", ""]).font = { bold: true, size: 14 };
  ws.addRow(["", ""]);
  ws.addRow(["Hoja a llenar", "«Datos». Una fila por registro; no cambies los títulos de las columnas."]);
  ws.addRow(["Columnas obligatorias", spec.requiredHeaders.join(", ")]).font = { bold: true };
  if (spec.module === "products") {
    ws.addRow(["Categorías", "No necesitas crearlas antes: escribe el nombre en la columna Categoría y se crean solas al importar."]);
    ws.addRow(["Antes de importar", "Verás una vista previa. Nada se guarda mientras haya filas con errores."]);
    ws.addRow(["Si repites la importación", "Los productos que ya existen se marcan como repetidos; no se duplican."]);
  }
  ws.addRow(["", ""]);
  const head = ws.addRow(["Columna", "Descripción"]);
  head.font = { bold: true };
  for (const h of spec.headers) ws.addRow([h, HEADER_HELP[h] ?? ""]);
  const examples = EXAMPLES[spec.module];
  if (examples) {
    ws.addRow(["", ""]);
    ws.addRow(["EJEMPLOS (copia el formato)", ""]).font = { bold: true };
    ws.addRow(spec.headers).font = { bold: true };
    for (const example of examples) ws.addRow(example);
  }
}

function addListValidation(ws: ExcelJS.Worksheet, headerName: string, options: string[], spec: Spec, formula?: string, opts: { strict?: boolean; hint?: string } = {}) {
  const idx = spec.headers.indexOf(headerName);
  if (idx < 0 || options.length === 0) return;
  const col = idx + 1; // 1-based
  const source = formula ?? `"${options.join(",")}"`;
  const strict = opts.strict !== false;
  for (let r = 2; r <= 1000; r++) {
    ws.getCell(r, col).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [source],
      showErrorMessage: true,
      errorStyle: strict ? "stop" : "warning",
      error: opts.hint ?? "Selecciona un valor de la lista",
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

  // Catálogos para las listas desplegables.
  const [categoryNames, unitNames, locationNames] = await Promise.all([
    prisma.category.findMany({ where: { organizationId: orgId, isActive: true }, select: { name: true }, orderBy: { name: "asc" } }).then((rows) => rows.map((c) => c.name)),
    prisma.unitOfMeasure.findMany({ where: { OR: [{ organizationId: orgId }, { organizationId: null }], isActive: true }, select: { abbreviation: true }, orderBy: { name: "asc" } }).then((rows) => rows.map((u) => u.abbreviation)),
    prisma.location.findMany({ where: { organizationId: orgId, isActive: true }, select: { name: true }, orderBy: { name: "asc" } }).then((rows) => rows.map((l) => l.name)),
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Datos");
  ws.columns = spec.headers.map((h) => ({ header: h, width: 22 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  // Estas columnas se guardan como texto para que Excel no recorte ceros de SKU ni de códigos de barras.
  for (const header of ["SKU", "Código de barras", "Teléfono", "Nº de cliente"]) {
    const index = spec.headers.indexOf(header);
    if (index >= 0) ws.getColumn(index + 1).numFmt = "@";
  }
  if (!opts.template) {
    for (const row of rows) {
      ws.addRow(spec.exportRow(row as unknown as Record<string, unknown>));
    }
  }

  const catalogs = wb.addWorksheet("Catálogos");
  catalogs.columns = [{ header: "Categorías", width: 32 }, { header: "Unidades", width: 20 }, { header: "Sucursales", width: 28 }];
  const catalogRows = Math.max(categoryNames.length, unitNames.length, locationNames.length, 1);
  for (let index = 0; index < catalogRows; index += 1) catalogs.addRow([categoryNames[index] ?? "", unitNames[index] ?? "", locationNames[index] ?? ""]);
  catalogs.getRow(1).font = { bold: true };
  catalogs.state = "veryHidden";

  // Dropdowns en celdas.
  if (module === "products") {
    // Categoría: la lista sugiere las existentes, pero se puede escribir una nueva (se crea al importar).
    addListValidation(ws, "Categoría", categoryNames, spec, `'Catálogos'!$A$2:$A$${categoryNames.length + 1}`, { strict: false, hint: "Esta categoría no existe todavía: se creará al importar." });
    addListValidation(ws, "Tipo", ["Estándar", "Granel"], spec);
    addListValidation(ws, "Unidad (granel)", unitNames, spec, `'Catálogos'!$B$2:$B$${unitNames.length + 1}`);
    addListValidation(ws, "Unidad alternativa", unitNames, spec, `'Catálogos'!$B$2:$B$${unitNames.length + 1}`);
    addListValidation(ws, "Sucursal de la existencia", locationNames, spec, `'Catálogos'!$C$2:$C$${locationNames.length + 1}`);
    addListValidation(ws, "Activo", ["Sí", "No"], spec);
    addListValidation(ws, "Controla inventario", ["Sí", "No"], spec);
    addListValidation(ws, "Permite fraccionar", ["Sí", "No"], spec);
  }
  if (module === "categories") {
    addListValidation(ws, "Categoría padre", categoryNames, spec, `'Catálogos'!$A$2:$A$${categoryNames.length + 1}`, { strict: false, hint: "Debe existir o venir escrita en este mismo archivo." });
    addListValidation(ws, "Activa", ["Sí", "No"], spec);
  }
  if (module === "customers") addListValidation(ws, "Activo", ["Sí", "No"], spec);

  addInstructionsSheet(wb, spec);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const prefix = opts.template ? "plantilla" : spec.filename;
  return { buffer, filename: `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx` };
}

/** Descarga la plantilla vacía (títulos + instrucciones con ejemplos + listas desplegables). */
export async function exportTemplate(orgId: string, module: string): Promise<{ buffer: Buffer; filename: string }> {
  return exportWorkbook(orgId, module, { template: true });
}

interface ParsedItem { record: Record<string, Cell>; line: number; errors: string[] }

interface ParsedWorkbook {
  items: ParsedItem[];
  missingColumns: string[];
  ctx: ImportContext;
  /** Categorías de productos que no existen y se crearán (sin repetir, con la primera escritura). */
  newCategories: string[];
}

async function parseWorkbook(orgId: string, module: string, buffer: Buffer, actor: ImportActor): Promise<{ spec: Spec; parsed: ParsedWorkbook }> {
  const spec = SPECS[module];
  if (!spec) throw new Error("Módulo sin importación disponible");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet("Datos") ?? wb.worksheets[0];
  if (!ws) throw new Error("El archivo no contiene hojas");
  if (ws.rowCount > IMPORT_MAX_ROWS + 1) throw new Error(`El archivo supera el límite de ${IMPORT_MAX_ROWS} registros`);
  if (ws.columnCount > IMPORT_MAX_COLUMNS) throw new Error(`El archivo supera el límite de ${IMPORT_MAX_COLUMNS} columnas`);

  const ctx = await buildImportContext(orgId, actor);
  const headerSet = new Set<string>();
  const headerPositions = new Map<string, number>();
  const labelByNorm = new Map(spec.headers.map((h) => [norm(h), h]));
  const items: ParsedItem[] = [];
  const keys = FIELD_KEYS[module];
  if (!keys || keys.length !== spec.headers.length) throw new Error("La configuración de importación es inválida");

  ws.eachRow((row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1).map(plainCell);
    if (rowNumber === 1) {
      values.forEach((cell, index) => {
        const text = norm(cell);
        if (!text) return;
        const label = labelByNorm.get(text) ?? labelByNorm.get(norm(HEADER_ALIASES[text] ?? ""));
        if (label) {
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
      const raw = position === undefined ? "" : values[position] ?? "";
      record[key] = spec.parseCell(key, typeof raw === "string" ? raw.trim() : raw, ctx);
    });
    items.push({ record, line: rowNumber, errors: validateImportRecord(module, record, ctx) });
  });

  const missingColumns = spec.requiredHeaders.filter((h) => !headerSet.has(h));
  const seen = new Map<string, Set<string>>();
  const checkUnique = (item: ParsedItem, key: string, label: string, existing: Set<string>) => {
    const value = norm(item.record[key]);
    if (!value) return;
    if (existing.has(value)) item.errors.push(`${label} ya existe en el sistema`);
    const values = seen.get(key) ?? new Set<string>();
    if (values.has(value)) item.errors.push(`${label} está repetido en el archivo`);
    values.add(value); seen.set(key, values);
  };
  const newCategories = new Map<string, string>();
  for (const item of items) {
    if (module === "categories") {
      checkUnique(item, "name", "La categoría", new Set(ctx.categoryByName.keys()));
    }
    if (module === "customers") {
      checkUnique(item, "customerCode", "El número de cliente", ctx.customerCodes);
      checkUnique(item, "phone", "El teléfono", ctx.customerPhones);
      checkUnique(item, "email", "El correo", ctx.customerEmails);
    }
    if (module === "products") {
      checkUnique(item, "name", "El producto", ctx.productNames);
      if (item.record.productType !== "bulk") {
        checkUnique(item, "sku", "El SKU", ctx.variantSkus);
        checkUnique(item, "barcode", "El código de barras", ctx.variantBarcodes);
      }
      const category = item.record.categoryName;
      if (typeof category === "string" && category.startsWith(NEW_CATEGORY)) {
        const label = category.slice(NEW_CATEGORY.length);
        if (!newCategories.has(norm(label))) newCategories.set(norm(label), label);
      }
    }
  }
  if (module === "categories") {
    // El padre debe existir ya o venir en el archivo.
    const inFile = new Set(items.map((item) => norm(item.record.name)));
    for (const item of items) {
      const parent = norm(item.record.parentName);
      if (!parent) continue;
      if (parent === norm(item.record.name)) item.errors.push("Una categoría no puede ser su propio padre");
      else if (!ctx.categoryByName.has(parent) && !inFile.has(parent)) item.errors.push(`La categoría padre «${String(item.record.parentName)}» no existe ni viene en el archivo`);
    }
  }
  return { spec, parsed: { items, missingColumns, ctx, newCategories: [...newCategories.values()] } };
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
  /** Avisos para el usuario: por ejemplo, categorías que se crearán. */
  notes: string[];
}

const isMarker = (value: Cell | undefined, marker: string) => typeof value === "string" && value.startsWith(marker);

export function validateImportRecord(module: string, record: Record<string, Cell>, ctx?: ImportContext) {
  const errors: string[] = [];
  const missing = (value: Cell) => isMarker(value, "__missing__:");
  for (const key of ["isActive", "trackInventory", "allowSplit"]) if (isMarker(record[key], "__invalid_bool__:")) errors.push(`${key}: usa Sí o No`);
  const nameKey = module === "customers" ? "fullName" : "name";
  if (!String(record[nameKey] ?? "").trim()) errors.push("Falta el nombre obligatorio");
  else if (String(record[nameKey]).trim().length > 255) errors.push("El nombre no puede pasar de 255 caracteres");
  if (module === "categories" && missing(record.parentName)) errors.push(`La categoría padre «${String(record.parentName).slice(12)}» no existe`);
  if (module === "customers") {
    if (!validatePhone(record.phone)) errors.push("El teléfono debe tener 10 dígitos");
    if (!validateEmail(record.email)) errors.push("El correo no tiene un formato válido");
    const points = parseOptionalNumber(record.points);
    if (points !== null && (!Number.isFinite(points) || points < 0)) errors.push("Los puntos deben ser un número igual o mayor que cero");
  }
  if (module === "products") {
    if (isMarker(record.productType, "__invalid_type__:")) errors.push("El tipo debe ser Estándar o Granel");
    const type = record.productType === "bulk" ? "bulk" : "standard";
    const labels: Record<string, string> = {
      price: "Precio", cost: "Costo", initialStock: "Existencia inicial", initialMinStock: "Stock mínimo", bulkPricePerUnit: "Precio por unidad",
      bulkCostPerUnit: "Costo por unidad", bulkMinQuantity: "Cant. mínima", bulkMaxQuantity: "Cant. máxima", bulkStep: "Incremento", splitPricePerUnit: "Precio alternativo",
    };
    const numberKeys = [...(type === "bulk" ? ["bulkPricePerUnit", "bulkCostPerUnit", "bulkMinQuantity", "bulkStep", "bulkMaxQuantity"] : ["price", "cost"]), "initialStock", "initialMinStock"];
    for (const key of numberKeys) {
      const value = parseOptionalNumber(record[key]);
      if (value !== null && (!Number.isFinite(value) || value < 0)) errors.push(`${labels[key]}: usa un número igual o mayor que cero`);
    }
    // Igual que el formulario: un producto en venta necesita precio, para que no aparezcan artículos de $0.00 en el POS.
    if (type === "standard" && record.isActive !== false && !errors.some((e) => e.startsWith("Precio"))) {
      if (!((parseOptionalNumber(record.price) ?? 0) > 0)) errors.push("Pon el precio de venta (mayor que cero)");
    }
    if (type === "bulk") {
      if ((parseOptionalNumber(record.bulkPricePerUnit) ?? 0) <= 0 && !errors.some((e) => e.startsWith("Precio por unidad"))) errors.push("Pon el precio por unidad (mayor que cero)");
      if (!record.bulkUnitName) errors.push("Selecciona la unidad del producto a granel");
      else if (missing(record.bulkUnitName)) errors.push(`La unidad «${String(record.bulkUnitName).slice(12)}» no existe`);
      if ((Number(record.bulkStep) || 0) <= 0) errors.push("El incremento de venta debe ser mayor que cero");
      if (record.allowSplit === true) {
        if (!record.splitUnitName || missing(record.splitUnitName)) errors.push("Selecciona una unidad alternativa válida para fraccionar");
        if ((parseOptionalNumber(record.splitPricePerUnit) ?? 0) <= 0) errors.push("Pon el precio alternativo (mayor que cero)");
      }
    }
    if (missing(record.locationName)) errors.push(`La sucursal «${String(record.locationName).slice(12)}» no existe o está inactiva`);
    const stock = (parseOptionalNumber(record.initialStock) ?? 0) > 0 || (parseOptionalNumber(record.initialMinStock) ?? 0) > 0;
    if (stock && record.trackInventory === false) errors.push("Quita la existencia y el stock mínimo, o activa «Controla inventario»");
    else if (stock && ctx && !ctx.canManageInventory) errors.push("No tienes permiso para registrar existencias: deja vacías esas columnas");
  }
  return errors;
}

/** Nombre legible de un id interno de categoría, unidad o sucursal. */
function labelForId(ctx: ImportContext, key: string, id: string): string {
  const maps: Record<string, Map<string, string>> = { categoryName: ctx.categoryByName, bulkUnitName: ctx.unitByLabel, splitUnitName: ctx.unitByLabel, locationName: ctx.locationByName };
  const map = maps[key];
  if (!map) return id;
  for (const [label, value] of map) if (value === id) return label;
  return id;
}

/** Vista previa: parsea sin crear registros; valida columnas requeridas. Las filas con error van primero. */
export async function previewWorkbook(orgId: string, module: string, buffer: Buffer, actor: ImportActor = { userId: "" }): Promise<PreviewResult> {
  const { spec, parsed } = await parseWorkbook(orgId, module, buffer, actor);
  const toRow = (i: ParsedItem): PreviewRow => ({
    line: i.line,
    cells: FIELD_KEYS[module].map((key) => {
      const value = i.record[key];
      if (isMarker(value, NEW_CATEGORY)) return `${String(value).slice(NEW_CATEGORY.length)} (nueva)`;
      if (isMarker(value, "__missing__:")) return String(value).slice(12);
      // Los ids internos (categoría existente, unidad, sucursal) se muestran por nombre en vez del código.
      return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? labelForId(parsed.ctx, key, value) : String(value ?? "");
    }),
    errors: i.errors,
  });
  const invalidItems = parsed.items.filter((item) => item.errors.length > 0);
  const validItems = parsed.items.filter((item) => item.errors.length === 0);
  const notes: string[] = [];
  if (parsed.newCategories.length > 0) {
    const shown = parsed.newCategories.slice(0, 8).join(", ") + (parsed.newCategories.length > 8 ? "…" : "");
    notes.push(`Se crearán ${parsed.newCategories.length} categoría(s) nueva(s): ${shown}.`);
  }
  return {
    ok: parsed.missingColumns.length === 0,
    total: parsed.items.length,
    missingColumns: parsed.missingColumns,
    headers: spec.headers,
    sample: [...invalidItems.slice(0, 50), ...validItems.slice(0, Math.max(0, 50 - Math.min(invalidItems.length, 50)))].map(toRow),
    valid: validItems.length,
    invalid: invalidItems.length,
    notes,
  };
}

export async function importWorkbook(orgId: string, module: string, buffer: Buffer, actor: ImportActor = { userId: "" }): Promise<ImportResult> {
  const { spec, parsed } = await parseWorkbook(orgId, module, buffer, actor);

  if (parsed.missingColumns.length > 0) {
    throw new Error(`Falta(n) columna(s) requerida(s): ${parsed.missingColumns.join(", ")}`);
  }

  const result: ImportResult = { ok: true, imported: 0, errors: [] };
  const validationErrors = parsed.items.filter((item) => item.errors.length).map((item) => ({ row: item.line, message: item.errors.join(" · ") }));
  if (validationErrors.length) return { ok: false, imported: 0, errors: validationErrors };
  const crudCtx: CrudContext = { userId: actor.userId, canManageInventory: actor.canManageInventory === true };

  if (module === "products" && parsed.newCategories.length > 0) {
    // Las categorías que no existían se crean primero; cada producto queda ligado a la suya.
    const created = new Map<string, string>();
    result.createdCategories = [];
    for (const label of parsed.newCategories) {
      try {
        const category = await categoriesModule.create(orgId, { name: label }, crudCtx);
        created.set(norm(label), String((category as unknown as { id: string }).id));
        result.createdCategories.push(label);
      } catch (err) {
        // Si la categoría apareció mientras tanto (otra importación), se reutiliza.
        const existing = await prisma.category.findFirst({ where: { organizationId: orgId, name: label }, select: { id: true } });
        if (existing) created.set(norm(label), existing.id);
        else result.errors.push({ row: 0, message: `No se pudo crear la categoría «${label}»: ${err instanceof Error ? err.message : "error"}` });
      }
    }
    for (const item of parsed.items) {
      const category = item.record.categoryName;
      if (isMarker(category, NEW_CATEGORY)) item.record.categoryName = created.get(norm(String(category).slice(NEW_CATEGORY.length))) ?? null;
    }
  }

  if (module === "categories") {
    // Los padres se crean antes que sus hijas, aunque en el archivo vengan al revés.
    const idByName = new Map(parsed.ctx.categoryByName);
    const pending = [...parsed.items];
    while (pending.length > 0) {
      const index = pending.findIndex((item) => !norm(item.record.parentName) || idByName.has(norm(item.record.parentName)));
      if (index < 0) {
        for (const item of pending) result.errors.push({ row: item.line, message: `La categoría padre «${String(item.record.parentName)}» no se pudo resolver` });
        break;
      }
      const [item] = pending.splice(index, 1);
      const parentKey = norm(item.record.parentName);
      item.record.parentId = parentKey ? idByName.get(parentKey) ?? null : null;
      const error = await spec.create(orgId, item.record, crudCtx);
      if (error) {
        result.errors.push({ row: item.line, message: error });
        continue;
      }
      result.imported += 1;
      const row = await prisma.category.findFirst({ where: { organizationId: orgId, name: String(item.record.name).trim() }, select: { id: true } });
      if (row) idByName.set(norm(item.record.name), row.id);
    }
    result.ok = result.errors.length === 0;
    return result;
  }

  for (const item of parsed.items) {
    const error = await spec.create(orgId, item.record, crudCtx);
    if (error) {
      result.errors.push({ row: item.line, message: error });
    } else {
      result.imported += 1;
    }
  }
  result.ok = result.errors.length === 0;
  return result;
}
