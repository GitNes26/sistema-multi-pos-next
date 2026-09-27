"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarRange, MapPin } from "lucide-react"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { DatePicker } from "@/components/base/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { crudApi } from "@/lib/api"
import { fmt, type ReportFilters } from "./report-kit"

// Barra de filtros común a los reportes: periodo (atajos o fechas) y sucursal.

export type PeriodPreset = "7d" | "30d" | "month" | "prev_month" | "90d" | "custom"

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function presetRange(preset: Exclude<PeriodPreset, "custom">): { from: string; to: string } {
  const now = new Date()
  const back = (days: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - days + 1)
    return iso(d)
  }
  switch (preset) {
    case "7d": return { from: back(7), to: iso(now) }
    case "30d": return { from: back(30), to: iso(now) }
    case "90d": return { from: back(90), to: iso(now) }
    case "month": return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
    case "prev_month": return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
  }
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Este mes" },
  { value: "prev_month", label: "Mes anterior" },
  { value: "90d", label: "90 días" },
  { value: "custom", label: "Fechas" },
]

const toDate = (s: string) => (s ? new Date(`${s}T12:00:00`) : null)

export function useReportFiltersState(initial: Exclude<PeriodPreset, "custom"> = "30d") {
  const [preset, setPreset] = useState<PeriodPreset>(initial)
  const [range, setRange] = useState(() => presetRange(initial))
  const [locationId, setLocationId] = useState("")
  const filters: ReportFilters = useMemo(() => ({ ...range, locationId }), [range, locationId])
  return { preset, setPreset, range, setRange, locationId, setLocationId, filters }
}

export function ReportFiltersBar({
  state,
  showLocation = true,
  extra,
}: {
  state: ReturnType<typeof useReportFiltersState>
  showLocation?: boolean
  extra?: React.ReactNode
}) {
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!showLocation) return
    crudApi
      .list("locations", { pageSize: 250 })
      .then((r) => setLocations(r.rows.filter((x) => x.isActive !== false).map((x) => ({ id: String(x.id), name: String(x.name) }))))
      .catch(() => setLocations([]))
  }, [showLocation])

  const choose = (p: PeriodPreset) => {
    state.setPreset(p)
    if (p !== "custom") state.setRange(presetRange(p))
  }

  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-3 mb-4 border-b bg-background/85 px-3 py-2.5 backdrop-blur-md sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter options={PRESETS} value={state.preset} onChange={choose} ariaLabel="Periodo" />
        {state.preset === "custom" ? (
          <div className="flex items-center gap-2">
            <DatePicker
              value={toDate(state.range.from)}
              onChange={(d) => d && state.setRange((r) => ({ ...r, from: iso(d) }))}
              placeholder="Desde"
              className="w-40"
            />
            <span className="text-sm text-muted-foreground">a</span>
            <DatePicker
              value={toDate(state.range.to)}
              onChange={(d) => d && state.setRange((r) => ({ ...r, to: iso(d) }))}
              placeholder="Hasta"
              className="w-40"
            />
          </div>
        ) : (
          <span className="hidden items-center gap-1.5 text-sm text-muted-foreground md:inline-flex">
            <CalendarRange className="size-4" />
            {fmt.day(state.range.from)} – {fmt.day(state.range.to)}
          </span>
        )}
        {showLocation && locations.length > 1 && (
          <Select value={state.locationId || "all"} onValueChange={(v) => state.setLocationId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-auto min-w-44" aria-label="Sucursal">
              <MapPin className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {extra && <div className="ml-auto flex flex-wrap items-center gap-2">{extra}</div>}
      </div>
    </div>
  )
}
