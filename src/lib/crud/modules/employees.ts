import { $Enums } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword, setMembership, verifyPassword } from "@/lib/auth/users";
import { mailConfigured, sendWelcomeLink } from "@/lib/auth/mail";
import { roleAllowedInOrg, roleIdToEnum } from "@/lib/settings/system-roles";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface EmployeeDto {
  id: string;
  employeeCode: string | null;
  fullName: string;
  role: string;
  roleId: string | null;
  positionId: string | null;
  positionName: string | null;
  locationId: string | null;
  locationName: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  salaryType: string;
  salaryAmount: number;
  paymentFrequency: string;
  isActive: boolean;
  salesCount: number;
}

/** Roles de acceso asignables a un empleado (se crea su cuenta de usuario). */
const EMPLOYEE_ROLES = ["owner", "admin", "manager", "cashier"] as const satisfies readonly $Enums.OrgRole[];

async function resolveEmployeeRole(organizationId: string, actorId: string, data: Record<string, unknown>) {
  const [actor, actorMembership] = await Promise.all([
    prisma.user.findUnique({ where: { id: actorId }, select: { isSuperadmin: true } }),
    prisma.membership.findUnique({ where: { userId_organizationId: { userId: actorId, organizationId } }, select: { role: true } }),
  ]);
  const mayAssignOwner = Boolean(actor?.isSuperadmin || actorMembership?.role === "owner");
  const roleId = typeof data.roleId === "string" ? data.roleId : "";
  if (roleId) {
    const [role, organization] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleId }, select: { id: true, isSystem: true, businessMode: true, organizationId: true } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } }),
    ]);
    if (!role || !roleAllowedInOrg(role, organization?.businessMode ?? "retail", organizationId)) throw new CrudError("Rol no disponible para esta empresa", 400, "roleId");
    if (["system-admin", "system-superadmin"].includes(role.id) && !actor?.isSuperadmin) throw new CrudError("No puedes asignar este rol", 403, "roleId");
    if (role.id === "system-owner" && !mayAssignOwner) throw new CrudError("Solo el propietario puede asignar este rol", 403, "roleId");
    return { role: roleIdToEnum(roleId), roleId };
  }
  const raw = typeof data.role === "string" ? data.role : "";
  if (!(EMPLOYEE_ROLES as readonly string[]).includes(raw)) throw new CrudError("Selecciona un rol", 400, "roleId");
  if (raw === "admin" && !actor?.isSuperadmin) throw new CrudError("No puedes asignar este rol", 403, "roleId");
  if (raw === "owner" && !mayAssignOwner) throw new CrudError("Solo el propietario puede asignar este rol", 403, "roleId");
  return { role: raw as $Enums.OrgRole, roleId: null };
}

type EmployeeRow = {
  id: string;
  employeeCode: string | null;
  fullName: string;
  positionId: string | null;
  locationId: string | null;
  phone: string | null;
  imageUrl: string | null;
  salaryType: string;
  salaryAmount: unknown;
  paymentFrequency: string;
  isActive: boolean;
  userId: string;
  position: { name: string } | null;
  location: { name: string } | null;
  user: { email: string | null; memberships: { role: string; roleId: string | null; roleRef: { name: string } | null }[] } | null;
  _count: { sales: number };
};

function serialize(e: EmployeeRow): EmployeeDto {
  const membership = e.user?.memberships?.[0];
  const role = membership?.roleRef?.name ?? membership?.role ?? "cashier";
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    fullName: e.fullName,
    role,
    roleId: membership?.roleId ?? null,
    positionId: e.positionId,
    positionName: e.position?.name ?? null,
    locationId: e.locationId,
    locationName: e.location?.name ?? null,
    phone: e.phone,
    email: e.user?.email ?? null,
    imageUrl: e.imageUrl,
    salaryType: e.salaryType || "",
    salaryAmount: Number(e.salaryAmount) || 0,
    paymentFrequency: e.paymentFrequency || "biweekly",
    isActive: e.isActive,
    salesCount: e._count.sales,
  };
}

async function nextEmployeeCode(organizationId: string): Promise<string> {
  const rows = await prisma.employee.findMany({
    where: { organizationId, employeeCode: { startsWith: "EMP-" } },
    select: { employeeCode: true },
  });
  const max = rows.reduce((current, row) => {
    const value = Number(row.employeeCode?.slice(4));
    return Number.isInteger(value) ? Math.max(current, value) : current;
  }, 0);
  return `EMP-${String(max + 1).padStart(4, "0")}`;
}

