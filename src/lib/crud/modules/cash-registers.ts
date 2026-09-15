import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface CashRegisterDto {
  id: string;
  name: string;
  folioPrefix: string | null;
  locationId: string;
  locationName: string | null;
  isActive: boolean;
  openSessionCount: number;
  salesCount: number;
}

const select = {
  id: true,
  name: true,
  folioPrefix: true,
  locationId: true,
  isActive: true,
  location: { select: { name: true, code: true } },
  _count: { select: { cashSessions: true, sales: true } },
} as const;

type CashRegisterRow = {
  id: string;
  name: string;
  folioPrefix: string | null;
  locationId: string;
  isActive: boolean;
  location: { name: string; code: string | null } | null;
  _count: { cashSessions: number; sales: number };
};

function serialize(r: CashRegisterRow): CashRegisterDto {
  return {
    id: r.id,
    name: r.name,
    folioPrefix: r.folioPrefix,
    locationId: r.locationId,
    locationName: r.location?.name ?? null,
    isActive: r.isActive,
    openSessionCount: r._count.cashSessions,
    salesCount: r._count.sales,
  };
}

function buildPrefix(location: { code: string | null; name: string }, registerName: string) {
  const loc = (location.code || location.name).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").slice(0, 6) || "SUC";
  const clean = registerName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const abbreviation = (words.length > 1 ? words.map((word) => word[0]).join("") : clean.slice(0, 3)).slice(0, 4) || "CJ";
  return `${loc}-${abbreviation}`.slice(0, 10);
}

export const cashRegistersModule: CrudModule<CashRegisterDto> = {
  key: "cashRegisters",

  async list(organizationId, params: ListParams): Promise<CrudListResult<CashRegisterDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const locationId = (params.locationId as string) || undefined;

    const where: { organizationId: string; location?: { is: { organizationId: string } }; locationId?: string; OR?: { name: { contains: string } }[] } = {
      organizationId,
      ...(locationId ? { locationId } : {}),
      ...(q ? { OR: [{ name: { contains: q } }] } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.cashRegister.findMany({
        where,
        select,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cashRegister.count({ where }),
    ]);

    return { rows: rows.map((r) => serialize(r as unknown as CashRegisterRow)), total };
  },

  async get(organizationId, id) {
    const r = await prisma.cashRegister.findFirst({
      where: { id, organizationId },
      select,
    });
    if (!r) throw new CrudError("Caja no encontrada", 404);
    return serialize(r as unknown as CashRegisterRow);
  },

  async create(organizationId, input) {
    const data = input as Record<string, unknown>;
    const name = data.name ? String(data.name).trim() : "";
    if (!name) throw new CrudError("El nombre es obligatorio", 400, "name");
    const locationId = data.locationId ? String(data.locationId) : "";
    if (!locationId) throw new CrudError("Selecciona una sucursal", 400, "locationId");

    const location = await prisma.location.findFirst({ where: { id: locationId, organizationId } });
    if (!location) throw new CrudError("La sucursal no existe", 400, "locationId");

    // Auto-generate folioPrefix: [locationCode]-[Caja#] if not provided
    let folioPrefix = data.folioPrefix ? String(data.folioPrefix).trim() : null;
    if (!folioPrefix) {
      folioPrefix = buildPrefix(location, name);
    }

    const r = await prisma.cashRegister.create({
      data: {
        organizationId,
        locationId,
        name,
        folioPrefix,
        isActive: data.isActive !== false,
      },
      select,
    });
    return serialize(r as unknown as CashRegisterRow);
  },

  async update(organizationId, id, input) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.cashRegister.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Caja no encontrada", 404);

    let targetLocation = await prisma.location.findFirst({ where: { id: existing.locationId, organizationId } });
    if (data.locationId) {
      targetLocation = await prisma.location.findFirst({
        where: { id: String(data.locationId), organizationId },
      });
      if (!targetLocation) throw new CrudError("La sucursal no existe", 400, "locationId");
    }
    const nextName = data.name !== undefined ? String(data.name).trim() || existing.name : existing.name;
    const nextPrefix = data.folioPrefix !== undefined
      ? (data.folioPrefix ? String(data.folioPrefix).trim().toUpperCase() : null)
      : targetLocation ? buildPrefix(targetLocation, nextName) : existing.folioPrefix;

    const r = await prisma.cashRegister.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: nextName } : {}),
        ...(data.locationId !== undefined ? { locationId: String(data.locationId) } : {}),
        ...((data.folioPrefix !== undefined || data.name !== undefined || data.locationId !== undefined) ? { folioPrefix: nextPrefix } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive !== false } : {}),
      },
      select,
    });
    return serialize(r as unknown as CashRegisterRow);
  },

  async remove(organizationId, id) {
    const r = await prisma.cashRegister.findFirst({
      where: { id, organizationId },
    });
    if (!r) throw new CrudError("Caja no encontrada", 404);
    // Soft-delete: deactivate cash register to preserve history.
    await prisma.cashRegister.update({ where: { id }, data: { isActive: false } });
  },
};
