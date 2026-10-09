import { randomBytes } from "node:crypto";
import { Prisma, type $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CrudError } from "@/lib/crud/types";
import { maybeNotifyLowStock } from "@/lib/inventory/server";
import { persistNotification } from "@/lib/notifications/helpers";

// Flujo de traslados entre ubicaciones (sucursal ↔ CEDIS):
//
//   Solicitado ─▶ En preparación ─▶ En camino ─▶ Recibido
//        └──────────────┴── Cancelado (sin afectar stock)
//
// • El stock SALE del origen al despachar (transfer_out).
// • El stock ENTRA al destino al recibir, solo por lo contado (transfer_in).
// • Lo que no llegó queda registrado como diferencia del traslado.
// • Mientras va en camino, el teléfono del chofer reporta su GPS.

type LocType = $Enums.LocationType;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const round = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export const TRANSFER_STATUS_LABELS: Record<$Enums.TransferStatus, string> = {
  pending: "Solicitado",
  preparing: "En preparación",
  in_transit: "En camino",
  received: "Recibido",
  cancelled: "Cancelado",
};

export const transferFolio = (n: number) => `T-${String(n).padStart(4, "0")}`;

// ── Utilidades ──────────────────────────────────────────────────────────

async function placeNames(organizationId: string) {
  const [locations, cedis] = await Promise.all([
    prisma.location.findMany({ where: { organizationId }, select: { id: true, name: true, latitude: true, longitude: true, address: true } }),
    prisma.cedi.findMany({ where: { organizationId }, select: { id: true, name: true, latitude: true, longitude: true, address: true } }),
  ]);
  const map = new Map<string, { name: string; lat: number | null; lng: number | null; address: string | null }>();
  for (const p of [...locations, ...cedis]) {
    map.set(p.id, {
      name: p.name,
      lat: p.latitude == null ? null : Number(p.latitude),
      lng: p.longitude == null ? null : Number(p.longitude),
      address: p.address ?? null,
    });
  }
  return map;
}

async function assertPlace(organizationId: string, type: LocType, id: string) {
  const row =
    type === "location"
      ? await prisma.location.findFirst({ where: { id, organizationId, isActive: true }, select: { id: true } })
      : await prisma.cedi.findFirst({ where: { id, organizationId, isActive: true }, select: { id: true } });
  if (!row) throw new CrudError("La ubicación no existe o está inactiva", 404);
}

async function employeeFor(userId: string) {
  return prisma.employee.findFirst({ where: { userId }, select: { id: true } });
}

async function findTransfer(organizationId: string, id: string) {
  const t = await prisma.transfer.findFirst({ where: { id, organizationId }, include: { items: true } });
  if (!t) throw new CrudError("Traslado no encontrado", 404);
  return t;
}

// ── Lectura ─────────────────────────────────────────────────────────────

export interface TransferListRow {
  id: string;
  folio: string;
  status: $Enums.TransferStatus;
  fromName: string;
  toName: string;
  fromLocationId: string;
  toLocationId: string;
  itemCount: number;
  totalQty: number;
  receivedQty: number | null;
  hasDiscrepancy: boolean;
  driverName: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  expectedAt: string | null;
  lastLocationAt: string | null;
}

