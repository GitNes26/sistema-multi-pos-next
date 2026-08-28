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

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: AppRole | "superadmin";
  organizationId: string | null;
  /** Organización en la que el usuario está operando (superAdmin / admin multi-org). */
  activeOrganizationId: string | null;
  permissions: PermissionKey[];
  scope: AuthScope;
};

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
  interface User {
    role?: AppRole | "superadmin";
    organizationId?: string | null;
    activeOrganizationId?: string | null;
    permissions?: PermissionKey[];
    scope?: AuthScope;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: AppRole | "superadmin";
    organizationId?: string | null;
    activeOrganizationId?: string | null;
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

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email o código", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        const user = await resolveLoginUser(credentials.identifier);
        if (!user) return null;

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        const kind = inferKindFromUser(user);
        const permissions: PermissionKey[] =
          kind.scope === "superadmin"
            ? (await permissionsForRole("superadmin"))
            : kind.scope === "app"
              ? await permissionsForRole(kind.role, kind.roleId, kind.organizationId)
              : [];

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          image: user.avatarUrl,
          role: kind.role,
          organizationId: kind.organizationId,
          activeOrganizationId: kind.organizationId,
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
        token.organizationId = user.organizationId ?? null;
        token.activeOrganizationId = user.activeOrganizationId ?? user.organizationId ?? null;
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
        organizationId: token.organizationId ?? null,
        activeOrganizationId: token.activeOrganizationId ?? token.organizationId ?? null,
        permissions: token.permissions ?? [],
        scope: token.scope ?? "app",
      };
      return session;
    },
  },
};