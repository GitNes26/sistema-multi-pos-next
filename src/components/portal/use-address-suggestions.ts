"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, type LocationResult } from "@/hooks/use-location"

export interface AddressSuggestion {
  description: string
  placeId?: string
  lat?: number
  lon?: number
}

/**
 * Autocompletado de direcciones: espera a que el usuario deje de escribir
 * (500 ms; Nominatim pide máximo 1 consulta por segundo) y devuelve sugerencias
 * de Google Places o, sin clave, de OpenStreetMap.
 */
export function useAddressSuggestions(query: string, enabled = true) {
  const { searchAddress, getPlaceDetails } = useLocation()
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const seq = useRef(0)
  const skip = useRef<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (!enabled || q.length < 4 || skip.current === q) {
      setSuggestions([])
      return
    }
    const id = ++seq.current
    const timer = window.setTimeout(async () => {
      setSearching(true)
      const results = await searchAddress(q)
      if (id !== seq.current) return
      setSuggestions(results.slice(0, 6))
      setSearching(false)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [query, enabled, searchAddress])

  const clear = useCallback(() => {
    seq.current++
    setSuggestions([])
    setSearching(false)
  }, [])

  /** Resuelve la sugerencia elegida a coordenadas + dirección. */
  const pick = useCallback(
    async (index: number): Promise<{ lat: number; lon: number; address: string; parts: LocationResult["parts"] } | null> => {
      const s = suggestions[index]
      if (!s) return null
      skip.current = s.description.trim()
      if (s.lat != null && s.lon != null) return { lat: s.lat, lon: s.lon, address: s.description, parts: {} }
      if (s.placeId) {
        const detail = await getPlaceDetails(s.placeId)
        if (detail) return { lat: detail.coords.lat, lon: detail.coords.lon, address: detail.address || s.description, parts: detail.parts }
      }
      return null
    },
    [suggestions, getPlaceDetails]
  )

  return { suggestions, searching, clear, pick }
}
