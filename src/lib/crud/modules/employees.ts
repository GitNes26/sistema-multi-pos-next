import { $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, setMembership, verifyPassword } from "@/lib/auth/users";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface EmployeeDto {
  id: string;
  employeeCode: string | null;
  fullName: string;
  role: string;
  positionId: string | null;
  positionName: string | null;
  locationId: string | null;
  locationName: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  isActive: boolean;
  salesCount: number;
}

/** Roles de acceso asignables a un empleado (se crea su cuenta de usuario). */
const EMPLOYEE_ROLES = ["owner", "admin", "manager", "cashier"] as const satisfies readonly $Enums.OrgRole[];

type EmployeeRow = {
  id: string;
  employeeCode: string | null;
  fullName: string;
  positionId: string | null;
  locationId: string | null;
  phone: string | null;
  imageUrl: string | null;
  isActive: boolean;
  userId: string;
  position: { name: string } | null;
  location: { name: string } | null;
  user: { email: string | null; memberships: { role: string }[] } | null;
  _count: { sales: number };
};

function serialize(e: EmployeeRow): EmployeeDto {
  const role = e.user?.memberships?.[0]?.role ?? "cashier";
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    fullName: e.fullName,
    role,
    positionId: e.positionId,
    positionName: e.position?.name ?? null,
    locationId: e.locationId,
    locationName: e.location?.name ?? null,
    phone: e.phone,
    email: e.user?.email ?? null,
    imageUrl: e.imageUrl,
    isActive: e.isActive,
    salesCount: e._count.sales,
  };
}

