// Video promocional: una tienda de abarrotes vendiendo en el POS de Multi-POS.
// Graba un recorrido REAL de la interfaz (base de pruebas local, datos demo) con rótulos y cursor visibles.
//   node scripts/promo/record-abarrotes.mjs   →   scripts/promo/out/abarrotes.webm
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const base = process.env.PROMO_BASE ?? "http://127.0.0.1:3107"
const W = 1536
const H = 864
const outDir = path.resolve("scripts/promo/out")
fs.mkdirSync(outDir, { recursive: true })
for (const f of fs.readdirSync(outDir)) if (f.endsWith(".webm") && !f.startsWith("multi-pos-")) fs.rmSync(path.join(outDir, f))

const browser = await chromium.launch()

// Acceso en un contexto aparte (sin grabar): el video empieza ya dentro del punto de venta.
const loginCtx = await browser.newContext({ viewport: { width: W, height: H } })
const loginPage = await loginCtx.newPage()
await loginPage.goto(base + "/auth/login", { waitUntil: "domcontentloaded" })
await loginPage.waitForLoadState("networkidle")
for (let i = 0; i < 6; i++) {
  await loginPage.locator("#identifier").fill("demo@multi-pos.com")
  await loginPage.locator("#password").fill("demo1234")
  if ((await loginPage.locator("#password").inputValue()) === "demo1234") break
  await loginPage.waitForTimeout(700)
}
await loginPage.getByRole("button", { name: /^entrar/i }).click()
await loginPage.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 120000 })
const storageState = await loginCtx.storageState()
await loginCtx.close()

const context = await browser.newContext({ viewport: { width: W, height: H }, storageState, recordVideo: { dir: outDir, size: { width: W, height: H } } })
const page = await context.newPage()

