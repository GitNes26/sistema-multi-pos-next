/* eslint-disable @typescript-eslint/no-explicit-any, no-var -- script de pruebas de carga */
/**
 * Prueba de carga con tráfico simulado de VERDAD contra un servidor de pruebas.
 *
 * Cada "usuario virtual" (VU) se comporta como una persona: abre su pantalla, hace una acción,
 * piensa unos segundos y repite. Mezcla cajeros (catálogo + ventas reales), administradores
 * (panel, listados, ventas, inventario), clientes del portal (tienda, pedidos) y visitas públicas
 * (portada, salud), repartidos entre cientos de empresas con tamaños distintos.
 *
 *   # 1) servidor de producción sobre la base de pruebas (puerto de TEST_BASE_URL)
 *   #    node scripts/test-env.mjs serve-prod minimal
 *   # 2) tráfico
 *   npx tsx scripts/loadtest/run.mts --stages 50:20,200:40,500:40
 *
 * Opciones: --stages vus:segundos,...  --think 1   (factor de espera entre acciones; 0.5 = el doble de rápido)
 *           --sse 0.15                   (fracción de VUs de app con conexión SSE abierta)
 *           --label nombre               (etiqueta del reporte)
 */
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

const envFile = path.resolve(".env.test-minimal.local")
const env = JSON.parse(fs.readFileSync(envFile, "utf8"))
Object.assign(process.env, env)
const { assertTestEnvironment } = await import("../test-safety.mjs")
const { baseURL } = assertTestEnvironment(process.env as Record<string, string>)
const { encode } = await import("next-auth/jwt")
const { permissionsForRole } = await import("../../src/lib/auth/server-permissions")
const { prisma } = await import("../../src/lib/db")

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const STAGES = arg("stages", "50:20,200:40,500:40").split(",").map((s) => {
  const [vus, secs] = s.split(":").map(Number)
  return { vus, secs }
})
const THINK = Number(arg("think", "1"))
const SSE_FRACTION = Number(arg("sse", "0.15"))
const LABEL = arg("label", "carga")
// Los primeros segundos de cada etapa (usuarios entrando y cargando su pantalla inicial, cachés frías) no cuentan en las cifras de la etapa.
const WARMUP = Number(arg("warmup", "20"))
// Varias instancias del servidor (puertos): cada usuario virtual se queda con una, como un balanceador con sesión pegajosa.
const PORTS = arg("ports", "").split(",").filter(Boolean)
// Secreto propio de la prueba (nunca el CRON_SECRET real del entorno).
const CRON_SECRET = process.env.LOADTEST_CRON_SECRET || "loadtest-secret"
const secret = process.env.NEXTAUTH_SECRET!

// ── Empresas y sesiones ─────────────────────────────────────────────────────
interface OrgSeed { orgId: string; ownerId: string; locationId: string; customerUserId: string; customerId: string }
const orgs: OrgSeed[] = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const ownerPermissions = await permissionsForRole("owner", null, orgs[0].orgId)

const cookieName = baseURL.startsWith("https") ? "__Secure-next-auth.session-token" : "next-auth.session-token"
async function sessionCookie(kind: "app" | "portal", org: OrgSeed) {
  const isApp = kind === "app"
  const id = isApp ? org.ownerId : org.customerUserId
  const token = await encode({
    secret,
    maxAge: 60 * 60 * 6,
    token: {
      sub: id, id, name: isApp ? "Dueño" : "Cliente", email: `${id}@load.test`,
      role: isApp ? "owner" : "customer", roleName: null,
      organizationId: org.orgId, activeOrganizationId: org.orgId, organizationName: "Negocio de carga",
      businessMode: "retail", permissions: isApp ? ownerPermissions : [], planDenied: [],
      scope: kind, authCheckedAt: Date.now(), authVersion: 0,
    },
  })
  return `${cookieName}=${token}`
}

// Tamaño desigual: pocas empresas concentran mucho tráfico (como en la vida real).
const weights = orgs.map((_, i) => 1 / (i + 4))
const totalWeight = weights.reduce((a, b) => a + b, 0)
function pickOrg(): OrgSeed {
  let r = Math.random() * totalWeight
  for (let i = 0; i < orgs.length; i += 1) { r -= weights[i]; if (r <= 0) return orgs[i] }
  return orgs[orgs.length - 1]
}

// ── Cliente HTTP ────────────────────────────────────────────────────────────
const agent = new http.Agent({ keepAlive: true, maxSockets: 2000, maxFreeSockets: 256 })
const url = new URL(baseURL)
interface Sample { label: string; ms: number; status: number; stage: number; at: number }
const samples: Sample[] = []
let stageIndex = 0
let inFlight = 0
let peakInFlight = 0

