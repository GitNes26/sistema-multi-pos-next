import { prisma } from "@/lib/db";
import type { $Enums, Prisma } from "@prisma/client";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

// FASE 15 — Servidor de ajustes: empresa, perfil, usuarios, roles, invitaciones,
// lealtad y supervisor.

const toNum = (v: Prisma.Decimal | number | string | null): number =>
  v == null ? 0 : Number(v);

// ── Empresa (15.2) ───────────────────────────────────────────────────────────

export interface CompanyProfileInput {
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  ticketFooter?: string | null;
}

export async function getCompanyProfile(organizationId: string) {
  return prisma.companyProfile.findUnique({ where: { organizationId } });
}

export async function upsertCompanyProfile(organizationId: string, input: CompanyProfileInput) {
  const existing = await prisma.companyProfile.findUnique({ where: { organizationId } });
  if (existing) {
    return prisma.companyProfile.update({ where: { id: existing.id }, data: input });
  }
  return prisma.companyProfile.create({ data: { organizationId, ...input } });
}

// ── Perfil de usuario (15.1) ────────────────────────────────────────────────

export interface ProfileInput {
  fullName?: string;
  phone?: string | null;
  email?: string;
  avatarUrl?: string | null;
}

export async function getMyProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, avatarUrl: true, phone: true },
  });
}

export async function updateMyProfile(userId: string, input: ProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
    select: { id: true, email: true, fullName: true, avatarUrl: true, phone: true },
  });
}

// ── Usuarios (15.4) ─────────────────────────────────────────────────────────

export interface OrgUserRow {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  role: string;
  isEmployee: boolean;
}

export async function listOrgUsers(organizationId: string): Promise<OrgUserRow[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, isActive: true } } },
    orderBy: { createdAt: "asc" },
  });

  const employeeUserIds = new Set(
    (
      await prisma.employee.findMany({
        where: { organizationId },
        select: { userId: true },
      })
    ).map((e) => e.userId)
  );

  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    fullName: m.user.fullName,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    isActive: m.user.isActive,
    role: m.role,
    isEmployee: employeeUserIds.has(m.user.id),
  }));
}

export async function updateMembershipRole(
  membershipId: string,
  role: string
): Promise<{ ok: boolean }> {
  if (!["owner", "manager", "cashier"].includes(role)) {
    throw new Error("Rol inválido");
  }
  await prisma.membership.update({
    where: { id: membershipId },
    data: { role: role as $Enums.OrgRole },
  });
  return { ok: true };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<{ ok: boolean }> {
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  return { ok: true };
}

export async function removeMembership(membershipId: string): Promise<{ ok: boolean }> {
  await prisma.membership.delete({ where: { id: membershipId } });
  return { ok: true };
}

// ── Roles (14.x / 15.4) ─────────────────────────────────────────────────────

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  organizationId: string | null;
  permissionCount: number;
}

export async function listRoles(organizationId: string): Promise<RoleRow[]> {
  const roles = await prisma.role.findMany({
    where: { OR: [{ isSystem: true }, { organizationId }] },
    include: { _count: { select: { permissions: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    organizationId: r.organizationId,
    permissionCount: r._count.permissions,
  }));
}

export async function getRolePermissions(roleId: string): Promise<string[]> {
  const rps = await prisma.rolePermission.findMany({
    where: { roleId, organizationId: null },
    select: { permissionKey: true },
  });
  return rps.map((rp) => rp.permissionKey);
}

export async function setRolePermissions(roleId: string, keys: string[]): Promise<{ ok: boolean }> {
  const valid = new Set(PERMISSIONS.map((p) => p.key));
  const filtered = keys.filter((k) => valid.has(k as never));
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId, organizationId: null } }),
    prisma.rolePermission.createMany({
      data: filtered.map((k) => ({ roleId, permissionKey: k, allowed: true })),
    }),
  ]);
  return { ok: true };
}

export async function createRole(
  organizationId: string,
  input: { name: string; description?: string | null; copyRoleId?: string | null }
): Promise<RoleRow> {
  if (!input.name?.trim()) throw new Error("El nombre es obligatorio");
  const created = await prisma.role.create({
    data: {
      organizationId,
      name: input.name.trim(),
      description: input.description ?? null,
      isSystem: false,
    },
  });

  if (input.copyRoleId) {
    const source = await prisma.rolePermission.findMany({
      where: { roleId: input.copyRoleId, organizationId: null },
      select: { permissionKey: true },
    });
    if (source.length) {
      await prisma.rolePermission.createMany({
        data: source.map((s) => ({ roleId: created.id, permissionKey: s.permissionKey, allowed: true })),
      });
    }
  }

  return {
    id: created.id,
    name: created.name,
    description: created.description,
    isSystem: created.isSystem,
    organizationId: created.organizationId,
    permissionCount: input.copyRoleId
      ? await prisma.rolePermission.count({ where: { roleId: created.id } })
      : 0,
  };
}

