"use client"

import { useState, useCallback } from "react"
import {
  isGoogleMapsAvailable,
  loadGoogleMaps,
  googleReverseGeocode,
  googlePlacesSearch,
  googlePlaceDetails,
  type GooglePlaceResult,
} from "@/lib/google-maps-loader"

export interface LocationCoords {
  lat: number
  lon: number
}

export interface AddressParts {
  calle?: string
  numero?: string
  colonia?: string
  cp?: string
  municipio?: string
  estado?: string
  pais?: string
}

export interface LocationResult {
  coords: LocationCoords
  address: string
  parts: AddressParts
}

// ── Nominatim fallback ──────────────────────────────────────

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
    country?: string
  }
}

async function nominatimReverse(lat: number, lon: number): Promise<LocationResult | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: "json",
      addressdetails: "1",
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data: NominatimResult = await res.json()
    const a = data.address ?? {}
    const parts: AddressParts = {
      calle: a.road,
      numero: a.house_number,
      colonia: a.suburb ?? a.neighborhood,
      cp: a.postcode,
      municipio: a.city ?? a.town,
      estado: a.state,
      pais: a.country,
    }
    const address = [
      [parts.calle, parts.numero].filter(Boolean).join(" "),
      parts.colonia,
      parts.municipio,
      parts.estado,
      parts.cp,
    ]
      .filter(Boolean)
      .join(", ")
    return { coords: { lat, lon }, address, parts }
  } catch {
    return null
  }
}

async function nominatimSearch(query: string): Promise<Array<{ description: string; lat: number; lon: number }>> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "5",
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return []
    const data: NominatimResult[] = await res.json()
    return data.map((r) => ({ description: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }))
  } catch {
    return []
  }
}

// ── Hook ────────────────────────────────────────────────────

export interface UseLocationReturn {
  /** Get the user's current location via browser Geolocation */
  detectMyLocation: () => Promise<LocationResult | null>
  /** Search for an address (Google Places or Nominatim fallback) */
  searchAddress: (query: string) => Promise<Array<{ description: string; placeId?: string; lat?: number; lon?: number }>>
  /** Get details for a Google Place (placeId) */
  getPlaceDetails: (placeId: string) => Promise<LocationResult | null>
  /** Reverse geocode coordinates to address */
  reverseGeocode: (lat: number, lon: number) => Promise<LocationResult | null>
  /** Whether Google Maps is available */
  hasGoogleMaps: boolean
  /** Current loading state */
  loading: boolean
  /** Current error message */
  error: string | null
}

export function useLocation(): UseLocationReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasGoogleMaps = isGoogleMapsAvailable()

  const detectMyLocation = useCallback(async (): Promise<LocationResult | null> => {
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalización.")
      return null
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          try {
            // Try Google reverse geocode first
            if (hasGoogleMaps) {
              const result = await googleReverseGeocode(lat, lon)
              if (result) {
                resolve({
                  coords: { lat, lon },
                  address: result.description,
                  parts: {
                    calle: result.addressComponents.street,
                    numero: result.addressComponents.streetNumber,
                    colonia: result.addressComponents.neighborhood,
                    cp: result.addressComponents.postalCode,
                    municipio: result.addressComponents.city,
                    estado: result.addressComponents.state,
                    pais: result.addressComponents.country,
                  },
                })
                setLoading(false)
                return
              }
            }
            // Fallback to Nominatim
            const result = await nominatimReverse(lat, lon)
            resolve(result ?? { coords: { lat, lon }, address: "", parts: {} })
          } catch {
            resolve({ coords: { lat, lon }, address: "", parts: {} })
          } finally {
            setLoading(false)
          }
        },
        (err) => {
          setLoading(false)
          if (err.code === 1) {
            setError("Permiso de ubicación denegado. Actívalo en la configuración de tu navegador.")
          } else {
            setError("No se pudo obtener tu ubicación.")
          }
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      )
    })
  }, [hasGoogleMaps])

  const searchAddress = useCallback(
    async (query: string) => {
      if (!query.trim()) return []
      setLoading(true)
      setError(null)
      try {
        if (hasGoogleMaps) {
          await loadGoogleMaps()
          const results = await googlePlacesSearch(query)
          if (results.length > 0) return results
        }
        // Fallback to Nominatim
        return await nominatimSearch(query)
      } catch {
        setError("Error al buscar la dirección.")
        return []
      } finally {
        setLoading(false)
      }
    },
    [hasGoogleMaps]
  )

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<LocationResult | null> => {
      setLoading(true)
      try {
        const result = await googlePlaceDetails(placeId)
        if (!result) return null
        return {
          coords: { lat: result.lat, lon: result.lon },
          address: result.description,
          parts: {
            calle: result.addressComponents.street,
            numero: result.addressComponents.streetNumber,
            colonia: result.addressComponents.neighborhood,
            cp: result.addressComponents.postalCode,
            municipio: result.addressComponents.city,
            estado: result.addressComponents.state,
            pais: result.addressComponents.country,
          },
        }
      } catch {
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const reverseGeocode = useCallback(
    async (lat: number, lon: number): Promise<LocationResult | null> => {
      if (hasGoogleMaps) {
        const result = await googleReverseGeocode(lat, lon)
        if (result) {
          return {
            coords: { lat, lon },
            address: result.description,
            parts: {
              calle: result.addressComponents.street,
              numero: result.addressComponents.streetNumber,
              colonia: result.addressComponents.neighborhood,
              cp: result.addressComponents.postalCode,
              municipio: result.addressComponents.city,
              estado: result.addressComponents.state,
              pais: result.addressComponents.country,
            },
          }
        }
      }
      return nominatimReverse(lat, lon)
    },
    [hasGoogleMaps]
  )

  return {
    detectMyLocation,
    searchAddress,
    getPlaceDetails,
    reverseGeocode,
    hasGoogleMaps,
    loading,
    error,
  }
}
