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

// organizations.manage es exclusivo del superAdmin (no va en owner/admin).
const allPermissionKeys = PERMISSIONS.map((p) => p.key);
const appPermissionKeys = PERMISSIONS.filter((p) => p.key !== "organizations.manage").map((p) => p.key);

export const SYSTEM_ROLES = [
  {
    name: "superadmin",
    description: "Acceso total al sistema",
    permissions: allPermissionKeys,
  },
  {
    name: "owner",
    description: "Dueño de la empresa: acceso total",
    permissions: appPermissionKeys,
  },
  {
    name: "admin",
    description: "Admin multi-empresa: acceso total en sus organizaciones",
    permissions: appPermissionKeys,
  },
  {
    name: "manager",
    description: "Gerente: todo excepto gestión de usuarios",
    permissions: appPermissionKeys.filter((k) => k !== "users.manage"),
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

// FASE 14.4 — Menú dinámico predefinido (global, ids fijos para upsert).
type SystemMenuDef = {
  id: string;
  parentId: string | null;
  type: "section" | "item";
  label: string;
  icon: string;
  href?: string | null;
  permissionKey?: string | null;
  sortOrder: number;
};

export const SYSTEM_MENUS: SystemMenuDef[] = [
  { id: "menu-principal", parentId: null, type: "section", label: "Principal", icon: "LayoutDashboard", sortOrder: 1 },
  { id: "menu-panel", parentId: "menu-principal", type: "item", label: "Panel", icon: "LayoutDashboard", href: "/admin", sortOrder: 1 },
  { id: "menu-pos", parentId: "menu-principal", type: "item", label: "POS", icon: "Store", href: "/pos", permissionKey: "pos.use", sortOrder: 2 },
  { id: "menu-ventas", parentId: "menu-principal", type: "item", label: "Ventas", icon: "ShoppingCart", href: "/admin/sales", permissionKey: "sales.view", sortOrder: 3 },
  { id: "menu-reportes", parentId: "menu-principal", type: "item", label: "Reportes", icon: "BarChart3", href: "/admin/reports", permissionKey: "reports.view", sortOrder: 4 },
  { id: "menu-notificaciones", parentId: "menu-principal", type: "item", label: "Notificaciones", icon: "BellRing", href: "/admin/notifications", sortOrder: 5 },

  { id: "menu-catalogos", parentId: null, type: "section", label: "Catálogos", icon: "Package", sortOrder: 2 },
  { id: "menu-productos", parentId: "menu-catalogos", type: "item", label: "Productos", icon: "Package", href: "/admin/products", permissionKey: "products.view", sortOrder: 1 },
  { id: "menu-categorias", parentId: "menu-catalogos", type: "item", label: "Categorías", icon: "Tags", href: "/admin/categories", permissionKey: "categories.manage", sortOrder: 2 },
  { id: "menu-medidas", parentId: "menu-catalogos", type: "item", label: "Medidas", icon: "Ruler", href: "/admin/units", permissionKey: "products.manage", sortOrder: 3 },
  { id: "menu-clientes", parentId: "menu-catalogos", type: "item", label: "Clientes", icon: "Users", href: "/admin/customers", permissionKey: "customers.view", sortOrder: 4 },
  { id: "menu-empleados", parentId: "menu-catalogos", type: "item", label: "Empleados", icon: "UserCog", href: "/admin/employees", permissionKey: "employees.view", sortOrder: 5 },
  { id: "menu-puestos", parentId: "menu-catalogos", type: "item", label: "Puestos", icon: "Briefcase", href: "/admin/positions", permissionKey: "employees.view", sortOrder: 6 },
  { id: "menu-promociones", parentId: "menu-catalogos", type: "item", label: "Promociones", icon: "Percent", href: "/admin/promotions", permissionKey: "promotions.view", sortOrder: 7 },
  { id: "menu-publicaciones", parentId: "menu-catalogos", type: "item", label: "Publicaciones", icon: "Megaphone", href: "/admin/publications", permissionKey: "publications.manage", sortOrder: 8 },

  { id: "menu-operacion", parentId: null, type: "section", label: "Operación", icon: "Boxes", sortOrder: 3 },
  { id: "menu-inventario", parentId: "menu-operacion", type: "item", label: "Inventario", icon: "Boxes", href: "/admin/inventory", permissionKey: "inventory.view", sortOrder: 1 },
  { id: "menu-sucursales", parentId: "menu-operacion", type: "item", label: "Sucursales", icon: "MapPin", href: "/admin/locations", permissionKey: "locations.view", sortOrder: 2 },
  { id: "menu-cajas", parentId: "menu-operacion", type: "item", label: "Cajas", icon: "Banknote", href: "/admin/cashRegisters", permissionKey: "locations.view", sortOrder: 3 },
  { id: "menu-pedidos", parentId: "menu-operacion", type: "item", label: "Pedidos", icon: "ClipboardList", href: "/admin/orders", permissionKey: "orders.view", sortOrder: 4 },
  { id: "menu-pedidos-monitoreo", parentId: "menu-pedidos", type: "item", label: "Monitoreo", icon: "Activity", href: "/admin/orders/monitoring", permissionKey: "orders.view", sortOrder: 1 },
  { id: "menu-cedis", parentId: "menu-operacion", type: "item", label: "CEDIS", icon: "Warehouse", href: "/admin/cedis", permissionKey: "cedis.manage", sortOrder: 5 },

  { id: "menu-ajustes", parentId: null, type: "section", label: "Ajustes", icon: "Settings", sortOrder: 4 },
  { id: "menu-apariencia", parentId: "menu-ajustes", type: "item", label: "Apariencia", icon: "Palette", href: "/admin/settings/appearance", permissionKey: "settings.manage", sortOrder: 1 },
  { id: "menu-empresa", parentId: "menu-ajustes", type: "item", label: "Empresa", icon: "Building2", href: "/admin/settings/company", permissionKey: "settings.manage", sortOrder: 2 },
  { id: "menu-lealtad", parentId: "menu-ajustes", type: "item", label: "Lealtad", icon: "Sparkles", href: "/admin/settings/loyalty", permissionKey: "settings.manage", sortOrder: 3 },
  { id: "menu-supervisor", parentId: "menu-ajustes", type: "item", label: "Supervisor", icon: "ShieldCheck", href: "/admin/settings/supervisor", permissionKey: "settings.manage", sortOrder: 4 },
  { id: "menu-pagos", parentId: "menu-ajustes", type: "item", label: "Pagos", icon: "CreditCard", href: "/admin/settings/payments", permissionKey: "settings.manage", sortOrder: 5 },
  // { id: "menu-ajustes-general", parentId: "menu-ajustes", type: "item", label: "Ajustes", icon: "Settings", href: "/admin/settings", permissionKey: "settings.manage", sortOrder: 6 },
  { id: "menu-usuarios", parentId: "menu-ajustes", type: "item", label: "Usuarios y permisos", icon: "ShieldCheck", href: "/admin/settings/users", permissionKey: "users.manage", sortOrder: 6 },
  { id: "menu-menus", parentId: "menu-ajustes", type: "item", label: "Menú", icon: "Menu", href: "/admin/settings/menus", permissionKey: "users.manage", sortOrder: 7 },
  { id: "menu-organizations", parentId: "menu-ajustes", type: "item", label: "Organizaciones y roles", icon: "Building2", href: "/admin/settings/organizations", permissionKey: "organizations.manage", sortOrder: 8 },
];

export async function seedProduction() {
  // SuperAdmin
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { isActive: true, isSuperadmin: true },
    create: {
      email: SUPERADMIN_EMAIL,
      passwordHash,
      fullName: SUPERADMIN_NAME,
      isActive: true,
      isSuperadmin: true,
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

  // Menú dinámico (FASE 14.4)
  for (const m of SYSTEM_MENUS) {
    await prisma.menu.upsert({
      where: { id: m.id },
      update: {
        parentId: m.parentId,
        type: m.type,
        label: m.label,
        icon: m.icon,
        href: m.href ?? null,
        badge: null,
        badgeVariant: null,
        permissionKey: m.permissionKey ?? null,
        sortOrder: m.sortOrder,
        isActive: true,
      },
      create: {
        id: m.id,
        parentId: m.parentId,
        type: m.type,
        label: m.label,
        icon: m.icon,
        href: m.href ?? null,
        badge: null,
        badgeVariant: null,
        permissionKey: m.permissionKey ?? null,
        sortOrder: m.sortOrder,
        isActive: true,
      },
    });
  }
}

export { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME };