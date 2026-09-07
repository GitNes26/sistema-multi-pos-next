import type { NextAuthOptions } from "next-auth";
import { $Enums } from "@prisma/client";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword, normalizeIdentifier } from "@/lib/auth/users";
import { permissionsForRole } from "@/lib/auth/server-permissions";
import { effectiveRole, type AppRole } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 2.1 — NextAuth v4 con Credentials.
// Resolución de login: email (User) | código de nómina (Employee) | nº cliente (Customer).
// Roles efectivos: superadmin / owner / manager / cashier (app) y customer (portal).

export type AuthScope = "superadmin" | "app" | "portal";

export type BusinessMode = "retail" | "food_service" | "services" | "rental" | "hybrid";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: AppRole | "superadmin";
  /** Nombre legible del rol resuelto (Role.name de la membresía, p.ej. "Mesero", "Cocina (KDS)", "Repartidor"). */
  roleName: string | null;
  organizationId: string | null;
  /** Organización en la que el usuario está operando (superAdmin / admin multi-org). */
  activeOrganizationId: string | null;
  /** Nombre de la organización activa (contexto visual en encabezados). */
  organizationName: string | null;
  /** Modo de negocio de la organización activa. */
  businessMode: BusinessMode;
  permissions: PermissionKey[];
  scope: AuthScope;
};

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
  interface User {
    role?: AppRole | "superadmin";
    roleName?: string | null;
    organizationId?: string | null;
    activeOrganizationId?: string | null;
    organizationName?: string | null;
    businessMode?: BusinessMode;
    permissions?: PermissionKey[];
    scope?: AuthScope;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: AppRole | "superadmin";
    roleName?: string | null;
    organizationId?: string | null;
    activeOrganizationId?: string | null;
    organizationName?: string | null;
    businessMode?: BusinessMode;
    permissions?: PermissionKey[];
    scope?: AuthScope;
    /** Sesión invalidada por re-validación en BD (usuario desactivado/eliminado). */
    invalid?: boolean;
    authCheckedAt?: number;
  }
}

type ResolvedLoginUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  passwordHash: string;
  isActive: boolean;
  isSuperadmin: boolean;
  /** Última organización activa recordada (para retomarla al volver a entrar). */
  lastOrganizationId: string | null;
  employees: { organizationId: string }[];
  customers: { organizationId: string }[];
  memberships: { organizationId: string; role: $Enums.OrgRole; roleId: string | null }[];
};

export async function resolveLoginUser(identifier: string): Promise<ResolvedLoginUser | null> {
  const value = normalizeIdentifier(identifier);

  // 1) Por email (único global)
  const byEmail = await prisma.user.findUnique({
    where: { email: value },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      passwordHash: true,
      isActive: true,
      isSuperadmin: true,
      lastOrganizationId: true,
      employees: { select: { organizationId: true } },
      customers: { select: { organizationId: true } },
      memberships: { select: { organizationId: true, role: true, roleId: true } },
    },
  });

  if (byEmail) {
    if (!byEmail.isActive) return null;
    return {
      ...byEmail,
      employees: byEmail.employees.map((e) => ({ organizationId: e.organizationId })),
      customers: byEmail.customers.map((c) => ({ organizationId: c.organizationId })),
      memberships: byEmail.memberships.map((m) => ({ organizationId: m.organizationId, role: m.role, roleId: m.roleId })),
    };
  }

  // 2) Por código de nómina (único por org)
  const byEmployee = await prisma.employee.findFirst({
    where: { employeeCode: value, isActive: true },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          passwordHash: true,
          isActive: true,
          isSuperadmin: true,
          lastOrganizationId: true,
          memberships: { select: { organizationId: true, role: true, roleId: true } },
        },
      },
      organizationId: true,
    },
  });
  if (byEmployee) {
    const u = byEmployee.user;
    if (!u.isActive) return null;
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      passwordHash: u.passwordHash,
      isActive: u.isActive,
      isSuperadmin: u.isSuperadmin,
      lastOrganizationId: u.lastOrganizationId,
      employees: [{ organizationId: byEmployee.organizationId }],
      customers: [],
      memberships: u.memberships.map((m) => ({ organizationId: m.organizationId, role: m.role, roleId: m.roleId })),
    };
  }

  // 3) Por nº de cliente (único por org)
  const byCustomer = await prisma.customer.findFirst({
    where: { customerCode: value, isActive: true },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          passwordHash: true,
          isActive: true,
          isSuperadmin: true,
          lastOrganizationId: true,
        },
      },
      organizationId: true,
    },
  });
  if (byCustomer) {
    const u = byCustomer.user;
    if (!u.isActive) return null;
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      passwordHash: u.passwordHash,
      isActive: u.isActive,
      isSuperadmin: u.isSuperadmin,
      lastOrganizationId: u.lastOrganizationId,
      employees: [],
      customers: [{ organizationId: byCustomer.organizationId }],
      memberships: [],
    };
  }

  return null;
}

