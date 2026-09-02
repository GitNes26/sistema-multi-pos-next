import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface LocationDto {
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
  allowsPickup: boolean;
  allowsDelivery: boolean;
  isActive: boolean;
  registerCount: number;
  salesCount: number;
  cashierCount: number;
}

type LocationRow = {
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
  allowsPickup: boolean;
  allowsDelivery: boolean;
  isActive: boolean;
  _count: { cashRegisters: number; sales: number };
};

const decimalOrNull = (
  v: { toNumber(): number } | number | null
): number | null => {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : v.toNumber();
};

function serialize(l: LocationRow): LocationDto {
  return {
    id: l.id,
    name: l.name,
    code: l.code,
    address: l.address,
    latitude: decimalOrNull(l.latitude),
    longitude: decimalOrNull(l.longitude),
    managerName: l.managerName,
    phone: l.phone,
    email: l.email,
    openingHours: l.openingHours,
    openingScheduleJson: l.openingScheduleJson,
    imageUrl: l.imageUrl,
    notes: l.notes,
    timezone: l.timezone,
    allowsPickup: l.allowsPickup,
    allowsDelivery: l.allowsDelivery,
    isActive: l.isActive,
    registerCount: l._count.cashRegisters,
    salesCount: l._count.sales,
    cashierCount: 0,
  };
}

export const locationsModule: CrudModule<LocationDto> = {
  key: "locations",

  async list(organizationId, params: ListParams): Promise<CrudListResult<LocationDto>> {
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
              { phone: { contains: q } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.location.findMany({
        where,
        include: { _count: { select: { cashRegisters: true, sales: true } } },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.location.count({ where }),
    ]);

    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const l = await prisma.location.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { cashRegisters: true, sales: true } } },
    });
    if (!l) throw new CrudError("Sucursal no encontrada", 404);
    return serialize(l);
  },

  async create(organizationId, input, _ctx) {
    const data = input as Record<string, unknown>;
    const name = data.name ? String(data.name).trim() : "";
    if (!name) throw new CrudError("El nombre es obligatorio", 400, "name");

    const code = data.code ? String(data.code).trim() : null;
    if (code) {
      const dup = await prisma.location.findFirst({ where: { organizationId, code } });
      if (dup) throw new CrudError("Ese código de sucursal ya existe", 400, "code");
    }

    const location = await prisma.location.create({
      data: {
        organizationId,
        name,
        code,
        address: data.address ? String(data.address) : null,
        latitude: data.latitude !== undefined && data.latitude !== null && data.latitude !== ""
          ? Number(data.latitude)
          : null,
        longitude: data.longitude !== undefined && data.longitude !== null && data.longitude !== ""
          ? Number(data.longitude)
          : null,
        managerName: data.managerName ? String(data.managerName) : null,
        phone: data.phone ? String(data.phone) : null,
        email: data.email ? String(data.email) : null,
        openingHours: data.openingHours ? String(data.openingHours) : null,
        openingScheduleJson: data.openingScheduleJson ? String(data.openingScheduleJson) : null,
        imageUrl: data.imageUrl ? String(data.imageUrl) : null,
        notes: data.notes ? String(data.notes) : null,
        timezone: data.timezone ? String(data.timezone) : "America/Mexico_City",
        allowsPickup: data.allowsPickup !== false,
        allowsDelivery: data.allowsDelivery === true,
        isActive: data.isActive !== false,
      },
      include: { _count: { select: { cashRegisters: true, sales: true } } },
    });
    return serialize(location);
  },

  async update(organizationId, id, input, _ctx) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.location.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Sucursal no encontrada", 404);

    if (data.code) {
      const dup = await prisma.location.findFirst({
        where: { organizationId, code: String(data.code).trim(), id: { not: id } },
      });
      if (dup) throw new CrudError("Ese código de sucursal ya existe", 400, "code");
    }

    const location = await prisma.location.update({
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
        ...(data.allowsPickup !== undefined ? { allowsPickup: data.allowsPickup !== false } : {}),
        ...(data.allowsDelivery !== undefined ? { allowsDelivery: data.allowsDelivery === true } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive !== false } : {}),
      },
      include: { _count: { select: { cashRegisters: true, sales: true } } },
    });
    return serialize(location);
  },

  async remove(organizationId, id) {
    const l = await prisma.location.findFirst({
      where: { id, organizationId },
    });
    if (!l) throw new CrudError("Sucursal no encontrada", 404);
    // Soft-delete: deactivate location to preserve history.
    await prisma.location.update({ where: { id }, data: { isActive: false } });
  },
};