// ── Capa de video: cursor, clics, rótulos y tarjetas de título (persiste entre páginas) ─────────────────────────
await context.addInitScript(() => {
  const install = () => {
    if (document.getElementById("__promo")) return
    const root = document.createElement("div")
    root.id = "__promo"
    root.innerHTML = `
      <style>
        #__promo,#__promo *{box-sizing:border-box;pointer-events:none!important;font-family:Montserrat,system-ui,sans-serif}
        #__cur{position:fixed;z-index:2147483647;left:0;top:0;width:28px;height:28px;pointer-events:none;transition:transform .02s linear;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
        #__rip{position:fixed;z-index:2147483646;width:14px;height:14px;border-radius:50%;border:3px solid #16a34a;pointer-events:none;opacity:0;transform:translate(-50%,-50%) scale(.4)}
        #__rip.go{animation:__r .55s ease-out}
        @keyframes __r{0%{opacity:.95;transform:translate(-50%,-50%) scale(.4)}100%{opacity:0;transform:translate(-50%,-50%) scale(3.2)}}
        #__cap{position:fixed;z-index:2147483645;left:500px;bottom:20px;transform:translate(-50%,16px);width:max-content;max-width:900px;padding:12px 24px;border-radius:999px;background:rgba(6,40,24,.92);color:#fff;font-weight:600;font-size:24px;letter-spacing:.1px;opacity:0;transition:opacity .35s,transform .35s;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35)}
        #__cap.on{opacity:1;transform:translate(-50%,0)}
        #__cap.mid{left:50%}
        #__card{position:fixed;inset:0;z-index:2147483644;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:linear-gradient(135deg,#052e1a,#0f7a4a 60%,#16a34a);color:#fff;text-align:center;opacity:0;pointer-events:none;transition:opacity .5s;padding:0 8vw}
        #__card.on{opacity:1}
        #__card h1{margin:0;font-size:64px;line-height:1.1;font-weight:800;letter-spacing:-.5px}
        #__card p{margin:0;font-size:30px;font-weight:500;opacity:.92}
        #__card .tag{font-size:22px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.8}
      </style>
      <div id="__card"><div class="tag"></div><h1></h1><p></p></div>
      <div id="__cap"></div>
      <div id="__rip"></div>
      <svg id="__cur" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`
    document.documentElement.appendChild(root)
    if (!sessionStorage.getItem("__intro")) {
      const d = root.querySelector("#__card")
      d.querySelector(".tag").textContent = "Multi-POS · Tienda de abarrotes"
      d.querySelector("h1").textContent = "Vende en segundos."
      d.querySelector("p").textContent = "Sin cursos, sin complicaciones."
      d.style.transition = "none"
      d.classList.add("on")
      setTimeout(() => { d.style.transition = "" }, 50)
    }
    const cur = root.querySelector("#__cur")
    const rip = root.querySelector("#__rip")
    window.addEventListener("mousemove", (e) => { cur.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)` }, true)
    window.addEventListener("mousedown", (e) => { rip.style.left = e.clientX + "px"; rip.style.top = e.clientY + "px"; rip.classList.remove("go"); void rip.offsetWidth; rip.classList.add("go") }, true)
  }
  document.addEventListener("DOMContentLoaded", install)
  if (document.readyState !== "loading") install()
})

const caption = (text) => page.evaluate((t) => { const c = document.getElementById("__cap"); if (!c) return; if (!t) { c.classList.remove("on"); return } c.textContent = t; c.classList.add("on") }, text)
const card = (tag, title, sub) => page.evaluate(([a, b, c]) => { const d = document.getElementById("__card"); if (!d) return; if (!b) { d.classList.remove("on"); return } d.querySelector(".tag").textContent = a ?? ""; d.querySelector("h1").textContent = b; d.querySelector("p").textContent = c ?? ""; d.classList.add("on") }, [tag, title, sub])
const wait = (ms) => page.waitForTimeout(ms)
const say = async (text, ms = 1900) => { await caption(text); await wait(ms) }

let mouse = { x: W / 2, y: H / 2 }
async function moveTo(locator, { dx = 0, dy = 0, steps = 16 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  const box = await locator.boundingBox()
  if (!box) return
  const x = box.x + box.width / 2 + dx
  const y = box.y + box.height / 2 + dy
  await page.mouse.move(x, y, { steps })
  mouse = { x, y }
  await wait(150)
}
async function tap(locator, opts) {
  await moveTo(locator, opts)
  await locator.click({ delay: 70 })
  await wait(300)
}

await page.setContent(`<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:linear-gradient(135deg,#052e1a,#0f7a4a 60%,#16a34a);color:#fff;font-family:Montserrat,system-ui,sans-serif;text-align:center">
  <div style="font-size:22px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.8">Multi-POS · Tienda de abarrotes</div>
  <h1 style="margin:0;font-size:64px;font-weight:800;letter-spacing:-.5px">Vende en segundos.</h1>
  <p style="margin:0;font-size:30px;font-weight:500;opacity:.92">Sin cursos, sin complicaciones.</p></body>`)
await wait(1200)
await page.goto(base + "/pos", { waitUntil: "domcontentloaded" })
await page.waitForLoadState("networkidle").catch(() => {})
await wait(1800)
await page.evaluate(() => sessionStorage.setItem("__intro", "1"))
await card()
await wait(900)

// ── 2. Abrir caja ───────────────────────────────────────────────────────────────────────────────────────────────
await say("1 · Abre tu caja con el fondo del día", 2200)
await tap(page.getByRole("button", { name: /Abrir caja/ }).first())
await wait(700)
await moveTo(page.locator("#openingCash"))
await page.locator("#openingCash").click()
await page.keyboard.type("500", { delay: 160 })
await wait(700)
await tap(page.getByRole("dialog").getByRole("button", { name: /^Abrir caja$/ }))
await wait(1200)

// ── 3. Buscar y vender ──────────────────────────────────────────────────────────────────────────────────────────
await say("2 · Toca un producto y ya está en el ticket", 2200)
await tap(page.getByRole("button", { name: "Agregar Refresco cola 2L" }))
await tap(page.getByRole("button", { name: "Agregar Refresco cola 2L" }))
await tap(page.getByRole("button", { name: "Agregar Bolillo" }))
await wait(800)

await say("¿Prefieres buscar o escanear el código de barras? También.", 2200)
const search = page.getByPlaceholder(/Buscar o escanear/)
await tap(search)
await page.keyboard.type("arroz", { delay: 170 })
await wait(900)
await tap(page.getByRole("button", { name: "Agregar Arroz 1kg" }))
await search.fill("")
await wait(500)

await say("Por categoría: abarrotes, bebidas, carnes, frutas y más", 2200)
await tap(page.getByRole("button", { name: /^Bebidas/ }))
await wait(900)
await tap(page.getByRole("button", { name: /^Todos/ }))
await wait(500)

// ── 4. Granel ───────────────────────────────────────────────────────────────────────────────────────────────────
await say("3 · ¿Vendes a granel? Elige los kilos o el monto", 2400)
await tap(page.getByRole("button", { name: "Agregar Pechuga de pollo" }))
await wait(900)
await tap(page.getByRole("dialog").getByRole("button", { name: "0.5 kg" }))
await wait(1200)
await tap(page.getByRole("dialog").getByRole("button", { name: /^Agregar/ }))
await wait(1000)

// ── 5. Promociones automáticas ──────────────────────────────────────────────────────────────────────────────────
await say("4 · Las promociones se aplican solas, y te avisa cuánto falta para la siguiente", 3400)

// ── 6. Cliente y puntos ─────────────────────────────────────────────────────────────────────────────────────────
await say("5 · Asocia al cliente: acumula y canjea puntos", 2200)
await tap(page.locator("button", { hasText: /^Cliente$/ }).first())
await wait(1000)
await tap(page.getByRole("dialog").getByText(/Mar.a Garc.a/))
await wait(1200)

// ── 7. Cobro ────────────────────────────────────────────────────────────────────────────────────────────────────
await say("6 · Cobra en efectivo, tarjeta o con puntos", 2200)
await tap(page.locator("button", { hasText: /Cobrar/ }).last())
await wait(1500)
await say("Un toque en el billete y te calcula el cambio", 2400)
await tap(page.getByRole("dialog").getByRole("button", { name: "$200" }))
await wait(1500)
await tap(page.getByRole("dialog").getByRole("button", { name: /Completar venta/ }))
await wait(2200)
await say("¡Listo! Ticket para imprimir, enviar o guardar", 3000)
await caption("")
await page.keyboard.press("Escape").catch(() => {})
await wait(1000)

// ── 8. Panel: inventario y reportes ─────────────────────────────────────────────────────────────────────────────
await card("Detrás del mostrador", "Tu negocio, bajo control.", "Inventario, ventas y ganancias al día.")
await wait(2800)
await page.goto(base + "/admin/inventory", { waitUntil: "domcontentloaded" })
await page.waitForLoadState("networkidle").catch(() => {})
await wait(900)
await card()
await say("Inventario en tiempo real: sabes qué te falta antes de que se acabe", 3000)
await page.mouse.move(W * 0.6, H * 0.55, { steps: 30 })
await page.mouse.wheel(0, 420)
await wait(1800)
await page.goto(base + "/admin", { waitUntil: "domcontentloaded" })
await page.waitForLoadState("networkidle").catch(() => {})
await wait(1500)
await say("Ventas, ganancias y alertas en un solo panel", 3000)
await page.mouse.move(W * 0.5, H * 0.5, { steps: 30 })
await page.mouse.wheel(0, 380)
await wait(2200)
await caption("")

// ── 9. Cierre ───────────────────────────────────────────────────────────────────────────────────────────────────
await card("Multi-POS", "Tu tienda, más fácil.", "Pruébalo hoy · Sin tarjeta · Sin contratos")
await wait(4200)

await context.close()
const video = page.video()
const file = video ? await video.path() : null
await browser.close()
if (file) {
  const dest = path.join(outDir, "abarrotes.webm")
  fs.renameSync(file, dest)
  console.log("VIDEO", dest, (fs.statSync(dest).size / 1024 / 1024).toFixed(1) + " MB")
}
