// Video promocional narrado: tienda de abarrotes + restaurante (producto personalizable, pedido para varias personas y pago personalizado).
// Graba un recorrido REAL de la interfaz (base de pruebas local, datos demo) con voz, pausas y zooms en lo importante.
//   $env:PROMO_FFMPEG="<ruta a ffmpeg completo>"; node scripts/promo/prep.mjs demo@multi-pos.com Supermercado --cerrar-caja
//   node scripts/promo/record-demo-narrado.mjs   →   scripts/promo/out/multi-pos-demo-narrado.mp4
import path from "node:path"
import { base, outDir, sleep, synth, createTrack, launch, login, startScene, render, concat } from "./lib.mjs"

const T = {
  intro: "¡Hola! Te voy a enseñar, en un par de minutos, lo fácil que es vender con Multi-POS. Empecemos con una tienda de abarrotes.",
  caja: "Lo primero: abre tu caja con el fondo del día. Escribes cuánto dinero hay… y listo. Así de sencillo.",
  tocar: "Ahora sí, a vender. Un toque al refresco, otro más, el bolillo… y todo va cayendo al ticket. Sin teclear nada.",
  buscar: "¿Prefieres buscar por nombre, o escanear el código de barras? También se puede, tú eliges.",
  categorias: "Y si quieres explorar, tienes categorías: abarrotes, bebidas, carnes, frutas, y más.",
  granel: "¿Vendes a granel? Sin problema. Eliges los kilos, o el monto que el cliente quiera llevarse.",
  promos: "Mira esto: las promociones se aplican solas, y hasta te avisa cuánto falta para la siguiente. Tú no calculas nada.",
  cliente: "Si el cliente es de la casa, lo asocias, y acumula puntos que después puede canjear. Se siente bien volver, ¿verdad?",
  cobro: "A la hora de cobrar, efectivo, tarjeta o con puntos. Un toque en el billete… y el sistema te calcula el cambio.",
  listo: "¡Listo! Ticket para imprimir, enviar o guardar. Así de fácil.",
  inventario: "Y detrás del mostrador, tu negocio bajo control. El inventario, al instante: sabes qué te falta antes de que se acabe.",
  panel: "Ventas, ganancias y alertas, todo en un solo panel. Sin hojas de cálculo, sin sorpresas.",
  trans: "Pero eso no es todo. Si tu negocio es un restaurante o una cafetería, esto te va a encantar.",
  intro2: "En un restaurante, cada quien pide a su gusto. Veamos cómo se atiende una mesa de varias personas.",
  varios: "Activa «pedir para varias personas», y agrega un nombre por comensal. Ana, Luis y Marta.",
  personalizable: "Aquí viene lo bueno: un producto personalizable. Cada quien lo arma como quiere.",
  tamano: "Elige el tamaño… y el tipo de leche. Almendra, para Ana.",
  extras: "Suma extras, y fíjate cómo el precio se ajusta solito.",
  notas: "Y deja indicaciones para la cocina. Sin azúcar. Nadie se confunde.",
  grupos: "Ahora, el pedido de Luis y el de Marta. Cada uno queda a su nombre.",
  agrupado: "Mira el ticket: un solo cobro, pero agrupado por persona. Ana, Luis y Marta, cada quien con lo suyo.",
  cobrar: "Y a la hora de pagar, tú decides cómo. Pago personalizado: combina efectivo, tarjeta y más.",
  pago1: "El primer pago, en efectivo.",
  pago2: "El segundo, con tarjeta.",
  pago3: "Y lo que falte, como quieran. Fíjate cómo cada pago se va sumando aquí a un lado, con lo que aún falta.",
  fin: "¡Listo! Una venta, tres pedidos y varias formas de pagar. Sin complicaciones.",
  outro: "Multi-POS. Tu negocio, a tu manera. Pruébalo hoy, sin tarjeta y sin contratos.",
}

