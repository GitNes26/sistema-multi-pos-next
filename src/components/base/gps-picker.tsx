"use client"

import { useState } from "react"
import { MapPin, MapPinned } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { InfoField } from "@/components/base/info-field"
import { LocationSearch } from "@/components/shared/location-search"
import { MapPinPicker } from "@/components/shared/map-pin-picker-lazy"
import { useLocation, type LocationResult } from "@/hooks/use-location"

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
  onPermissionError?: () => void
  label?: string
  helper?: React.ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
}

export function GpsPicker({
  value,
  onChange,
  onPermissionError,
  label,
  helper,
  required,
  disabled,
  className,
}: GpsPickerProps) {
  const { hasGoogleMaps } = useLocation()
  const [showMap, setShowMap] = useState(false)

  function handleLocationChange(address: string, coords: { lat: number; lon: number } | null) {
    if (coords) {
      onChange?.({
        lat: coords.lat,
        lon: coords.lon,
        calle: value?.calle,
        numero: value?.numero,
        colonia: value?.colonia,
        cp: value?.cp,
        municipio: value?.municipio,
        estado: value?.estado,
      })
    }
  }

  function handleLocationSelect(result: LocationResult) {
    onChange?.({
      lat: result.coords.lat,
      lon: result.coords.lon,
      calle: result.parts.calle,
      numero: result.parts.numero,
      colonia: result.parts.colonia,
      cp: result.parts.cp,
      municipio: result.parts.municipio,
      estado: result.parts.estado,
    })
  }

  function handleMapPick(lat: number, lon: number) {
    onChange?.({
      lat,
      lon,
      calle: value?.calle,
      numero: value?.numero,
      colonia: value?.colonia,
      cp: value?.cp,
      municipio: value?.municipio,
      estado: value?.estado,
    })
  }

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

      <LocationSearch
        value={value ? [value.calle, value.numero, value.colonia, value.municipio, value.estado, value.cp].filter(Boolean).join(", ") : ""}
        onChange={handleLocationChange}
        onLocationSelect={handleLocationSelect}
        lat={value?.lat}
        lon={value?.lon}
        placeholder="Buscar dirección, calle o colonia…"
        disabled={disabled}
        showMap={false}
        showDetect={true}
      />

      {/* Map toggle button */}
      <Button
        type="button"
        variant={showMap ? "default" : "outline"}
        size="sm"
        className="w-full"
        disabled={disabled}
        onClick={() => setShowMap(!showMap)}
      >
        <MapPinned className="mr-1.5 size-4" />
        {showMap ? "Ocultar mapa" : "Seleccionar en mapa"}
      </Button>

      {/* Interactive map picker */}
      {showMap && (
        <MapPinPicker
          lat={value?.lat}
          lon={value?.lon}
          onChange={handleMapPick}
          height={280}
        />
      )}

      {/* Coordinate fields + details */}
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
        </div>
      )}

      {!hasGoogleMaps && (
        <p className="text-[10px] text-muted-foreground">
          Usa Google Maps para mejores resultados de búsqueda
        </p>
      )}
    </div>
  )
}
