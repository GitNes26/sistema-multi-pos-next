import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface UnitDto {
  id: string;
  name: string;
  abbreviation: string;
  type: string;
  baseUnit: string | null;
  conversionFactor: number;
  isActive: boolean;
  isSystem: boolean;
}

const select = {
  id: true,
  name: true,
  abbreviation: true,
  type: true,
  baseUnit: true,
  conversionFactor: true,
  isActive: true,
  organizationId: true,
} as const;

function serialize(u: {
  id: string;
  name: string;
  abbreviation: string;
  type: string;
  baseUnit: string | null;
  conversionFactor: { toNumber(): number } | number;
  isActive: boolean;
  organizationId: string | null;
}): UnitDto {
  return {
    id: u.id,
    name: u.name,
    abbreviation: u.abbreviation,
    type: u.type,
    baseUnit: u.baseUnit,
    conversionFactor: typeof u.conversionFactor === "number" ? u.conversionFactor : u.conversionFactor.toNumber(),
    isActive: u.isActive,
    isSystem: u.organizationId === null,
  };
}

export const unitsModule: CrudModule<UnitDto> = {
  key: "units",

  async list(organizationId, params: ListParams): Promise<CrudListResult<UnitDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";

    const where = {
      OR: [{ organizationId }, { organizationId: null }],
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { abbreviation: { contains: q.toUpperCase() } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.unitOfMeasure.findMany({
        where,
        select,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.unitOfMeasure.count({ where }),
    ]);

    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const u = await prisma.unitOfMeasure.findFirst({
      where: { id, OR: [{ organizationId }, { organizationId: null }] },
      select,
    });
    if (!u) throw new CrudError("Unidad no encontrada", 404);
    return serialize(u);
  },

  async create(organizationId, input) {
    const data = input as { name?: string; abbreviation?: string; type?: string; baseUnit?: string | null; conversionFactor?: number; isActive?: boolean };
    if (!data.name?.trim()) throw new CrudError("El nombre es obligatorio", 400, "name");
    if (!data.abbreviation?.trim()) throw new CrudError("La abreviatura es obligatoria", 400, "abbreviation");
    const abbreviation = data.abbreviation.trim().toLowerCase();

    const exists = await prisma.unitOfMeasure.findFirst({
      where: { abbreviation, OR: [{ organizationId }, { organizationId: null }] },
    });
    if (exists) throw new CrudError("Ya existe una unidad con esa abreviatura", 400, "abbreviation");

    const u = await prisma.unitOfMeasure.create({
      data: {
        organizationId,
        name: data.name.trim(),
        abbreviation,
        type: data.type ?? "custom",
        baseUnit: data.baseUnit ?? null,
        conversionFactor: data.conversionFactor ?? 1,
        isActive: data.isActive ?? true,
      },
      select,
    });
    return serialize(u);
  },

  async update(organizationId, id, input) {
    const data = input as { name?: string; abbreviation?: string; type?: string; baseUnit?: string | null; conversionFactor?: number; isActive?: boolean };
    const existing = await prisma.unitOfMeasure.findFirst({
      where: { id, OR: [{ organizationId }, { organizationId: null }] },
      select: { id: true, organizationId: true },
    });
    if (!existing) throw new CrudError("Unidad no encontrada", 404);

    const abbreviation = data.abbreviation?.trim().toLowerCase();
    if (abbreviation && abbreviation !== existing.id) {
      const dup = await prisma.unitOfMeasure.findFirst({
        where: { abbreviation, id: { not: id }, OR: [{ organizationId }, { organizationId: null }] },
      });
      if (dup) throw new CrudError("Ya existe una unidad con esa abreviatura", 400, "abbreviation");
    }

    const u = await prisma.unitOfMeasure.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.abbreviation !== undefined ? { abbreviation: abbreviation! } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.baseUnit !== undefined ? { baseUnit: data.baseUnit } : {}),
        ...(data.conversionFactor !== undefined ? { conversionFactor: data.conversionFactor } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select,
    });
    return serialize(u);
  },

  async remove(organizationId, id) {
    const existing = await prisma.unitOfMeasure.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new CrudError("Unidad no encontrada", 404);

    const [bulkUses, splitUses, inventoryUses] = await Promise.all([
      prisma.product.count({ where: { organizationId, bulkUnitId: id } }),
      prisma.product.count({ where: { organizationId, splitUnitId: id } }),
      prisma.inventory.count({ where: { organizationId, unitId: id } }),
    ]);
    if (bulkUses + splitUses + inventoryUses > 0) {
      throw new CrudError("La unidad está en uso por productos o inventario", 409);
    }
    await prisma.unitOfMeasure.delete({ where: { id } });
  },
};