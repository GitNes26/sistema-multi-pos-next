"use client"

import * as React from "react"
import { Crosshair, MapPin, Search, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { InfoField } from "@/components/base/info-field"

export interface GpsValue {
  lat: number
  lon: number
  calle?: string
  numero?: string
  colonia?: string
  cp?: string
  municipio?: string
  estado?: string
}

export interface GpsPickerProps {
  value?: GpsValue | null
  onChange?: (value: GpsValue | null) => void
  label?: string
  helper?: React.ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: {
    road?: string
    house_number?: string
    suburb?: string
    neighborhood?: string
    postcode?: string
    city?: string
    town?: string
    state?: string
  }
}

export function GpsPicker({
  value,
  onChange,
  label,
  helper,
  required,
  disabled,
  className,
}: GpsPickerProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [locating, setLocating] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string>()
  const [geoError, setGeoError] = React.useState<string>()

  async function queryNominatim(
    q: string,
    type: "query" | "reverse",
    lat?: number,
    lon?: number
  ): Promise<NominatimResult | null> {
    const params = new URLSearchParams()
    if (type === "query") {
      params.set("q", q)
      params.set("format", "json")
      params.set("addressdetails", "1")
      params.set("limit", "1")
    } else {
      params.set("lat", String(lat))
      params.set("lon", String(lon))
      params.set("format", "json")
      params.set("addressdetails", "1")
    }
    const res = await fetch(
      `https://nominatim.openstreetmap.org/${type === "query" ? "search" : "reverse"}?${params.toString()}`,
      { headers: { Accept: "application/json" } }
    )
    if (!res.ok) return null
    const data = type === "query" ? (await res.json()) as NominatimResult[] : [await res.json()] as NominatimResult[]
    return data[0] ?? null
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const q = searchQuery.trim()
    if (!q || searching || disabled) return
    setSearching(true)
    setSearchError(undefined)
    try {
      const result = await queryNominatim(q, "query")
      if (!result) {
        setSearchError("No se encontró la ubicación.")
        return
      }
      applyResult(result)
    } catch {
      setSearchError("Error consultando el geocodificador.")
    } finally {
      setSearching(false)
    }
  }

  function applyResult(r: NominatimResult) {
    const a = r.address ?? {}
    const next: GpsValue = {
      lat: Number(r.lat),
      lon: Number(r.lon),
      calle: a.road,
      numero: a.house_number,
      colonia: a.suburb ?? a.neighborhood,
      cp: a.postcode,
      municipio: a.city ?? a.town,
      estado: a.state,
    }
    onChange?.(next)
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoError("Tu navegador no soporta geolocalización.")
      return
    }
    setLocating(true)
    setGeoError(undefined)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        try {
          const r = await queryNominatim("", "reverse", lat, lon)
          if (r) applyResult(r)
          else onChange?.({ lat, lon })
        } catch {
          onChange?.({ lat, lon })
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocating(false)
        setGeoError("No se pudo obtener tu ubicación.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const bbox = value
    ? `${value.lon - 0.002},${value.lat - 0.002},${value.lon + 0.002},${value.lat + 0.002}`
    : null

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label className="leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar dirección, calle o colonia…"
              disabled={disabled || searching}
              className="pl-9 md:pl-9"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={disabled || searching}
            className="h-8"
          >
            {searching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Buscar
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || locating}
          onClick={useMyLocation}
          className="h-8"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Crosshair className="size-4" />
          )}
          Usar mi ubicación
        </Button>
      </div>

      {(searchError || geoError) && (
        <p className="text-xs text-destructive">{searchError ?? geoError}</p>
      )}

      {value && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <InfoField label="Latitud">
              <Input
                type="number"
                step="any"
                min={-90}
                max={90}
                value={Number.isFinite(value.lat) ? value.lat : ""}
                onChange={(e) =>
                  onChange?.({ ...value, lat: Number(e.target.value) })
                }
                disabled={disabled}
              />
            </InfoField>
            <InfoField label="Longitud">
              <Input
                type="number"
                step="any"
                min={-180}
                max={180}
                value={Number.isFinite(value.lon) ? value.lon : ""}
                onChange={(e) =>
                  onChange?.({ ...value, lon: Number(e.target.value) })
                }
                disabled={disabled}
              />
            </InfoField>
            {value.calle && (
              <InfoField label="Calle">
                <Input value={value.calle} disabled className="text-sm" />
              </InfoField>
            )}
            {value.numero && (
              <InfoField label="Número">
                <Input value={value.numero} disabled className="text-sm" />
              </InfoField>
            )}
            {value.colonia && (
              <InfoField label="Colonia">
                <Input value={value.colonia} disabled className="text-sm" />
              </InfoField>
            )}
            {value.cp && (
              <InfoField label="C.P.">
                <Input value={value.cp} disabled className="text-sm" />
              </InfoField>
            )}
            {value.municipio && (
              <InfoField label="Municipio">
                <Input value={value.municipio} disabled className="text-sm" />
              </InfoField>
            )}
            {value.estado && (
              <InfoField label="Estado">
                <Input value={value.estado} disabled className="text-sm" />
              </InfoField>
            )}
          </div>

          {bbox && (
            <div className="overflow-hidden rounded-lg border">
              <iframe
                title="Mapa"
                className="block h-52 w-full"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${value.lat},${value.lon}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}