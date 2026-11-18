// Video promocional 2: producto personalizable, pedido para varias personas y pago personalizado (restaurante).
// Graba un recorrido REAL de la interfaz (base de pruebas local, datos demo) con rótulos y cursor visibles.
//   node scripts/promo/record-personalizado.mjs   →   scripts/promo/out/personalizado.webm
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
  await loginPage.locator("#identifier").fill("gerente-rest@demo.multi-pos.com")
  await loginPage.locator("#password").fill("demo1234")
  if ((await loginPage.locator("#password").inputValue()) === "demo1234") break
  await loginPage.waitForTimeout(700)
}
await loginPage.getByRole("button", { name: /^entrar/i }).click()
await loginPage.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 120000 })
await loginPage.goto(base + "/pos", { waitUntil: "domcontentloaded" })
await loginPage.waitForLoadState("networkidle").catch(() => {})
await loginPage.waitForTimeout(1500)
// Cierra el aviso de la guía y abre el negocio (si está cerrado) para que el video se vea limpio.
await loginPage.locator("button").filter({ has: loginPage.locator("svg.lucide-x") }).first().click({ timeout: 2000 }).catch(() => {})
await loginPage.locator("header button, button", { hasText: /^Cerrado$/ }).first().click({ timeout: 2500 }).catch(() => {})
await loginPage.getByRole("button", { name: /Abrir ahora/ }).click({ timeout: 2500 }).catch(() => {})
await loginPage.waitForTimeout(1200)
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
      d.querySelector(".tag").textContent = "Multi-POS · Restaurantes y cafeterías"
      d.querySelector("h1").textContent = "A su gusto. Para todos."
      d.querySelector("p").textContent = "Pedidos para varias personas y cobro como tú quieras."
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


// El negocio demo está fuera de su horario: se oculta la etiqueta «Cerrado» solo para el video.
await context.addInitScript(() => {
  setInterval(() => {
    document.querySelectorAll("button").forEach((b) => {
      if ((b.textContent || "").trim() === "Cerrado") b.style.visibility = "hidden"
    })
  }, 300)
})

const caption = (text) => page.evaluate((t) => { const c = document.getElementById("__cap"); if (!c) return; if (!t) { c.classList.remove("on"); return } c.textContent = t; c.classList.add("on") }, text)
const card = (tag, title, sub) => page.evaluate(([a, b, c]) => { const d = document.getElementById("__card"); if (!d) return; if (!b) { d.classList.remove("on"); return } d.querySelector(".tag").textContent = a ?? ""; d.querySelector("h1").textContent = b; d.querySelector("p").textContent = c ?? ""; d.classList.add("on") }, [tag, title, sub])
const wait = (ms) => page.waitForTimeout(ms)
const T0 = Date.now()
const say = async (text, ms = 1600) => { console.log(((Date.now() - T0) / 1000).toFixed(1) + "s", text); await caption(text); await wait(ms) }

