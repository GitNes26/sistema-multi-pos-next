import assert from "node:assert/strict"
import test from "node:test"
import { cached, cacheStats, clearCache, invalidateOrg, orgTag } from "../../src/lib/cache/index.ts"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test("sirve del caché y solo carga una vez dentro del TTL", async () => {
  clearCache()
  let loads = 0
  const loader = async () => ++loads
  assert.equal(await cached("a", { ttlMs: 1000 }, loader), 1)
  assert.equal(await cached("a", { ttlMs: 1000 }, loader), 1)
  assert.equal(loads, 1)
})

test("500 peticiones simultáneas generan una sola carga (single-flight)", async () => {
  clearCache()
  let loads = 0
  const loader = async () => { loads += 1; await sleep(30); return "catalogo" }
  const results = await Promise.all(Array.from({ length: 500 }, () => cached("catalogo", { ttlMs: 1000 }, loader)))
  assert.equal(loads, 1)
  assert.equal(results.every((r) => r === "catalogo"), true)
})

test("un error del loader no se guarda y se reintenta", async () => {
  clearCache()
  let n = 0
  const loader = async () => { n += 1; if (n === 1) throw new Error("falla"); return "ok" }
  await assert.rejects(() => cached("e", { ttlMs: 1000 }, loader))
  assert.equal(await cached("e", { ttlMs: 1000 }, loader), "ok")
})

test("stale-while-revalidate: sirve el dato viejo y refresca en segundo plano", async () => {
  clearCache()
  let v = 0
  const loader = async () => ++v
  assert.equal(await cached("s", { ttlMs: 20, staleMs: 500 }, loader), 1)
  await sleep(40)
  assert.equal(await cached("s", { ttlMs: 20, staleMs: 500 }, loader), 1) // viejo, sin esperar
  await sleep(20)
  assert.equal(await cached("s", { ttlMs: 20, staleMs: 500 }, loader), 2) // ya refrescado
})

test("invalidar una empresa no toca a las demás", async () => {
  clearCache()
  let a = 0, b = 0
  await cached("pos:A", { ttlMs: 1000, tags: [orgTag("A")] }, async () => ++a)
  await cached("pos:B", { ttlMs: 1000, tags: [orgTag("B")] }, async () => ++b)
  invalidateOrg("A")
  assert.equal(await cached("pos:A", { ttlMs: 1000, tags: [orgTag("A")] }, async () => ++a), 2)
  assert.equal(await cached("pos:B", { ttlMs: 1000, tags: [orgTag("B")] }, async () => ++b), 1)
})

test("una carga iniciada antes de invalidar no deja dato viejo guardado", async () => {
  clearCache()
  let version = 1
  const slow = async () => { const v = version; await sleep(40); return v }
  const pending = cached("race", { ttlMs: 1000, tags: [orgTag("R")] }, slow)
  await sleep(10)
  version = 2
  invalidateOrg("R")
  assert.equal(await pending, 1) // quien ya esperaba recibe lo que se cargó
  assert.equal(await cached("race", { ttlMs: 1000, tags: [orgTag("R")] }, async () => version), 2) // la siguiente ve lo nuevo
})

test("reporta aciertos y fallos en las estadísticas", async () => {
  clearCache()
  const before = cacheStats()
  await cached("x", { ttlMs: 1000 }, async () => 1)
  await cached("x", { ttlMs: 1000 }, async () => 1)
  const after = cacheStats()
  assert.equal(after.hits - before.hits, 1)
  assert.equal(after.misses - before.misses, 1)
})