export async function listTransfers(
  organizationId: string,
  f: { status?: string; locationId?: string; q?: string } = {}
): Promise<TransferListRow[]> {
  const [rows, places] = await Promise.all([
    prisma.transfer.findMany({
      where: {
        organizationId,
        ...(f.status === "active"
          ? { status: { in: ["pending", "preparing", "in_transit"] } }
          : f.status
            ? { status: f.status as $Enums.TransferStatus }
            : {}),
        ...(f.locationId ? { OR: [{ fromLocationId: f.locationId }, { toLocationId: f.locationId }] } : {}),
      },
      include: { items: { select: { quantity: true, receivedQty: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    placeNames(organizationId),
  ]);

  return rows.map((t) => {
    const received = t.items.some((i) => i.receivedQty != null) ? t.items.reduce((s, i) => s + num(i.receivedQty), 0) : null;
    return {
      id: t.id,
      folio: transferFolio(t.number),
      status: t.status,
      fromName: places.get(t.fromLocationId)?.name ?? "—",
      toName: places.get(t.toLocationId)?.name ?? "—",
      fromLocationId: t.fromLocationId,
      toLocationId: t.toLocationId,
      itemCount: t.items.length,
      totalQty: round(t.items.reduce((s, i) => s + num(i.quantity), 0)),
      receivedQty: received == null ? null : round(received),
      hasDiscrepancy: t.hasDiscrepancy,
      driverName: t.driverName,
      createdAt: t.createdAt.toISOString(),
      dispatchedAt: t.dispatchedAt?.toISOString() ?? null,
      receivedAt: t.receivedAt?.toISOString() ?? null,
      expectedAt: t.expectedAt?.toISOString() ?? null,
      lastLocationAt: t.lastLocationAt?.toISOString() ?? null,
    };
  }).filter((r) => !f.q || `${r.folio} ${r.fromName} ${r.toName} ${r.driverName ?? ""}`.toLowerCase().includes(f.q.toLowerCase()));
}

export interface TransferPlace {
  id: string;
  type: LocType;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
}

export interface TransferDetail {
  id: string;
  folio: string;
  status: $Enums.TransferStatus;
  from: TransferPlace;
  to: TransferPlace;
  notes: string | null;
  receiveNotes: string | null;
  /** Quien recibió físicamente (empleado y/o nombre escrito). */
  receivedBy: string | null;
  requestedBy: string | null;
  driverName: string | null;
  /** Chofer asignado (trabajador) y si ya aceptó; `trackToken` es el enlace para quien no tiene cuenta. */
  driver: { employeeId: string | null; name: string | null; accepted: boolean; trackToken: string | null };
  vehicle: string | null;
  expectedAt: string | null;
  hasDiscrepancy: boolean;
  lastPosition: { lat: number; lng: number; at: string } | null;
  track: { lat: number; lng: number; at: string }[];
  timeline: { key: "requested" | "preparing" | "dispatched" | "received" | "cancelled"; at: string | null; by: string | null }[];
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    image: string | null;
    unit: string | null;
    quantity: number;
    receivedQty: number | null;
    receiveNote: string | null;
    availableAtOrigin: number | null;
  }[];
}

export async function getTransfer(organizationId: string, id: string): Promise<TransferDetail> {
  const t = await prisma.transfer.findFirst({
    where: { id, organizationId },
    include: {
      items: { include: { product: { select: { name: true, imageUrl: true } } } },
      trackPoints: { orderBy: { recordedAt: "asc" }, take: 500 },
    },
  });
  if (!t) throw new CrudError("Traslado no encontrado", 404);

  const receiverEmployee = t.receivedByEmployeeId
    ? await prisma.employee.findFirst({ where: { id: t.receivedByEmployeeId, organizationId }, select: { fullName: true } })
    : null;
  const [places, variants, inventories, users] = await Promise.all([
    placeNames(organizationId),
    prisma.productVariant.findMany({ where: { id: { in: t.items.map((i) => i.variantId).filter((v): v is string => !!v) } }, select: { id: true, name: true } }),
    prisma.inventory.findMany({
      where: { id: { in: t.items.map((i) => i.inventoryId).filter((v): v is string => !!v) } },
      select: { id: true, quantity: true, unit: { select: { abbreviation: true } } },
    }),
    prisma.user.findMany({
      where: { id: { in: [t.requestedById, t.dispatchedById, t.receivedById].filter((v): v is string => !!v) } },
      select: { id: true, fullName: true, email: true },
    }),
  ]);
  const variantName = new Map(variants.map((v) => [v.id, v.name]));
  const inv = new Map(inventories.map((i) => [i.id, i]));
  const userName = (uid: string | null) => {
    const u = users.find((x) => x.id === uid);
    return u ? u.fullName || u.email : null;
  };
  const place = (pid: string, type: LocType): TransferPlace => {
    const p = places.get(pid);
    return { id: pid, type, name: p?.name ?? "—", lat: p?.lat ?? null, lng: p?.lng ?? null, address: p?.address ?? null };
  };

  const timeline: TransferDetail["timeline"] = [
    { key: "requested", at: t.createdAt.toISOString(), by: userName(t.requestedById) },
    { key: "preparing", at: t.status === "pending" ? null : (t.dispatchedAt ?? t.createdAt).toISOString(), by: null },
    { key: "dispatched", at: t.dispatchedAt?.toISOString() ?? null, by: userName(t.dispatchedById) },
    { key: "received", at: t.receivedAt?.toISOString() ?? null, by: userName(t.receivedById) },
  ];
  if (t.status === "cancelled") timeline.push({ key: "cancelled", at: t.completedAt?.toISOString() ?? null, by: null });

  return {
    id: t.id,
    folio: transferFolio(t.number),
    status: t.status,
    from: place(t.fromLocationId, t.fromLocationType),
    to: place(t.toLocationId, t.toLocationType),
    notes: t.notes,
    receiveNotes: t.receiveNotes,
    receivedBy: [receiverEmployee?.fullName, t.receivedByName].filter(Boolean).join(" · ") || null,
    requestedBy: userName(t.requestedById),
    driverName: t.driverName,
    driver: { employeeId: t.driverEmployeeId, name: t.driverName, accepted: Boolean(t.driverAcceptedAt), trackToken: t.trackToken },
    vehicle: t.vehicle,
    expectedAt: t.expectedAt?.toISOString() ?? null,
    hasDiscrepancy: t.hasDiscrepancy,
    lastPosition: t.lastLat != null && t.lastLng != null && t.lastLocationAt
      ? { lat: Number(t.lastLat), lng: Number(t.lastLng), at: t.lastLocationAt.toISOString() }
      : null,
    track: t.trackPoints.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), at: p.recordedAt.toISOString() })),
    timeline,
    items: t.items.map((i) => {
      const row = i.inventoryId ? inv.get(i.inventoryId) : undefined;
      return {
        id: i.id,
        productName: i.product.name,
        variantName: i.variantId ? (variantName.get(i.variantId) ?? null) : null,
        image: i.product.imageUrl,
        unit: row?.unit?.abbreviation ?? null,
        quantity: num(i.quantity),
        receivedQty: i.receivedQty == null ? null : num(i.receivedQty),
        receiveNote: i.receiveNote,
        availableAtOrigin: row ? num(row.quantity) : null,
      };
    }),
  };
}