export const employeesModule: CrudModule<EmployeeDto> = {
  key: "employees",

  async createDefaults(organizationId) {
    return { employeeCode: await nextEmployeeCode(organizationId), isActive: true };
  },

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
          user: { select: { email: true, memberships: { where: { organizationId }, select: { role: true, roleId: true, roleRef: { select: { name: true } } } } } },
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
        user: { select: { email: true, memberships: { where: { organizationId }, select: { role: true, roleId: true, roleRef: { select: { name: true } } } } } },
        _count: { select: { sales: true } },
      },
    });
    if (!e) throw new CrudError("Empleado no encontrado", 404);
    return serialize(e as EmployeeRow);
  },

  async create(organizationId, input, ctx) {
    const data = input as Record<string, unknown>;
    const fullName = data.fullName ? String(data.fullName).trim() : "";
    if (!fullName) throw new CrudError("El nombre es obligatorio", 400, "fullName");
    const employeeCode = data.employeeCode
      ? String(data.employeeCode).trim().toUpperCase()
      : await nextEmployeeCode(organizationId);

    const dupCode = await prisma.employee.findFirst({ where: { organizationId, employeeCode } });
    if (dupCode) throw new CrudError("Ese código de nómina ya existe", 400, "employeeCode");

    const emailRaw = data.email ? String(data.email).trim().toLowerCase() : "";
    const phone = data.phone ? String(data.phone).trim() : null;
    if (emailRaw) {
      if (process.env.NODE_ENV === "production" && !mailConfigured()) throw new CrudError("Configura el correo SMTP antes de registrar empleados con acceso", 503, "email");
      const dupEmail = await prisma.user.findUnique({ where: { email: emailRaw } });
      if (dupEmail) throw new CrudError("Ya existe un usuario con ese correo", 400, "email");
    }
    if (phone) {
      const dupPhone = await prisma.employee.findFirst({ where: { organizationId, phone } });
      if (dupPhone) throw new CrudError("Ya existe un empleado con ese teléfono", 400, "phone");
    }

    const email = emailRaw || `emp-${employeeCode.toLowerCase()}@empresa.local`;
    const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
    const assignment = await resolveEmployeeRole(organizationId, ctx.userId, data);
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

    const salaryType = data.salaryType ? String(data.salaryType) : "";
    const salaryAmount = data.salaryAmount != null ? Number(data.salaryAmount) : 0;
    const paymentFrequency = data.paymentFrequency ? String(data.paymentFrequency) : "biweekly";

    try {
      await setMembership(user.id, organizationId, assignment.role);
      if (assignment.roleId) await prisma.membership.update({ where: { userId_organizationId: { userId: user.id, organizationId } }, data: { roleId: assignment.roleId } });
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
          salaryType,
          salaryAmount,
          paymentFrequency,
          isActive: data.isActive !== false,
        },
        include: {
          position: { select: { name: true } },
          location: { select: { name: true } },
          user: { select: { email: true, memberships: { where: { organizationId }, select: { role: true, roleId: true, roleRef: { select: { name: true } } } } } },
          _count: { select: { sales: true } },
        },
      });
      if (emailRaw && mailConfigured()) await sendWelcomeLink(emailRaw);
      return serialize(employee as EmployeeRow);
    } catch (err) {
      // Cleanup orphaned user/membership on create failure
      await prisma.employee.deleteMany({ where: { userId: user.id, organizationId } }).catch((cleanupErr) => console.error("[employees] cleanup employee failed:", cleanupErr));
      await prisma.membership.deleteMany({ where: { userId: user.id, organizationId } }).catch((cleanupErr) => console.error("[employees] cleanup membership failed:", cleanupErr));
      await prisma.user.delete({ where: { id: user.id } }).catch((cleanupErr) => console.error("[employees] cleanup user failed:", cleanupErr));
      throw err;
    }
  },

  async update(organizationId, id, input, ctx) {
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
    if (emailRaw && emailRaw !== existing.user?.email && process.env.NODE_ENV === "production" && !mailConfigured()) {
      throw new CrudError("Configura el correo SMTP antes de cambiar el correo de acceso", 503, "email");
    }
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

    // Las cuentas heredadas con contraseña igual al correo reciben un enlace
    // para elegir una nueva; nunca sustituimos el secreto por el nuevo correo.
    if (emailRaw && emailRaw !== existing.user?.email) {
      const userRow = await prisma.user.findUnique({
        where: { id: existing.userId },
        select: { passwordHash: true },
      });
      if (userRow && (await verifyPassword(existing.user?.email ?? "", userRow.passwordHash)) && mailConfigured()) {
        await sendWelcomeLink(emailRaw);
        await prisma.user.update({
          where: { id: existing.userId },
          data: { passwordHash: await hashPassword(randomBytes(32).toString("hex")) },
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

    if (data.roleId !== undefined || data.role !== undefined) {
      const assignment = await resolveEmployeeRole(organizationId, ctx.userId, data);
      await setMembership(existing.userId, organizationId, assignment.role);
      await prisma.membership.update({ where: { userId_organizationId: { userId: existing.userId, organizationId } }, data: { roleId: assignment.roleId } });
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
        ...(data.salaryType !== undefined ? { salaryType: String(data.salaryType) } : {}),
        ...(data.salaryAmount !== undefined ? { salaryAmount: Number(data.salaryAmount) } : {}),
        ...(data.paymentFrequency !== undefined ? { paymentFrequency: String(data.paymentFrequency) } : {}),
        isActive,
      },
      include: {
        position: { select: { name: true } },
        location: { select: { name: true } },
        user: { select: { email: true, memberships: { where: { organizationId }, select: { role: true, roleId: true, roleRef: { select: { name: true } } } } } },
        _count: { select: { sales: true } },
      },
    });
    return serialize(employee as EmployeeRow);
  },

  async remove(organizationId, id) {
    const e = await prisma.employee.findFirst({
      where: { id, organizationId },
    });
    if (!e) throw new CrudError("Empleado no encontrado", 404);
    // Soft-delete: deactivate employee and user instead of hard delete to preserve history.
    await prisma.$transaction([
      prisma.employee.update({ where: { id }, data: { isActive: false } }),
      prisma.user.update({ where: { id: e.userId }, data: { isActive: false } }),
    ]);
  },
};
