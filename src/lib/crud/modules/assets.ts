import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CUT_FIELDS, cutFromAttributes } from "@/lib/styles/cut";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

// Vehículos, fichas de estilo o equipos del cliente. Un cliente puede tener varios; se desactivan
// (no se borran) para conservar el historial de lo que se les atendió.

export interface AssetDto {
  id: string;
  customerId: string;
  customerName: string;
  kind: string;
  label: string;
  reference: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  size: string | null;
  notes: string | null;
  isActive: boolean;
  /** Ficha de estilo: indicaciones del corte (laterales, parte superior, barba…). */
  [cutKey: `cut${string}`]: string | null;
}

const KINDS = ["vehicle", "profile", "equipment", "other"];

type Row = Prisma.CustomerAssetGetPayload<{ include: { customer: { select: { fullName: true } } } }>;
const include = { customer: { select: { fullName: true } } } as const;

const serialize = (a: Row): AssetDto => ({
  ...Object.fromEntries(CUT_FIELDS.map((f) => [f.key, cutFromAttributes(a.attributes)[f.key] ?? null])),
  id: a.id,
  customerId: a.customerId,
  customerName: a.customer.fullName,
  kind: a.kind,
  label: a.label,
  reference: a.reference,
  brand: a.brand,
  model: a.model,
  color: a.color,
  size: a.size,
  notes: a.notes,
  isActive: a.isActive,
});

const text = (v: unknown, max = 190): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** «Tsuru gris» a partir de marca, modelo y color cuando no se escribe un nombre. */
function autoLabel(d: { brand: string | null; model: string | null; color: string | null; reference: string | null }) {
  return [d.brand, d.model, d.color].filter(Boolean).join(" ") || d.reference || "";
}

/** Mezcla las indicaciones del corte recibidas con el JSON `attributes` existente (sin tocar otras claves). */
function mergeCut(current: Prisma.JsonValue | null, d: Record<string, unknown>): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const base = current && typeof current === "object" && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {};
  for (const field of CUT_FIELDS) {
    if (d[field.key] === undefined) continue;
    const value = text(d[field.key], 200);
    if (value) base[field.key] = value;
    else delete base[field.key];
  }
  return Object.keys(base).length ? (base as Prisma.InputJsonValue) : Prisma.JsonNull;
}

export const assetsModule: CrudModule<AssetDto> = {
  key: "assets",

  async list(organizationId, params: ListParams): Promise<CrudListResult<AssetDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const customerId = typeof params.customerId === "string" && params.customerId ? params.customerId : undefined;
    const where: Prisma.CustomerAssetWhereInput = {
      organizationId,
      ...(customerId ? { customerId } : {}),
      ...(params.kind ? { kind: String(params.kind) } : {}),
      ...(q
        ? {
            OR: [
              { label: { contains: q } },
              { reference: { contains: q } },
              { brand: { contains: q } },
              { model: { contains: q } },
              { customer: { fullName: { contains: q } } },
              { customer: { phone: { contains: q } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.customerAsset.findMany({ where, include, orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.customerAsset.count({ where }),
    ]);
    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const a = await prisma.customerAsset.findFirst({ where: { id, organizationId }, include });
    if (!a) throw new CrudError("Vehículo no encontrado", 404);
    return serialize(a);
  },

  async create(organizationId, input) {
    const d = input as Record<string, unknown>;
    const customerId = typeof d.customerId === "string" ? d.customerId : "";
    if (!customerId) throw new CrudError("Elige al cliente", 400, "customerId");
    const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId }, select: { id: true } });
    if (!customer) throw new CrudError("El cliente no pertenece a la empresa activa", 400, "customerId");
    const kind = KINDS.includes(String(d.kind)) ? String(d.kind) : "vehicle";
    const fields = { reference: text(d.reference, 40)?.toUpperCase() ?? null, brand: text(d.brand, 60), model: text(d.model, 60), color: text(d.color, 40) };
    const label = text(d.label, 120) ?? autoLabel(fields);
    if (!label) throw new CrudError("Escribe un nombre, la placa o la marca y el modelo", 400, "label");
    const a = await prisma.customerAsset.create({
      data: { organizationId, customerId, kind, label, ...fields, size: text(d.size, 40), notes: text(d.notes, 2000), isActive: d.isActive !== false, attributes: mergeCut(null, d) },
      include,
    });
    return serialize(a);
  },

  async update(organizationId, id, input) {
    const d = input as Record<string, unknown>;
    const existing = await prisma.customerAsset.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Vehículo no encontrado", 404);
    const has = (k: string) => d[k] !== undefined;
    const merged = {
      reference: has("reference") ? (text(d.reference, 40)?.toUpperCase() ?? null) : existing.reference,
      brand: has("brand") ? text(d.brand, 60) : existing.brand,
      model: has("model") ? text(d.model, 60) : existing.model,
      color: has("color") ? text(d.color, 40) : existing.color,
    };
    const label = has("label") ? (text(d.label, 120) ?? autoLabel(merged)) : existing.label;
    if (!label) throw new CrudError("Escribe un nombre, la placa o la marca y el modelo", 400, "label");
    const a = await prisma.customerAsset.update({
      where: { id },
      data: {
        ...merged,
        label,
        ...(has("kind") && KINDS.includes(String(d.kind)) ? { kind: String(d.kind) } : {}),
        ...(has("size") ? { size: text(d.size, 40) } : {}),
        ...(has("notes") ? { notes: text(d.notes, 2000) } : {}),
        ...(has("isActive") ? { isActive: d.isActive !== false } : {}),
        ...(CUT_FIELDS.some((f) => has(f.key)) ? { attributes: mergeCut(existing.attributes, d) } : {}),
      },
      include,
    });
    return serialize(a);
  },

  async remove(organizationId, id) {
    const a = await prisma.customerAsset.findFirst({ where: { id, organizationId } });
    if (!a) throw new CrudError("Vehículo no encontrado", 404);
    await prisma.customerAsset.update({ where: { id }, data: { isActive: false } });
  },
};