export async function updateRole(
  roleId: string,
  input: { name?: string; description?: string | null }
): Promise<{ ok: boolean }> {
  await prisma.role.update({
    where: { id: roleId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
  return { ok: true };
}

export async function deleteRole(roleId: string): Promise<{ ok: boolean }> {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Rol no encontrado");
  if (role.isSystem) throw new Error("Los roles del sistema no se pueden eliminar");
  await prisma.role.delete({ where: { id: roleId } });
  return { ok: true };
}

// ── Invitaciones (15.5) ─────────────────────────────────────────────────────

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  locationId: string | null;
  createdAt: string;
  acceptedAt: string | null;
}

export async function listInvitations(organizationId: string): Promise<InvitationRow[]> {
  const rows = await prisma.userInvitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    locationId: i.locationId,
    createdAt: i.createdAt.toISOString(),
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
  }));
}

export async function createInvitation(
  organizationId: string,
  input: { email: string; role?: string; locationId?: string | null }
): Promise<InvitationRow> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email inválido");
  }
  const role = input.role && ["owner", "manager", "cashier"].includes(input.role) ? input.role : "cashier";

  // No duplicar invitaciones pendientes.
  const existing = await prisma.userInvitation.findFirst({
    where: { organizationId, email, status: "pending" },
  });
  if (existing) throw new Error("Ya existe una invitación pendiente para este email");

  const created = await prisma.userInvitation.create({
    data: { organizationId, email, role: role as $Enums.OrgRole, locationId: input.locationId ?? null },
  });

  return {
    id: created.id,
    email: created.email,
    role: created.role,
    status: created.status,
    locationId: created.locationId,
    createdAt: created.createdAt.toISOString(),
    acceptedAt: null,
  };
}

export async function revokeInvitation(id: string): Promise<{ ok: boolean }> {
  const inv = await prisma.userInvitation.findUnique({ where: { id } });
  if (!inv) throw new Error("Invitación no encontrada");
  await prisma.userInvitation.delete({ where: { id } });
  return { ok: true };
}

// ── Lealtad (15.6) ──────────────────────────────────────────────────────────

export interface LoyaltySettings {
  pointsPerCurrency: number;
  pointValue: number;
  loyaltyEnabled: boolean;
}

export async function getLoyaltySettings(organizationId: string): Promise<LoyaltySettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { pointsPerCurrency: true, pointValue: true, loyaltyEnabled: true },
  });
  return {
    pointsPerCurrency: toNum(org?.pointsPerCurrency ?? null),
    pointValue: toNum(org?.pointValue ?? null),
    loyaltyEnabled: org?.loyaltyEnabled ?? true,
  };
}

export async function updateLoyaltySettings(
  organizationId: string,
  input: { pointsPerCurrency?: number; pointValue?: number; loyaltyEnabled?: boolean }
): Promise<LoyaltySettings> {
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(input.pointsPerCurrency !== undefined ? { pointsPerCurrency: input.pointsPerCurrency } : {}),
      ...(input.pointValue !== undefined ? { pointValue: input.pointValue } : {}),
      ...(input.loyaltyEnabled !== undefined ? { loyaltyEnabled: input.loyaltyEnabled } : {}),
    },
    select: { pointsPerCurrency: true, pointValue: true, loyaltyEnabled: true },
  });
  return {
    pointsPerCurrency: toNum(org.pointsPerCurrency),
    pointValue: toNum(org.pointValue),
    loyaltyEnabled: org.loyaltyEnabled,
  };
}

// ── Supervisor (15.7) ───────────────────────────────────────────────────────

export const SUPERVISOR_ACTIONS = [
  { key: "discount", label: "Descuento manual (mayor al límite)" },
  { key: "void", label: "Cancelar venta" },
  { key: "refund", label: "Devolución" },
] as const;

export interface SupervisorSettings {
  required: boolean;
  actions: string[];
}

export async function getSupervisorSettings(organizationId: string): Promise<SupervisorSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { supervisorApproval: true },
  });
  const raw = (org?.supervisorApproval ?? {}) as Partial<SupervisorSettings>;
  return {
    required: Boolean(raw.required),
    actions: Array.isArray(raw.actions) ? raw.actions : [],
  };
}

export async function updateSupervisorSettings(
  organizationId: string,
  input: { required?: boolean; actions?: string[] }
): Promise<SupervisorSettings> {
  const current = await getSupervisorSettings(organizationId);
  const next: SupervisorSettings = {
    required: input.required ?? current.required,
    actions: input.actions ?? current.actions,
  };
  await prisma.organization.update({
    where: { id: organizationId },
    data: { supervisorApproval: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}
