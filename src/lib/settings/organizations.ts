import { $Enums, type BusinessMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, normalizeIdentifier } from "@/lib/auth/users";
import { listRoles } from "@/lib/settings/server";
import {
  roleAllowedInOrg,
  roleIdToEnum,
  ROLE_MODE_GATE_MESSAGE,
} from "@/lib/settings/system-roles";

// FASE 15.9 — Helpers de servidor para la gestión de organizaciones
// (exclusivo del superAdmin).

const VALID_ROLES: $Enums.OrgRole[] = ["owner", "admin", "manager", "cashier"];

// Roles de sistema que nunca se asignan desde este diálogo.
const NON_ASSIGNABLE_SHARED_IDS = new Set(["system-superadmin", "system-customer"]);

/**
 * Roles de sistema asignables por el superAdmin para una organización:
 * los 4 compartidos (owner/admin/manager/cashier), los específicos del modo
 * de negocio (mesero/cocina, agente…) y los compartidos extra (repartidor).
 * Todos se asignan por roleId.
 */
export async function assignableRolesFor(organizationId: string) {
  const roles = await listRoles(organizationId);
  return roles
    .filter((r) => r.isSystem && !NON_ASSIGNABLE_SHARED_IDS.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissionCount: r.permissionCount,
    }));
}

export interface OrganizationRow {
  id: string;
  name: string;
  /** Modo de negocio: define los roles/páginas/permisos de la organización. */
  businessMode: BusinessMode;
  currency: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
  adminCount: number;
  createdAt: string;
  /** Roles de sistema asignables por roleId (los 4 compartidos + los del modo
   * + compartidos extra como repartidor), con su resumen de permisos. */
  assignableRoles: { id: string; name: string; description: string | null; permissionCount: number }[];
}

export async function listOrganizations(): Promise<OrganizationRow[]> {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      owner: { select: { fullName: true, email: true } },
      memberships: { select: { role: true } },
    },
  });
  return Promise.all(
    orgs.map(async (o) => ({
      id: o.id,
      name: o.name,
      businessMode: o.businessMode as BusinessMode,
      currency: o.currency,
      ownerName: o.owner.fullName,
      ownerEmail: o.owner.email,
      memberCount: o.memberships.length,
      adminCount: o.memberships.filter((m) => m.role === "admin").length,
      createdAt: o.createdAt.toISOString(),
      assignableRoles: await assignableRolesFor(o.id),
    }))
  );
}

export interface CreateOrganizationInput {
  name: string;
  currency?: string;
  ownerName?: string;
  ownerEmail: string;
  ownerPassword: string;
}

/** Crea la organización + la cuenta owner (membresía owner) + sucursal
 * Matriz y Caja 1 relacionada, para que la empresa arranque operativa. */
export async function createOrganization(input: CreateOrganizationInput): Promise<OrganizationRow> {
  const name = input.name?.trim();
  if (!name) throw new Error("El nombre de la organización es obligatorio");

  const email = normalizeIdentifier(input.ownerEmail);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email del owner inválido");
  }
  if (!input.ownerPassword || input.ownerPassword.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  const ownerName = input.ownerName?.trim() || email.split("@")[0];

  const owner =
    existingUser ??
    (await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(input.ownerPassword),
        fullName: ownerName,
        isActive: true,
      },
    }));

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name,
        ownerId: owner.id,
        currency: input.currency?.trim() || "MXN",
      },
    });

    await tx.membership.upsert({
      where: { userId_organizationId: { userId: owner.id, organizationId: created.id } },
      update: { role: "owner" },
      create: { userId: owner.id, organizationId: created.id, role: "owner" },
    });

    // Sucursal matriz + caja inicial: la base mínima para operar el POS.
    const matriz = await tx.location.create({
      data: {
        organizationId: created.id,
        name: "Matriz",
        code: "MATRIZ",
        managerName: ownerName,
        allowsPickup: true,
        allowsDelivery: true,
        isActive: true,
      },
    });
    await tx.cashRegister.create({
      data: {
        organizationId: created.id,
        locationId: matriz.id,
        name: "Caja 1",
        folioPrefix: "C1",
        isActive: true,
      },
    });

    return created;
  });

  return {
    id: org.id,
    name: org.name,
    businessMode: org.businessMode as BusinessMode,
    currency: org.currency,
    ownerName: owner.fullName,
    ownerEmail: owner.email,
    memberCount: 1,
    adminCount: 0,
    createdAt: org.createdAt.toISOString(),
    assignableRoles: [],
  };
}

