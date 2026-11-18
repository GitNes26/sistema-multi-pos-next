// Video promocional narrado 2: una compra desde el portal del cliente, vista por las dos partes (cliente y negocio) a la vez.
//   $env:PROMO_FFMPEG="<ruta a ffmpeg completo>"; node scripts/promo/prep.mjs demo@multi-pos.com Híbrido
//   node scripts/promo/record-portal-narrado.mjs   →   scripts/promo/out/multi-pos-portal-narrado.mp4
import path from "node:path"
import { chromium } from "@playwright/test"
import { base, outDir, sleep, synth, createTrack, launch, login, startScene, render } from "./lib.mjs"

const T = {
  intro: "Ahora veamos una compra completa en línea, desde las dos orillas: el cliente, en su celular… y tu negocio, en vivo.",
  tienda: "Este es el portal de tu cliente. Entra desde su celular y encuentra tu catálogo, con sus precios y categorías.",
  producto: "Elige un producto, ve su detalle… y lo agrega al carrito.",
  carrito: "Revisa su carrito, y sigue al pago.",
  pago: "Aquí elige cómo recibirlo, en sucursal o a domicilio, y cómo pagar. Hasta puede usar sus puntos.",
  confirmar: "Y para confirmar, un solo gesto: desliza, y listo.",
  llega: "¡Ahora mira el lado del negocio! Sin recargar nada, el pedido ya está en el tablero. Y también llega el aviso, con su campanita.",
  cliente1: "Mientras tanto, el cliente ve su pedido: recibido, esperando confirmación.",
  confirma: "El negocio abre el pedido, revisa el detalle… y lo confirma.",
  cliente2: "Y al instante, el cliente recibe la noticia: ¡pedido confirmado!",
  surtir: "Ahora, a prepararlo. En la pantalla de surtido se marca cada producto, y con un toque, el pedido queda listo.",
  cliente3: "¡Y el cliente se entera! Su pedido está listo para recoger, con su código de entrega. Su PIN, o su QR.",
  cobra: "Cuando llega a recogerlo, el negocio cobra ahí mismo. En efectivo exacto, con un solo toque.",
  valida: "Y valida la entrega con el PIN del cliente, o escaneando su QR. Así, nadie se lleva un pedido que no es suyo.",
  cliente4: "¡Listo! Pedido recogido. Y el cliente puede ver su recibo cuando quiera.",
  ventas: "Y para el negocio, la venta quedó registrada sola: con su ticket, su caja y su inventario al día. Sin captura doble.",
  outro: "Multi-POS: tus clientes piden fácil, tú atiendes sin enredos. Pruébalo hoy.",
}

const voice = synth(T)
const track = createTrack(voice)
const browser = await launch()

// Fondo del montaje (se dibuja con el navegador): marcos y rótulos de cada panel.
const stage = path.join(outDir, "stage-portal.png")
{
  const b = await chromium.launch()
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } })
  await pg.setContent(`<body style="margin:0;width:1920px;height:1080px;background:linear-gradient(135deg,#041f12,#0b5a37 70%,#0f7a4a);font-family:Montserrat,system-ui,sans-serif;color:#fff;position:relative;overflow:hidden">
    <div style="position:absolute;left:52px;top:34px;font-size:26px;font-weight:800;letter-spacing:1px">EL CLIENTE <span style="font-weight:500;opacity:.8">· en su celular</span></div>
    <div style="position:absolute;left:552px;top:34px;font-size:26px;font-weight:800;letter-spacing:1px">EL NEGOCIO <span style="font-weight:500;opacity:.8">· su panel, en vivo</span></div>
    <div style="position:absolute;right:40px;top:36px;font-size:22px;font-weight:700;opacity:.9">Multi-POS</div>
    <div style="position:absolute;left:52px;top:102px;width:465px;height:956px;border-radius:34px;background:#0b2a1b;box-shadow:0 0 0 2px rgba(255,255,255,.18),0 20px 50px rgba(0,0,0,.45)"></div>
    <div style="position:absolute;left:552px;top:102px;width:1336px;height:956px;border-radius:18px;background:#0b2a1b;box-shadow:0 0 0 2px rgba(255,255,255,.18),0 20px 50px rgba(0,0,0,.45)"></div></body>`)
  await pg.screenshot({ path: stage })
  await b.close()
}

