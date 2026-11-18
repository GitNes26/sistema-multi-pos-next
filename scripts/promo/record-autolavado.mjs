// Video promocional narrado: autolavado (operación del día: bahías, recepción, tablero, turnos, cobro, membresías) y, en otra parte, citas desde el portal.
//   $env:PROMO_FFMPEG="<ruta a ffmpeg completo>"; node scripts/promo/prep.mjs demo@multi-pos.com Híbrido; node scripts/promo/prep-lavado.mjs --limpiar
//   node scripts/promo/record-autolavado.mjs ops     →   scripts/promo/out/parte-autolavado-ops.mp4
import path from "node:path"
import { outDir, sleep, synth, createTrack, launch, login, startScene, render, makeStage, concat } from "./lib.mjs"

const part = process.argv[2] ?? "ops"

const T = {
  intro: "¿Tienes un autolavado? Mira cómo se ve tu día con Multi-POS: ordenado, rápido, y todo en tiempo real.",
  bahias: "Primero, organiza tu espacio. Aquí están tus bahías y tus sillas, cada lugar con su nombre, para que nadie se pise.",
  recibir: "Llega un cliente, y lo recibes en segundos. Lo buscas por nombre, y hasta aparece su vehículo. Eliges el servicio, con su precio ya puesto.",
  lugar: "Le asignas una bahía, anotas dónde quedó el llavero, y dejas indicaciones: un rayón, un cuidado especial. Y listo, creas la orden.",
  otros: "Y así, uno tras otro. Con cliente de mostrador, sin datos, en cinco segundos.",
  tablero: "Mira qué orden. Cada vehículo está en su etapa: recibido, lavando, secado y detalle, y listo para entregar. Y arriba, tus bahías te dicen cuál está ocupada.",
  avanza: "Avanzar es un toque. Y tu cliente, desde su celular, ve en qué etapa va su coche. Sin llamadas, sin preguntas.",
  turnos: "Y para tu sala de espera, una pantalla de turnos. Con los vehículos en proceso, los que ya están listos, y la cola que sigue. Hasta con aviso de voz.",
  cobrar: "Cuando el cliente regresa, cobras y entregas en un solo paso. Efectivo o tarjeta, y se registra la venta, la caja, todo.",
  membresia: "¿Quieres que vuelvan? Crea membresías: por ejemplo, cuatro lavados al mes por una cuota fija. El sistema lleva la cuenta solo.",
  garantia: "Y hasta garantías: si llueve el mismo día, el lavado se repite sin costo. Todo, con reglas que tú defines.",
  panel: "Y tu panel, siempre al día: ventas, ganancias y alertas, en un solo lugar.",
  introCitas: "Ahora, las citas. ¿Reservan por internet, o llaman por teléfono? Las dos llegan al mismo lugar, y en tiempo real.",
  portal: "El cliente abre su celular, elige el servicio que quiere, el día… y el horario que más le acomoda.",
  agenda: "Y en tu negocio, sin que hagas nada, la cita aparece en la agenda, con su aviso, lista para que la confirmes.",
  telefono: "¿Y si llaman por teléfono? Tú la agendas en segundos: buscas al cliente, eliges el servicio, y listo.",
  lugares: "La agenda se puede ver por personal, o por lugar, bahía por bahía. Así sabes quién está libre y nunca se encima un servicio.",
  cliente: "Y el cliente ve su cita en su celular, siempre a la mano. Tú defines las políticas: cuánto antes puede cancelar, o cuántas veces puede reagendar.",
  outroCitas: "Reservas en línea o por teléfono, todo en un solo lugar. Así se ve un negocio ordenado. Pruébalo con Multi-POS.",
  cierre: "Y como Multi-POS es multiservicio, el mismo sistema te sirve para barbería, estética, taller… lo que tú ofrezcas.",
}

const voice = synth(T)
const track = createTrack(voice)
const browser = await launch()

