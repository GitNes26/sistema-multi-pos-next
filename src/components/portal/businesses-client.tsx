"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { AnimatePresence, motion } from "framer-motion"
import { Bike, Check, ChevronDown, Clock, Globe, Loader2, LocateFixed, Mail, MapPin, Navigation, Phone, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ClearFiltersButton } from "@/components/base/clear-filters-button"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { BUSINESS_MODES } from "@/lib/business-modes"
import type { BusinessMode } from "@/lib/auth/options"
import { distanceKm, formatDistance } from "@/lib/geo"
import { matchesSearch } from "@/lib/search"
import { swalError } from "@/lib/swal"
import { cn } from "@/lib/utils"

interface Branch {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  hours: string | null
  open: boolean | null
  statusLabel: string
  allowsDelivery: boolean
  allowsPickup: boolean
  mapUrl: string | null
}

interface Business {
  id: string
  name: string
  businessMode: string
  logoUrl: string | null
  city: string | null
  state: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  hue: number | null
  joined: boolean
  customerCode: string | null
  open: boolean | null
  delivers: boolean
  locations: Branch[]
}

type Coords = { lat: number; lng: number }

const modeLabel = (mode: string) => BUSINESS_MODES[mode as BusinessMode]?.label ?? mode
const webHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

function OpenBadge({ open, label }: { open: boolean | null; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        open === null ? "bg-muted text-muted-foreground" : open ? "bg-success/15 text-success-ink" : "bg-destructive/10 text-destructive"
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", open === null ? "bg-muted-foreground/60" : open ? "bg-success" : "bg-destructive")} />
      {label}
    </span>
  )
}

function ContactLink({ href, icon: Icon, children }: { href: string; icon: typeof Phone; children: React.ReactNode }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  )
}

