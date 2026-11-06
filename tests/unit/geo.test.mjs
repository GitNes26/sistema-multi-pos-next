import assert from "node:assert/strict"
import test from "node:test"
import { distanceKm, formatDistance, mapsUrl } from "../../src/lib/geo.ts"

test("distancia entre dos puntos conocidos (CDMX a Guadalajara ≈ 460 km)", () => {
  const km = distanceKm(19.4326, -99.1332, 20.6597, -103.3496)
  assert.ok(km > 440 && km < 480, String(km))
  assert.equal(distanceKm(19.4, -99.1, 19.4, -99.1), 0)
})

test("formato de distancia legible", () => {
  assert.equal(formatDistance(0.35), "350 m")
  assert.equal(formatDistance(2.46), "2.5 km")
  assert.equal(formatDistance(18.2), "18 km")
})

test("enlace de mapa: coordenadas, dirección o nada", () => {
  assert.match(mapsUrl(19.4, -99.1) ?? "", /query=19\.4,-99\.1/)
  assert.match(mapsUrl(null, null, "Calle 1 #2") ?? "", /Calle%201%20%232/)
  assert.equal(mapsUrl(null, null, "  "), null)
})
