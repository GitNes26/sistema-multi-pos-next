"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Store,
  ClipboardList,
  ListChecks,
  User,
  ShoppingCart,
} from "lucide-react";
import { usePortalStore } from "@/stores/portal-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CartSheet } from "@/components/portal/cart-sheet";
import { BulkModal } from "@/components/portal/bulk-modal";
import { TapScale } from "@/components/shared/tap-scale";

const NAV_ITEMS = [
  { href: "/portal", label: "Inicio", icon: Home, match: /^\/portal$/ },
  { href: "/portal/store", label: "Tienda", icon: Store },
  { href: "/portal/orders", label: "Pedidos", icon: ClipboardList },
  { href: "/portal/lists", label: "Listas", icon: ListChecks },
  { href: "/portal/profile", label: "Perfil", icon: User },
];

export function PortalShell({
  storeName,
  user,
  children,
}: {
  storeName: string;
  user: { name?: string | null; image?: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const itemCount = usePortalStore((s) => s.items.reduce((a, i) => a + i.qty, 0));
  const setCartOpen = usePortalStore((s) => s.setCartOpen);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <Link href="/portal" className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-5" />
          </span>
          <span className="truncate text-base font-semibold leading-tight">{storeName}</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/portal/profile"
            className="flex size-9 items-center justify-center rounded-xl border text-muted-foreground hover:bg-muted"
            aria-label="Perfil"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name ?? ""} className="size-9 rounded-xl object-cover" />
            ) : (
              <User className="size-5" />
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Carrito"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="size-5" />
            {itemCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">
                {itemCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t bg-background/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const active = item.match
              ? item.match.test(pathname)
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <TapScale key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                    active && "text-primary"
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
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
