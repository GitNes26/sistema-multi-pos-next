import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface CediDto {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  managerName: string | null;
  phone: string | null;
  email: string | null;
  openingHours: string | null;
  openingScheduleJson: string | null;
  imageUrl: string | null;
  notes: string | null;
  timezone: string;
  isActive: boolean;
}

const decimalOrNull = (v: { toNumber(): number } | number | null): number | null => {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : v.toNumber();
};

function serialize(c: {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  latitude: { toNumber(): number } | number | null;
  longitude: { toNumber(): number } | number | null;
  managerName: string | null;
  phone: string | null;
  email: string | null;
  openingHours: string | null;
  openingScheduleJson: string | null;
  imageUrl: string | null;
  notes: string | null;
  timezone: string;
  isActive: boolean;
}): CediDto {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    address: c.address,
    latitude: decimalOrNull(c.latitude),
    longitude: decimalOrNull(c.longitude),
    managerName: c.managerName,
    phone: c.phone,
    email: c.email,
    openingHours: c.openingHours,
    openingScheduleJson: c.openingScheduleJson,
    imageUrl: c.imageUrl,
    notes: c.notes,
    timezone: c.timezone,
    isActive: c.isActive,
  };
}

export const cedisModule: CrudModule<CediDto> = {
  key: "cedis",

  async list(organizationId, params: ListParams): Promise<CrudListResult<CediDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";

    const where = {
      organizationId,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { address: { contains: q } },
              { managerName: { contains: q } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.cedi.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cedi.count({ where }),
    ]);

    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const c = await prisma.cedi.findFirst({ where: { id, organizationId } });
    if (!c) throw new CrudError("CEDIS no encontrado", 404);
    return serialize(c);
  },

  async create(organizationId, input) {
    const data = input as Record<string, unknown>;
    const name = data.name ? String(data.name).trim() : "";
    if (!name) throw new CrudError("El nombre es obligatorio", 400, "name");

    const code = data.code ? String(data.code).trim() : null;
    if (code) {
      const dup = await prisma.cedi.findFirst({ where: { organizationId, code } });
      if (dup) throw new CrudError("Ese código ya existe", 400, "code");
    }

    const c = await prisma.cedi.create({
      data: {
        organizationId,
        name,
        code,
        address: data.address ? String(data.address) : null,
        latitude: data.latitude !== undefined && data.latitude !== null && data.latitude !== "" ? Number(data.latitude) : null,
        longitude: data.longitude !== undefined && data.longitude !== null && data.longitude !== "" ? Number(data.longitude) : null,
        managerName: data.managerName ? String(data.managerName) : null,
        phone: data.phone ? String(data.phone) : null,
        email: data.email ? String(data.email) : null,
        openingHours: data.openingHours ? String(data.openingHours) : null,
        openingScheduleJson: data.openingScheduleJson ? String(data.openingScheduleJson) : null,
        imageUrl: data.imageUrl ? String(data.imageUrl) : null,
        notes: data.notes ? String(data.notes) : null,
        timezone: data.timezone ? String(data.timezone) : "America/Mexico_City",
        isActive: data.isActive !== false,
      },
    });
    return serialize(c);
  },

  async update(organizationId, id, input) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.cedi.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("CEDIS no encontrado", 404);

    if (data.code) {
      const dup = await prisma.cedi.findFirst({
        where: { organizationId, code: String(data.code).trim(), id: { not: id } },
      });
      if (dup) throw new CrudError("Ese código ya existe", 400, "code");
    }

    const c = await prisma.cedi.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: String(data.name).trim() || existing.name } : {}),
        ...(data.code !== undefined ? { code: data.code ? String(data.code).trim() : null } : {}),
        ...(data.address !== undefined ? { address: data.address ? String(data.address) : null } : {}),
        ...(data.latitude !== undefined
          ? { latitude: data.latitude !== null && data.latitude !== "" ? Number(data.latitude) : null }
          : {}),
        ...(data.longitude !== undefined
          ? { longitude: data.longitude !== null && data.longitude !== "" ? Number(data.longitude) : null }
          : {}),
        ...(data.managerName !== undefined ? { managerName: data.managerName ? String(data.managerName) : null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone ? String(data.phone) : null } : {}),
        ...(data.email !== undefined ? { email: data.email ? String(data.email) : null } : {}),
        ...(data.openingHours !== undefined ? { openingHours: data.openingHours ? String(data.openingHours) : null } : {}),
        ...(data.openingScheduleJson !== undefined ? { openingScheduleJson: data.openingScheduleJson ? String(data.openingScheduleJson) : null } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl ? String(data.imageUrl) : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ? String(data.notes) : null } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone ? String(data.timezone) : "America/Mexico_City" } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive !== false } : {}),
      },
    });
    return serialize(c);
  },

  async remove(organizationId, id) {
    const c = await prisma.cedi.findFirst({ where: { id, organizationId } });
    if (!c) throw new CrudError("CEDIS no encontrado", 404);
    await prisma.cedi.delete({ where: { id } });
  },
};