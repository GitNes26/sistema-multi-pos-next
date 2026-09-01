import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BarChart3,
  Banknote,
  BellRing,
  Boxes,
  Briefcase,
  Building2,
  ChefHat,
  ClipboardList,
  CreditCard,
  Landmark,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Menu,
  Package,
  Puzzle,
  Palette,
  Percent,
  Ruler,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tags,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import type { Session } from "next-auth";
import { hasPermission, isSuperadminOnlyPermission } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import type { MenuNode } from "@/lib/menus/server";
import { resolveMenuIcon } from "@/lib/menu-icons";
import type { FeatureKey } from "@/lib/features";
import { NAV_HREF_TO_FEATURE, isFeatureEnabled } from "@/lib/features";
import type { BusinessMode } from "@/lib/auth/options";

// FASE 5.11 + FASE 14 — Rutas + íconos + permisos definidos UNA sola vez.
// Sidebar, BottomBar y Drawer consumen esta especificación (fallback hardcoded)
// o el árbol dinámico de BD (useMenus → menuTreeToSections).

export interface NavItem {
  href?: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  /** Feature flag key: si se define, el item solo se muestra si el feature está habilitado */
  feature?: FeatureKey;
  match?: RegExp;
  badge?: string;
  badgeVariant?: string;
  children?: NavItem[];
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
      {
        href: "/admin/notifications",
        label: "Notificaciones",
        icon: BellRing,
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
        href: "/admin/units",
        label: "Medidas",
        icon: Ruler,
        permission: "products.manage",
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
        href: "/admin/positions",
        label: "Puestos",
        icon: Briefcase,
        permission: "employees.view",
      },
      {
        href: "/admin/combos",
        label: "Combos",
        icon: Puzzle,
        permission: "products.manage",
        feature: "combos",
      },
      {
        href: "/admin/promotions",
        label: "Promociones",
        icon: Percent,
        permission: "promotions.view",
      },
      {
        href: "/admin/publications",
        label: "Publicaciones",
        icon: Megaphone,
        permission: "publications.manage",
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
        feature: "inventory",
      },
      {
        href: "/admin/locations",
        label: "Sucursales",
        icon: MapPin,
        permission: "locations.view",
      },
      {
        href: "/admin/cashRegisters",
        label: "Cajas",
        icon: Banknote,
        permission: "locations.view",
      },
      {
        href: "/admin/orders",
        label: "Pedidos",
        icon: ClipboardList,
        permission: "orders.view",
      },
      {
        href: "/admin/credits",
        label: "Crédito",
        icon: Landmark,
        permission: "orders.view",
        feature: "credit",
      },
      {
        href: "/admin/cedis",
        label: "CEDIS",
        icon: Warehouse,
        permission: "cedis.manage",
        feature: "cedis",
      },
      {
        href: "/admin/tables",
        label: "Mesas",
        icon: Armchair,
        permission: "locations.view",
        feature: "tables",
      },
      {
        href: "/kds",
        label: "Cocina (KDS)",
        icon: ChefHat,
        permission: "orders.view",
        feature: "kds",
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
        href: "/admin/settings/company",
        label: "Empresa",
        icon: Building2,
        permission: "settings.manage",
      },
      {
        href: "/admin/settings/loyalty",
        label: "Lealtad",
        icon: Sparkles,
        permission: "settings.manage",
      },
      {
        href: "/admin/settings/supervisor",
        label: "Supervisor",
        icon: ShieldCheck,
        permission: "settings.manage",
      },
      {
        href: "/admin/settings/payments",
        label: "Pagos",
        icon: CreditCard,
        permission: "settings.manage",
      },
      {
        href: "/admin/settings/delivery-policy",
        label: "Entrega",
        icon: Truck,
        permission: "settings.manage",
      },
      {
        href: "/admin/settings/credit-policy",
        label: "Crédito",
        icon: Landmark,
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
      {
        href: "/admin/settings/menus",
        label: "Menú",
        icon: Menu,
        permission: "users.manage",
      },
      {
        href: "/admin/settings/organizations",
        label: "Organizaciones y roles",
        icon: Building2,
        permission: "organizations.manage",
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
  if (isSuperadminOnlyPermission(permission)) return role === "superadmin";
  if (role === "superadmin" || role === "owner" || role === "admin") return true;
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

// ── BusinessMode Filtering ────────────────────────────────────────

/** Filtra items de nav por businessMode usando los feature flags. */
function navItemHasFeature(item: NavItem, mode: BusinessMode): boolean {
  // If no feature key is set, the item is always visible
  if (!item.feature) return true;
  return isFeatureEnabled(item.feature, mode);
}

/** Filtra secciones de nav por permisos Y businessMode (server-side). */
export function filterNavSectionsByFeature(
  mode: BusinessMode,
  sections: NavSection[] = NAV_SECTIONS
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => navItemHasFeature(item, mode)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Filtra por permisos + businessMode (cliente-side, iconos vivos). */
export function filterNavSectionsByUserAndFeature(
  navUser: NavUser | null,
  mode: BusinessMode,
  sections: NavSection[] = NAV_SECTIONS
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          navUserHasPermission(navUser, item.permission) &&
          navItemHasFeature(item, mode)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/** Check if a nav href is available for the given businessMode. */
export function isNavHrefEnabled(href: string, mode: BusinessMode): boolean {
  const feature = NAV_HREF_TO_FEATURE[href];
  if (!feature) return true; // No feature mapping = always visible
  return isFeatureEnabled(feature, mode);
}

export function filterNavItems(
  navUser: NavUser | null,
  items: NavItem[]
): NavItem[] {
  return items.filter((item) => navUserHasPermission(navUser, item.permission));
}

/** ¿La ruta actual coincide con el item? (considera hijos) */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match.test(pathname);
  if (item.children?.length) {
    if (item.children.some((c) => isNavActive(c, pathname))) return true;
  }
  if (!item.href) return false;
  if (item.href === "/admin") return pathname === "/admin";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Convierte el árbol de BD (MenuNode) a NavSection[] con íconos resueltos. */
function mapMenuItem(n: MenuNode): NavItem {
  return {
    href: n.href ?? undefined,
    label: n.label,
    icon: resolveMenuIcon(n.icon),
    permission: (n.permissionKey as PermissionKey | null) ?? undefined,
    badge: n.badge ?? undefined,
    badgeVariant: n.badgeVariant ?? undefined,
    children: n.children.length ? n.children.map(mapMenuItem) : undefined,
  };
}

export function menuTreeToSections(tree: MenuNode[]): NavSection[] {
  return tree.map((n) => {
    if (n.type === "section") {
      return { title: n.label, items: n.children.map(mapMenuItem) };
    }
    return { items: [mapMenuItem(n)] };
  });
}

/** Aplana los items (con href) del árbol para la BottomTabBar. */
export function menuTreeToBottomItems(tree: MenuNode[], limit = 5): NavItem[] {
  const out: NavItem[] = [];
  const walk = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      if (n.type === "item" && n.href) {
        out.push(mapMenuItem(n));
        if (out.length >= limit) return;
      }
      walk(n.children);
      if (out.length >= limit) return;
    }
  };
  walk(tree);
  return out.slice(0, limit);
}