if (part === "ops") {
  const storageState = await login(browser, { url: "/auth/login", id: "demo@multi-pos.com" })
  const s = await startScene(browser, { name: "lavado-ops", storageState, intro: { tag: "Multi-POS · Autolavado", title: "Tu autolavado, en orden.", sub: "Cada vehículo, cada bahía, en tiempo real." } })
  globalThis.__T0 = s.wall0
  const p = s.page
  const dlg = () => p.getByRole("dialog").last()
  const pick = async (text) => s.tap(p.locator('[role="option"]', { hasText: text }).first())

  await track.say("intro", () => s.go("/admin/stations", { settle: 1200 }))
  await s.card()
  await sleep(700)

  await track.say("bahias", async () => {
    await s.focus({ x: 304, y: 228, width: 1192, height: 410 }, { ms: 3600, z: 1.35 })
    await p.mouse.move(700, 450, { steps: 20 })
  })

  await s.nav("/admin/service-orders")
  await track.say("recibir", async () => {
    await s.tap(p.getByRole("button", { name: "Recibir vehículo" }).first())
    await sleep(700)
    await s.tap(dlg().getByText("Buscar por nombre o teléfono"))
    await s.type("Regina", 130)
    await sleep(900)
    await pick("Regina")
    await sleep(700)
    await s.focus(dlg().getByText("Vehículo").first(), { ms: 2200, pad: 40, z: 1.6 })
    await s.focus({ x: 456, y: 240, width: 630, height: 240 }, { ms: 2800, z: 1.45 })
    await s.tap(dlg().getByText("Lavado completo"))
  })
  await track.say("lugar", async () => {
    await s.tap(dlg().getByText("Bahía, silla"))
    await pick(/^Bahía 1/)
    await s.tap(dlg().getByPlaceholder(/A-12/))
    await s.type("A-12", 160)
    await s.tap(dlg().getByPlaceholder(/rayón/i))
    await s.type("Rayón en la puerta derecha. No usar cera en el tablero.", 40)
    await sleep(500)
    await s.focus(dlg(), { ms: 2400, z: 1.25 })
    await s.tap(dlg().getByRole("button", { name: /Crear orden/ }))
    await sleep(1200)
  })
  const quick = async (service, bay) => {
    await s.tap(p.getByRole("button", { name: "Recibir vehículo" }).first())
    await sleep(600)
    await s.tap(dlg().getByText(service, { exact: true }).first())
    await s.tap(dlg().getByText("Bahía, silla"))
    await pick(bay)
    await s.tap(dlg().getByRole("button", { name: /Crear orden/ }))
    await sleep(1200)
  }
  await track.say("otros", async () => {
    await quick("Lavado básico", /^Bahía 2/)
    await quick("Encerado", /^Bahía 3/)
  })

  await track.say("tablero", async () => {
    await s.focus({ x: 288, y: 244, width: 1190, height: 230 }, { ms: 3600, z: 1.3 })
    await s.focus({ x: 288, y: 190, width: 880, height: 42 }, { ms: 3000, z: 1.7 })
  })
  await track.say("avanza", async () => {
    await s.tap(p.getByRole("button", { name: "Pasar a Lavando" }).first())
    await sleep(900)
    await s.tap(p.getByRole("button", { name: "Pasar a Secado y detalle" }).first())
    await sleep(900)
    await s.tap(p.getByRole("button", { name: /Marcar «Listo/ }).first())
    await sleep(900)
    await s.tap(p.getByRole("button", { name: "Pasar a Lavando" }).first())
    await sleep(900)
    await s.focus({ x: 288, y: 244, width: 1190, height: 230 }, { ms: 2600, z: 1.3 })
  })

  await track.say("turnos", async () => {
    await s.tap(p.getByRole("button", { name: /Pantalla de turnos/ }).or(p.getByRole("link", { name: /Pantalla de turnos/ })).first())
    await p.waitForURL(/turnos/, { timeout: 20000 }).catch(() => {})
    await sleep(2200)
    await p.mouse.move(768, 300, { steps: 20 })
    await s.focus({ x: 20, y: 100, width: 520, height: 260 }, { ms: 3000, z: 1.6 })
    await s.focus({ x: 1000, y: 100, width: 520, height: 330 }, { ms: 3200, z: 1.5 })
  })

  await p.goBack({ waitUntil: "domcontentloaded" }).catch(() => {})
  await p.waitForLoadState("networkidle").catch(() => {})
  await sleep(900)
  await track.say("cobrar", async () => {
    await s.tap(p.getByRole("button", { name: /Cobrar y entregar/ }).first())
    await sleep(1200)
    await s.focus(dlg(), { ms: 2600, z: 1.25 })
    await s.tap(dlg().getByRole("button", { name: "Efectivo" }).first()).catch(() => {})
    await s.tap(dlg().getByRole("button", { name: /Cobrar y entregar/ }).last())
    await sleep(2500)
    await s.focus({ x: 288, y: 244, width: 1190, height: 230 }, { ms: 2600, z: 1.3 })
  })
  await p.keyboard.press("Escape").catch(() => {})

  await track.say("membresia", async () => {
    await s.nav("/admin/loyalty-programs")
    await p.mouse.move(800, 400, { steps: 20 })
    await s.focus({ x: 288, y: 150, width: 1220, height: 330 }, { ms: 4200, z: 1.3 })
  })
  await track.say("garantia", async () => {
    await s.nav("/admin/warranties")
    await p.mouse.move(800, 400, { steps: 20 })
    await s.focus({ x: 288, y: 150, width: 1220, height: 330 }, { ms: 3600, z: 1.3 })
  })
  await track.say("panel", async () => {
    await s.nav("/admin")
    await p.mouse.move(800, 400, { steps: 25 })
    await sleep(2500)
    await p.mouse.wheel(0, 380)
  })
  await s.card("Multi-POS", "Multiservicio de verdad.", "Autolavado · Barbería · Estética · Taller")
  await track.say("cierre", null, { tail: 1200 })
  const r = await s.finish()
  await browser.close()
  render({ scenes: [r], track, out: path.join(outDir, "parte-autolavado-ops.mp4") })
}