// ── Escritura ───────────────────────────────────────────────────────────

export interface CreateTransferInput {
  fromLocationType: LocType;
  fromLocationId: string;
  toLocationType: LocType;
  toLocationId: string;
  items: { inventoryId: string; quantity: number }[];
  notes?: string | null;
  expectedAt?: string | null;
}

export async function createTransfer(organizationId: string, userId: string, input: CreateTransferInput) {
  if (input.fromLocationId === input.toLocationId && input.fromLocationType === input.toLocationType) {
    throw new CrudError("El origen y el destino deben ser distintos", 400, "toLocationId");
  }
  const items = input.items.filter((i) => Number(i.quantity) > 0);
  if (items.length === 0) throw new CrudError("Agrega al menos un producto con cantidad mayor a 0", 400, "items");
  await Promise.all([
    assertPlace(organizationId, input.fromLocationType, input.fromLocationId),
    assertPlace(organizationId, input.toLocationType, input.toLocationId),
  ]);

  const rows = await prisma.inventory.findMany({
    where: { id: { in: items.map((i) => i.inventoryId) }, organizationId, locationId: input.fromLocationId, locationType: input.fromLocationType },
    select: { id: true, productId: true, variantId: true, quantity: true, variant: { select: { productId: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const it of items) {
    const row = byId.get(it.inventoryId);
    if (!row) throw new CrudError("Un producto no pertenece a la ubicación de origen", 400, "items");
    if (Number(it.quantity) > num(row.quantity)) {
      throw new CrudError("Una cantidad supera la existencia disponible en el origen", 409, "items");
    }
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const last = await tx.transfer.aggregate({ where: { organizationId }, _max: { number: true } });
    return tx.transfer.create({
      data: {
        organizationId,
        number: (last._max.number ?? 0) + 1,
        fromLocationId: input.fromLocationId,
        fromLocationType: input.fromLocationType,
        toLocationId: input.toLocationId,
        toLocationType: input.toLocationType,
        notes: input.notes?.trim() || null,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        requestedById: userId,
        items: {
          create: items.map((it) => {
            const row = byId.get(it.inventoryId)!;
            const productId = row.productId ?? row.variant?.productId;
            if (!productId) throw new CrudError("Producto sin identificar en el inventario", 400);
            return { productId, variantId: row.variantId, inventoryId: row.id, quantity: round(Number(it.quantity)) };
          }),
        },
      },
    });
  });
  return { ok: true, id: transfer.id, folio: transferFolio(transfer.number) };
}

export async function startPreparing(organizationId: string, id: string) {
  const t = await findTransfer(organizationId, id);
  if (t.status !== "pending") throw new CrudError("Solo un traslado solicitado puede pasar a preparación", 409);
  await prisma.transfer.update({ where: { id }, data: { status: "preparing" } });
  return { ok: true };
}

/**
 * Asigna al responsable del traslado: un trabajador (usa /repartidor y comparte su ubicación)
 * o solo un nombre (recibe un enlace para compartirla sin cuenta). Se puede cambiar mientras
 * el traslado siga activo, incluso en camino.
 */
export async function assignTransferDriver(
  organizationId: string,
  id: string,
  userId: string,
  input: { employeeId?: string | null; name?: string | null; vehicle?: string | null }
) {
  const t = await findTransfer(organizationId, id);
  if (!["pending", "preparing", "in_transit"].includes(t.status)) throw new CrudError("El traslado ya terminó", 409);
  const me = await employeeFor(userId);
  let employee: { id: string; fullName: string; userId: string } | null = null;
  if (input.employeeId) {
    employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, organizationId, isActive: true },
      select: { id: true, fullName: true, userId: true },
    });
    if (!employee) throw new CrudError("El empleado no está disponible", 404);
  }
  const name = employee?.fullName ?? input.name?.trim() ?? "";
  if (!name) throw new CrudError("Elige un trabajador o escribe el nombre de quien lo lleva", 400);

  const self = Boolean(employee && me && employee.id === me.id);
  const needsToken = !employee && !t.trackToken;
  await prisma.transfer.update({
    where: { id },
    data: {
      driverEmployeeId: employee?.id ?? null,
      driverName: name,
      driverAssignedAt: new Date(),
      driverAcceptedAt: self ? new Date() : null,
      ...(input.vehicle !== undefined ? { vehicle: input.vehicle?.trim() || null } : {}),
      ...(needsToken ? { trackToken: randomBytes(18).toString("hex") } : {}),
    },
  });
  if (employee && !self) {
    await persistNotification({
      organizationId,
      locationId: null,
      kind: "transfer",
      title: `Traslado ${transferFolio(t.number)} asignado`,
      body: "Acéptalo en tu interfaz de entregas para llevarlo y compartir tu ubicación.",
      severity: "info",
      recipientUserId: employee.userId,
      link: "/repartidor",
      metadata: { transferId: id },
    }).catch(() => null);
  }
  return { ok: true };
}

