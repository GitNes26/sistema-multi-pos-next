import type { Prisma, $Enums } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { CrudError } from "@/lib/crud/types";
import type { ImportResult } from "@/lib/excel/spreadsheet";
import { persistNotification } from "@/lib/notifications/helpers";

// FASE 8 — Servicio de inventario (existencias, movimientos, mínimos, transferencias).

type Dec = { toNumber(): number } | number;
const num = (v: Dec): number => (typeof v === "number" ? v : v.toNumber());

export interface InventorySnapshotRow {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
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

export interface MovementRow {
  id: string;
  type: $Enums.MovementType;
  quantity: number;
  reason: string | null;
  productName: string;
  variantName: string | null;
  unit: string | null;
  performer: string | null;
  createdAt: string;
}

/** Garantiza filas de inventario en una ubicación para todo lo trackeado. */
export async function ensureInventoryRows(
  organizationId: string,
  locationType: $Enums.LocationType,
  locationId: string
) {
  const products = await prisma.product.findMany({
    where: { organizationId, trackInventory: true, isActive: true },
    select: { id: true, productType: true, trackInventory: true, bulkUnitId: true, variants: { select: { id: true } } },
  });
  const targets: { productId: string | null; variantId: string | null; unitId: string | null }[] = [];
  for (const p of products) {
    if (p.productType === "standard") {
      for (const v of p.variants) targets.push({ productId: p.id, variantId: v.id, unitId: null });
    } else {
      targets.push({ productId: p.id, variantId: null, unitId: p.bulkUnitId });
    }
  }
  await prisma.inventory.createMany({
    data: targets.map((t) => ({
      organizationId,
      locationId,
      locationType,
      productId: t.productId,
      variantId: t.variantId,
      unitId: t.unitId,
      quantity: 0,
      minThreshold: 0,
    })),
    skipDuplicates: true,
  });
}

type Where = Prisma.InventoryWhereInput;

export async function inventorySnapshot(
  organizationId: string,
  params: {
    locationType: $Enums.LocationType;
    locationId: string;
    q?: string;
    productType?: string;
    lowOnly?: boolean;
  }
): Promise<InventorySnapshotRow[]> {
  const { locationType, locationId, q, productType, lowOnly } = params;
  await ensureInventoryRows(organizationId, locationType, locationId);

  const where: Where = {
    organizationId,
    locationId,
    locationType,
    ...(q
      ? {
          OR: [
            { product: { name: { contains: q } } },
            { variant: { name: { contains: q } } },
            { variant: { sku: { contains: q } } },
            { variant: { barcode: { contains: q } } },
          ],
        }
      : {}),
    ...(productType === "standard" || productType === "bulk" ? { product: { productType } } : {}),
  };

  const rows = await prisma.inventory.findMany({
    where,
    include: {
      product: {
        select: { id: true, name: true, productType: true, trackInventory: true },
      },
      variant: { select: { id: true, name: true, sku: true, barcode: true } },
      unit: { select: { name: true, abbreviation: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { variant: { name: "asc" } }],
  });

  const mapped: InventorySnapshotRow[] = rows.map((r) => {
    const quantity = num(r.quantity);
    const min = num(r.minThreshold);
    const status = quantity <= 0 ? "empty" : quantity <= min ? "low" : "ok";
    return {
      id: r.id,
      productId: r.productId,
      variantId: r.variantId,
      productName: r.product?.name ?? "—",
      variantName: r.variant?.name ?? null,
      sku: r.variant?.sku ?? null,
      barcode: r.variant?.barcode ?? null,
      productType: (r.product?.productType ?? "standard") as "standard" | "bulk",
      quantity,
      unit: r.unit?.abbreviation ?? null,
      minThreshold: min,
      status,
      trackInventory: r.product?.trackInventory ?? false,
    };
  });

  if (lowOnly) return mapped.filter((r) => r.status !== "ok");
  return mapped;
}

async function findInventory(organizationId: string, refId: string) {
  const row = await prisma.inventory.findFirst({
    where: { id: refId, organizationId },
    select: {
      id: true,
      productId: true,
      variantId: true,
      locationId: true,
      locationType: true,
      quantity: true,
      unitId: true,
      minThreshold: true,
    },
  });
  if (!row) throw new CrudError("Registro de inventario no encontrado", 404);
  return row;
}

type SignMap = Record<$Enums.MovementType, number>;

async function performerFor(userId: string) {
  const employee = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true, fullName: true },
  });
  return employee ?? null;
}

