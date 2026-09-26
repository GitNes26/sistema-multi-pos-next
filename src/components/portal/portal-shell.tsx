"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Home,
  Store,
  ClipboardList,
  ListChecks,
  User,
  Heart,
  Star,
  CreditCard,
  Landmark,
  CalendarCheck2,
  Menu,
} from "lucide-react";
import { usePortalStore } from "@/stores/portal-store";
import { cn } from "@/lib/utils";
import { PortalHeader } from "@/components/portal/portal-header";
import { CartSheet } from "@/components/portal/cart-sheet";
import { BulkModal } from "@/components/portal/bulk-modal";
import { NavDrawer } from "@/components/portal/nav-drawer";
import { motion } from "framer-motion";
import { TapScale } from "@/components/shared/tap-scale";
import { haptic } from "@/lib/haptics";

export const ALL_NAV_ITEMS = [
  { id: "home", href: "/portal", label: "Inicio", icon: Home, match: /^\/portal$/ },
  { id: "store", href: "/portal/store", label: "Tienda", icon: Store, match: /^\/portal\/store/ },
  { id: "reservations", href: "/portal/reservations", label: "Reservar", icon: CalendarCheck2, match: /^\/portal\/reservations/ },
  { id: "orders", href: "/portal/orders", label: "Pedidos", icon: ClipboardList, match: /^\/portal\/orders/ },
  { id: "lists", href: "/portal/lists", label: "Listas", icon: ListChecks, match: /^\/portal\/lists/ },
  { id: "favorites", href: "/portal/favorites", label: "Favoritos", icon: Heart, match: /^\/portal\/favorites/ },
  { id: "loyalty", href: "/portal/loyalty", label: "Puntos", icon: Star, match: /^\/portal\/loyalty/ },
  { id: "payment", href: "/portal/payment-methods", label: "Pagos", icon: CreditCard, match: /^\/portal\/payment/ },
  { id: "credit", href: "/portal/credit", label: "Crédito", icon: Landmark, match: /^\/portal\/credit/ },
  { id: "profile", href: "/portal/profile", label: "Perfil", icon: User, match: /^\/portal\/profile/ },
] as const;

export type NavItemId = (typeof ALL_NAV_ITEMS)[number]["id"];
export type NavItemIdIncludingCombos = NavItemId | "combos";

const DEFAULT_NAV_ORDER: NavItemIdIncludingCombos[] = [
  "home",
  "store",
  "reservations",
  "orders",
  "lists",
  "profile",
  "combos",
];

export const HIDDEN_FROM_BAR: NavItemIdIncludingCombos[] = ["combos"]; // Sin botón propio; acceden desde otra ruta.
export const NAV_LAYOUT = 5; // Columnas de la barra: 4 activities + botón "Menú" cuando hay más vistas.

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function PortalShell({
  storeName,
  logoUrl,
  businessMode,
  user,
  children,
}: {
  storeName: string;
  logoUrl?: string | null;
  businessMode?: string | null;
  user: { name?: string | null; image?: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const keepCustomerInPortal = () => {
      if (window.location.pathname === "/" || window.location.pathname === "/portal/auth/login") {
        window.history.replaceState(window.history.state, "", "/portal");
        router.replace("/portal");
      }
    };
    window.addEventListener("popstate", keepCustomerInPortal);
    return () => window.removeEventListener("popstate", keepCustomerInPortal);
  }, [router]);
  const canReserve = businessMode === "food_service" || businessMode === "hybrid";
  const navOrder = usePortalStore((s) => s.navOrder);
  const orderedIds: NavItemIdIncludingCombos[] =
    (navOrder && navOrder.length >= 3 ? navOrder : DEFAULT_NAV_ORDER)
      .filter((id) => id !== "reservations" || canReserve);

  // Vistas fuera de la barra (ocultas por diseño o que no alcanzaron cupo).
  const hiddenSet = new Set(orderedIds.filter((id) => HIDDEN_FROM_BAR.includes(id)));
  const capacity = NAV_LAYOUT - 1; // 1 slot reservado para "Menú"
  const barItems = orderedIds
    .filter((id) => !HIDDEN_FROM_BAR.includes(id))
    .slice(0, capacity)
    .map((id) => ALL_NAV_ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof ALL_NAV_ITEMS)[number] => Boolean(item));

  const hasMore =
    hiddenSet.size > 0 || orderedIds.filter((id) => !HIDDEN_FROM_BAR.includes(id)).length > capacity;

  const isActive = (item: (typeof ALL_NAV_ITEMS)[number]) =>
    item.match
      ? item.match.test(pathname)
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Si la página actual no corresponde a ningún botón de la barra (p. ej.
  // Favoritos desde el menú), resaltar "Menú" para indicar dónde estás.
  const currentInBar = barItems.some((item) => isActive(item));

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
      <PortalHeader storeName={storeName} logoUrl={logoUrl} user={user} />

      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t bg-background/92 safe-area-bottom supports-backdrop-filter:bg-background/80 supports-backdrop-filter:backdrop-blur-xl"
      >
        <div className={cn("grid", GRID_COLS[barItems.length + (hasMore ? 1 : 0)] ?? "grid-cols-5")}>
          {barItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <TapScale key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 text-xs font-medium text-muted-foreground transition-colors outline-none focus-visible:text-foreground",
                    active && "font-semibold text-foreground"
                  )}
                >
                  {/* Indicador activo tipo píldora que viaja entre pestañas */}
                  <span className="relative flex h-8 w-14 items-center justify-center">
                    {active && (
                      <motion.span
                        layoutId="portal-tab-pill"
                        className="absolute inset-0 rounded-full bg-primary/14"
                        transition={{ type: "spring", stiffness: 520, damping: 40 }}
                      />
                    )}
                    <Icon className={cn("relative size-5", active && "text-primary")} strokeWidth={active ? 2.4 : 1.9} />
                  </span>
                  <span className="leading-none">{item.label}</span>
                </Link>
              </TapScale>
            );
          })}

          {hasMore && (
            <TapScale>
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  usePortalStore.getState().setNavOpen(true);
                }}
                className={cn(
                  "flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground",
                  !currentInBar && "font-semibold text-foreground"
                )}
                aria-label="Abrir menú de navegación"
              >
                <span className="relative flex h-8 w-14 items-center justify-center">
                  {!currentInBar && (
                    <motion.span
                      layoutId="portal-tab-pill"
                      className="absolute inset-0 rounded-full bg-primary/14"
                      transition={{ type: "spring", stiffness: 520, damping: 40 }}
                    />
                  )}
                  <Menu className={cn("relative size-5", !currentInBar && "text-primary")} strokeWidth={1.9} />
                </span>
                <span className="leading-none">Menú</span>
              </button>
            </TapScale>
          )}
        </div>
      </nav>

      <NavDrawer storeName={storeName} logoUrl={logoUrl} user={user} canReserve={canReserve} />
      <CartSheet />
      <BulkModal />
    </div>
  );
}
