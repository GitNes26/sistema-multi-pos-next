"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Settings2 } from "lucide-react"
import { motion } from "framer-motion"
import { usePortalStore } from "@/stores/portal-store"
import { ALL_NAV_ITEMS, type NavItemIdIncludingCombos } from "./portal-shell"
import { BottomSheet } from "./bottom-sheet"
import { Logo } from "@/components/layout/logo"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptics"

export function NavDrawer({
  storeName,
  logoUrl,
  user,
}: {
  storeName: string
  logoUrl?: string | null
  user: { name?: string | null; image?: string | null }
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
    .filter((item): item is (typeof ALL_NAV_ITEMS)[number] => Boolean(item))

  return (
    <BottomSheet
      open={navOpen}
      onOpenChange={setNavOpen}
      title="Menú"
      showCloseButton={true}
    >
      {/* Encabezado: tienda + usuario */}
      <div className="flex items-center gap-3 px-1 pb-3">
        <Logo size={40} logoUrl={logoUrl} className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{storeName}</p>
          <p className="truncate text-xs text-muted-foreground">
            Hola, {user.name?.split(" ")[0] ?? "bienvenido"}
          </p>
        </div>
      </div>

      {/* Activities */}
      <nav className="space-y-0.5 pb-2">
        {drawerItems.map((item, idx) => {
          const Icon = item.icon
          const active = item.match
            ? item.match.test(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.24), duration: 0.18 }}
            >
              <Link
                href={item.href}
                onClick={() => {
                  haptic.light()
                  setNavOpen(false)
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
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
            </motion.div>
          )
        })}
      </nav>

      {/* Personalizar navegación */}
      <div className="border-t pt-3 pb-2">
        <Link
          href="/portal/profile#nav-customizer"
          onClick={() => setNavOpen(false)}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Settings2 className="size-[18px]" />
          </span>
          <span className="flex-1">Personalizar navegación</span>
          <ChevronRight className="size-4 text-muted-foreground/60" />
        </Link>
      </div>
    </BottomSheet>
  )
}