/** Notifica (persistida + SSE) cuando el stock queda en/o bajo el mínimo. */
export async function maybeNotifyLowStock(
  organizationId: string,
  inventoryId: string,
  ctx?: { userId?: string | null; employeeId?: string | null }
) {
  const row = await prisma.inventory.findFirst({
    where: { id: inventoryId, organizationId },
    include: {
      product: { select: { name: true } },
      variant: { select: { name: true } },
      unit: { select: { name: true } },
    },
  });
  if (!row) return;
  const qty = num(row.quantity);
  const min = num(row.minThreshold);
  if (min <= 0 || qty > min) return;

  const label =
    row.variant?.name && row.variant.name !== "Default"
      ? `${row.product?.name ?? ""} (${row.variant.name})`
      : row.product?.name ?? "Producto";
  await persistNotification({
    organizationId,
    locationId: row.locationId,
    userId: ctx?.userId ?? null,
    employeeId: ctx?.employeeId ?? null,
    kind: "low_stock",
    title: "Inventario bajo",
    body: `${label} quedó con ${qty} ${row.unit?.name ?? "unidades"} (mínimo ${min}).`,
    severity: "warning",
    link: "/admin/inventory",
    metadata: { inventoryId: row.id },
    dedupeInventoryId: row.id,
  });
}

/** Registra un movimiento de compra/ajuste/venta/devolución y actualiza stock. */
export async function registerMovement(
  organizationId: string,
  input: {
    inventoryId: string;
    type: $Enums.MovementType;
    quantity: number;
    reason?: string;
  },
  userId: string
): Promise<MovementRow> {
  const { inventoryId, type, quantity, reason } = input;

  const row = await findInventory(organizationId, inventoryId);
  const signs: SignMap = {
    purchase: 1,
    sale: -1,
    adjustment: quantity >= 0 ? 1 : -1,
    transfer_in: 1,
    transfer_out: -1,
    return: 1,
  };
  if (!["purchase", "adjustment", "sale", "return", "transfer_in", "transfer_out"].includes(type)) {
    throw new CrudError("Tipo de movimiento inválido", 400);
  }
  const delta = type === "adjustment" ? quantity : Math.abs(quantity) * signs[type];
  if (delta === 0) throw new CrudError("La cantidad no puede ser 0", 400, "quantity");

  const current = num(row.quantity);
  const next = Math.round((current + delta) * 1000) / 1000;
  if (next < 0) throw new CrudError("No hay suficiente stock para este movimiento", 409);

  const employee = await performerFor(userId);
  await prisma.$transaction([
    prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: next } }),
    prisma.inventoryMovement.create({
      data: {
        organizationId,
        productId: row.productId,
        variantId: row.variantId,
        locationId: row.locationId,
        locationType: row.locationType,
        type,
        quantity: delta,
        unitId: row.unitId,
        reason: reason ?? null,
        referenceId: inventoryId,
        employeeId: employee?.id ?? null,
        userId,
      },
    }),
  ]);
  await maybeNotifyLowStock(organizationId, inventoryId, {
    userId,
    employeeId: employee?.id ?? null,
  });
  return (await movementById(organizationId, inventoryId, type, employee?.fullName ?? null)) as MovementRow;
}

