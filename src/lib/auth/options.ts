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
    permissions?: PermissionKey[];
    scope?: AuthScope;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: AppRole | "superadmin";
    organizationId?: string | null;
    permissions?: PermissionKey[];
    scope?: AuthScope;
  }
}

type ResolvedLoginUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  passwordHash: string;
  isActive: boolean;
  employees: { organizationId: string }[];
  customers: { organizationId: string }[];
  memberships: { organizationId: string; role: $Enums.OrgRole }[];
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
      employees: { select: { organizationId: true } },
      customers: { select: { organizationId: true } },
      memberships: { select: { organizationId: true, role: true } },
    },
  });

  if (byEmail) {
    if (!byEmail.isActive) return null;
    return {
      ...byEmail,
      employees: byEmail.employees.map((e) => ({ organizationId: e.organizationId })),
      customers: byEmail.customers.map((c) => ({ organizationId: c.organizationId })),
      memberships: byEmail.memberships.map((m) => ({ organizationId: m.organizationId, role: m.role })),
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
          memberships: { select: { organizationId: true, role: true } },
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
      employees: [{ organizationId: byEmployee.organizationId }],
      customers: [],
      memberships: u.memberships.map((m) => ({ organizationId: m.organizationId, role: m.role })),
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
      employees: [],
      customers: [{ organizationId: byCustomer.organizationId }],
      memberships: [],
    };
  }

  return null;
}

function inferKindFromUser(user: NonNullable<Awaited<ReturnType<typeof resolveLoginUser>>>) {
  const isSuper = user.employees.length === 0 && user.customers.length === 0;
  if (isSuper) {
    return { scope: "superadmin" as AuthScope, role: "superadmin" as const, organizationId: null as string | null };
  }
  if (user.customers.length > 0 && user.employees.length === 0) {
    return {
      scope: "portal" as AuthScope,
      role: "customer" as const,
      organizationId: user.customers[0].organizationId as string | null,
    };
  }
  const org = (user.employees[0]?.organizationId ?? user.customers[0]?.organizationId) ?? null;
  const membership = user.memberships?.find((m) => m.organizationId === org);
  const role = membership ? effectiveRole(membership.role) : "cashier";
  return { scope: "app" as AuthScope, role, organizationId: org };
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
              ? await permissionsForRole(kind.role)
              : [];

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          image: user.avatarUrl,
          role: kind.role,
          organizationId: kind.organizationId,
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.organizationId = user.organizationId ?? null;
        token.permissions = user.permissions ?? [];
        token.scope = user.scope ?? "app";
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name ?? "",
        email: token.email ?? "",
        image: typeof token.picture === "string" ? token.picture : null,
        role: token.role ?? "customer",
        organizationId: token.organizationId ?? null,
        permissions: token.permissions ?? [],
        scope: token.scope ?? "app",
      };
      return session;
    },
  },
};