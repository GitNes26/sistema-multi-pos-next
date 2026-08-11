import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/db/client";
import { PERMISSIONS } from "../../src/lib/auth/permission-keys";

// FASE 1.3.1 + FASE 2.8 — Seed de producción (base mínima)
// - SuperAdmin default
// - 30 permisos predefinidos (fuente: src/lib/auth/permission-keys.ts)
// - 4 roles default de sistema (superadmin, owner, manager, cashier)
// - Unidades de medida del sistema (PLAN §6b)

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? "admin@multi-pos.com";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "Admin123!";
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME ?? "Super Admin";

export const SYSTEM_ROLES = [
  {
    name: "superadmin",
    description: "Acceso total al sistema",
    permissions: PERMISSIONS.map((p) => p.key),
  },
  {
    name: "owner",
    description: "Dueño de la empresa: acceso total",
    permissions: PERMISSIONS.map((p) => p.key),
  },
  {
    name: "manager",
    description: "Gerente: todo excepto gestión de usuarios",
    permissions: PERMISSIONS.map((p) => p.key).filter((k) => k !== "users.manage"),
  },
  {
    name: "cashier",
    description: "Cajero: POS, catálogos y caja",
    permissions: [
      "pos.use",
      "products.view",
      "inventory.view",
      "customers.view",
      "customers.manage",
      "promotions.view",
      "sales.view",
      "cash.open",
      "cash.close",
      "orders.view",
      "orders.manage",
      "locations.view",
    ],
  },
] as const;

// Unidades del sistema (organizationId = null → globales)
export const SYSTEM_UNITS = [
  { name: "Kilogramo", abbreviation: "kg", type: "weight", baseUnit: "g", conversionFactor: "1000" },
  { name: "Gramo", abbreviation: "g", type: "weight", baseUnit: "g", conversionFactor: "1" },
  { name: "Litro", abbreviation: "lt", type: "volume", baseUnit: "ml", conversionFactor: "1000" },
  { name: "Mililitro", abbreviation: "ml", type: "volume", baseUnit: "ml", conversionFactor: "1" },
  { name: "Pieza", abbreviation: "pza", type: "piece", baseUnit: "pza", conversionFactor: "1" },
  { name: "Metro", abbreviation: "m", type: "length", baseUnit: "cm", conversionFactor: "100" },
  { name: "Centímetro", abbreviation: "cm", type: "length", baseUnit: "cm", conversionFactor: "1" },
  { name: "Peso (monto)", abbreviation: "peso", type: "amount", baseUnit: "peso", conversionFactor: "1" },
] as const;

export async function seedProduction() {
  // SuperAdmin
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { isActive: true },
    create: {
      email: SUPERADMIN_EMAIL,
      passwordHash,
      fullName: SUPERADMIN_NAME,
      isActive: true,
    },
  });

  // Permisos
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, label: p.label },
      create: { key: p.key, module: p.module, action: p.action, label: p.label },
    });
  }

  // Roles de sistema
  for (const def of SYSTEM_ROLES) {
    const id = `system-${def.name}`;
    const role = await prisma.role.upsert({
      where: { id },
      update: { name: def.name, description: def.description, isSystem: true },
      create: { id, name: def.name, description: def.description, isSystem: true },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, organizationId: null } });
    await prisma.rolePermission.createMany({
      data: def.permissions.map((key) => ({
        roleId: role.id,
        permissionKey: key,
        allowed: true,
      })),
    });
  }

  // Unidades del sistema
  for (const u of SYSTEM_UNITS) {
    const existing = await prisma.unitOfMeasure.findFirst({
      where: { organizationId: null, abbreviation: u.abbreviation },
    });
    const data = {
      name: u.name,
      type: u.type,
      baseUnit: u.baseUnit,
      conversionFactor: new Prisma.Decimal(u.conversionFactor),
    };
    if (existing) {
      await prisma.unitOfMeasure.update({ where: { id: existing.id }, data });
    } else {
      await prisma.unitOfMeasure.create({
        data: { ...data, abbreviation: u.abbreviation },
      });
    }
  }
}

export { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME };