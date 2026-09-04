"use client"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { LocationSearch } from "@/components/shared/location-search"
import { useLocation, type LocationResult } from "@/hooks/use-location"

export interface AddressGpsValue {
  lat: number
  lon: number
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
  const { hasGoogleMaps } = useLocation()

  function handleChange(newAddress: string, coords: { lat: number; lon: number } | null) {
    onAddressChange(newAddress)
    if (coords) {
      onGpsChange(coords)
    }
  }

  function handleLocationSelect(result: LocationResult) {
    onAddressChange(result.address)
    onGpsChange({ lat: result.coords.lat, lon: result.coords.lon })
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>

      <LocationSearch
        value={address}
        onChange={handleChange}
        onLocationSelect={handleLocationSelect}
        lat={latitude}
        lon={longitude}
        placeholder={placeholder}
        disabled={disabled}
        showMap={showMap}
        showDetect={true}
      />
    </div>
  )
}
