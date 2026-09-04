"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Crosshair, MapPin, Search, Loader2, Map, X, ChevronRight } from "lucide-react"
import { MapPreview } from "@/components/shared/map-preview"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocation, type LocationResult } from "@/hooks/use-location"

interface LocationSearchProps {
  /** Current address text */
  value: string
  /** Called when address changes */
  onChange: (address: string, coords: { lat: number; lon: number } | null) => void
  /** Full location result callback (with address parts) */
  onLocationSelect?: (result: LocationResult) => void
  /** Latitude */
  lat?: number | null
  /** Longitude */
  lon?: number | null
  /** Label */
  label?: string
  /** Placeholder */
  placeholder?: string
  /** Required */
  required?: boolean
  /** Disabled */
  disabled?: boolean
  /** Show map preview */
  showMap?: boolean
  /** Show "use my location" button */
  showDetect?: boolean
  /** Additional CSS class */
  className?: string
}

export function LocationSearch({
  value,
  onChange,
  onLocationSelect,
  lat,
  lon,
  label,
  placeholder = "Buscar dirección, calle o colonia…",
  required,
  disabled,
  showMap = true,
  showDetect = true,
  className,
}: LocationSearchProps) {
  const { detectMyLocation, searchAddress, getPlaceDetails, loading, error, hasGoogleMaps } = useLocation()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Array<{ description: string; placeId?: string; lat?: number; lon?: number }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const [showMapState, setShowMapState] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced search
  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q)
      setActiveIndex(-1)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!q.trim()) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        const results = await searchAddress(q)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setSearching(false)
      }, 300)
    },
    [searchAddress]
  )

  // Select a suggestion
  async function selectSuggestion(s: { description: string; placeId?: string; lat?: number; lon?: number }) {
    setShowSuggestions(false)
    setQuery("")
    if (s.placeId) {
      // Google Place — get full details
      const result = await getPlaceDetails(s.placeId)
      if (result) {
        onChange(result.address, result.coords)
        onLocationSelect?.(result)
      }
    } else if (s.lat != null && s.lon != null) {
      // Nominatim result — reverse geocode for full details
      const result = await searchAddress(s.description)
      // Use the coordinates directly
      onChange(s.description, { lat: s.lat, lon: s.lon })
    }
    inputRef.current?.blur()
  }

  // Detect my location
  async function handleDetectLocation() {
    const result = await detectMyLocation()
    if (result) {
      onChange(result.address, result.coords)
      onLocationSelect?.(result)
    }
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const hasGps = lat != null && lon != null

  return (
    <div className={cn("space-y-2", className)} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
      )}

      {/* Search input with autocomplete */}
      <div className="relative">
        <div className="relative flex items-center">
          <MapPin className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query || value}
            onChange={(e) => {
              if (showSuggestions) {
                handleQueryChange(e.target.value)
              } else {
                onChange(e.target.value, null)
              }
            }}
            onFocus={() => {
              setQuery(value || "")
              if (query.trim() && suggestions.length > 0) setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-9 pr-9"
          />
          {value && !showSuggestions && (
            <button
              type="button"
              className="absolute right-9 text-muted-foreground hover:text-foreground"
              onClick={() => {
                onChange("", null)
                setQuery("")
              }}
            >
              <X className="size-3.5" />
            </button>
          )}
          {showDetect && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 text-muted-foreground hover:text-primary"
              disabled={disabled || loading}
              onClick={handleDetectLocation}
              title="Usar mi ubicación actual"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Crosshair className="size-4" />
              )}
            </Button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
            <div className="p-1">
              {suggestions.map((s, i) => (
                <button
                  key={s.placeId ?? s.description}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    i === activeIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => selectSuggestion(s)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{s.description}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
                </button>
              ))}
            </div>
            {!hasGoogleMaps && (
              <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
                Powered by OpenStreetMap
              </div>
            )}
          </div>
        )}

        {/* Searching indicator in dropdown */}
        {showSuggestions && searching && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover p-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando…
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Coordinates + map */}
      {hasGps && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {lat!.toFixed(6)}, {lon!.toFixed(6)}
            </span>
            {showMap && (
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
            )}
          </div>
          {showMapState && lat != null && lon != null && (
            <MapPreview lat={lat} lon={lon} height={192} />
          )}
        </div>
      )}
    </div>
  )
}