function inferKindFromUser(user: NonNullable<Awaited<ReturnType<typeof resolveLoginUser>>>) {
  // SuperAdmin por rol (flag), no por ausencia de empleado/cliente.
  if (user.isSuperadmin) {
    return { scope: "superadmin" as AuthScope, role: "superadmin" as const, organizationId: null as string | null, roleId: null as string | null };
  }
  if (user.customers.length > 0 && user.employees.length === 0) {
    return {
      scope: "portal" as AuthScope,
      role: "customer" as const,
      organizationId: user.customers[0].organizationId as string | null,
      roleId: null as string | null,
    };
  }
  // App: preferir la organización del empleado; si no, la primera membresía.
  const employeeOrg = user.employees[0]?.organizationId ?? null;
  const membership =
    user.memberships?.find((m) => m.organizationId === employeeOrg) ??
    user.memberships?.[0];
  const org = employeeOrg ?? membership?.organizationId ?? user.customers[0]?.organizationId ?? null;
  const role = membership ? effectiveRole(membership.role) : "cashier";
  const roleId = membership?.roleId ?? null;
  return { scope: "app" as AuthScope, role, organizationId: org, roleId };
}

/**
 * Nombre legible del rol del usuario. Si la membresía apunta a un rol concreto
 * (rol de sistema por modo de negocio o rol custom/empresa), se usa el nombre
 * de esa fila ("Mesero", "Cocina (KDS)", "Repartidor", "Agente de atención"…);
 * si no hay roleId, queda null y la UI cae al nombre del rol efectivo.
 */
