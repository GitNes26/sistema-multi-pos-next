import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Package,
  Palette,
  Percent,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import type { Session } from "next-auth";
import { hasPermission } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 5.11 — Rutas + íconos + permisos definidos UNA sola vez.
// Sidebar, BottomBar y Drawer consumen esta especificación.

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  match?: RegExp;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/admin", label: "Panel", icon: LayoutDashboard },
      {
        href: "/admin/sales",
        label: "Ventas",
        icon: ShoppingCart,
        permission: "sales.view",
      },
      {
        href: "/admin/reports",
        label: "Reportes",
        icon: BarChart3,
        permission: "reports.view",
      },
    ],
  },
  {
    title: "Catálogos",
    items: [
      {
        href: "/admin/products",
        label: "Productos",
        icon: Package,
        permission: "products.view",
      },
      {
        href: "/admin/categories",
        label: "Categorías",
        icon: Tags,
        permission: "categories.manage",
      },
      {
        href: "/admin/customers",
        label: "Clientes",
        icon: Users,
        permission: "customers.view",
      },
      {
        href: "/admin/employees",
        label: "Empleados",
        icon: UserCog,
        permission: "employees.view",
      },
      {
        href: "/admin/promotions",
        label: "Promociones",
        icon: Percent,
        permission: "promotions.view",
      },
    ],
  },
  {
    title: "Operación",
    items: [
      {
        href: "/admin/inventory",
        label: "Inventario",
        icon: Boxes,
        permission: "inventory.view",
      },
      {
        href: "/admin/locations",
        label: "Sucursales",
        icon: MapPin,
        permission: "locations.view",
      },
      {
        href: "/admin/orders",
        label: "Pedidos",
        icon: ClipboardList,
        permission: "orders.view",
      },
      {
        href: "/admin/cedis",
        label: "CEDIS",
        icon: Warehouse,
        permission: "cedis.manage",
      },
    ],
  },
  {
    title: "Ajustes",
    items: [
      {
        href: "/admin/settings/appearance",
        label: "Apariencia",
        icon: Palette,
        permission: "settings.manage",
      },
      {
        href: "/admin/settings",
        label: "Ajustes",
        icon: Settings,
        permission: "settings.manage",
      },
      {
        href: "/admin/settings/users",
        label: "Usuarios y permisos",
        icon: ShieldCheck,
        permission: "users.manage",
      },
    ],
  },
];

/** Items principales para la BottomTabBar móvil (5.6). */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  {
    href: "/admin/sales",
    label: "Ventas",
    icon: ShoppingCart,
    permission: "sales.view",
  },
  { href: "/pos", label: "POS", icon: Boxes },
  {
    href: "/admin/customers",
    label: "Clientes",
    icon: Users,
    permission: "customers.view",
  },
  {
    href: "/admin/settings",
    label: "Ajustes",
    icon: Settings,
    permission: "settings.manage",
  },
];

/** Perfil mínimo de sesión que usan los filtros de navegación en cliente. */
export interface NavUser {
  user?: {
    role?: string | null;
    permissions?: PermissionKey[];
  } | null;
}

function navUserHasPermission(
  navUser: NavUser | null,
  permission?: PermissionKey
): boolean {
  if (!permission) return true;
  if (!navUser?.user) return false;
  const { role, permissions } = navUser.user;
  if (role === "superadmin" || role === "owner") return true;
  return permissions?.includes(permission) ?? false;
}

/** Filtra secciones según permisos de la sesión (server-side). */
export function filterNavSections(
  session: Session | null,
  sections: NavSection[] = NAV_SECTIONS
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || hasPermission(session, item.permission)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/** Igual que filterNavSections pero en cliente (los iconos viven del lado cliente). */
export function filterNavSectionsByUser(
  navUser: NavUser | null,
  sections: NavSection[] = NAV_SECTIONS
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        navUserHasPermission(navUser, item.permission)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function filterNavItems(
  navUser: NavUser | null,
  items: NavItem[]
): NavItem[] {
  return items.filter((item) => navUserHasPermission(navUser, item.permission));
}

/** ¿La ruta actual coincide con el item? */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match.test(pathname);
  if (item.href === "/admin") return pathname === "/admin";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}