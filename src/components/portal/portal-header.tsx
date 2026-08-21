"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft, Store, ShoppingCart, User } from "lucide-react"
import { usePortalStore } from "@/stores/portal-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { TapScale } from "@/components/shared/tap-scale"

const PAGE_TITLES: Record<string, string> = {
  "/portal": "",
  "/portal/store": "Tienda",
  "/portal/orders": "Mis Pedidos",
  "/portal/lists": "Mis Listas",
  "/portal/profile": "Mi Perfil",
  "/portal/checkout": "Pagar",
  "/portal/loyalty": "Mis Puntos",
  "/portal/favorites": "Favoritos",
  "/portal/payment-methods": "Métodos de Pago",
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith("/portal/orders/")) return "Detalle del Pedido"
  if (pathname.startsWith("/portal/lists/")) return "Mi Lista"
  return ""
}

function isSubPage(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  return segments.length >= 3
}

export function PortalHeader({
  storeName,
  user,
}: {
  storeName: string
  user: { name?: string | null; image?: string | null }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const itemCount = usePortalStore((s) => s.items.reduce((a, i) => a + i.qty, 0))
  const setCartOpen = usePortalStore((s) => s.setCartOpen)

  const showBack = isSubPage(pathname)
  const pageTitle = getPageTitle(pathname)
  const isHome = pathname === "/portal"

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
      {/* Left side: back button or logo */}
      {showBack ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 -ml-1"
          onClick={() => router.back()}
          aria-label="Volver"
        >
          <ChevronLeft className="size-5" />
        </Button>
      ) : (
        <Link href="/portal" className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold leading-tight">
            {storeName}
          </span>
        </Link>
      )}

      {/* Center: page title (on sub-pages) */}
      {showBack && pageTitle && (
        <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {pageTitle}
        </span>
      )}

      {/* Right side */}
      <div className="flex items-center gap-0.5">
        <ThemeToggle />
        <TapScale>
          <Link
            href="/portal/profile"
            className="flex size-8 items-center justify-center rounded-xl border text-muted-foreground hover:bg-muted"
            aria-label="Perfil"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? ""}
                className="size-8 rounded-xl object-cover"
              />
            ) : (
              <User className="size-4" />
            )}
          </Link>
        </TapScale>
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
  )
}
