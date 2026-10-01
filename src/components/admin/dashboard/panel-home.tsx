"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { ArrowRight, ArrowLeftRight, Boxes, Banknote, ClipboardList, Undo2 } from "lucide-react"
import { NAV_SECTIONS, filterNavSectionsByUserAndFeature } from "@/lib/nav"
import type { BusinessMode, } from "@/lib/auth/options"
import { cn } from "@/lib/utils"

interface Live {
  orders: number | null
  lowStock: number | null
  openRegisters: number | null
  transfers: number | null
  returns: number | null
}

/** Logo de la empresa, grande y centrado, como fondo tenue del panel. */
export function PanelBackdrop({ logoUrl }: { logoUrl: string | null }) {
  if (!logoUrl) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-contain bg-center bg-no-repeat opacity-[0.06] dark:opacity-[0.08]"
      style={{ backgroundImage: `url("${logoUrl.replace(/"/g, "%22")}")`, backgroundSize: "min(70%, 34rem)" }}
    />
  )
}

/** Pulso operativo: lo que pide atención ahora, solo con lo que el usuario puede ver. */
export function LiveStrip() {
  const [live, setLive] = useState<Live | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch("/api/panel/live")
        .then((r) => r.json())
        .then((d) => alive && d.ok && setLive(d.live))
        .catch(() => undefined)
    void load()
    const t = window.setInterval(load, 60_000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])
  if (!live) return null

  const tiles = [
    { key: "orders", label: "Pedidos en curso", value: live.orders, href: "/admin/orders", icon: ClipboardList, warn: (live.orders ?? 0) > 0 },
    { key: "stock", label: "Bajo mínimo", value: live.lowStock, href: "/admin/inventory", icon: Boxes, warn: (live.lowStock ?? 0) > 0 },
    { key: "cash", label: "Cajas abiertas", value: live.openRegisters, href: "/admin/sales", icon: Banknote, warn: false },
    { key: "transfers", label: "Traslados en curso", value: live.transfers, href: "/admin/inventory?tab=transfers", icon: ArrowLeftRight, warn: false },
    { key: "returns", label: "Devoluciones por resolver", value: live.returns, href: "/admin/sales", icon: Undo2, warn: (live.returns ?? 0) > 0 },
  ].filter((t) => t.value != null)
  if (tiles.length === 0) return null

  return (
    <section aria-label="Operación ahora" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "press flex items-center gap-3 rounded-2xl border bg-card/90 p-3 backdrop-blur-sm transition-colors hover:border-primary/40",
            t.warn && "border-warning/50"
          )}
        >
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", t.warn ? "bg-warning/15 text-warning-ink" : "bg-primary/10 text-primary")}>
            <t.icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-heading text-xl font-semibold leading-none tabular-nums">{t.value}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t.label}</span>
          </span>
        </Link>
      ))}
    </section>
  )
}

/** Sin permiso para ver las métricas: accesos directos a lo que su rol sí puede usar. */
export function QuickAccess({ roleName }: { roleName: string | null }) {
  const { data: session } = useSession()
  const mode = ((session?.user as { businessMode?: BusinessMode } | undefined)?.businessMode ?? "retail") as BusinessMode
  const sections = useMemo(
    () =>
      filterNavSectionsByUserAndFeature(
        { user: { role: session?.user?.role, permissions: session?.user?.permissions, planDenied: session?.user?.planDenied } },
        mode,
        NAV_SECTIONS
      )
        .map((s) => ({ ...s, items: s.items.filter((i) => i.href && i.href !== "/admin") }))
        .filter((s) => s.items.length > 0),
    [session, mode]
  )
  const name = session?.user?.name?.split(" ")[0]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{name ? `Hola, ${name}` : "Bienvenido"}</h2>
        <p className="text-sm text-muted-foreground">
          {roleName ? `Estos son los accesos de tu rol (${roleName}).` : "Estos son tus accesos."} Las métricas del negocio requieren el permiso de reportes.
        </p>
      </div>
      {sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Tu rol aún no tiene módulos asignados. Pide a un administrador que revise tus permisos.</p>
      ) : (
        sections.map((s) => (
          <section key={s.title ?? "x"} className="space-y-2">
            {s.title && <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.title}</h3>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href!}
                  className="press group flex min-h-14 items-center gap-3 rounded-2xl border bg-card/90 p-3 backdrop-blur-sm transition-colors hover:border-primary/40"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <i.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{i.label}</span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