if (part === "citas") {
  const stage = path.join(outDir, "stage-citas.png")
  await makeStage(stage, ["EL CLIENTE", "su celular"], ["EL NEGOCIO", "su agenda, en vivo"])
  const phoneState = await login(browser, { url: "/portal/auth/login", id: "hcli-001@hibrido.local", landing: "/portal", viewport: { width: 430, height: 900 } })
  const bizState = await login(browser, { url: "/auth/login", id: "demo@multi-pos.com" })
  const ph = await startScene(browser, { name: "citas-cliente", storageState: phoneState, viewport: { width: 430, height: 900 }, intro: { tag: "El cliente", title: "Reserva en segundos", sub: "Desde su celular" } })
  const bz = await startScene(browser, { name: "citas-negocio", storageState: bizState, viewport: { width: 1320, height: 940 }, intro: { tag: "El negocio", title: "Su agenda, en vivo", sub: "Citas, personal y lugares" } })
  globalThis.__T0 = Math.max(ph.wall0, bz.wall0)
  const P = ph.page
  const B = bz.page
  const dlg = () => B.getByRole("dialog").last()
  const pickB = async (text) => bz.tap(B.locator('[role="option"]', { hasText: text }).first())

  await track.say("introCitas", async () => {
    await Promise.all([ph.go("/portal/citas", { settle: 1200 }), bz.go("/agenda", { settle: 1200 })])
    await P.getByRole("button", { name: "Saltar" }).click({ timeout: 3000 }).catch(() => {})
  })
  await Promise.all([ph.card(), bz.card()])
  await sleep(700)

  await track.say("portal", async () => {
    await ph.tap(P.getByRole("button", { name: /Nueva cita/ }))
    await sleep(600)
    await ph.tap(P.getByText("¿Qué te hacemos?"))
    await sleep(500)
    await ph.focus({ x: 10, y: 120, width: 410, height: 250 }, { ms: 2600, z: 1.4 })
    await ph.tap(P.locator('[role="option"]', { hasText: "Lavado completo" }).first())
    await sleep(900)
    await ph.tap(P.getByText("dd/mm/aaaa"))
    await sleep(700)
    await ph.tap(P.locator("button").filter({ hasText: /^18$/ }).first())
    await sleep(1500)
    await ph.focus({ x: 10, y: 380, width: 410, height: 330 }, { ms: 3000, z: 1.3 })
    const slot = P.getByText("11:00", { exact: true }).first()
    if (await slot.count()) await ph.tap(slot)
    await sleep(600)
    await ph.tap(P.getByRole("button", { name: /^Agendar$/ }))
    await sleep(1500)
  })

  await track.say("agenda", async () => {
    const d = B.getByText(/de noviembre de 2026/).first()
    const box = await d.boundingBox()
    if (box) await bz.tap(B.locator("button").filter({ has: B.locator("svg") }).and(B.locator("button:right-of(:text('de noviembre'))")).first()).catch(async () => { await B.mouse.click(box.x + box.width + 30, box.y + box.height / 2) })
    await sleep(1500)
    await bz.focus({ x: 300, y: 230, width: 1000, height: 520 }, { ms: 3600, z: 1.3 })
    await bz.focus({ x: 1050, y: 8, width: 230, height: 50 }, { ms: 2400, z: 1.8 })
  })
  await track.say("telefono", async () => {
    await bz.tap(B.getByRole("button", { name: /Nueva cita/ }))
    await sleep(800)
    await bz.tap(dlg().getByText("Buscar o crear cliente"))
    await bz.type("Mónica", 120)
    await sleep(1000)
    await pickB("Mónica")
    await bz.tap(dlg().getByText("Seleccionar servicio"))
    await pickB("Lavado básico")
    await sleep(500)
    await bz.focus(dlg(), { ms: 2400, z: 1.25 })
    await bz.tap(dlg().getByRole("button", { name: /^Agendar$/ }))
    await sleep(1800)
  })
  await track.say("lugares", async () => {
    await bz.tap(B.getByText("Por lugar", { exact: true }))
    await sleep(1200)
    await bz.focus({ x: 300, y: 130, width: 1000, height: 620 }, { ms: 4200, z: 1.25 })
    await bz.tap(B.getByText("Por personal", { exact: true }))
  })
  await track.say("cliente", async () => {
    await ph.focus({ x: 10, y: 300, width: 410, height: 330 }, { ms: 3600, z: 1.35 })
    await bz.tap(B.getByRole("button", { name: /Políticas/ }))
    await sleep(900)
    await bz.focus(dlg(), { ms: 3400, z: 1.25 })
    await B.keyboard.press("Escape").catch(() => {})
  })
  await Promise.all([ph.card("Multi-POS", "Reservas sin llamadas.", "Y con llamadas también"), bz.card("Multi-POS", "Todo en un solo lugar.", "Pruébalo hoy · Sin tarjeta · Sin contratos")])
  await track.say("outroCitas", null, { tail: 1500 })
  const rp = await ph.finish()
  const rb = await bz.finish()
  await browser.close()
  render({
    scenes: [rp, rb], track, out: path.join(outDir, "parte-autolavado-citas.mp4"), extra: [stage],
    layout: () => "[2:v]scale=1920:1080,format=yuv420p[bgi];[v0]scale=449:940[ph];[v1]scale=1320:940[bz];[bgi][ph]overlay=60:110[t1];[t1][bz]overlay=560:110[vout]",
  })
}

if (part === "final") {
  await browser.close()
  concat([path.join(outDir, "parte-autolavado-ops.mp4"), path.join(outDir, "parte-autolavado-citas.mp4")], path.join(outDir, "multi-pos-autolavado-narrado.mp4"))
}
