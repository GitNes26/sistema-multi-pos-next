import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { $Enums } from "@prisma/client";

// FASE 2 — Utilidades de credenciales y auto-creación de usuarios (2.9, 2.10)

const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

type NewUserInput = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  isActive?: boolean;
};

/** Crea (o actualiza si el email ya existe) un User para un empleado. FASE 7.4 usa esto. */
export async function createEmployeeUser({
  organizationId,
  employeeCode,
  positionId,
  ...user
}: NewUserInput & {
  organizationId: string;
  employeeCode: string;
  positionId?: string;
}) {
  const passwordHash = await hashPassword(user.password);
  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: {
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive ?? true,
    },
    create: {
      email: user.email,
      passwordHash,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive ?? true,
    },
  });

  const existing = await prisma.employee.findUnique({
    where: { organizationId_userId: { organizationId, userId: dbUser.id } },
  });

  const employee = existing
    ? await prisma.employee.update({
        where: { id: existing.id },
        data: { employeeCode, positionId, fullName: user.fullName, phone: user.phone },
      })
    : await prisma.employee.create({
        data: {
          organizationId,
          userId: dbUser.id,
          employeeCode,
          positionId,
          fullName: user.fullName,
          phone: user.phone,
        },
      });

  return { user: dbUser, employee };
}

/** Crea (o actualiza) un User para un cliente del portal. FASE 7.3 usa esto. */
export async function createCustomerUser({
  organizationId,
  customerCode,
  ...user
}: NewUserInput & {
  organizationId: string;
  customerCode: string;
}) {
  const passwordHash = await hashPassword(user.password);
  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: {
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive ?? true,
    },
    create: {
      email: user.email,
      passwordHash,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive ?? true,
    },
  });

  const existing = await prisma.customer.findUnique({
    where: { organizationId_userId: { organizationId, userId: dbUser.id } },
  });

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: { customerCode, fullName: user.fullName, phone: user.phone },
      })
    : await prisma.customer.create({
        data: {
          organizationId,
          userId: dbUser.id,
          customerCode,
          fullName: user.fullName,
          phone: user.phone,
        },
      });

  return { user: dbUser, customer };
}

/** Asigna (upsert) la membresía de un usuario a la organización. */
export async function setMembership(
  userId: string,
  organizationId: string,
  role: $Enums.OrgRole
) {
  return prisma.membership.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: { role },
    create: { userId, organizationId, role },
  });
}

/** Cambio de contraseña (FASE 2.13). Verifica la anterior y actualiza. */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Usuario no encontrado" };

  const valid = await verifyPassword(oldPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "La contraseña actual es incorrecta" };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  return { ok: true };
}

/** Genera y guarda un token de reset (guardado hasheado con SHA-256). */
export async function issuePasswordResetToken(
  email: string
): Promise<{ token?: string; sent: boolean }> {
  const user = await prisma.user.findUnique({ where: { email: normalizeIdentifier(email) } });
  if (!user || !user.isActive) return { sent: false };

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: tokenHash, passwordResetExpires: expires },
  });

  return { token, sent: true };
}

/** Aplica un token de reset: resetea la contraseña si es válido. */
export async function applyPasswordResetToken(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findUnique({ where: { passwordResetToken: tokenHash } });
  if (!user) return { ok: false, error: "Enlace inválido" };
  if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return { ok: false, error: "El enlace expiró. Solicita uno nuevo." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
  return { ok: true };
}