"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import {
  ChevronLeft,
  ShoppingCart,
  Bell,
  BellRing,
} from "lucide-react"
import { usePortalStore } from "@/stores/portal-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { TapScale } from "@/components/shared/tap-scale"
import { Logo } from "@/components/layout/logo"
import { playSound } from "@/lib/sounds"
import { usePushSound } from "@/hooks/use-push-sound"
import { PushSubscriber } from "@/components/portal/push-subscriber"

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
  "/portal/notifications": "Notificaciones",
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith("/portal/orders/")) return "Detalle"
  if (pathname.startsWith("/portal/lists/")) return "Mi Lista"
  return ""
}

function isSubPage(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  return segments.length >= 3
}

export function PortalHeader({
  storeName,
  logoUrl,
  user,
}: {
  storeName: string
  logoUrl?: string | null
  user: { name?: string | null; image?: string | null }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const itemCount = usePortalStore((s) => s.items.reduce((a, i) => a + i.qty, 0))
  const setCartOpen = usePortalStore((s) => s.setCartOpen)
  usePushSound()

  const [unreadCount, setUnreadCount] = useState(0)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const initialLoadDone = useRef(false)

  useEffect(() => {
    let active = true
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/portal/notifications", { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        const items = data.notifications ?? []
        const unread = items.filter((n: { readAt: string | null }) => !n.readAt)

        if (initialLoadDone.current && prevIdsRef.current.size > 0) {
          const newItems = items.filter((n: { id: string; readAt: string | null }) => !prevIdsRef.current.has(n.id) && !n.readAt)
          if (newItems.length > 0) playSound("notification")
        }

        prevIdsRef.current = new Set(items.map((n: { id: string }) => n.id))
        initialLoadDone.current = true
        if (active) setUnreadCount(unread.length)
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30_000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const showBack = isSubPage(pathname)
  const pageTitle = getPageTitle(pathname)

  return (
    <header className="sticky top-0 z-40 safe-area-top">
      <div className="flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-2.5 backdrop-blur-xl">
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          {showBack ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 -ml-1 size-9"
                onClick={() => router.back()}
                aria-label="Volver"
              >
                <ChevronLeft className="size-5" />
              </Button>
              {pageTitle && (
                <h1 className="truncate text-base font-semibold">{pageTitle}</h1>
              )}
            </>
          ) : (
            <Link href="/portal" className="flex items-center gap-2.5">
              <Logo size={24} logoUrl={logoUrl} className="rounded-xl" />
              <span className="truncate text-sm font-bold tracking-tight">{storeName}</span>
            </Link>
          )}
        </div>

        {/* Right — compact icon row: Cart → Bell → Theme → Avatar(rightmost) */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8"
            aria-label="Carrito"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="size-[18px]" />
            {itemCount > 0 && (
              <Badge className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center p-0 text-[9px] font-bold">
                {itemCount > 99 ? "99+" : itemCount}
              </Badge>
            )}
          </Button>

          <TapScale>
            <Link
              href="/portal/notifications"
              className="relative flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
              aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            >
              {unreadCount > 0 ? (
                <BellRing className="size-[18px] text-primary" />
              ) : (
                <Bell className="size-[18px]" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground animate-in zoom-in">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </TapScale>

          <PushSubscriber />
          <ThemeToggle />

          <TapScale>
            <Link
              href="/portal/profile"
              className="flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-primary/5"
              aria-label="Perfil"
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={user.name ?? ""} className="size-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-primary">
                  {(user.name ?? "?")[0]?.toUpperCase()}
                </span>
              )}
            </Link>
          </TapScale>
        </div>
      </div>
    </header>
  )
}
