/** Distancia entre dos coordenadas en kilómetros (fórmula de Haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371
  const latitudeDelta = ((lat2 - lat1) * Math.PI) / 180
  const longitudeDelta = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Enlace para abrir una ubicación en el mapa del dispositivo. */
export function mapsUrl(latitude: number | null | undefined, longitude: number | null | undefined, address?: string | null): string | null {
  if (latitude != null && longitude != null) return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
  if (address?.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
  return null
}

/** «350 m» / «2.4 km» / «18 km». */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}