let rr = 0
function request(label: string, method: string, pathname: string, cookie: string | null, body?: unknown, keepBody = false): Promise<{ status: number; json?: any }> {
  return new Promise((resolve) => {
    const started = performance.now()
    inFlight += 1; peakInFlight = Math.max(peakInFlight, inFlight)
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const req = http.request({
      agent, host: url.hostname, port: PORTS.length ? PORTS[(rr = (rr + 1) % PORTS.length)] : url.port, path: pathname, method, timeout: 30_000,
      headers: { ...(cookie ? { cookie } : {}), ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}), accept: "application/json,text/html" },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (c) => { if (keepBody) chunks.push(c) })
      res.on("end", () => {
        inFlight -= 1
        samples.push({ label, ms: performance.now() - started, status: res.statusCode ?? 0, stage: stageIndex, at: Date.now() })
        let json: any
        if (keepBody) { try { json = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { /* no JSON */ } }
        resolve({ status: res.statusCode ?? 0, json })
      })
    })
    req.on("timeout", () => req.destroy(new Error("timeout")))
    req.on("error", () => { inFlight -= 1; samples.push({ label, ms: performance.now() - started, status: 0, stage: stageIndex, at: Date.now() }); resolve({ status: 0 }) })
    if (payload) req.write(payload)
    req.end()
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const think = (min: number, max: number) => sleep((min + Math.random() * (max - min)) * 1000 * THINK)
let running = true
let sseOpen = 0
let sseEvents = 0

function openSse(cookie: string, route: string) {
  const req = http.request({ agent: new http.Agent({ keepAlive: true }), host: url.hostname, port: url.port, path: route, headers: { cookie, accept: "text/event-stream" } }, (res) => {
    if (res.statusCode !== 200) { res.resume(); return }
    sseOpen += 1
    res.on("data", () => { sseEvents += 1 })
    res.on("close", () => { sseOpen -= 1 })
  })
  req.on("error", () => undefined)
  req.end()
  return () => req.destroy()
}

// ── Comportamientos ─────────────────────────────────────────────────────────
type Catalog = { cashier: { employeeId: string | null }; session: { id: string; registerId: string } | null; location: { id: string }; products: { productId: string; variantId: string | null; name: string; price: number; stock: number; kind: string; trackInventory: boolean }[] }

async function posTerminal(org: OrgSeed, cookie: string) {
  let catalog: Catalog | null = null
  const load = async () => { const r = await request("pos.catalog", "GET", "/api/pos/catalog", cookie, undefined, true); if (r.json?.catalog) catalog = r.json.catalog }
  await request("pos.page", "GET", "/pos", cookie)
  await load()
  await request("app.menus", "GET", "/api/menus", cookie)
  while (running) {
    await think(2, 7)
    const roll = Math.random()
    if (roll < 0.4 && catalog?.session) {
      const c = catalog as Catalog
      const lines = c.products.filter((p) => p.kind === "standard" && p.variantId && p.price > 0 && (!p.trackInventory || p.stock > 3)).sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3))
      if (!lines.length) continue
      const items = lines.map((p) => ({ productId: p.productId, variantId: p.variantId, productType: "standard", productName: p.name, variantName: null, quantity: 1, unitId: null, unitPrice: p.price, totalPrice: p.price, discount: 0, taxRate: 0, lineTotal: p.price, trackInventory: p.trackInventory }))
      const total = Math.round(items.reduce((a, i) => a + i.lineTotal, 0) * 100) / 100
      await request("pos.sale", "POST", "/api/pos/sales", cookie, { locationId: c.location.id, payload: { items, subtotal: total, discount: 0, tax: 0, total, changeGiven: 0, pointsEarned: 0, pointsRedeemed: 0, pointsRedeemedValue: 0, payments: [{ method: "cash", amount: total }], discounts: [], cashSessionId: c.session!.id, cashRegisterId: c.session!.registerId } })
    } else if (roll < 0.75) {
      await load() // la caja refresca su catálogo cada ~20 s
    } else if (roll < 0.9) {
      await request("pos.products-search", "GET", `/api/crud/products?page=1&pageSize=20&q=Producto%20${Math.floor(Math.random() * 9)}`, cookie)
    } else {
      await request("app.branding", "GET", "/api/branding", cookie)
    }
  }
}