export const employeesModule: CrudModule<EmployeeDto> = {
  key: "employees",

  async list(organizationId, params: ListParams): Promise<CrudListResult<EmployeeDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const positionId = (params.positionId as string) || undefined;

    const where = {
      organizationId,
      ...(positionId ? { positionId } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q } },
              { employeeCode: { contains: q.toUpperCase() } },
              { phone: { contains: q } },
              { user: { email: { contains: q } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          position: { select: { name: true } },
          location: { select: { name: true } },
          user: { select: { email: true, memberships: { where: { organizationId }, select: { role: true } } } },
          _count: { select: { sales: true } },
        },
        orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      rows: rows.map((e) => serialize(e as EmployeeRow)),
      total,
    };
  },

  async get(organizationId, id) {
    const e = await prisma.employee.findFirst({
      where: { id, organizationId },
      include: {
        position: { select: { name: true } },
        location: { select: { name: true } },
        user: { select: { email: true, memberships: { where: { organizationId }, select: { role: true } } } },
        _count: { select: { sales: true } },
      },
    });
    if (!e) throw new CrudError("Empleado no encontrado", 404);
    return serialize(e as EmployeeRow);
  },

  async create(organizationId, input, _ctx) {
    const data = input as Record<string, unknown>;
    const fullName = data.fullName ? String(data.fullName).trim() : "";
    if (!fullName) throw new CrudError("El nombre es obligatorio", 400, "fullName");
    const employeeCode = data.employeeCode ? String(data.employeeCode).trim().toUpperCase() : "";
    if (!employeeCode) throw new CrudError("El código de nómina es obligatorio", 400, "employeeCode");

    const dupCode = await prisma.employee.findFirst({ where: { organizationId, employeeCode } });
    if (dupCode) throw new CrudError("Ese código de nómina ya existe", 400, "employeeCode");

    const emailRaw = data.email ? String(data.email).trim().toLowerCase() : "";
    const phone = data.phone ? String(data.phone).trim() : null;
    if (emailRaw) {
      const dupEmail = await prisma.user.findUnique({ where: { email: emailRaw } });
      if (dupEmail) throw new CrudError("Ya existe un usuario con ese correo", 400, "email");
    }
    if (phone) {
      const dupPhone = await prisma.employee.findFirst({ where: { organizationId, phone } });
      if (dupPhone) throw new CrudError("Ya existe un empleado con ese teléfono", 400, "phone");
    }

    const email = emailRaw || `emp-${employeeCode.toLowerCase()}@empresa.local`;
    // Contraseña inicial = correo (el empleado la cambia en su primer acceso).
    const passwordHash = await hashPassword(email);
    const roleRaw = data.role ? String(data.role) : "";
    const role: $Enums.OrgRole =
      (EMPLOYEE_ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as $Enums.OrgRole) : "cashier";
    const positionId = data.positionId ? String(data.positionId) : null;
    if (positionId) {
      const pos = await prisma.employeePosition.findFirst({ where: { id: positionId, organizationId } });
      if (!pos) throw new CrudError("El puesto no existe", 400, "positionId");
    }
    const locationId = data.locationId ? String(data.locationId) : null;
    if (locationId) {
      const loc = await prisma.location.findFirst({ where: { id: locationId, organizationId } });
      if (!loc) throw new CrudError("La sucursal no existe", 400, "locationId");
    }

    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, phone, isActive: true },
    });

    try {
      await setMembership(user.id, organizationId, role);
      const employee = await prisma.employee.create({
        data: {
          organizationId,
          userId: user.id,
          employeeCode,
          positionId,
          locationId,
          fullName,
          phone,
          imageUrl: data.imageUrl ? String(data.imageUrl) : null,
          isActive: data.isActive !== false,
        },
        include: {
          position: { select: { name: true } },
          location: { select: { name: true } },
          user: { select: { email: true, memberships: { where: { organizationId }, select: { role: true } } } },
          _count: { select: { sales: true } },
        },
      });
      return serialize(employee as EmployeeRow);
    } catch (err) {
      await prisma.membership.deleteMany({ where: { userId: user.id, organizationId } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      throw err;
    }
  },

  async update(organizationId, id, input, _ctx) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.employee.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        userId: true,
        employeeCode: true,
        phone: true,
        fullName: true,
        isActive: true,
        user: { select: { email: true } },
      },
    });
    if (!existing) throw new CrudError("Empleado no encontrado", 404);

    const employeeCode =
      data.employeeCode !== undefined
        ? String(data.employeeCode).trim().toUpperCase()
        : existing.employeeCode ?? "";
    if (employeeCode && employeeCode !== existing.employeeCode) {
      const dup = await prisma.employee.findFirst({
        where: { organizationId, employeeCode, id: { not: id } },
      });
      if (dup) throw new CrudError("Ese código de nómina ya existe", 400, "employeeCode");
    }

    const phone = data.phone !== undefined ? (data.phone ? String(data.phone).trim() : null) : existing.phone;
    if (phone && phone !== existing.phone) {
      const dupPhone = await prisma.employee.findFirst({
        where: { organizationId, phone, id: { not: id } },
      });
      if (dupPhone) throw new CrudError("Ya existe un empleado con ese teléfono", 400, "phone");
    }

    const emailRaw = data.email !== undefined ? (data.email ? String(data.email).trim().toLowerCase() : null) : undefined;
    if (emailRaw) {
      const dupEmail = await prisma.user.findFirst({
        where: { email: emailRaw, id: { not: existing.userId } },
      });
      if (dupEmail) throw new CrudError("Ya existe un usuario con ese correo", 400, "email");
    }

    const fullName =
      data.fullName !== undefined
        ? String(data.fullName).trim() || existing.fullName
        : undefined;

    const isActive = data.isActive !== undefined ? data.isActive !== false : existing.isActive;

    await prisma.user.update({
      where: { id: existing.userId },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(phone ? { phone } : {}),
        ...(emailRaw ? { email: emailRaw } : {}),
        isActive,
      },
    });

    // Si el correo cambió y la contraseña sigue siendo la default (el correo anterior),
    // se resetea para que coincida con el nuevo correo.
    if (emailRaw && emailRaw !== existing.user?.email) {
      const userRow = await prisma.user.findUnique({
        where: { id: existing.userId },
        select: { passwordHash: true },
      });
      if (userRow && (await verifyPassword(existing.user?.email ?? "", userRow.passwordHash))) {
        await prisma.user.update({
          where: { id: existing.userId },
          data: { passwordHash: await hashPassword(emailRaw) },
        });
      }
    }

    if (data.positionId) {
      const pos = await prisma.employeePosition.findFirst({
        where: { id: String(data.positionId), organizationId },
      });
      if (!pos) throw new CrudError("El puesto no existe", 400, "positionId");
    }
    if (data.locationId) {
      const loc = await prisma.location.findFirst({
        where: { id: String(data.locationId), organizationId },
      });
      if (!loc) throw new CrudError("La sucursal no existe", 400, "locationId");
    }

    if (data.role !== undefined) {
      const roleRaw = String(data.role);
      if (!(EMPLOYEE_ROLES as readonly string[]).includes(roleRaw)) {
        throw new CrudError("Rol inválido", 400, "role");
      }
      await setMembership(existing.userId, organizationId, roleRaw as $Enums.OrgRole);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(employeeCode ? { employeeCode } : {}),
        ...(data.positionId !== undefined
          ? { positionId: data.positionId ? String(data.positionId) : null }
          : {}),
        ...(data.locationId !== undefined
          ? { locationId: data.locationId ? String(data.locationId) : null }
          : {}),
        ...(data.phone !== undefined ? { phone } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl ? String(data.imageUrl) : null } : {}),
        isActive,
      },
      include: {
        position: { select: { name: true } },
        location: { select: { name: true } },
        user: { select: { email: true, memberships: { where: { organizationId }, select: { role: true } } } },
        _count: { select: { sales: true } },
      },
    });
    return serialize(employee as EmployeeRow);
  },

  async remove(organizationId, id) {
    const e = await prisma.employee.findFirst({
      where: { id, organizationId },
      include: {
        _count: { select: { cashSessions: true, sales: true, inventoryMovements: true, inventoryRevisions: true } },
      },
    });
    if (!e) throw new CrudError("Empleado no encontrado", 404);
    if (e._count.cashSessions > 0 || e._count.sales > 0 || e._count.inventoryMovements > 0 || e._count.inventoryRevisions > 0) {
      throw new CrudError("No se puede eliminar: tiene ventas, cajas o movimientos", 409);
    }
    await prisma.$transaction([
      prisma.employee.delete({ where: { id } }),
      prisma.membership.deleteMany({ where: { userId: e.userId, organizationId } }),
      prisma.user.delete({ where: { id: e.userId } }),
    ]);
  },
};