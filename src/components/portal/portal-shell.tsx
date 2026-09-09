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
  MoreHorizontal,
} from "lucide-react";
import { usePortalStore } from "@/stores/portal-store";
import { cn } from "@/lib/utils";
import { PortalHeader } from "@/components/portal/portal-header";
import { CartSheet } from "@/components/portal/cart-sheet";
import { BulkModal } from "@/components/portal/bulk-modal";
import { TapScale } from "@/components/shared/tap-scale";

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
export const NAV_LAYOUT = 5; // Botones visibles en la barra inferior; el resto va a menú.

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

  // Barra: máximo NAV_LAYOUT botones + ítems ocultos en menú (movilidad).
  const barItems: NavItemIdIncludingCombos[] = orderedIds.filter(
    (id) => !HIDDEN_FROM_BAR.includes(id)
  ).slice(0, NAV_LAYOUT);
  const hiddenItems: NavItemIdIncludingCombos[] = orderedIds.filter((id) =>
    HIDDEN_FROM_BAR.includes(id)
  );
  const barIds = new Set(barItems);
  const menuItems = ALL_NAV_ITEMS.filter((item) =>
    !orderedIds.includes(item.id) && !barIds.has(item.id)
  );

  const bar: {
    id: string;
    href: string;
    icon: typeof Home;
    active: boolean;
  }[] = [];
  for (const id of barItems) {
    const found = ALL_NAV_ITEMS.find((item) => item.id === id);
    if (!found) continue;
    bar.push({
      id: found.id,
      href: found.href,
      icon: found.icon,
      active:
        found.match
          ? found.match.test(pathname)
          : pathname === found.href || pathname.startsWith(`${found.href}/`),
    });
  }

  const colsClass =
    bar.length <= 3 ? `grid-cols-${bar.length}` : "grid-cols-5";

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
      <PortalHeader storeName={storeName} logoUrl={logoUrl} user={user} />

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t bg-background/95 backdrop-blur safe-area-bottom">
        {bar.length > 0 ? (
          <div className={cn("grid", colsClass)}>
            {bar.map((item) => {
              const Icon = item.icon;
              const label =
                ALL_NAV_ITEMS.find((it) => it.id === item.id)?.label ??
                "";
              return (
                <TapScale key={item.id}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors",
                      item.active && "text-primary"
                    )}
                  >
                    <Icon
                      className="size-5"
                      strokeWidth={item.active ? 2.5 : 2}
                    />
                    <span className="leading-none">{label}</span>
                  </Link>
                </TapScale>
              );
            })}
          </div>
        ) : null}

        {(hiddenItems.length > 0 || menuItems.length > 0) && (
          <button
            type="button"
            onClick={() => usePortalStore.getState().setNavOpen(true)}
            className="flex items-center justify-center py-2.5 text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
            aria-label="Más opciones de navegación"
          >
            <MoreHorizontal className="size-5" />
          </button>
        )}
      </nav>

      <CartSheet />
      <BulkModal />
    </div>
  );
}