async function adminUser(org: OrgSeed, cookie: string) {
  const iso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10)
  await request("admin.page", "GET", "/admin", cookie)
  await request("app.menus", "GET", "/api/menus", cookie)
  while (running) {
    await think(4, 12)
    const pickN = Math.random()
    if (pickN < 0.25) await request("admin.panel-live", "GET", "/api/panel/live", cookie)
    else if (pickN < 0.45) await request("admin.products", "GET", `/api/crud/products?page=${1 + Math.floor(Math.random() * 3)}&pageSize=20`, cookie)
    else if (pickN < 0.6) await request("admin.customers", "GET", "/api/crud/customers?page=1&pageSize=20", cookie)
    else if (pickN < 0.8) await request("admin.sales", "GET", `/api/sales?page=1&pageSize=20&from=${iso(30)}&to=${iso(0)}`, cookie)
    else if (pickN < 0.92) await request("admin.inventory", "GET", `/api/inventory?locationType=location&locationId=${org.locationId}&page=1&pageSize=25`, cookie)
    else await request("admin.reports", "GET", `/api/reports?type=sales&from=${iso(30)}&to=${iso(0)}`, cookie)
  }
}

async function portalCustomer(org: OrgSeed, cookie: string) {
  await request("portal.storefront", "GET", "/api/portal/storefront", cookie)
  while (running) {
    await think(3, 10)
    const r = Math.random()
    if (r < 0.45) await request("portal.storefront", "GET", "/api/portal/storefront", cookie)
    else if (r < 0.75) await request("portal.home", "GET", "/api/portal/home", cookie)
    else await request("portal.orders", "GET", "/api/portal/orders", cookie)
  }
}

async function publicVisitor() {
  while (running) {
    await request("public.landing", "GET", "/", null)
    await think(5, 20)
    if (Math.random() < 0.3) await request("public.health", "GET", "/api/health", null)
  }
}

// ── Orquestación por etapas ─────────────────────────────────────────────────
let vuCount = 0
const stops: (() => void)[] = []
async function spawnVu() {
  vuCount += 1
  const org = pickOrg()
  const r = Math.random()
  try {
    if (r < 0.4) { const c = await sessionCookie("app", org); if (Math.random() < SSE_FRACTION) stops.push(openSse(c, "/api/notifications/stream")); await posTerminal(org, c) }
    else if (r < 0.65) { const c = await sessionCookie("app", org); if (Math.random() < SSE_FRACTION) stops.push(openSse(c, "/api/notifications/stream")); await adminUser(org, c) }
    else if (r < 0.95) await portalCustomer(org, await sessionCookie("portal", org))
    else await publicVisitor()
  } finally {
    vuCount -= 1
  }
}

const healthSeries: { t: number; vus: number; dbMs: number; rssMb: number; heapMb: number; cacheHitRate: number; inflight: number }[] = []
async function sampleHealth(t0: number) {
  while (running) {
    const r = await new Promise<any>((resolve) => {
      const req = http.request({ host: url.hostname, port: url.port, path: "/api/health", headers: { authorization: `Bearer ${CRON_SECRET}` }, timeout: 10_000 }, (res) => {
        const chunks: Buffer[] = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))) } catch { resolve(null) } })
      })
      req.on("error", () => resolve(null)); req.on("timeout", () => req.destroy()); req.end()
    })
    if (r) healthSeries.push({ t: Math.round((Date.now() - t0) / 1000), vus: vuCount, dbMs: r.dbMs, rssMb: r.memoryMb?.rss, heapMb: r.memoryMb?.heapUsed, cacheHitRate: r.cache?.hitRate, inflight: inFlight })
    await sleep(5000)
  }
}

const percentile = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0)
function summarize(list: Sample[]) {
  const ms = list.map((s) => s.ms).sort((a, b) => a - b)
  const errors = list.filter((s) => s.status === 0 || s.status >= 500).length
  const clientErrors = list.filter((s) => s.status >= 400 && s.status < 500).length
  return { n: list.length, p50: percentile(ms, 50), p95: percentile(ms, 95), p99: percentile(ms, 99), max: ms[ms.length - 1] ?? 0, errors, clientErrors, errorRate: list.length ? errors / list.length : 0 }
}
const fmt = (n: number) => `${Math.round(n)}`.padStart(6)

// Calienta la conexión y verifica que el servidor responde y está en la base de pruebas.
const probe = await request("probe", "GET", "/api/health", null, undefined, true)
if (probe.status !== 200) { console.error(`El servidor de ${baseURL} no responde (${probe.status}). ¿Está corriendo serve-prod?`); process.exit(1) }
samples.length = 0