/** Elegir (o unirse a) un negocio: cada uno conserva su propio historial, puntos y crédito. */
export function BusinessesClient({ activeOrganizationId, name }: { activeOrganizationId: string | null; name: string }) {
  const router = useRouter()
  const { update } = useSession()
  const [rows, setRows] = useState<Business[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [mode, setMode] = useState("")
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [onlyDelivery, setOnlyDelivery] = useState(false)
  const [onlyMine, setOnlyMine] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    fetch("/api/portal/businesses", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(d.businesses ?? []))
      .catch(() => setRows([]))
  }, [])

  const locate = () => {
    if (!navigator.geolocation) {
      swalError("Ubicación no disponible", "Tu navegador no permite obtener la ubicación.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocating(false)
        swalError("No pudimos ubicarte", "Permite el acceso a tu ubicación para ordenar por cercanía.")
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  /** Cada negocio con la distancia de su sucursal más cercana (si hay ubicación) y sus sucursales ordenadas. */
  const enriched = useMemo(() => {
    return (rows ?? []).map((b) => {
      const locations = b.locations
        .map((l) => ({ ...l, km: coords && l.latitude != null && l.longitude != null ? distanceKm(coords.lat, coords.lng, l.latitude, l.longitude) : null }))
        .sort((a, c) => (a.km ?? Infinity) - (c.km ?? Infinity))
      return { ...b, locations, km: locations.find((l) => l.km != null)?.km ?? null }
    })
  }, [rows, coords])

  const modes = useMemo(() => [...new Set((rows ?? []).map((b) => b.businessMode))].map((m) => ({ value: m, label: modeLabel(m) })), [rows])

  const visible = useMemo(() => {
    const list = enriched.filter((b) => {
      if (onlyOpen && b.open !== true) return false
      if (onlyDelivery && !b.delivers) return false
      if (onlyMine && !b.joined) return false
      if (mode && b.businessMode !== mode) return false
      if (q.trim()) {
        const haystack = [b.name, b.city, b.state, modeLabel(b.businessMode), ...b.locations.map((l) => `${l.name} ${l.address ?? ""}`)].filter(Boolean).join(" ")
        if (!matchesSearch(haystack, q)) return false
      }
      return true
    })
    // Con ubicación: la más cercana primero (los que no tienen coordenadas al final); si no, por nombre.
    return list.sort((a, c) => (coords ? (a.km ?? Infinity) - (c.km ?? Infinity) : 0) || a.name.localeCompare(c.name, "es"))
  }, [enriched, onlyOpen, onlyDelivery, onlyMine, mode, q, coords])

  const filtersActive = Boolean(q || mode || onlyOpen || onlyDelivery || onlyMine)
  const clearFilters = () => {
    setQ("")
    setMode("")
    setOnlyOpen(false)
    setOnlyDelivery(false)
    setOnlyMine(false)
  }

  const enter = async (b: Business) => {
    setBusy(b.id)
    try {
      if (!b.joined) {
        const res = await fetch("/api/portal/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: b.id }),
        })
        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo unir al negocio")
      }
      await update({ activeOrganizationId: b.id })
      router.replace("/portal")
      router.refresh()
    } catch (e) {
      swalError("No se pudo entrar al negocio", e instanceof Error ? e.message : undefined)
      setBusy(null)
    }
  }

  const chip = (active: boolean) =>
    cn(
      "press inline-flex min-h-9 touch-manipulation items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap",
      active ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/50"
    )

  return (
    <main className="mx-auto min-h-dvh max-w-2xl space-y-5 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="space-y-1 pt-4">
        <p className="text-sm text-muted-foreground">{name ? `Hola, ${name.split(" ")[0]}` : "Bienvenido"}</p>
        <h1 className="text-2xl font-bold">¿A qué negocio quieres comprar?</h1>
        <p className="text-sm text-muted-foreground">Tu cuenta sirve para todos. En cada negocio llevas tus propios pedidos, puntos, crédito, listas y favoritos.</p>
      </header>

      <section aria-label="Filtros" className="space-y-3">
        <InputGroupField label="Buscar" type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Negocio, ciudad, sucursal o dirección" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(Boolean(coords))} onClick={coords ? () => setCoords(null) : locate} disabled={locating} aria-pressed={Boolean(coords)}>
            {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
            {coords ? "Ordenado por cercanía" : "Cerca de mí"}
          </button>
          <button type="button" className={chip(onlyOpen)} onClick={() => setOnlyOpen((v) => !v)} aria-pressed={onlyOpen}>
            <Clock className="size-4" /> Abierto ahora
          </button>
          <button type="button" className={chip(onlyDelivery)} onClick={() => setOnlyDelivery((v) => !v)} aria-pressed={onlyDelivery}>
            <Bike className="size-4" /> Entrega a domicilio
          </button>
          <button type="button" className={chip(onlyMine)} onClick={() => setOnlyMine((v) => !v)} aria-pressed={onlyMine}>
            <Check className="size-4" /> Mis negocios
          </button>
        </div>
        {modes.length > 1 && (
          <FormCombobox
            ariaLabel="Tipo de negocio"
            options={modes}
            value={mode}
            onChange={setMode}
            onClear={() => setMode("")}
            placeholder="Todos los tipos de negocio"
            searchable={false}
          />
        )}
        <ClearFiltersButton active={filtersActive} onClear={clearFilters} />
      </section>

      {rows === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Store}
          title={rows.length === 0 ? "Aún no hay negocios disponibles" : "Ningún negocio coincide"}
          description={rows.length === 0 ? "Vuelve más tarde." : "Prueba con otros filtros o limpia la búsqueda."}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((b, i) => {
            const isOpen = expanded === b.id
            const place = [b.city, b.state].filter(Boolean).join(", ")
            return (
              <motion.li key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className={cn("overflow-hidden rounded-2xl border bg-card", b.id === activeOrganizationId && "border-primary ring-1 ring-primary")}>
                <div className="flex items-center gap-3 p-4">
                  <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                    {b.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Store className="size-6 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-semibold">{b.name}</span>
                      <OpenBadge open={b.open} label={b.open === null ? "Sin horario" : b.open ? "Abierto" : "Cerrado"} />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {modeLabel(b.businessMode)}
                      {place ? ` · ${place}` : ""}
                      {b.km != null ? ` · a ${formatDistance(b.km)}` : ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {b.joined ? `Cliente ${b.customerCode ?? ""}`.trim() : "Aún no eres cliente · te registramos al entrar"}
                      {` · ${b.locations.length} ${b.locations.length === 1 ? "sucursal" : "sucursales"}`}
                    </span>
                  </span>
                  <Button type="button" size="sm" disabled={busy !== null} onClick={() => void enter(b)} className="shrink-0">
                    {busy === b.id ? <Loader2 className="size-4 animate-spin" /> : b.id === activeOrganizationId ? <Check className="size-4" /> : b.joined ? "Entrar" : "Unirme"}
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 w-full items-center justify-between gap-2 border-t px-4 text-sm text-muted-foreground hover:bg-muted/40"
                >
                  <span>{isOpen ? "Ocultar detalles" : "Ver detalles y sucursales"}</span>
                  <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="space-y-4 border-t bg-muted/20 p-4">
                        {(b.phone || b.email || b.website || b.address) && (
                          <div className="flex flex-col gap-1">
                            {b.address && (
                              <span className="inline-flex items-start gap-1.5 text-sm">
                                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                {b.address}
                              </span>
                            )}
                            {b.phone && <ContactLink href={`tel:${b.phone.replace(/\s+/g, "")}`} icon={Phone}>{b.phone}</ContactLink>}
                            {b.email && <ContactLink href={`mailto:${b.email}`} icon={Mail}>{b.email}</ContactLink>}
                            {b.website && <ContactLink href={webHref(b.website)} icon={Globe}>{b.website}</ContactLink>}
                          </div>
                        )}

                        {b.locations.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Este negocio aún no publica sucursales.</p>
                        ) : (
                          <ul className="space-y-3">
                            {b.locations.map((l) => (
                              <li key={l.id} className="space-y-1.5 rounded-xl border bg-card p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">{l.name}</span>
                                  <OpenBadge open={l.open} label={l.statusLabel} />
                                </div>
                                {l.address && (
                                  <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
                                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                                    {l.address}
                                    {l.km != null ? ` · a ${formatDistance(l.km)}` : ""}
                                  </span>
                                )}
                                {l.hours && (
                                  <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
                                    <Clock className="mt-0.5 size-3.5 shrink-0" />
                                    {l.hours}
                                  </span>
                                )}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                                  {l.phone && <ContactLink href={`tel:${l.phone.replace(/\s+/g, "")}`} icon={Phone}>{l.phone}</ContactLink>}
                                  {l.email && <ContactLink href={`mailto:${l.email}`} icon={Mail}>{l.email}</ContactLink>}
                                  {l.mapUrl && <ContactLink href={l.mapUrl} icon={Navigation}>Cómo llegar</ContactLink>}
                                </div>
                                {(l.allowsPickup || l.allowsDelivery) && (
                                  <p className="text-xs text-muted-foreground">{[l.allowsPickup ? "Recoger en tienda" : null, l.allowsDelivery ? "Entrega a domicilio" : null].filter(Boolean).join(" · ")}</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </ul>
      )}
      {activeOrganizationId && (
        <Button variant="ghost" className="w-full" onClick={() => router.push("/portal")}>
          Volver a la tienda
        </Button>
      )}
    </main>
  )
}
