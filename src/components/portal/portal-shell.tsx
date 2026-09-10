"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  user,
  children,
}: {
  storeName: string;
  logoUrl?: string | null;
  user: { name?: string | null; image?: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navOrder = usePortalStore((s) => s.navOrder);
  const orderedIds: NavItemIdIncludingCombos[] =
    navOrder && navOrder.length >= 3 ? navOrder : DEFAULT_NAV_ORDER;

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

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t bg-background/95 backdrop-blur safe-area-bottom">
        <div className={cn("grid", GRID_COLS[barItems.length + (hasMore ? 1 : 0)] ?? "grid-cols-5")}>
          {barItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <TapScale key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors",
                    active && "text-primary"
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
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
                  "flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                  !currentInBar && "text-primary"
                )}
                aria-label="Abrir menú de navegación"
              >
                <Menu className="size-5" strokeWidth={2} />
                <span className="leading-none">Menú</span>
              </button>
            </TapScale>
          )}
        </div>
      </nav>

      <NavDrawer storeName={storeName} logoUrl={logoUrl} user={user} />
      <CartSheet />
      <BulkModal />
    </div>
  );
}