const voice = synth(T)
const track = createTrack(voice)
const browser = await launch()
const files = []

// ═════════════ Parte 1 · Tienda de abarrotes ═════════════
{
  const storageState = await login(browser, { url: "/auth/login", id: "demo@multi-pos.com" })
  const s = await startScene(browser, { name: "abarrotes", storageState, intro: { tag: "Multi-POS · Tienda de abarrotes", title: "Vende en segundos.", sub: "Sin cursos, sin complicaciones." } })
  globalThis.__T0 = s.wall0
  const p = s.page
  const ticket = { x: 1000, y: 64, width: 536, height: 800 }

  await track.say("intro", () => s.go("/pos", { settle: 1200 }))
  await s.card()
  await sleep(700)

  await track.say("caja", async () => {
    await s.tap(p.getByRole("button", { name: /Abrir caja/ }).first())
    await sleep(600)
    await s.focus(p.getByRole("dialog"), { ms: 2600 })
    await s.moveTo(p.locator("#openingCash"))
    await p.locator("#openingCash").click()
    await s.type("500", 170)
    await sleep(500)
    await s.tap(p.getByRole("dialog").getByRole("button", { name: /^Abrir caja$/ }))
  })
  await sleep(700)

  await track.say("tocar", async () => {
    await s.tap(p.getByRole("button", { name: "Agregar Refresco cola 2L" }))
    await s.tap(p.getByRole("button", { name: "Agregar Refresco cola 2L" }))
    await s.tap(p.getByRole("button", { name: "Agregar Bolillo" }))
    await s.focus(ticket, { ms: 3000 })
  })

  await track.say("buscar", async () => {
    const search = p.getByPlaceholder(/Buscar o escanear/)
    await s.tap(search)
    await s.type("arroz", 160)
    await sleep(700)
    await s.focus(search, { ms: 2500, z: 1.7 })
    await s.tap(p.getByRole("button", { name: "Agregar Arroz 1kg" }))
    await search.fill("")
  })

  await track.say("categorias", async () => {
    await s.focus({ x: 10, y: 128, width: 980, height: 56 }, { ms: 2800, z: 1.6 })
    await s.tap(p.getByRole("button", { name: /^Bebidas/ }))
    await sleep(900)
    await s.tap(p.getByRole("button", { name: /^Todos/ }))
  })

  await track.say("granel", async () => {
    await s.tap(p.getByRole("button", { name: "Agregar Pechuga de pollo" }))
    await sleep(700)
    await s.focus(p.getByRole("dialog"), { ms: 2800 })
    await s.tap(p.getByRole("dialog").getByRole("button", { name: "0.5 kg" }))
    await sleep(800)
    await s.tap(p.getByRole("dialog").getByRole("button", { name: /^Agregar/ }))
  })
  await sleep(500)

  await track.say("promos", () => s.focus({ x: 1008, y: 560, width: 520, height: 300 }, { ms: 5000 }))

  await track.say("cliente", async () => {
    await s.tap(p.locator("button", { hasText: /^Cliente$/ }).first())
    await sleep(900)
    await s.focus(p.getByRole("dialog"), { ms: 2200 })
    await s.tap(p.getByRole("dialog").getByText(/Mar.a Garc.a/))
    await sleep(600)
    await s.focus({ x: 1008, y: 625, width: 520, height: 235 }, { ms: 2400, z: 1.5 })
  })

  await track.say("cobro", async () => {
    await s.tap(p.locator("button", { hasText: /Cobrar/ }).last())
    await sleep(1200)
    await s.focus(p.getByRole("dialog"), { ms: 2400 })
    await s.tap(p.getByRole("dialog").getByRole("button", { name: "$200" }))
    await sleep(900)
    await s.tap(p.getByRole("dialog").getByRole("button", { name: /Completar venta/ }))
  })

  await track.say("listo", async () => {
    await sleep(1500)
    await s.focus(p.getByRole("dialog"), { ms: 2800 })
  })
  await p.keyboard.press("Escape").catch(() => {})
  await sleep(800)

  await track.say("inventario", async () => {
    await s.go("/admin/inventory")
    await p.mouse.move(s.W * 0.6, s.H * 0.55, { steps: 30 })
    await sleep(2500)
    await p.mouse.wheel(0, 420)
  })
  await track.say("panel", async () => {
    await s.go("/admin")
    await p.mouse.move(s.W * 0.5, s.H * 0.5, { steps: 30 })
    await sleep(1800)
    await p.mouse.wheel(0, 380)
  })

  await s.card("Multi-POS", "Y esto es solo el comienzo.", "Mira lo que sigue para restaurantes y cafeterías")
  await track.say("trans", null, { tail: 700 })
  const r = await s.finish()
  const out = render({ scenes: [r], track, out: path.join(outDir, "parte1-abarrotes.mp4") })
  files.push(out)
  track.audio.length = 0
}