export async function updateOrganization(
  id: string,
  input: { name?: string; currency?: string }
): Promise<{ ok: boolean }> {
  await prisma.organization.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.currency !== undefined ? { currency: input.currency.trim() } : {}),
    },
  });
  return { ok: true };
}

// ── Usuarios y membresías ────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isSuperadmin: boolean;
  memberships: {
    membershipId: string;
    organizationId: string;
    organizationName: string;
    businessMode: string;
    role: string;
    roleId: string | null;
    roleName: string | null;
  }[];
}

export async function listAllUsers(): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      isSuperadmin: true,
      memberships: {
        select: {
          id: true,
          organizationId: true,
          role: true,
          roleId: true,
          roleRef: { select: { name: true } },
          organization: { select: { name: true, businessMode: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    isActive: u.isActive,
    isSuperadmin: u.isSuperadmin,
    memberships: u.memberships.map((m) => ({
      membershipId: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      businessMode: m.organization.businessMode,
      role: m.role,
      roleId: m.roleId ?? null,
      roleName: m.roleRef?.name ?? null,
    })),
  }));
}

export async function createUser(input: {
  email: string;
  fullName: string;
  password: string;
}): Promise<{ id: string }> {
  const email = normalizeIdentifier(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email inválido");
  }
  if (!input.fullName?.trim()) throw new Error("El nombre es obligatorio");
  if (!input.password || input.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Ya existe un usuario con ese email");

  const created = await prisma.user.create({
    data: {
      email,
      fullName: input.fullName.trim(),
      passwordHash: await hashPassword(input.password),
      isActive: true,
    },
    select: { id: true },
  });
  return created;
}

export async function listOrgMembers(orgId: string) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      roleRef: { select: { name: true, isSystem: true, businessMode: true } },
    },
  });
  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    fullName: m.user.fullName,
    email: m.user.email,
    role: m.role,
    roleId: m.roleId ?? null,
    roleName: m.roleRef?.name ?? null,
  }));
}

/**
 * Asigna un usuario a una organización (upsert).
 * `role` es el valor enum (owner/admin/manager/cashier); `roleId` opcional
 * apunta a un rol de sistema específico (p. ej. system-food_service-waiter)
 * para que los permisos se resuelvan por roleId también.
 */
export async function assignUserToOrg(
  organizationId: string,
  userId: string,
  role?: string,
  roleId?: string | null
): Promise<{ ok: boolean }> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error("Organización no encontrada");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuario no encontrado");

  // Resolver el rol efectivo
  let enumRole: $Enums.OrgRole;
  let resolvedRoleId: string | null = null;

  if (roleId) {
    const roleRecord = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, isSystem: true, businessMode: true, organizationId: true },
    });
    if (!roleRecord) throw new Error("Rol no encontrado");

    // Compuerta de modo siempre activa: un rol de sistema de otro modo
    // (mesero/cocina/agente…) o un rol custom de otra empresa no puede
    // asignarse a esta organización.
    if (!roleAllowedInOrg(roleRecord, org.businessMode, org.id)) {
      throw new Error(ROLE_MODE_GATE_MESSAGE);
    }

    resolvedRoleId = roleRecord.id;
    // Mapear el rol a su enum equivalente para el fallback por enum
    enumRole = roleIdToEnum(roleRecord.id);
  } else {
    if (!role || !VALID_ROLES.includes(role as $Enums.OrgRole)) {
      throw new Error("Rol inválido");
    }
    enumRole = role as $Enums.OrgRole;
  }

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: { role: enumRole, roleId: resolvedRoleId },
    create: { userId, organizationId, role: enumRole, roleId: resolvedRoleId },
  });
  return { ok: true };
}

