"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Settings2, X } from "lucide-react"
import { usePortalStore } from "@/stores/portal-store"
import { ALL_NAV_ITEMS, type NavItemIdIncludingCombos } from "./portal-shell"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Logo } from "@/components/layout/logo"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptics"

export function NavDrawer({
  storeName,
  logoUrl,
  user,
  canReserve,
}: {
  storeName: string
  logoUrl?: string | null
  user: { name?: string | null; image?: string | null }
  canReserve: boolean
}) {
  const pathname = usePathname()
  const navOpen = usePortalStore((s) => s.navOpen)
  const setNavOpen = usePortalStore((s) => s.setNavOpen)
  const navOrder = usePortalStore((s) => s.navOrder)

  // Drawer completo: primero el orden elegido por el usuario, luego el resto
  // de activities disponibles (para que ninguna quede inalcanzable).
  const orderedIds: NavItemIdIncludingCombos[] =
    navOrder && navOrder.length >= 3
      ? navOrder
      : ALL_NAV_ITEMS.map((i) => i.id)
  const inOrder = new Set(orderedIds)
  const drawerItems = [
    ...orderedIds,
    ...ALL_NAV_ITEMS.filter((i) => !inOrder.has(i.id)).map((i) => i.id),
  ]
    .map((id) => ALL_NAV_ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof ALL_NAV_ITEMS)[number] => item !== undefined && (item.id !== "reservations" || canReserve))

  return (
    <Sheet open={navOpen} onOpenChange={setNavOpen}>
      <SheetContent side="left" showCloseButton={false} style={{ width: "min(88vw, 22rem)", maxWidth: "22rem" }} className="gap-0 overflow-hidden p-0 safe-area-top safe-area-bottom">
        <SheetHeader className="flex-row items-center gap-3 border-b px-4 py-5 pr-14">
          <Logo size={44} logoUrl={logoUrl} className="shrink-0 rounded-xl" />
          <div className="min-w-0 text-left">
            <SheetTitle className="truncate text-base font-semibold">{storeName}</SheetTitle>
            <SheetDescription className="truncate">Hola, {user.name?.split(" ")[0] ?? "bienvenido"}</SheetDescription>
          </div>
          <SheetClose asChild><button type="button" className="absolute right-3 top-5 flex size-11 items-center justify-center rounded-xl hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" aria-label="Cerrar menú"><X className="size-5" /></button></SheetClose>
        </SheetHeader>

        <nav aria-label="Secciones del portal" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {drawerItems.map((item) => {
          const Icon = item.icon
          const active = item.match
            ? item.match.test(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <div key={item.id}>
              <Link
                href={item.href}
                onClick={() => {
                  haptic.light()
                  setNavOpen(false)
                }}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-primary/15" : "bg-muted"
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <span className="flex-1">{item.label}</span>
                {active && (
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                )}
                <ChevronRight className="size-4 text-muted-foreground/60" />
              </Link>
            </div>
          )
        })}
        </nav>

      <div className="border-t px-3 py-3">
        <Link
          href="/portal/profile#nav-customizer"
          onClick={() => setNavOpen(false)}
          className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Settings2 className="size-[18px]" />
          </span>
          <span className="flex-1">Personalizar navegación</span>
          <ChevronRight className="size-4 text-muted-foreground/60" />
        </Link>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-3 text-xs text-muted-foreground">
          <Link href="/legal/terminos" onClick={() => setNavOpen(false)} className="hover:text-foreground hover:underline">Términos</Link>
          <Link href="/legal/privacidad" onClick={() => setNavOpen(false)} className="hover:text-foreground hover:underline">Privacidad</Link>
          <Link href="/legal/comercio" onClick={() => setNavOpen(false)} className="hover:text-foreground hover:underline">Compras</Link>
        </div>
      </div>
      </SheetContent>
    </Sheet>
  )
}
