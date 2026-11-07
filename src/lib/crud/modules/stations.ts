import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

// Lugares de atención: silla, bahía, cabina. Se desactivan (no se borran) para conservar el historial.

export interface StationDto {
  id: string;
  name: string;
  kind: string;
  locationId: string | null;
  locationName: string | null;
  defaultEmployeeId: string | null;
  defaultEmployeeName: string | null;
  sortOrder: number;
  isActive: boolean;
}

const KINDS = ["bay", "stall", "lane", "chair", "booth", "other"];
const include = { location: { select: { name: true } }, defaultEmployee: { select: { fullName: true } } } as const;

type Row = {
  id: string;
  name: string;
  kind: string;
  locationId: string | null;
  defaultEmployeeId: string | null;
  sortOrder: number;
  isActive: boolean;
  location: { name: string } | null;
  defaultEmployee: { fullName: string } | null;
};

const serialize = (s: Row): StationDto => ({
  id: s.id,
  name: s.name,
  kind: s.kind,
  locationId: s.locationId,
  locationName: s.location?.name ?? null,
  defaultEmployeeId: s.defaultEmployeeId,
  defaultEmployeeName: s.defaultEmployee?.fullName ?? null,
  sortOrder: s.sortOrder,
  isActive: s.isActive,
});

async function refs(organizationId: string, d: Record<string, unknown>) {
  const locationId = typeof d.locationId === "string" && d.locationId ? d.locationId : null;
  const employeeId = typeof d.defaultEmployeeId === "string" && d.defaultEmployeeId ? d.defaultEmployeeId : null;
  if (locationId && !(await prisma.location.findFirst({ where: { id: locationId, organizationId }, select: { id: true } }))) {
    throw new CrudError("La sucursal no pertenece a la empresa activa", 400, "locationId");
  }
  if (employeeId && !(await prisma.employee.findFirst({ where: { id: employeeId, organizationId }, select: { id: true } }))) {
    throw new CrudError("El empleado no pertenece a la empresa activa", 400, "defaultEmployeeId");
  }
  return { locationId, defaultEmployeeId: employeeId };
}

export const stationsModule: CrudModule<StationDto> = {
  key: "stations",

  async list(organizationId, params: ListParams): Promise<CrudListResult<StationDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const where = {
      organizationId,
      ...(params.locationId ? { locationId: String(params.locationId) } : {}),
      ...(q ? { name: { contains: q } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.serviceStation.findMany({ where, include, orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.serviceStation.count({ where }),
    ]);
    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const s = await prisma.serviceStation.findFirst({ where: { id, organizationId }, include });
    if (!s) throw new CrudError("Lugar no encontrado", 404);
    return serialize(s);
  },

  async create(organizationId, input) {
    const d = input as Record<string, unknown>;
    const name = typeof d.name === "string" ? d.name.trim().slice(0, 80) : "";
    if (!name) throw new CrudError("El nombre es obligatorio", 400, "name");
    const s = await prisma.serviceStation.create({
      data: {
        organizationId,
        name,
        kind: KINDS.includes(String(d.kind)) ? String(d.kind) : "bay",
        sortOrder: Number.isFinite(Number(d.sortOrder)) ? Math.trunc(Number(d.sortOrder)) : 0,
        isActive: d.isActive !== false,
        ...(await refs(organizationId, d)),
      },
      include,
    });
    return serialize(s);
  },

  async update(organizationId, id, input) {
    const d = input as Record<string, unknown>;
    const existing = await prisma.serviceStation.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Lugar no encontrado", 404);
    const name = d.name !== undefined ? String(d.name).trim().slice(0, 80) : existing.name;
    if (!name) throw new CrudError("El nombre es obligatorio", 400, "name");
    const r =
      d.locationId !== undefined || d.defaultEmployeeId !== undefined
        ? await refs(organizationId, {
            locationId: d.locationId !== undefined ? d.locationId : existing.locationId,
            defaultEmployeeId: d.defaultEmployeeId !== undefined ? d.defaultEmployeeId : existing.defaultEmployeeId,
          })
        : {};
    const s = await prisma.serviceStation.update({
      where: { id },
      data: {
        name,
        ...r,
        ...(d.kind !== undefined && KINDS.includes(String(d.kind)) ? { kind: String(d.kind) } : {}),
        ...(d.sortOrder !== undefined && Number.isFinite(Number(d.sortOrder)) ? { sortOrder: Math.trunc(Number(d.sortOrder)) } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive !== false } : {}),
      },
      include,
    });
    return serialize(s);
  },

  async remove(organizationId, id) {
    const s = await prisma.serviceStation.findFirst({ where: { id, organizationId } });
    if (!s) throw new CrudError("Lugar no encontrado", 404);
    await prisma.serviceStation.update({ where: { id }, data: { isActive: false } });
  },
};