// ═════════════ Parte 2 · Restaurante ═════════════
{
  const storageState = await login(browser, {
    url: "/auth/login",
    id: "gerente-rest@demo.multi-pos.com",
    after: async (lp) => {
      await lp.goto(base + "/pos", { waitUntil: "domcontentloaded" })
      await lp.waitForLoadState("networkidle").catch(() => {})
      await lp.waitForTimeout(1500)
      await lp.locator("button").filter({ has: lp.locator("svg.lucide-x") }).first().click({ timeout: 2000 }).catch(() => {})
      await lp.waitForTimeout(800)
    },
  })
  const s = await startScene(browser, { name: "restaurante", storageState, hideClosed: true, intro: { tag: "Multi-POS · Restaurantes y cafeterías", title: "A su gusto. Para todos.", sub: "Pedidos para varias personas y cobro como tú quieras." } })
  globalThis.__T0 = s.wall0
  const p = s.page
  const ticket = { x: 1000, y: 64, width: 536, height: 800 }
  const dlg = () => p.getByRole("dialog")

  await track.say("intro2", () => s.go("/pos", { settle: 1200 }))
  await s.card()
  await sleep(700)
  await p.getByRole("button", { name: /^Bebidas/ }).click().catch(() => {})

  const addName = async (name) => {
    const input = p.getByPlaceholder(/Nombre/)
    if (!(await input.isVisible().catch(() => false))) await s.tap(p.getByText("Persona nueva"))
    await s.tap(input)
    await s.type(name, 90)
    await sleep(250)
    await s.tap(p.getByRole("button", { name: "Agregar", exact: true }))
    await sleep(450)
  }
  await track.say("varios", async () => {
    await s.tap(p.getByText("Pedir para varias personas").first())
    await sleep(600)
    await addName("Ana")
    await addName("Luis")
    await addName("Marta")
    await s.tap(p.locator("button", { hasText: /^Ana$/ }).first())
    await s.focus({ x: 1000, y: 64, width: 536, height: 330 }, { ms: 2500 })
  })

  await track.say("personalizable", async () => {
    await s.tap(p.getByRole("button", { name: /Agregar Café de especialidad/ }))
    await sleep(900)
    await s.focus(dlg(), { ms: 3000, z: 1.4 })
  })
  await track.say("tamano", async () => {
    await s.tap(p.getByText(/^Grande/).first())
    await s.tap(p.getByText("Almendra", { exact: true }))
    await sleep(500)
  })
  await track.say("extras", async () => {
    await p.mouse.move(1260, 560, { steps: 12 })
    await p.mouse.wheel(0, 330)
    await sleep(700)
    await s.tap(p.getByText("Canela", { exact: true }))
    await s.tap(p.getByText("Crema batida"))
    await sleep(500)
    await s.focus(dlg(), { ms: 2400, z: 1.4 })
  })
  await track.say("notas", async () => {
    await p.mouse.move(1260, 560, { steps: 12 })
    await p.mouse.wheel(0, 300)
    await sleep(700)
    await s.tap(p.getByText("Sin azúcar", { exact: true }))
    await sleep(900)
    await s.tap(p.getByRole("button", { name: /Agregar · \$/ }))
  })
  await sleep(700)

  await track.say("grupos", async () => {
    await s.tap(p.locator("button", { hasText: /^Luis$/ }).first())
    await s.tap(p.getByRole("button", { name: /^Desayunos/ }))
    await s.tap(p.getByRole("button", { name: "Agregar Chilaquiles verdes" }))
    await s.tap(p.getByRole("button", { name: /^Bebidas/ }))
    await s.tap(p.getByRole("button", { name: "Agregar Limonada" }))
    await s.tap(p.locator("button", { hasText: /^Marta$/ }).first())
    await s.tap(p.getByRole("button", { name: /^Desayunos/ }))
    await s.tap(p.getByRole("button", { name: "Agregar Hot cakes con miel" }))
    await s.tap(p.getByRole("button", { name: /^Bebidas/ }))
    await s.tap(p.getByRole("button", { name: "Agregar Café americano" }))
  })
  await track.say("agrupado", async () => {
    await p.mouse.move(1260, 430, { steps: 14 })
    await p.mouse.wheel(0, -400)
    await sleep(500)
    await s.focus(ticket, { ms: 3200, z: 1.35 })
    await p.mouse.wheel(0, 260)
    await sleep(1400)
    await p.mouse.wheel(0, 260)
    await sleep(1200)
  })

  await track.say("cobrar", async () => {
    await s.tap(p.locator("button", { hasText: /Cobrar/ }).last())
    await sleep(1100)
    await s.tap(dlg().getByRole("button", { name: /Omitir y cobrar/ }))
    await sleep(1200)
    await s.tap(dlg().getByText("Pago personalizado"))
    await sleep(600)
    await s.focus(dlg(), { ms: 2600, z: 1.3 })
  })
  const key = (k) => s.tap(dlg().getByRole("button", { name: k, exact: true }), { steps: 14 })
  await track.say("pago1", async () => {
    await s.tap(dlg().getByRole("button", { name: "Efectivo", exact: true }), { steps: 14 })
    await key("5"); await key("0")
    await s.tap(dlg().getByRole("button", { name: /Agregar pago/ }))
  })
  await track.say("pago2", async () => {
    await s.tap(dlg().getByRole("button", { name: "Tarjeta", exact: true }), { steps: 14 })
    await key("8"); await key("0")
    await s.tap(dlg().getByRole("button", { name: /Agregar pago/ }))
  })
  await track.say("pago3", async () => {
    await s.tap(dlg().getByRole("button", { name: "Efectivo", exact: true }), { steps: 14 })
    await s.tap(dlg().getByRole("button", { name: /Exacto/ }), { steps: 14 })
    const addBtn = dlg().getByRole("button", { name: /Agregar pago/ })
    if (await addBtn.isEnabled().catch(() => false)) await s.tap(addBtn)
    await sleep(500)
    await s.focus(dlg(), { ms: 3800, z: 1.35 })
  })
  await s.tap(dlg().getByRole("button", { name: /Completar venta/ }))
  await track.say("fin", async () => {
    await sleep(1800)
    await s.focus(dlg(), { ms: 2500, z: 1.3 })
  })
  await p.keyboard.press("Escape").catch(() => {})
  await sleep(600)

  await s.card("Multi-POS", "Tu negocio, a tu manera.", "Pruébalo hoy · Sin tarjeta · Sin contratos")
  await track.say("outro", null, { tail: 1500 })
  const r = await s.finish()
  files.push(render({ scenes: [r], track, out: path.join(outDir, "parte2-restaurante.mp4") }))
  track.audio.length = 0
}

await browser.close()
concat(files, path.join(outDir, "multi-pos-demo-narrado.mp4"))
