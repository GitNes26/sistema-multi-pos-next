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
  Puzzle,
} from "lucide-react";
import { usePortalStore } from "@/stores/portal-store";
import { cn } from "@/lib/utils";
import { PortalHeader } from "@/components/portal/portal-header";
import { CartSheet } from "@/components/portal/cart-sheet";
import { BulkModal } from "@/components/portal/bulk-modal";
import { TapScale } from "@/components/shared/tap-scale";

export const ALL_NAV_ITEMS = [
  { id: "home", href: "/portal", label: "Inicio", icon: Home, match: /^\/portal$/ },
  { id: "combos", href: "/portal/combos", label: "Combos", icon: Puzzle, match: /^\/portal\/combos/ },
  { id: "store", href: "/portal/store", label: "Tienda", icon: Store, match: /^\/portal\/store/ },
  { id: "orders", href: "/portal/orders", label: "Pedidos", icon: ClipboardList, match: /^\/portal\/orders/ },
  { id: "lists", href: "/portal/lists", label: "Listas", icon: ListChecks, match: /^\/portal\/lists/ },
  { id: "favorites", href: "/portal/favorites", label: "Favoritos", icon: Heart, match: /^\/portal\/favorites/ },
  { id: "loyalty", href: "/portal/loyalty", label: "Puntos", icon: Star, match: /^\/portal\/loyalty/ },
  { id: "payment", href: "/portal/payment-methods", label: "Pagos", icon: CreditCard, match: /^\/portal\/payment/ },
  { id: "credit", href: "/portal/credit", label: "Crédito", icon: Landmark, match: /^\/portal\/credit/ },
  { id: "profile", href: "/portal/profile", label: "Perfil", icon: User, match: /^\/portal\/profile/ },
] as const;

export type NavItemId = (typeof ALL_NAV_ITEMS)[number]["id"];

const DEFAULT_NAV_ORDER: NavItemId[] = ["home", "combos", "store", "orders", "lists", "profile"];

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
  const activeNavIds = navOrder && navOrder.length >= 3 ? navOrder : DEFAULT_NAV_ORDER;
  const navItems = activeNavIds
    .map((id) => ALL_NAV_ITEMS.find((item) => item.id === id)!)
    .filter(Boolean);

  const colsClass =
    navItems.length <= 5
      ? `grid-cols-${navItems.length}`
      : "grid-cols-5";

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
      <PortalHeader storeName={storeName} logoUrl={logoUrl} user={user} />

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t bg-background/95 backdrop-blur safe-area-bottom">
        <div className={cn("grid", colsClass)}>
          {navItems.map((item) => {
            const active = item.match
              ? item.match.test(pathname)
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <TapScale key={item.href}>
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
        </div>
      </nav>

      <CartSheet />
      <BulkModal />
    </div>
  );
}