console.log(`\n▶ ${LABEL}: ${orgs.length} empresas · etapas ${STAGES.map((s) => `${s.vus} VUs×${s.secs}s`).join(" → ")} · think×${THINK}\n`)
const dbCounters = async () => {
  const rows = await prisma.$queryRawUnsafe<{ Variable_name: string; Value: string }[]>("SHOW GLOBAL STATUS WHERE Variable_name IN ('Questions','Innodb_rows_read')")
  return Object.fromEntries(rows.map((r) => [r.Variable_name, Number(r.Value)]))
}
const dbBefore = await dbCounters()
const t0 = Date.now()
void sampleHealth(t0)
const stageStats: { vus: number; secs: number; rps: number; p95: number; errors: number }[] = []
for (let i = 0; i < STAGES.length; i += 1) {
  stageIndex = i
  const { vus, secs } = STAGES[i]
  while (vuCount < vus) { void spawnVu(); if (vuCount % 25 === 0) await sleep(50) }
  const stageStart = Date.now()
  await sleep(secs * 1000)
  // Cifras de la etapa en régimen (sin el calentamiento).
  const warm = Math.min(WARMUP, secs / 2)
  const mine = samples.filter((s) => s.stage === i && s.at >= stageStart + warm * 1000)
  const sum = summarize(mine)
  stageStats.push({ vus, secs, rps: mine.length / Math.max(1, (Date.now() - stageStart) / 1000 - warm), p95: sum.p95, errors: sum.errors })
  console.log(`  etapa ${i + 1}: ${String(vus).padStart(5)} VUs · ${stageStats[i].rps.toFixed(0).padStart(5)} req/s · p50 ${fmt(sum.p50)} ms · p95 ${fmt(sum.p95)} ms · p99 ${fmt(sum.p99)} ms · errores ${sum.errors} (${(sum.errorRate * 100).toFixed(2)} %)`)
}
running = false
for (const stop of stops) stop()
await sleep(1500)

const byLabel = new Map<string, Sample[]>()
for (const s of samples) byLabel.set(s.label, [...(byLabel.get(s.label) ?? []), s])
console.log("\nPor tipo de petición:")
console.log("  " + "petición".padEnd(24) + "   n".padStart(8) + "  p50 ms  p95 ms  p99 ms     max  5xx/timeouts  4xx")
const rows = [...byLabel.entries()].sort((a, b) => b[1].length - a[1].length).map(([label, list]) => ({ label, ...summarize(list) }))
for (const r of rows) console.log(`  ${r.label.padEnd(24)}${String(r.n).padStart(8)}${fmt(r.p50)}  ${fmt(r.p95)}  ${fmt(r.p99)}  ${fmt(r.max)}  ${String(r.errors).padStart(12)}  ${r.clientErrors}`)
const all = summarize(samples)
const duration = (Date.now() - t0) / 1000
console.log(`\nTotal: ${samples.length.toLocaleString("es-MX")} peticiones en ${duration.toFixed(0)} s (${(samples.length / duration).toFixed(0)} req/s) · p95 ${all.p95.toFixed(0)} ms · errores ${all.errors} (${(all.errorRate * 100).toFixed(2)} %) · máx. simultáneas ${peakInFlight} · SSE abiertas al final ${sseOpen}`)
const last = healthSeries.at(-1)
if (last) console.log(`Servidor: memoria RSS ${last.rssMb} MB · latencia BD ${last.dbMs} ms · aciertos de caché ${(last.cacheHitRate * 100).toFixed(0)} %`)

const dbAfter = await dbCounters()
const queriesPerRequest = (dbAfter.Questions - dbBefore.Questions) / Math.max(1, samples.length)
const rowsPerRequest = (dbAfter.Innodb_rows_read - dbBefore.Innodb_rows_read) / Math.max(1, samples.length)
console.log(`Base de datos: ${queriesPerRequest.toFixed(1)} consultas y ${Math.round(rowsPerRequest).toLocaleString("es-MX")} filas leídas por cada petición HTTP`)
const sales = await prisma.sale.count({ where: { createdAt: { gte: new Date(t0) } } })
console.log(`Ventas reales registradas durante la prueba: ${sales} (peticiones pos.sale: ${byLabel.get("pos.sale")?.length ?? 0})`)

const P95_LIMIT = Number(process.env.LOAD_P95_MS) || 800
const pass = all.errorRate < 0.01 && all.p95 < P95_LIMIT
console.log(`\n${pass ? "✔ APROBADA" : "✖ NO APROBADA"} (criterio: errores < 1 % y p95 < ${P95_LIMIT} ms)\n`)
fs.mkdirSync(".loadtest", { recursive: true })
fs.writeFileSync(`.loadtest/report-${LABEL}.json`, JSON.stringify({ label: LABEL, baseURL, stages: STAGES, think: THINK, orgs: orgs.length, total: all, duration, stageStats, perRequest: rows, health: healthSeries, salesCreated: sales, queriesPerRequest, rowsPerRequest, pass }, null, 2))
await prisma.$disconnect()
process.exit(pass ? 0 : 1)