let mouse = { x: W / 2, y: H / 2 }
async function moveTo(locator, { dx = 0, dy = 0, steps = 9 } = {}) {
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
  <div style="font-size:22px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.8">Multi-POS · Restaurantes y cafeterías</div>
  <h1 style="margin:0;font-size:64px;font-weight:800;letter-spacing:-.5px">A su gusto. Para todos.</h1>
  <p style="margin:0;font-size:30px;font-weight:500;opacity:.92">Pedidos para varias personas y cobro como tú quieras.</p></body>`)
await wait(1200)
await page.goto(base + "/pos", { waitUntil: "domcontentloaded" })
await page.waitForLoadState("networkidle").catch(() => {})
await wait(1800)
await page.evaluate(() => sessionStorage.setItem("__intro", "1"))
await card()
await wait(900)

// ── 1. Pedido para varias personas ─────────────────────────────────────────────────────────────────────────────
await page.getByRole("button", { name: /^Bebidas/ }).click().catch(() => {})
await wait(500)
await say("1 · ¿Pedido para varias personas? Agrega un nombre por comensal", 2240)
await tap(page.getByText("Pedir para varias personas").first())
await wait(700)
const addName = async (name) => {
  const input = page.getByPlaceholder(/Nombre/)
  if (!(await input.isVisible().catch(() => false))) await tap(page.getByText("Persona nueva"))
  await tap(input)
  await page.keyboard.type(name, { delay: 80 })
  await wait(250)
  await tap(page.getByRole("button", { name: "Agregar", exact: true }))
  await wait(500)
}
await addName("Ana")
await addName("Luis")
await addName("Marta")
await tap(page.locator("button", { hasText: /^Ana$/ }).first())
await wait(500)

// ── 2. Producto personalizable ──────────────────────────────────────────────────────────────────────────────────
await say("2 · Producto personalizable: cada quien lo arma a su gusto", 2240)
await tap(page.getByRole("button", { name: /Agregar Café de especialidad/ }))
await wait(1400)
await say("Elige tamaño y tipo de leche", 1440)
await tap(page.getByText(/^Grande/).first())
await tap(page.getByText("Almendra", { exact: true }))
await wait(600)
await page.mouse.move(1260, 560, { steps: 12 })
await page.mouse.wheel(0, 330)
await wait(900)
await say("Suma extras y el precio se ajusta solo", 1600)
await tap(page.getByText("Canela", { exact: true }))
await tap(page.getByText("Crema batida"))
await wait(600)
await page.mouse.move(1260, 560, { steps: 12 })
await page.mouse.wheel(0, 300)
await wait(700)
await tap(page.getByText("Sin azúcar", { exact: true }))
await say("Y deja indicaciones para la cocina", 1440)
await wait(500)
await tap(page.getByRole("button", { name: /Agregar · \$/ }))
await wait(1200)

// ── 3. Agrupado por nombre ──────────────────────────────────────────────────────────────────────────────────────
await say("3 · Cada pedido queda a nombre de su comensal", 1760)
await tap(page.locator("button", { hasText: /^Luis$/ }).first())
await tap(page.getByRole("button", { name: /^Desayunos/ }))
await tap(page.getByRole("button", { name: "Agregar Chilaquiles verdes" }))
await tap(page.getByRole("button", { name: /^Bebidas/ }))
await tap(page.getByRole("button", { name: "Agregar Limonada" }))
await wait(500)
await tap(page.locator("button", { hasText: /^Marta$/ }).first())
await tap(page.getByRole("button", { name: /^Desayunos/ }))
await tap(page.getByRole("button", { name: "Agregar Hot cakes con miel" }))
await tap(page.getByRole("button", { name: /^Bebidas/ }))
await tap(page.getByRole("button", { name: "Agregar Café americano" }))
await wait(600)
await say("Ana, Luis y Marta: un solo ticket, agrupado por persona", 2560)
await page.mouse.move(1260, 430, { steps: 14 })
await page.mouse.wheel(0, -400)
await wait(900)
await page.mouse.wheel(0, 260)
await wait(1500)
await page.mouse.wheel(0, 260)
await wait(1500)

// ── 4. Pago personalizado ───────────────────────────────────────────────────────────────────────────────────────
await say("4 · Cobra una sola vez… y como quieran pagar", 1760)
await tap(page.locator("button", { hasText: /Cobrar/ }).last())
await wait(1200)
await tap(page.getByRole("dialog").getByRole("button", { name: /Omitir y cobrar/ }))
await wait(1400)
await say("Pago personalizado: combina efectivo, tarjeta y más", 2080)
await tap(page.getByRole("dialog").getByText("Pago personalizado"))
await wait(900)
const key = async (k) => tap(page.getByRole("dialog").getByRole("button", { name: k, exact: true }), { steps: 6 })
await say("Primer pago: en efectivo…", 1040)
await tap(page.getByRole("dialog").getByRole("button", { name: "Efectivo", exact: true }), { steps: 6 })
await key("5"); await key("0")
await tap(page.getByRole("dialog").getByRole("button", { name: /Agregar pago/ }))
await wait(1000)
await say("Segundo pago: con tarjeta…", 1040)
await tap(page.getByRole("dialog").getByRole("button", { name: "Tarjeta", exact: true }), { steps: 6 })
await key("8"); await key("0")
await tap(page.getByRole("dialog").getByRole("button", { name: /Agregar pago/ }))
await wait(1000)
await say("Y el resto como quieran. Cada pago se suma a un lado", 1920)
await tap(page.getByRole("dialog").getByRole("button", { name: "Efectivo", exact: true }), { steps: 6 })
await tap(page.getByRole("dialog").getByRole("button", { name: /Exacto/ }), { steps: 6 })
const addBtn = page.getByRole("dialog").getByRole("button", { name: /Agregar pago/ })
if (await addBtn.isEnabled().catch(() => false)) await tap(addBtn)
await wait(2000)
await tap(page.getByRole("dialog").getByRole("button", { name: /Completar venta/ }))
await wait(2200)
await say("¡Listo! Una venta, tres pedidos, varias formas de pagar", 2080)
await caption("")
await page.keyboard.press("Escape").catch(() => {})
await wait(900)

// ── 5. Cierre ───────────────────────────────────────────────────────────────────────────────────────────────────
await card("Multi-POS", "Cada quien a su gusto.", "Tú, sin complicaciones · Pruébalo hoy")
await wait(4200)

await context.close()
const video = page.video()
const file = video ? await video.path() : null
await browser.close()
if (file) {
  const dest = path.join(outDir, "personalizado.webm")
  fs.renameSync(file, dest)
  console.log("VIDEO", dest, (fs.statSync(dest).size / 1024 / 1024).toFixed(1) + " MB")
}