async function movementById(organizationId: string, inventoryId: string, type: $Enums.MovementType, performerName: string | null) {
  const m = await prisma.inventoryMovement.findFirst({
    where: { organizationId, referenceId: inventoryId, type },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true } },
      variant: { select: { name: true } },
      unit: { select: { abbreviation: true } },
      employee: { select: { fullName: true } },
    },
  });
  if (!m) throw new CrudError("Movimiento no registrado", 500);
  return {
    id: m.id,
    type: m.type,
    quantity: num(m.quantity),
    reason: m.reason,
    productName: m.product?.name ?? "—",
    variantName: m.variant?.name ?? null,
    unit: m.unit?.abbreviation ?? null,
    performer: m.employee?.fullName ?? performerName,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Establece el stock mínimo (umbral) de una fila de inventario. */
export async function setMinThreshold(organizationId: string, inventoryId: string, minThreshold: number) {
  const value = Math.max(0, Number(minThreshold) || 0);
  await prisma.inventory.updateMany({
    where: { id: inventoryId, organizationId },
    data: { minThreshold: value },
  });
  return value;
}

/** Transfiere stock entre ubicaciones (transfer_out en origen, transfer_in en destino). */
export async function transferStock(
  organizationId: string,
  input: {
    fromInventoryId: string;
    toLocationType: $Enums.LocationType;
    toLocationId: string;
    quantity: number;
    reason?: string;
  },
  userId: string
) {
  const { fromInventoryId, toLocationType, toLocationId, quantity, reason } = input;
  const from = await findInventory(organizationId, fromInventoryId);
  const qty = Math.abs(Number(quantity) || 0);
  if (qty === 0) throw new CrudError("La cantidad no puede ser 0", 400, "quantity");
  if (num(from.quantity) < qty) throw new CrudError("No hay suficiente stock en el origen", 409);

  // Destino: fila equivalente (misma variante/producto) en la otra ubicación.
  const dest = await prisma.inventory.findFirst({
    where: {
      organizationId,
      locationId: toLocationId,
      locationType: toLocationType,
      variantId: from.variantId,
    },
  });
  let destId = dest?.id ?? null;
  if (!dest) {
    const created = await prisma.inventory.create({
      data: {
        organizationId,
        productId: from.productId,
        variantId: from.variantId,
        locationId: toLocationId,
        locationType: toLocationType,
        quantity: 0,
        unitId: from.unitId,
        minThreshold: 0,
      },
    });
    destId = created.id;
  }

  const employee = await performerFor(userId);
  const originNext = Math.round((num(from.quantity) - qty) * 1000) / 1000;
  const destCurrent = dest ? num(dest.quantity) : 0;
  const destNext = Math.round((destCurrent + qty) * 1000) / 1000;

  await prisma.$transaction([
    prisma.inventory.update({ where: { id: from.id }, data: { quantity: originNext } }),
    prisma.inventory.update({ where: { id: destId! }, data: { quantity: destNext } }),
    prisma.inventoryMovement.createMany({
      data: [
        {
          organizationId,
          productId: from.productId,
          variantId: from.variantId,
          locationId: from.locationId,
          locationType: from.locationType,
          type: "transfer_out",
          quantity: -qty,
          unitId: from.unitId,
          reason: reason ?? null,
          referenceId: from.id,
          employeeId: employee?.id ?? null,
          userId,
        },
        {
          organizationId,
          productId: from.productId,
          variantId: from.variantId,
          locationId: toLocationId,
          locationType: toLocationType,
          type: "transfer_in",
          quantity: qty,
          unitId: from.unitId,
          reason: reason ?? null,
          referenceId: destId!,
          employeeId: employee?.id ?? null,
          userId,
        },
      ],
    }),
  ]);

  await maybeNotifyLowStock(organizationId, from.id);
  return { ok: true, from: originNext, to: destNext };
}

/** Historial de movimientos de una ubicación. */
export async function listMovements(
  organizationId: string,
  params: {
    locationType: $Enums.LocationType;
    locationId: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<{ rows: MovementRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 20);
  const q = params.q?.trim() ?? "";

  const where: Prisma.InventoryMovementWhereInput = {
    organizationId,
    locationId: params.locationId,
    locationType: params.locationType,
    ...(q
      ? {
          OR: [
            { product: { name: { contains: q } } },
            { variant: { name: { contains: q } } },
            { variant: { sku: { contains: q } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: {
        product: { select: { name: true } },
        variant: { select: { name: true } },
        unit: { select: { abbreviation: true } },
        employee: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return {
    rows: rows.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: num(m.quantity),
      reason: m.reason,
      productName: m.product?.name ?? "—",
      variantName: m.variant?.name ?? null,
      unit: m.unit?.abbreviation ?? null,
      performer: m.employee?.fullName ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    total,
  };
}

// ── Revisiones físicas (FASE 8.5) ─────────────────────────────────────────────

export interface RevisionRow {
  id: string;
  revisionNumber: number;
  status: $Enums.RevisionStatus;
  notes: string | null;
  locationType: $Enums.LocationType;
  locationId: string;
  itemCount: number;
  countedCount: number;
  differenceCount: number;
  performedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RevisionItemRow {
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

export interface RevisionDetail {
  id: string;
  revisionNumber: number;
  status: $Enums.RevisionStatus;
  notes: string | null;
  locationType: $Enums.LocationType;
  locationId: string;
  performedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: RevisionItemRow[];
}

export async function listRevisions(
  organizationId: string,
  params: { locationType: $Enums.LocationType; locationId: string; page?: number; pageSize?: number }
): Promise<{ rows: RevisionRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 20);
  const where: Prisma.InventoryRevisionWhereInput = {
    organizationId,
    locationType: params.locationType,
    locationId: params.locationId,
  };

  const [rows, total] = await Promise.all([
    prisma.inventoryRevision.findMany({
      where,
      include: {
        performedByUser: { select: { fullName: true } },
        _count: { select: { items: true } },
        items: { select: { countedQuantity: true, difference: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryRevision.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      revisionNumber: r.revisionNumber,
      status: r.status,
      notes: r.notes,
      locationType: r.locationType,
      locationId: r.locationId,
      itemCount: r._count.items,
      countedCount: r.items.filter((i) => i.countedQuantity != null).length,
      differenceCount: r.items.filter((i) => i.difference != null && num(i.difference) !== 0).length,
      performedBy: r.performedByUser?.fullName ?? null,
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
  };
}

async function findRevision(organizationId: string, revisionId: string) {
  const r = await prisma.inventoryRevision.findFirst({
    where: { id: revisionId, organizationId },
    include: {
      performedByUser: { select: { fullName: true } },
      items: { include: { product: { select: { name: true, productType: true, bulkUnit: { select: { abbreviation: true } } } }, variant: { select: { name: true, sku: true, barcode: true } } } },
    },
  });
  if (!r) throw new CrudError("Revisión no encontrada", 404);
  return r;
}

export async function getRevision(organizationId: string, revisionId: string): Promise<RevisionDetail> {
  const r = await findRevision(organizationId, revisionId);
  return {
    id: r.id,
    revisionNumber: r.revisionNumber,
    status: r.status,
    notes: r.notes,
    locationType: r.locationType,
    locationId: r.locationId,
    performedBy: r.performedByUser?.fullName ?? null,
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    items: r.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      productName: i.product?.name ?? "—",
      variantName: i.variant?.name ?? null,
      sku: i.variant?.sku ?? null,
      barcode: i.variant?.barcode ?? null,
      productType: (i.product?.productType ?? "standard") as "standard" | "bulk",
      unit: i.product?.bulkUnit?.abbreviation ?? null,
      expectedQuantity: i.expectedQuantity != null ? num(i.expectedQuantity) : 0,
      countedQuantity: i.countedQuantity != null ? num(i.countedQuantity) : null,
      difference: i.difference != null ? num(i.difference) : null,
      scanned: i.scanned,
    })),
  };
}

export async function createRevision(
  organizationId: string,
  userId: string,
  input: { locationType: $Enums.LocationType; locationId: string; notes?: string }
): Promise<RevisionDetail> {
  const { locationType, locationId, notes } = input;
  await ensureInventoryRows(organizationId, locationType, locationId);

  const last = await prisma.inventoryRevision.findFirst({
    where: { organizationId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });

  const now = new Date();
  const employee = await performerFor(userId);

  const inventoryRows = await prisma.inventory.findMany({
    where: { organizationId, locationId, locationType },
    include: {
      product: { select: { name: true, productType: true, bulkUnit: { select: { abbreviation: true } } } },
      variant: { select: { name: true, sku: true, barcode: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { variant: { name: "asc" } }],
  });

  const revision = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryRevision.create({
      data: {
        organizationId,
        locationId,
        locationType,
        revisionNumber: (last?.revisionNumber ?? 0) + 1,
        status: "draft",
        notes: notes ?? null,
        performedBy: userId,
        employeeId: employee?.id ?? null,
        startedAt: now,
      },
    });
    if (inventoryRows.length) {
      await tx.inventoryRevisionItem.createMany({
        data: inventoryRows.map((row) => ({
          revisionId: created.id,
          productId: row.productId,
          variantId: row.variantId,
          expectedQuantity: row.quantity,
          countedQuantity: null,
          difference: null,
        })),
      });
    }
    return created;
  });

  return getRevision(organizationId, revision.id);
}

export async function setRevisionItemCount(
  organizationId: string,
  userId: string,
  revisionId: string,
  itemId: string,
  input: { countedQuantity: number; scanned?: boolean }
) {
  const revision = await findRevision(organizationId, revisionId);
  if (revision.status !== "draft" && revision.status !== "in_progress") {
    throw new CrudError("La revisión ya fue finalizada", 409);
  }

  const item = revision.items.find((i) => i.id === itemId);
  if (!item) throw new CrudError("Producto no encontrado en la revisión", 404);

  const counted = Math.max(0, Math.round(input.countedQuantity * 1000) / 1000);
  const expected = item.expectedQuantity != null ? num(item.expectedQuantity) : 0;
  const difference = Math.round((counted - expected) * 1000) / 1000;

  await prisma.inventoryRevision.update({
    where: { id: revision.id },
    data: {
      status: "in_progress",
      items: {
        update: {
          where: { id: item.id },
          data: {
            countedQuantity: counted,
            difference,
            scanned: input.scanned ?? item.scanned,
            countedBy: userId,
          },
        },
      },
    },
  });

  return { ok: true, counted, difference };
}

export async function completeRevision(organizationId: string, userId: string, revisionId: string) {
  const revision = await findRevision(organizationId, revisionId);
  if (revision.status === "completed" || revision.status === "cancelled") {
    throw new CrudError("La revisión ya fue finalizada", 409);
  }

  const employee = await performerFor(userId);

  await prisma.$transaction(async (tx) => {
    for (const item of revision.items) {
      const expected = item.expectedQuantity != null ? num(item.expectedQuantity) : 0;
      const counted = item.countedQuantity != null ? num(item.countedQuantity) : null;
      if (counted == null || Math.abs(counted - expected) < 0.001) continue;

      const inventoryRow = await tx.inventory.findFirst({
        where: {
          organizationId,
          locationId: revision.locationId,
          locationType: revision.locationType,
          productId: item.productId,
          variantId: item.variantId,
        },
      });
      if (!inventoryRow) continue;

      const delta = Math.round((counted - expected) * 1000) / 1000;
      const next = Math.round((num(inventoryRow.quantity) + delta) * 1000) / 1000;

      await tx.inventory.update({
        where: { id: inventoryRow.id },
        data: { quantity: Math.max(0, next) },
      });
      await maybeNotifyLowStock(organizationId, inventoryRow.id);
      await tx.inventoryMovement.create({
        data: {
          organizationId,
          productId: item.productId,
          variantId: item.variantId,
          locationId: revision.locationId,
          locationType: revision.locationType,
          type: "adjustment",
          quantity: delta,
          unitId: inventoryRow.unitId,
          reason: `Revisión física #${revision.revisionNumber}`,
          referenceId: revision.id,
          employeeId: employee?.id ?? null,
          userId,
        },
      });
    }

    await tx.inventoryRevision.update({
      where: { id: revision.id },
      data: { status: "completed", completedAt: new Date() },
    });
  });

  return { ok: true, id: revision.id };
}

export async function cancelRevision(organizationId: string, revisionId: string) {
  const revision = await findRevision(organizationId, revisionId);
  if (revision.status === "completed" || revision.status === "cancelled") {
    throw new CrudError("La revisión ya fue finalizada", 409);
  }
  await prisma.inventoryRevision.update({
    where: { id: revision.id },
    data: { status: "cancelled", completedAt: new Date() },
  });
  return { ok: true, id: revision.id };
}

// ── Importación masiva de existencias (FASE 8.6) ─────────────────────────────

export async function importInventoryStock(
  organizationId: string,
  userId: string,
  input: { locationType: $Enums.LocationType; locationId: string; buffer: Buffer }
): Promise<ImportResult> {
  const { locationType, locationId, buffer } = input;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new CrudError("El archivo no contiene hojas", 400);

  const headers: string[] = [];
  type ParsedRow = { sku: string; barcode: string; name: string; quantity: number; line: number };
  const items: ParsedRow[] = [];

  ws.eachRow((row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1);
    if (rowNumber === 1) {
      headers.push(...values.map((v) => String(v ?? "").trim().toLowerCase()));
      return;
    }
    if (!values.some((v) => v != null && String(v).trim() !== "")) return;
    const cell = (label: string) => {
      const i = headers.findIndex((h) => h === label);
      return i >= 0 ? String(values[i] ?? "") : "";
    };
    const quantity = Number(cell("cantidad"));
    items.push({
      sku: cell("sku"),
      barcode: cell("código de barras") || cell("codigo de barras") || cell("barcode"),
      name: cell("nombre") || cell("producto"),
      quantity,
      line: rowNumber,
    });
  });

  const variants = await prisma.productVariant.findMany({
    where: { organizationId },
    select: { id: true, productId: true, sku: true, barcode: true },
  });
  const like = (s: string | null) => s?.toLowerCase() ?? "";
  const variantBySku = new Map(variants.map((v) => [like(v.sku), v.id]));
  const variantByBarcode = new Map(variants.map((v) => [like(v.barcode), v.id]));
  const variantProduct = new Map(variants.map((v) => [v.id, v.productId]));

  const bulk = await prisma.product.findMany({
    where: { organizationId, productType: "bulk", trackInventory: true },
    select: { id: true, name: true },
  });
  const bulkByName = new Map(bulk.map((p) => [p.name.toLowerCase(), p.id]));

  const employee = await performerFor(userId);
  const result: ImportResult = { ok: true, imported: 0, errors: [] };

  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      result.errors.push({ row: item.line, message: "Cantidad inválida" });
      continue;
    }

    let variantId: string | null = null;
    let productId: string | null = null;
    if (item.sku || item.barcode) {
      variantId =
        (item.sku ? variantBySku.get(item.sku.toLowerCase()) : undefined) ??
        (item.barcode ? variantByBarcode.get(item.barcode.toLowerCase()) : undefined) ??
        null;
      if (!variantId) {
        result.errors.push({ row: item.line, message: "SKU/código de barras no encontrado" });
        continue;
      }
      productId = variantProduct.get(variantId) ?? null;
    } else if (item.name) {
      const pid = bulkByName.get(item.name.toLowerCase()) ?? null;
      if (!pid) {
        result.errors.push({ row: item.line, message: "Producto a granel no encontrado" });
        continue;
      }
      productId = pid;
      variantId = null;
    } else {
      result.errors.push({ row: item.line, message: "Faltan SKU, código de barras o nombre" });
      continue;
    }

    const quantity = Math.round(item.quantity * 1000) / 1000;

    try {
      let row = await prisma.inventory.findFirst({
        where: { organizationId, locationId, locationType, variantId, productId },
      });
      if (!row) {
        row = await prisma.inventory.create({
          data: {
            organizationId,
            locationId,
            locationType,
            variantId,
            productId,
            quantity: 0,
            unitId: null,
            minThreshold: 0,
          },
        });
      }

      const current = num(row.quantity);
      const delta = Math.round((quantity - current) * 1000) / 1000;

      await prisma.$transaction([
        prisma.inventory.update({ where: { id: row.id }, data: { quantity } }),
        prisma.inventoryMovement.create({
          data: {
            organizationId,
            productId,
            variantId,
            locationId,
            locationType,
            type: "adjustment",
            quantity: delta,
            unitId: row.unitId,
            reason: "Importación masiva (Excel)",
            referenceId: row.id,
            employeeId: employee?.id ?? null,
            userId,
          },
        }),
      ]);
      await maybeNotifyLowStock(organizationId, row.id);
      result.imported += 1;
    } catch (err) {
      result.errors.push({ row: item.line, message: err instanceof Error ? err.message : "Error al importar" });
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}