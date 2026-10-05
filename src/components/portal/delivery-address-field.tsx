"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Home, Loader2, LocateFixed, MapPin, MapPinned, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLocation } from "@/hooks/use-location"
import { useAddressSuggestions } from "@/components/shared/use-address-suggestions"
import type { PickedAddress } from "@/components/shared/address-map-picker"
import type { CustomerAddressView } from "@/lib/portal/server"

// Leaflet necesita el DOM del navegador.
const AddressMapPicker = dynamic(() => import("@/components/shared/address-map-picker").then((m) => m.AddressMapPicker), { ssr: false })

/**
 * Dirección de entrega, al estilo de las apps de reparto: un solo campo con
 * autocompletado, «usar mi ubicación», destinos guardados y un mapa a pantalla
 * completa para ubicar el pin. Al elegir cualquier dirección se muestra su
 * resumen con la opción de abrir el mapa para confirmarla o ajustar el pin.
 */
export function DeliveryAddressField({
  address,
  coords,
  error,
  saved,
  selectedSavedId,
  fallbackCenter,
  onChange,
  onTextChange,
  onSelectSaved,
  onSave,
  onRemoveSaved,
  onPermissionError,
}: {
  address: string
  coords: { lat: number; lon: number } | null
  error?: string
  saved: CustomerAddressView[]
  selectedSavedId: string | null
  fallbackCenter?: { lat: number; lon: number } | null
  /** Se eligió o ajustó una ubicación (sugerencia, GPS o mapa). */
  onChange: (value: PickedAddress) => void
  /** Se editó el texto a mano (p. ej. para agregar número interior). */
  onTextChange: (text: string) => void
  onSelectSaved: (a: CustomerAddressView) => void
  onSave: () => void
  onRemoveSaved: (id: string) => void
  onPermissionError?: () => void
}) {
  const [query, setQuery] = useState("")
  const [mapOpen, setMapOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const { detectMyLocation, error: geoError } = useLocation()
  const { suggestions, searching, clear, pick } = useAddressSuggestions(query, true, coords)
  const hasAddress = address.trim().length > 0

  const choose = async (index: number) => {
    const res = await pick(index)
    clear()
    setQuery("")
    if (res) onChange(res)
  }

  const locateMe = async () => {
    setLocating(true)
    const res = await detectMyLocation()
    setLocating(false)
    if (res) onChange({ lat: res.coords.lat, lon: res.coords.lon, address: res.address, parts: res.parts })
    else onPermissionError?.()
  }

  return (
    <div className="space-y-3">
      {saved.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Tus destinos guardados</p>
          <div className="flex flex-wrap gap-1.5">
            {saved.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelectSaved(a)}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  selectedSavedId === a.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Home className="size-3.5" /> {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buscador con autocompletado */}
      <div className="relative">
        <label htmlFor="delivery-address" className="mb-1.5 block text-sm font-medium">
          ¿A dónde te lo llevamos? <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="delivery-address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe tu calle, número y colonia"
            autoComplete="street-address"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "delivery-address-error" : undefined}
            className={cn(
              "h-12 w-full rounded-xl border bg-background pr-10 pl-10 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary",
              error && "border-destructive"
            )}
          />
          {searching && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        {suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg" role="listbox">
            {suggestions.map((s, i) => (
              <li key={`${s.description}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => void choose(i)}
                  className="flex min-h-12 w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{s.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p id="delivery-address-error" role="alert" className="mt-1.5 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={() => void locateMe()} disabled={locating}>
          {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />} Mi ubicación
        </Button>
        <Button type="button" variant="outline" className="h-12" onClick={() => setMapOpen(true)}>
          <MapPinned className="size-4" /> Elegir en el mapa
        </Button>
      </div>
      {geoError && !hasAddress && <p className="text-xs text-destructive">{geoError}</p>}

      {/* Resumen de la dirección elegida */}
      {hasAddress && (
        <div className="space-y-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <MapPin className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Dirección de entrega</p>
              <textarea
                value={address}
                onChange={(e) => onTextChange(e.target.value)}
                rows={2}
                aria-label="Dirección de entrega (puedes agregar número interior o referencias)"
                className="mt-0.5 w-full resize-none bg-transparent text-sm font-medium leading-snug outline-none"
              />
              <p className="text-xs text-muted-foreground">Agrega número interior o referencias directamente en el texto.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="h-10" onClick={() => setMapOpen(true)}>
              <MapPinned className="size-4" /> {coords ? "Confirmar o ajustar el pin" : "Ubicar en el mapa"}
            </Button>
            {!selectedSavedId && (
              <Button type="button" size="sm" variant="ghost" className="h-10" onClick={onSave}>
                <Plus className="size-4" /> Guardar destino
              </Button>
            )}
            {selectedSavedId && (
              <Button type="button" size="sm" variant="ghost" className="h-10 text-destructive" aria-label="Eliminar destino guardado" onClick={() => onRemoveSaved(selectedSavedId)}>
                <Trash2 className="size-4" /> Quitar
              </Button>
            )}
          </div>
        </div>
      )}

      <AddressMapPicker
        open={mapOpen}
        initial={coords}
        fallbackCenter={fallbackCenter}
        onClose={() => setMapOpen(false)}
        onPermissionError={onPermissionError}
        onConfirm={(value) => {
          setMapOpen(false)
          onChange(value)
        }}
      />
    </div>
  )
}
