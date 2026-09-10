"use client"

import { useEffect } from "react"
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
  height?: number
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
}: DeliveryTrackingMapProps) {
  const points: TrackingPoint[] = [driver, destination, origin].filter(
    (p): p is TrackingPoint => p != null
  )
  const center: [number, number] =
    points[0] != null ? [points[0].lat, points[0].lng] : [19.4326, -99.1332]

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPoints points={points} />

        {origin && (
          <Marker
            position={[origin.lat, origin.lng]}
            icon={pinIcon("&#127970;", "#10b981")}
            title="Sucursal"
          />
        )}
        {destination && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={pinIcon("&#127968;", "#2563eb")}
            title="Tu dirección"
          />
        )}
        {driver && destination && (
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
            title="Repartidor"
            zIndexOffset={500}
          />
        )}
      </MapContainer>

      {/* Leyenda */}
      <div className="pointer-events-none absolute right-2 bottom-2 z-[1000] flex items-center gap-2 rounded-lg bg-background/90 px-2 py-1 text-[10px] shadow-md backdrop-blur-sm">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-[#8b5cf6]" /> Repartidor
        </span>
        {destination && (
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#2563eb]" /> Tú
          </span>
        )}
        {origin && (
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#10b981]" /> Sucursal
          </span>
        )}
      </div>
    </div>
  )
}
