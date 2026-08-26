"use client"

import { useState } from "react"
import { Crosshair, MapPin, Search, Loader2, Map } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"

export interface AddressGpsValue {
  lat: number
  lon: number
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

function composeAddress(a: NominatimResult["address"]): string {
  if (!a) return ""
  return [
    [a.road, a.house_number].filter(Boolean).join(" "),
    a.suburb ?? a.neighborhood,
    a.city ?? a.town,
    a.state,
    a.postcode,
  ]
    .filter(Boolean)
    .join(", ")
}

interface AddressFieldProps {
  address: string
  onAddressChange: (address: string) => void
  latitude: number | null
  longitude: number | null
  onGpsChange: (gps: AddressGpsValue | null) => void
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
  textarea?: boolean
  showMap?: boolean
  placeholder?: string
}

export function AddressField({
  address,
  onAddressChange,
  latitude,
  longitude,
  onGpsChange,
  label = "Dirección",
  required,
  disabled,
  className,
  textarea = false,
  showMap = true,
  placeholder = "Calle, número, colonia, ciudad…",
}: AddressFieldProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string>()
  const [showMapState, setShowMapState] = useState(false)

  const hasGps = latitude != null && longitude != null

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
    const data =
      type === "query"
        ? ((await res.json()) as NominatimResult[])
        : ([await res.json()] as NominatimResult[])
    return data[0] ?? null
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const q = searchQuery.trim()
    if (!q || searching || disabled) return
    setSearching(true)
    setError(undefined)
    try {
      const result = await queryNominatim(q, "query")
      if (!result) {
        setError("No se encontró la ubicación.")
        return
      }
      onGpsChange({ lat: Number(result.lat), lon: Number(result.lon) })
      onAddressChange(composeAddress(result.address))
    } catch {
      setError("Error consultando el geocodificador.")
    } finally {
      setSearching(false)
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalización.")
      return
    }
    setLocating(true)
    setError(undefined)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        try {
          const r = await queryNominatim("", "reverse", lat, lon)
          if (r) {
            onGpsChange({ lat: Number(r.lat), lon: Number(r.lon) })
            onAddressChange(composeAddress(r.address))
          } else {
            onGpsChange({ lat, lon })
          }
        } catch {
          onGpsChange({ lat, lon })
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocating(false)
        setError("No se pudo obtener tu ubicación.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const bbox = hasGps
    ? `${longitude! - 0.002},${latitude! - 0.002},${longitude! + 0.002},${latitude! + 0.002}`
    : null

  const InputComponent = textarea ? Textarea : Input

  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <InputComponent
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-9"
            rows={textarea ? 3 : undefined}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || locating}
          onClick={useMyLocation}
          className="shrink-0 h-9"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Crosshair className="size-4" />
          )}
          <span className="hidden sm:inline ml-1">Ubicación</span>
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar dirección, calle o colonia…"
            disabled={disabled || searching}
            className="pl-9"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={disabled || searching}
          className="shrink-0 h-9"
        >
          {searching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Buscar
        </Button>
      </form>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {hasGps && showMap && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-xs"
              onClick={() => setShowMapState(!showMapState)}
            >
              <Map className="size-3 mr-1" />
              {showMapState ? "Ocultar mapa" : "Ver mapa"}
            </Button>
          </div>
          {showMapState && bbox && (
            <div className="overflow-hidden rounded-lg border">
              <iframe
                title="Mapa"
                className="block h-48 w-full"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