const phoneState = await login(browser, { url: "/portal/auth/login", id: "hcli-001@hibrido.local", landing: "/portal", viewport: { width: 430, height: 900 } })
const bizState = await login(browser, { url: "/auth/login", id: "demo@multi-pos.com" })
const ph = await startScene(browser, { name: "cliente", storageState: phoneState, viewport: { width: 430, height: 900 }, hideClosed: true, intro: { tag: "El cliente", title: "Compra desde su celular", sub: "Portal del cliente" } })
const bz = await startScene(browser, { name: "negocio", storageState: bizState, viewport: { width: 1320, height: 940 }, hideClosed: true, intro: { tag: "El negocio", title: "Lo ve todo en vivo", sub: "Pedidos, avisos y seguimiento" } })
globalThis.__T0 = Math.max(ph.wall0, bz.wall0)
const P = ph.page
const B = bz.page
const dlg = () => B.getByRole("dialog").last()

await track.say("intro", async () => {
  await Promise.all([ph.go("/portal/store", { settle: 1200 }), bz.go("/admin/orders", { settle: 1200 })])
  await P.getByRole("button", { name: "Saltar" }).click({ timeout: 4000 }).catch(() => {})
})
await Promise.all([ph.card(), bz.card()])
await sleep(700)

await track.say("tienda", async () => {
  await ph.focus({ x: 10, y: 360, width: 410, height: 60 }, { ms: 2600, z: 1.5 })
  await ph.tap(P.getByRole("button", { name: /^Bebidas/ }))
  await sleep(600)
  await ph.focus({ x: 10, y: 410, width: 410, height: 330 }, { ms: 3000, z: 1.3 })
})
await track.say("producto", async () => {
  await ph.tap(P.locator('a[href^="/portal/store/"]').first().locator("p").first())
  await P.waitForLoadState("networkidle").catch(() => {})
  await sleep(700)
  await ph.focus(P.getByRole("button", { name: "Agregar al carrito" }), { ms: 2400, z: 1.5 })
  await ph.tap(P.getByRole("button", { name: "Agregar al carrito" }))
})
await track.say("carrito", async () => {
  await ph.tap(P.getByRole("button", { name: /^Carrito \(/ }).first())
  await sleep(800)
  await ph.focus(P.getByRole("button", { name: "Continuar al pago" }), { ms: 2000, z: 1.4 })
  await ph.tap(P.getByRole("button", { name: "Continuar al pago" }))
  await P.waitForURL(/checkout/, { timeout: 30000 })
  await P.waitForLoadState("networkidle").catch(() => {})
})
await track.say("pago", async () => {
  await sleep(600)
  await ph.focus({ x: 10, y: 230, width: 410, height: 260 }, { ms: 2600, z: 1.35 })
  await P.mouse.move(215, 500, { steps: 14 })
  await P.mouse.wheel(0, 360)
  await sleep(500)
  await ph.focus({ x: 10, y: 120, width: 410, height: 400 }, { ms: 3000, z: 1.25 })
})
await track.say("confirmar", async () => {
  await P.mouse.wheel(0, -500)
  await sleep(500)
  const h = P.getByRole("button", { name: /Desliza para confirmar/ })
  const box = await h.boundingBox()
  await ph.focus({ x: 10, y: box.y - 10, width: 410, height: 90 }, { ms: 1800, z: 1.5 })
  await ph.moveTo(h)
  await P.mouse.down()
  await P.mouse.move(box.x + box.width / 2 + 335, box.y + box.height / 2, { steps: 30 })
  await P.mouse.up()
  await P.waitForURL(/portal\/orders\//, { timeout: 30000 })
})
await sleep(600)
const num = (await P.locator("main").innerText().catch(() => "")).match(/Pedido #(\d+)/)?.[1]
console.log("pedido", num)
const card = () => B.getByText(new RegExp("^#" + num + "$")).first()

await track.say("llega", async () => {
  await sleep(500)
  await bz.focus(card(), { ms: 3000, pad: 40, z: 1.9 })
  await bz.focus({ x: 1020, y: 4, width: 220, height: 50 }, { ms: 2600, z: 1.8 })
})
await track.say("cliente1", () => ph.focus({ x: 10, y: 340, width: 410, height: 260 }, { ms: 3200, z: 1.35 }))

await track.say("confirma", async () => {
  await bz.tap(card())
  await sleep(900)
  await bz.focus(dlg(), { ms: 3000, z: 1.25 })
  await bz.tap(dlg().getByRole("button", { name: "Confirmar pedido" }))
})
await track.say("cliente2", () => ph.focus({ x: 10, y: 340, width: 410, height: 260 }, { ms: 3400, z: 1.35 }))

await track.say("surtir", async () => {
  await sleep(500)
  await bz.tap(card())
  await sleep(800)
  await bz.tap(dlg().getByRole("button", { name: /preparaci/i }).last())
  await B.waitForURL(/prepare/, { timeout: 30000 })
  await sleep(700)
  const start = B.getByRole("button", { name: "Iniciar preparación" })
  if (await start.waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false)) await bz.tap(start)
  await B.getByText("Toca para marcar").waitFor({ state: "visible", timeout: 8000 }).catch(() => {})
  await sleep(900)
  await bz.focus(B.getByText("Toca para marcar"), { ms: 2400, pad: 90, z: 1.6 })
  await bz.tap(B.getByText("Toca para marcar"))
  await sleep(700)
  for (let i = 0; i < 3; i++) {
    await bz.tap(B.getByRole("button", { name: /Marcar pedido como listo|Completar preparaci/ }).first()).catch(() => {})
    await B.getByRole("button", { name: "Sí, completar" }).click({ timeout: 1500 }).catch(() => {})
    if (await B.waitForURL((u) => u.pathname === "/admin/orders", { timeout: 6000 }).then(() => true).catch(() => false)) break
    console.log("reintento de completar", i + 1, (await B.locator("main").innerText().catch(() => "")).replace(/s+/g, " ").slice(0, 160))
  }
})
await sleep(800)
await track.say("cliente3", async () => {
  await ph.focus({ x: 10, y: 330, width: 410, height: 300 }, { ms: 2600, z: 1.35 })
  await P.mouse.move(215, 600, { steps: 14 })
  await P.mouse.wheel(0, 300)
  await sleep(600)
  const lab = await P.getByText(/PIN de confirmaci/i).first().boundingBox().catch(() => null)
  await ph.focus(lab ? { x: 10, y: Math.max(0, lab.y - 20), width: 410, height: 230 } : { x: 10, y: 300, width: 410, height: 260 }, { ms: 3800, z: 1.4 })
})
const body = await P.locator("main").innerText()
const pin = (body.match(/PIN DE CONFIRMACI[ÓO]N\s+([\d\s]+?)\s+C[ÓO]DIGO/i)?.[1] ?? "").replace(/\D/g, "")
console.log("PIN", pin)

await track.say("cobra", async () => {
  await bz.tap(card())
  await sleep(800)
  await bz.tap(dlg().getByRole("button", { name: /^Cobrar/ }))
  await sleep(900)
  await bz.focus(dlg(), { ms: 2200, z: 1.25 })
  await bz.tap(B.getByRole("button", { name: /Efectivo exacto/ }))
  await sleep(1500)
})
await track.say("valida", async () => {
  await bz.tap(dlg().getByRole("button", { name: /Entregar con PIN/ }))
  await sleep(900)
  await bz.focus(dlg(), { ms: 2200, z: 1.3 })
  await bz.tap(dlg().getByRole("button", { name: /Teclear PIN/ }).or(B.getByRole("button", { name: /Usar PIN/ })).first())
  await sleep(600)
  const inp = dlg().locator("input").first()
  await bz.tap(inp)
  await bz.type(pin, 220)
  await sleep(800)
  const ok = dlg().getByRole("button", { name: /Confirmar|Validar|Entregar(?! con)/ }).last()
  if (await ok.count()) await bz.tap(ok)
  else await B.keyboard.press("Enter")
  await sleep(1500)
})
await track.say("cliente4", async () => {
  await ph.focus({ x: 10, y: 330, width: 410, height: 300 }, { ms: 3400, z: 1.35 })
  const rec = P.getByRole("link", { name: /Ver recibo/ }).or(P.getByRole("button", { name: /Ver recibo/ })).first()
  if (await rec.count()) await ph.focus(rec, { ms: 2200, z: 1.6 })
})
await track.say("ventas", async () => {
  await B.keyboard.press("Escape").catch(() => {})
  await bz.go("/admin/sales", { settle: 1000 })
  await B.mouse.move(700, 300, { steps: 24 })
  await bz.focus({ x: 270, y: 150, width: 1040, height: 330 }, { ms: 4200, z: 1.3 })
})

await Promise.all([ph.card("Multi-POS", "Tus clientes piden fácil.", "Tú atiendes sin enredos"), bz.card("Multi-POS", "Todo conectado, en vivo.", "Pruébalo hoy · Sin tarjeta · Sin contratos")])
await track.say("outro", null, { tail: 1500 })
const rp = await ph.finish()
const rb = await bz.finish()
await browser.close()
render({
  scenes: [rp, rb],
  track,
  out: path.join(outDir, "multi-pos-portal-narrado.mp4"),
  extra: [stage],
  layout: () => "[2:v]scale=1920:1080,format=yuv420p[bgi];[v0]scale=449:940[ph];[v1]scale=1320:940[bz];[bgi][ph]overlay=60:110[t1];[t1][bz]overlay=560:110[vout]",
})