async function resolveRoleName(roleId: string | null): Promise<string | null> {
  if (!roleId) return null;
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true },
  });
  return role?.name ?? null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email o código", type: "text" },
        password: { label: "Contraseña", type: "password" },
        // Elección opcional del picker de org del login (multi-org).
        organizationId: { label: "Organización", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        const user = await resolveLoginUser(credentials.identifier);
        if (!user) return null;

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        const kind = inferKindFromUser(user);
        // Org elegida en el picker del login (solo app): la membresía de esa
        // org define el rol efectivo, no la de login. Se valida contra las
        // membresías reales: un valor ajeno o sin membresía se ignora.
        const hintOrgId =
          typeof (credentials as { organizationId?: unknown }).organizationId === "string"
            ? ((credentials as { organizationId: string }).organizationId || null)
            : null;
        const pickedMembership =
          kind.scope === "app" && hintOrgId
            ? user.memberships.find((m) => m.organizationId === hintOrgId) ?? null
            : null;
        if (pickedMembership && hintOrgId) {
          kind.organizationId = hintOrgId;
          kind.role = effectiveRole(pickedMembership.role);
          kind.roleId = pickedMembership.roleId;
        }
        const [permissions, roleName] = await Promise.all([
          kind.scope === "superadmin"
            ? permissionsForRole("superadmin")
            : kind.scope === "app"
              ? permissionsForRole(kind.role, kind.roleId, kind.organizationId)
              : Promise.resolve([] as PermissionKey[]),
          kind.scope === "app" ? resolveRoleName(kind.roleId) : Promise.resolve(null),
        ]);

        // ── Organización activa: retomar la última recordada (si sigue teniendo
        // acceso) o caer a la org natural (empleado / primera membresía).
        const isSuper = kind.scope === "superadmin";
        const accessibleOrgs = isSuper
          ? null // el superAdmin puede operar cualquier org existente
          : new Set([
              ...user.employees.map((e) => e.organizationId),
              ...user.memberships.map((m) => m.organizationId),
            ]);
        let preferredOrg: string | null = null;
        if (pickedMembership && hintOrgId) {
          // Elección explícita del picker: gana a la org recordada.
          preferredOrg = hintOrgId;
        } else if (user.lastOrganizationId) {
          if (isSuper || accessibleOrgs!.has(user.lastOrganizationId)) {
            preferredOrg = user.lastOrganizationId;
          }
        }
        const candidateOrgId = preferredOrg ?? kind.organizationId ?? null;
        // La elección del picker (o la org efectiva del login) se recuerda
        // para el próximo login — misma filosofía que el switcher. Best-effort.
        if (candidateOrgId && kind.scope === "app" && candidateOrgId !== user.lastOrganizationId) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastOrganizationId: candidateOrgId },
            });
          } catch (err) {
            console.error("[auth] no se pudo recordar la organización del login", err);
          }
        }

        // Fetch businessMode + nombre de la organización activa
        let businessMode: BusinessMode = "retail";
        let organizationName: string | null = null;
        if (candidateOrgId) {
          const org = await prisma.organization.findUnique({
            where: { id: candidateOrgId },
            select: { businessMode: true, name: true },
          });
          if (org?.businessMode) businessMode = org.businessMode;
          organizationName = org?.name ?? null;
        }
        // Solo se activa si la org existe (el superAdmin con una org borrada
        // vuelve a "Sin organización" en lugar de quedar en un id colgado).
        const activeOrganizationId =
          organizationName !== null ? candidateOrgId : null;

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          image: user.avatarUrl,
          role: kind.role,
          roleName,
          organizationId: kind.organizationId,
          activeOrganizationId,
          organizationName,
          businessMode,
          permissions,
          scope: kind.scope,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 días
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session: updatePayload }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.roleName = user.roleName ?? null;
        token.organizationId = user.organizationId ?? null;
        token.activeOrganizationId = user.activeOrganizationId ?? user.organizationId ?? null;
        token.organizationName = user.organizationName ?? null;
        token.businessMode = user.businessMode ?? "retail";
        token.permissions = user.permissions ?? [];
        token.scope = user.scope ?? "app";
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image ?? token.picture;
        token.authCheckedAt = Date.now();
        return token;
      }

      // Actualización de la sesión desde el cliente (organization switcher):
      // `update({ activeOrganizationId })` → POST /api/auth/session.
      if (trigger === "update" && updatePayload && "activeOrganizationId" in updatePayload) {
        const next = (updatePayload as { activeOrganizationId?: string | null }).activeOrganizationId;
        token.activeOrganizationId = next ?? null;
        // Refrescar nombre + businessMode de la organización al cambiar de org
        // (o limpiarlos si el superAdmin sale de una organización).
        if (next) {
          const org = await prisma.organization.findUnique({
            where: { id: next },
            select: { businessMode: true, name: true },
          });
          if (org?.businessMode) token.businessMode = org.businessMode;
          token.organizationName = org?.name ?? null;
          // Las membresías pueden llevar un roleId distinto por organización:
          // recalcular rol efectivo + permisos para que la sesión refleje la
          // org activa, no la de login. El superAdmin (sin membresía) conserva
          // su rol/permisos: su alcance no depende de la organización.
          const membership = await prisma.membership.findFirst({
            where: { userId: token.id, organizationId: next },
            select: { role: true, roleId: true },
          });
          if (membership) {
            const role = effectiveRole(membership.role);
            token.role = role;
            token.roleName = await resolveRoleName(membership.roleId);
            token.permissions = await permissionsForRole(role, membership.roleId, next);
          }
        } else {
          token.businessMode = "retail";
          token.organizationName = null;
        }
        // Recordar la org activa en la BD (best-effort: si falla la escritura,
        // el cambio de org de la sesión actual NO debe romperse).
        try {
          await prisma.user.update({
            where: { id: token.id },
            data: { lastOrganizationId: next ?? null },
          });
        } catch (err) {
          console.error("[auth] no se pudo recordar la organización activa", err);
        }
      }

      // Re-validación contra BD (throttle 60s): si el usuario fue desactivado o
      // eliminado, se invalida la sesión para forzar el logout.
      const lastCheck = typeof token.authCheckedAt === "number" ? token.authCheckedAt : 0;
      if (Date.now() - lastCheck > 60_000) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { id: true, isActive: true },
        });
        token.authCheckedAt = Date.now();
        if (!dbUser || !dbUser.isActive) {
          token.invalid = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.invalid || !token.id) {
        session.user = null as unknown as SessionUser;
        return session;
      }
      session.user = {
        id: token.id,
        name: token.name ?? "",
        email: token.email ?? "",
        image: typeof token.picture === "string" ? token.picture : null,
        role: token.role ?? "customer",
        roleName: token.roleName ?? null,
        organizationId: token.organizationId ?? null,
        activeOrganizationId: token.activeOrganizationId ?? token.organizationId ?? null,
        organizationName: token.organizationName ?? null,
        businessMode: token.businessMode ?? "retail",
        permissions: token.permissions ?? [],
        scope: token.scope ?? "app",
      };
      return session;
    },
  },
};