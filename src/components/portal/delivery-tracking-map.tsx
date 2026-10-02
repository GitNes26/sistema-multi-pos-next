"use client"

import { useEffect, useRef, useState } from "react"
import { LocateFixed } from "lucide-react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

export interface TrackingPoint {
  lat: number
  lng: number
}

interface DeliveryTrackingMapProps {
  /** Posición en tiempo real del repartidor (SSE). */
  driver: TrackingPoint | null
  /** Destino: dirección del cliente. */
  destination: TrackingPoint | null
  /** Origen: sucursal que surte el pedido. */
  origin: TrackingPoint | null
  height?: number | string
  /** Recorrido ya realizado (se dibuja como línea continua). */
  trail?: TrackingPoint[]
  /** Textos de la leyenda (por defecto: repartidor / tú / sucursal). */
  labels?: { driver?: string; destination?: string; origin?: string }
  /** Permite zoom con rueda y controles (vista de escritorio amplia). */
  interactive?: boolean
}

/** Ícono de mapa como HTML inline (evita assets de imagen). */
function pinIcon(html: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff;font-size:13px;line-height:1">${html}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

interface RouteInfo {
  points: [number, number][]
  distanceKm: number
  minutes: number
}

/**
 * Ruta de manejo restante del repartidor al destino (OSRM público). Se
 * recalcula cuando se mueve más de ~60 m; si el servicio falla se conserva la
 * línea recta punteada.
 */
function useRemainingRoute(driver: TrackingPoint | null, destination: TrackingPoint | null) {
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null)
  useEffect(() => {
    if (!driver || !destination) {
      setRoute(null)
      return
    }
    const prev = last.current
    const moved = prev ? Math.hypot((driver.lat - prev.lat) * 111_000, (driver.lng - prev.lng) * 105_000) : Infinity
    if (prev && moved < 60 && Date.now() - prev.at < 60_000) return
    last.current = { lat: driver.lat, lng: driver.lng, at: Date.now() }
    const ctrl = new AbortController()
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${driver.lng},${driver.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`,
      { signal: ctrl.signal }
    )
      .then((r) => r.json())
      .then((d) => {
        const r = d?.routes?.[0]
        if (!r) return
        setRoute({
          points: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
          distanceKm: r.distance / 1000,
          minutes: Math.max(1, Math.round(r.duration / 60)),
        })
      })
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [driver, destination])
  return route
}

/** Ajusta el mapa para que quepan todos los puntos disponibles. */
function FitPoints({ points }: { points: TrackingPoint[] }) {
  const map = useMap()
  // Clave estable de coordenadas: evita re-encuadrar en renders sin cambios.
  const key = points.map((p) => `${p.lat},${p.lng}`).join(";")
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 16, { animate: true })
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

export function DeliveryTrackingMap({
  driver,
  destination,
  origin,
  height = 230,
  trail = [],
  labels = {},
  interactive = false,
}: DeliveryTrackingMapProps) {
  const text = { driver: "Repartidor", destination: "Tú", origin: "Sucursal", ...labels }
  const points: TrackingPoint[] = [driver, destination, origin].filter(
    (p): p is TrackingPoint => p != null
  )
  const fitPoints = trail.length > 1 ? [...points, trail[0]] : points
  const route = useRemainingRoute(driver, destination)
  const [map, setMap] = useState<L.Map | null>(null)
  const center: [number, number] =
    points[0] != null ? [points[0].lat, points[0].lng] : [19.4326, -99.1332]

  return (
    // isolate + z-0: las capas de Leaflet (z-index hasta 1000) quedan contenidas aquí
    // y no se montan sobre el menú, el carrito ni los diálogos.
    <div className="relative isolate z-0 overflow-hidden rounded-2xl border" style={{ height }}>
      <MapContainer
        ref={setMap}
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={interactive}
        zoomControl={interactive}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPoints points={fitPoints} />

        {origin && (
          <Marker
            position={[origin.lat, origin.lng]}
            icon={pinIcon("&#127970;", "#10b981")}
            title={text.origin}
          />
        )}
        {destination && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={pinIcon("&#127968;", "#2563eb")}
            title={text.destination}
          />
        )}
        {trail.length > 1 && (
          <Polyline
            positions={trail.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: "#8b5cf6", weight: 4, opacity: 0.85 }}
          />
        )}
        {route && (
          <Polyline positions={route.points} pathOptions={{ color: "#8b5cf6", weight: 5, opacity: 0.9 }} />
        )}
        {driver && destination && !route && (
          <Polyline
            positions={[
              [driver.lat, driver.lng],
              [destination.lat, destination.lng],
            ]}
            pathOptions={{
              color: "#8b5cf6",
              weight: 3,
              opacity: 0.55,
              dashArray: "6 6",
            }}
          />
        )}
        {driver && (
          <Marker
            position={[driver.lat, driver.lng]}
            icon={pinIcon("&#128666;", "#8b5cf6")}
            title={text.driver}
            zIndexOffset={500}
          />
        )}
      </MapContainer>

      {/* Centrar en el repartidor */}
      {driver && (
        <button
          type="button"
          onClick={() => map?.flyTo([driver.lat, driver.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })}
          className="absolute top-2 right-2 z-[1000] flex h-11 items-center gap-1.5 rounded-xl bg-background/95 px-3 text-xs font-semibold shadow-md backdrop-blur-sm active:scale-95"
          aria-label="Centrar en el repartidor"
        >
          <LocateFixed className="size-4 text-primary" /> Repartidor
        </button>
      )}
      {route && (
        <div className="pointer-events-none absolute top-2 left-2 z-[1000] rounded-xl bg-background/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-sm">
          {route.minutes} min · {route.distanceKm < 1 ? `${Math.round(route.distanceKm * 1000)} m` : `${route.distanceKm.toFixed(1)} km`} restantes
        </div>
      )}

      {/* Leyenda */}
      <div className="pointer-events-none absolute right-2 bottom-2 z-[1000] flex items-center gap-2 rounded-lg bg-background/90 px-2 py-1 text-xs shadow-md backdrop-blur-sm">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-[#8b5cf6]" /> {text.driver}
        </span>
        {destination && (
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#2563eb]" /> {text.destination}
          </span>
        )}
        {origin && (
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#10b981]" /> {text.origin}
          </span>
        )}
      </div>
    </div>
  )
}