export async function removeMembership(membershipId: string): Promise<{ ok: boolean }> {
  await prisma.membership.delete({ where: { id: membershipId } });
  return { ok: true };
}

/** Elimina la organización y todos sus datos en cascada (sin borrar cuentas de usuario). */
export async function deleteOrganization(organizationId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const orderIds = (await tx.order.findMany({ where: { organizationId }, select: { id: true } })).map((o) => o.id);
    const prepIds = (await tx.orderPreparation.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map((o) => o.id);
    await tx.orderPreparationItem.deleteMany({ where: { preparationId: { in: prepIds } } });
    await tx.orderPreparation.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.order.deleteMany({ where: { organizationId } });

    const saleIds = (await tx.sale.findMany({ where: { organizationId }, select: { id: true } })).map((s) => s.id);
    await tx.saleDiscount.deleteMany({ where: { saleId: { in: saleIds } } });
    await tx.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
    await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
    await tx.sale.deleteMany({ where: { organizationId } });

    const revisionIds = (await tx.inventoryRevision.findMany({ where: { organizationId }, select: { id: true } })).map((r) => r.id);
    await tx.inventoryRevisionItem.deleteMany({ where: { revisionId: { in: revisionIds } } });
    await tx.inventoryRevision.deleteMany({ where: { organizationId } });
    await tx.inventoryMovement.deleteMany({ where: { organizationId } });
    await tx.inventory.deleteMany({ where: { organizationId } });

    const variantIds = (await tx.productVariant.findMany({ where: { organizationId }, select: { id: true } })).map((v) => v.id);
    await tx.variantOptionValue.deleteMany({ where: { variantId: { in: variantIds } } });
    await tx.productVariant.deleteMany({ where: { organizationId } });
    const productIds = (await tx.product.findMany({ where: { organizationId }, select: { id: true } })).map((p) => p.id);
    const optionIds = (await tx.productOption.findMany({ where: { productId: { in: productIds } }, select: { id: true } })).map((o) => o.id);
    await tx.productOptionValue.deleteMany({ where: { optionId: { in: optionIds } } });
    await tx.productOption.deleteMany({ where: { productId: { in: productIds } } });
    await tx.product.deleteMany({ where: { organizationId } });

    const listIds = (await tx.shoppingList.findMany({ where: { organizationId }, select: { id: true } })).map((l) => l.id);
    await tx.shoppingListItem.deleteMany({ where: { listId: { in: listIds } } });
    await tx.shoppingList.deleteMany({ where: { organizationId } });
    await tx.customerFavorite.deleteMany({ where: { organizationId } });

    const promoIds = (await tx.promotion.findMany({ where: { organizationId }, select: { id: true } })).map((p) => p.id);
    await tx.promotionTarget.deleteMany({ where: { promotionId: { in: promoIds } } });
    await tx.promotion.deleteMany({ where: { organizationId } });
    await tx.coupon.deleteMany({ where: { organizationId } });
    await tx.loyaltyTransaction.deleteMany({ where: { organizationId } });

    await tx.customerPaymentMethod.deleteMany({ where: { organizationId } });
    await tx.customer.deleteMany({ where: { organizationId } });
    await tx.cashSession.deleteMany({ where: { organizationId } });
    await tx.cashRegister.deleteMany({ where: { organizationId } });
    await tx.cedi.deleteMany({ where: { organizationId } });
    await tx.location.deleteMany({ where: { organizationId } });
    await tx.employee.deleteMany({ where: { organizationId } });
    await tx.employeePosition.deleteMany({ where: { organizationId } });
    await tx.membership.deleteMany({ where: { organizationId } });
    await tx.userInvitation.deleteMany({ where: { organizationId } });
    await tx.notification.deleteMany({ where: { organizationId } });
    await tx.publication.deleteMany({ where: { organizationId } });
    await tx.companyProfile.deleteMany({ where: { organizationId } });
    await tx.appSettings.deleteMany({ where: { organizationId } });

    await tx.organization.delete({ where: { id: organizationId } });
  });
}