/** El chofer acepta un traslado asignado (o toma uno sin chofer). */
export async function acceptTransfer(organizationId: string, id: string, employeeId: string) {
  const t = await findTransfer(organizationId, id);
  if (!["pending", "preparing", "in_transit"].includes(t.status)) throw new CrudError("El traslado ya terminó", 409);
  if (t.driverEmployeeId && t.driverEmployeeId !== employeeId && t.driverAcceptedAt) {
    throw new CrudError("Otro chofer ya aceptó este traslado", 409);
  }
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId }, select: { fullName: true } });
  await prisma.transfer.update({
    where: { id },
    data: { driverEmployeeId: employeeId, driverName: emp?.fullName ?? t.driverName, driverAssignedAt: t.driverAssignedAt ?? new Date(), driverAcceptedAt: new Date() },
  });
  return { ok: true };
}

/** Traslados activos para la interfaz del chofer: los suyos y los que aún no tienen chofer. */
export async function listDriverTransfers(organizationId: string, employeeId: string | null) {
  const [rows, places] = await Promise.all([
    prisma.transfer.findMany({
      where: {
        organizationId,
        status: { in: ["pending", "preparing", "in_transit"] },
        OR: [...(employeeId ? [{ driverEmployeeId: employeeId }] : []), { driverEmployeeId: null }],
      },
      include: { items: { select: { quantity: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    placeNames(organizationId),
  ]);
  return rows.map((t) => ({
    id: t.id,
    folio: transferFolio(t.number),
    status: t.status,
    fromName: places.get(t.fromLocationId)?.name ?? "—",
    toName: places.get(t.toLocationId)?.name ?? "—",
    toAddress: places.get(t.toLocationId)?.address ?? null,
    toLat: places.get(t.toLocationId)?.lat ?? null,
    toLng: places.get(t.toLocationId)?.lng ?? null,
    units: round(t.items.reduce((s, i) => s + num(i.quantity), 0)),
    mine: Boolean(employeeId && t.driverEmployeeId === employeeId),
    accepted: Boolean(t.driverAcceptedAt),
    driverName: t.driverName,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
  }));
}

/** Ubicación reportada por el enlace público del chofer (sin cuenta). */
export async function recordTransferLocationByToken(token: string, input: { lat: number; lng: number; accuracy?: number | null }) {
  const t = await prisma.transfer.findUnique({ where: { trackToken: token }, select: { id: true, organizationId: true } });
  if (!t) throw new CrudError("Enlace inválido", 404);
  return recordTransferLocation(t.organizationId, t.id, input);
}

export async function getTransferByToken(token: string) {
  const t = await prisma.transfer.findUnique({ where: { trackToken: token } });
  if (!t) throw new CrudError("Enlace inválido", 404);
  const places = await placeNames(t.organizationId);
  return {
    folio: transferFolio(t.number),
    status: t.status,
    fromName: places.get(t.fromLocationId)?.name ?? "—",
    toName: places.get(t.toLocationId)?.name ?? "—",
    toAddress: places.get(t.toLocationId)?.address ?? null,
    driverName: t.driverName,
  };
}

/** Despacha: descuenta el origen y lo pone en camino. Permite ajustar cantidades al cargar. */
export async function dispatchTransfer(
  organizationId: string,
  id: string,
  userId: string,
  input: { driverName?: string | null; vehicle?: string | null; expectedAt?: string | null; quantities?: Record<string, number> }
) {
  const t = await findTransfer(organizationId, id);
  if (t.status !== "pending" && t.status !== "preparing") throw new CrudError("Este traslado ya salió o fue cerrado", 409);
  const employee = await employeeFor(userId);
  const folio = transferFolio(t.number);

  await prisma.$transaction(async (tx) => {
    for (const item of t.items) {
      const qty = round(input.quantities?.[item.id] ?? num(item.quantity));
      if (qty < 0) throw new CrudError("Cantidad inválida", 400);
      if (qty !== num(item.quantity)) await tx.transferItem.update({ where: { id: item.id }, data: { quantity: qty } });
      if (qty === 0) continue;
      if (!item.inventoryId) throw new CrudError("Partida sin inventario de origen", 400);
      const updated = await tx.inventory.updateMany({
        where: { id: item.inventoryId, organizationId, quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      });
      if (updated.count !== 1) throw new CrudError("No hay existencia suficiente en el origen para despachar", 409);
      const inv = await tx.inventory.findUniqueOrThrow({ where: { id: item.inventoryId }, select: { unitId: true } });
      await tx.inventoryMovement.create({
        data: {
          organizationId,
          productId: item.productId,
          variantId: item.variantId,
          locationId: t.fromLocationId,
          locationType: t.fromLocationType,
          type: "transfer_out",
          quantity: -qty,
          unitId: inv.unitId,
          reason: `Traslado ${folio} (salida)`,
          referenceId: t.id,
          employeeId: employee?.id ?? null,
          userId,
        },
      });
    }
    await tx.transfer.update({
      where: { id },
      data: {
        status: "in_transit",
        dispatchedAt: new Date(),
        dispatchedById: userId,
        driverName: input.driverName?.trim() || t.driverName,
        vehicle: input.vehicle?.trim() || t.vehicle,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : t.expectedAt,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await Promise.all(t.items.filter((i) => i.inventoryId).map((i) => maybeNotifyLowStock(organizationId, i.inventoryId!)));
  const places = await placeNames(organizationId);
  await persistNotification({
    organizationId,
    locationId: t.toLocationType === "location" ? t.toLocationId : null,
    kind: "transfer",
    title: `Traslado ${folio} en camino`,
    body: `Sale de ${places.get(t.fromLocationId)?.name ?? "origen"} hacia ${places.get(t.toLocationId)?.name ?? "destino"}.`,
    severity: "info",
    link: `/admin/inventory/transfers/${t.id}`,
    metadata: { transferId: t.id },
  }).catch(() => null);
  return { ok: true };
}

/** Punto GPS del chofer. Guarda la última posición y el recorrido (máx. 1 punto cada 10 s). */
export async function recordTransferLocation(
  organizationId: string,
  id: string,
  input: { lat: number; lng: number; accuracy?: number | null }
) {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
    throw new CrudError("Coordenadas inválidas", 400);
  }
  const t = await prisma.transfer.findFirst({ where: { id, organizationId }, select: { status: true, lastLocationAt: true } });
  if (!t) throw new CrudError("Traslado no encontrado", 404);
  if (t.status !== "in_transit") throw new CrudError("El traslado aún no sale: tu ubicación se comparte cuando va en camino", 409);
  const now = new Date();
  const addPoint = !t.lastLocationAt || now.getTime() - t.lastLocationAt.getTime() >= 10_000;
  await prisma.transfer.update({
    where: { id },
    data: {
      lastLat: input.lat,
      lastLng: input.lng,
      lastLocationAt: now,
      ...(addPoint ? { trackPoints: { create: { lat: input.lat, lng: input.lng, accuracy: input.accuracy ?? null } } } : {}),
    },
  });
  return { ok: true };
}

/** Recibe: suma al destino lo contado y registra diferencias. */
export async function receiveTransfer(
  organizationId: string,
  id: string,
  userId: string,
  input: {
    items: { itemId: string; receivedQty: number; note?: string | null }[]
    notes?: string | null
    /** Empleado que recibió (de la lista) y/o su nombre escrito a mano. */
    receiverEmployeeId?: string | null
    receiverName?: string | null
  }
) {
  const t = await findTransfer(organizationId, id);
  if (t.status !== "in_transit") throw new CrudError("Solo se puede recibir un traslado en camino", 409);
  const receiverEmployeeId = input.receiverEmployeeId?.trim() || null;
  if (receiverEmployeeId) {
    const ok = await prisma.employee.findFirst({ where: { id: receiverEmployeeId, organizationId }, select: { id: true } });
    if (!ok) throw new CrudError("El empleado que recibe no existe", 400, "receiverEmployeeId");
  }
  const receiverName = input.receiverName?.trim().slice(0, 120) || null;
  const employee = await employeeFor(userId);
  const folio = transferFolio(t.number);
  const byItem = new Map(input.items.map((i) => [i.itemId, i]));
  let discrepancy = false;
  const destIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const item of t.items) {
      const r = byItem.get(item.id);
      const received = round(Math.max(0, Number(r?.receivedQty ?? num(item.quantity))));
      if (received > num(item.quantity)) throw new CrudError("No se puede recibir más de lo enviado", 400);
      if (received !== num(item.quantity)) discrepancy = true;
      await tx.transferItem.update({ where: { id: item.id }, data: { receivedQty: received, receiveNote: r?.note?.trim() || null } });
      if (received === 0) continue;

      const origin = item.inventoryId
        ? await tx.inventory.findUnique({ where: { id: item.inventoryId }, select: { unitId: true } })
        : null;
      // Las filas de variante pueden guardarse sin productId (la clave única es
      // variante + ubicación); las de granel van por producto sin variante.
      let dest = await tx.inventory.findFirst({
        where: {
          organizationId,
          locationId: t.toLocationId,
          locationType: t.toLocationType,
          ...(item.variantId ? { variantId: item.variantId } : { productId: item.productId, variantId: null }),
        },
        select: { id: true },
      });
      if (dest) {
        await tx.inventory.update({ where: { id: dest.id }, data: { quantity: { increment: received } } });
      } else {
        dest = await tx.inventory.create({
          data: {
            organizationId,
            productId: item.productId,
            variantId: item.variantId,
            locationId: t.toLocationId,
            locationType: t.toLocationType,
            quantity: received,
            unitId: origin?.unitId ?? null,
            minThreshold: 0,
          },
          select: { id: true },
        });
      }
      destIds.push(dest.id);
      await tx.inventoryMovement.create({
        data: {
          organizationId,
          productId: item.productId,
          variantId: item.variantId,
          locationId: t.toLocationId,
          locationType: t.toLocationType,
          type: "transfer_in",
          quantity: received,
          unitId: origin?.unitId ?? null,
          reason: `Traslado ${folio} (entrada)`,
          referenceId: t.id,
          employeeId: employee?.id ?? null,
          userId,
        },
      });
    }
    await tx.transfer.update({
      where: { id },
      data: {
        status: "received",
        receivedAt: new Date(),
        completedAt: new Date(),
        receivedById: userId,
        receivedByEmployeeId: receiverEmployeeId,
        receivedByName: receiverName,
        receiveNotes: input.notes?.trim() || null,
        hasDiscrepancy: discrepancy,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await persistNotification({
    organizationId,
    locationId: t.fromLocationType === "location" ? t.fromLocationId : null,
    kind: "transfer",
    title: discrepancy ? `Traslado ${folio} recibido con diferencias` : `Traslado ${folio} recibido completo`,
    severity: discrepancy ? "warning" : "success",
    link: `/admin/inventory/transfers/${t.id}`,
    metadata: { transferId: t.id },
  }).catch(() => null);
  return { ok: true, hasDiscrepancy: discrepancy, destinationInventoryIds: destIds };
}

/** Cancela. Antes de salir no mueve stock; en camino regresa la mercancía al origen. */
export async function cancelTransfer(organizationId: string, id: string, userId: string, reason?: string | null) {
  const t = await findTransfer(organizationId, id);
  if (t.status === "received" || t.status === "cancelled") throw new CrudError("El traslado ya está cerrado", 409);
  const folio = transferFolio(t.number);
  const employee = await employeeFor(userId);

  await prisma.$transaction(async (tx) => {
    if (t.status === "in_transit") {
      for (const item of t.items) {
        const qty = num(item.quantity);
        if (!item.inventoryId || qty === 0) continue;
        const origin = await tx.inventory.update({ where: { id: item.inventoryId }, data: { quantity: { increment: qty } }, select: { unitId: true } });
        await tx.inventoryMovement.create({
          data: {
            organizationId,
            productId: item.productId,
            variantId: item.variantId,
            locationId: t.fromLocationId,
            locationType: t.fromLocationType,
            type: "transfer_in",
            quantity: qty,
            unitId: origin.unitId,
            reason: `Traslado ${folio} cancelado (regresa al origen)`,
            referenceId: t.id,
            employeeId: employee?.id ?? null,
            userId,
          },
        });
      }
    }
    await tx.transfer.update({
      where: { id },
      data: {
        status: "cancelled",
        completedAt: new Date(),
        receiveNotes: reason?.trim() ? `Cancelado: ${reason.trim()}` : t.receiveNotes,
      },
    });
  });
  return { ok: true };
}
