// Utilidades de los videos promocionales con narración: voz (Windows), cursor y foco en pantalla, zooms y mezcla final.
// Requiere ffmpeg completo en la variable PROMO_FFMPEG (el de Playwright no codifica audio).
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"

export const base = process.env.PROMO_BASE ?? "http://127.0.0.1:3107"
export const outDir = path.resolve("scripts/promo/out")
const ttsDir = path.join(outDir, "tts")
const VOICE = process.env.PROMO_VOICE ?? "Microsoft Sabina Desktop"
const PITCH = process.env.PROMO_PITCH ?? "+6%"
const RATE = process.env.PROMO_RATE ?? "+2%"
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function ffmpeg(args, opts = {}) {
  const exe = process.env.PROMO_FFMPEG
  if (!exe) throw new Error("Define PROMO_FFMPEG con la ruta de un ffmpeg completo.")
  const r = spawnSync(exe, ["-hide_banner", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 28, ...opts })
  if (r.status !== 0 && !opts.allowFail) throw new Error("ffmpeg falló:\n" + (r.stderr ?? "").slice(-1800))
  return r
}

// ── Voz ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function wavDuration(file) {
  const b = fs.readFileSync(file)
  let p = 12
  let byteRate = 0
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4)
    const size = b.readUInt32LE(p + 4)
    if (id === "fmt ") byteRate = b.readUInt32LE(p + 16)
    if (id === "data") return (size > b.length ? b.length - p - 8 : size) / byteRate
    p += 8 + size + (size % 2)
  }
  throw new Error("WAV inválido: " + file)
}

/** Genera (o reutiliza) un WAV por línea. Devuelve { clave: { file, dur } }. */
export function synth(lines) {
  fs.mkdirSync(ttsDir, { recursive: true })
  const jobs = []
  const voice = {}
  for (const [key, text] of Object.entries(lines)) {
    const spoken = text.replace(/Multi-POS/g, "Multi Pos")
    const hash = crypto.createHash("sha1").update([VOICE, PITCH, RATE, spoken].join("|")).digest("hex").slice(0, 14)
    const file = path.join(ttsDir, hash + ".wav")
    voice[key] = { file }
    if (!fs.existsSync(file)) jobs.push({ file, text: spoken })
  }
  if (jobs.length) {
    const jobsFile = path.join(ttsDir, "jobs.json")
    fs.writeFileSync(jobsFile, JSON.stringify(jobs), "utf8")
    const ps1 = path.join(ttsDir, "speak.ps1")
    fs.writeFileSync(
      ps1,
      [
        "param([string]$jobs)",
        "Add-Type -AssemblyName System.Speech",
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
        `$s.SelectVoice('${VOICE}')`,
        "$list = Get-Content -Raw -Encoding UTF8 $jobs | ConvertFrom-Json",
        "foreach ($j in $list) {",
        "  $s.SetOutputToWaveFile($j.file)",
        "  $esc = [System.Security.SecurityElement]::Escape($j.text)",
        `  $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-MX"><prosody pitch="${PITCH}" rate="${RATE}">' + $esc + '</prosody></speak>'`,
        "  $s.SpeakSsml($ssml)",
        "}",
        "$s.SetOutputToNull(); $s.Dispose()",
      ].join("\r\n"),
      "utf8",
    )
    const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, jobsFile], { encoding: "utf8" })
    if (r.status !== 0) throw new Error("No se pudo generar la voz:\n" + (r.stderr ?? ""))
  }
  for (const v of Object.values(voice)) v.dur = wavDuration(v.file)
  return voice
}

/** Pista de narración compartida: `say` reproduce una línea mientras se ejecuta la acción de pantalla. */
export function createTrack(voice, { shiftMs = Number(process.env.PROMO_AUDIO_SHIFT ?? 0) } = {}) {
  const audio = []
  return {
    audio,
    async say(key, action, { tail = 350 } = {}) {
      const v = voice[key]
      if (!v) throw new Error("Falta la línea de voz: " + key)
      const start = Date.now()
      audio.push({ ms: start + shiftMs, file: v.file, key })
      console.log(((start - (globalThis.__T0 ?? start)) / 1000).toFixed(1) + "s", key)
      await Promise.all([action ? Promise.resolve().then(action) : null, sleep(v.dur * 1000)])
      await sleep(tail)
    },
  }
}

// ── Navegador y escena ──────────────────────────────────────────────────────────────────────────────────────────
export const launch = () => chromium.launch()

/** Fondo del montaje en pantalla dividida (marcos y rótulos de cada panel), dibujado con el navegador. */
export async function makeStage(file, left, right) {
  const b = await chromium.launch()
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } })
  await pg.setContent(`<body style="margin:0;width:1920px;height:1080px;background:linear-gradient(135deg,#041f12,#0b5a37 70%,#0f7a4a);font-family:Montserrat,system-ui,sans-serif;color:#fff;position:relative;overflow:hidden">
    <div style="position:absolute;left:52px;top:34px;font-size:26px;font-weight:800;letter-spacing:1px">${left[0]} <span style="font-weight:500;opacity:.8">· ${left[1]}</span></div>
    <div style="position:absolute;left:552px;top:34px;font-size:26px;font-weight:800;letter-spacing:1px">${right[0]} <span style="font-weight:500;opacity:.8">· ${right[1]}</span></div>
    <div style="position:absolute;right:40px;top:36px;font-size:22px;font-weight:700;opacity:.9">Multi-POS</div>
    <div style="position:absolute;left:52px;top:102px;width:465px;height:956px;border-radius:34px;background:#0b2a1b;box-shadow:0 0 0 2px rgba(255,255,255,.18),0 20px 50px rgba(0,0,0,.45)"></div>
    <div style="position:absolute;left:552px;top:102px;width:1336px;height:956px;border-radius:18px;background:#0b2a1b;box-shadow:0 0 0 2px rgba(255,255,255,.18),0 20px 50px rgba(0,0,0,.45)"></div></body>`)
  await pg.screenshot({ path: file })
  await b.close()
}

export async function login(browser, { url, id, pw = "demo1234", landing, viewport = { width: 1536, height: 864 }, after }) {
  const ctx = await browser.newContext({ viewport })
  const p = await ctx.newPage()
  await p.goto(base + url, { waitUntil: "domcontentloaded" })
  await p.waitForLoadState("networkidle")
  for (let i = 0; i < 6; i++) {
    await p.locator("#identifier").fill(id)
    await p.locator("#password").fill(pw)
    if ((await p.locator("#password").inputValue()) === pw) break
    await p.waitForTimeout(700)
  }
  await p.getByRole("button", { name: /^entrar/i }).click()
  await p.waitForURL((u) => (landing ? u.pathname === landing : u.pathname.startsWith("/admin")), { timeout: 120000 })
  if (after) await after(p)
  const state = await ctx.storageState()
  await ctx.close()
  return state
}

const OVERLAY = (cfg) => {
  const install = () => {
    if (document.getElementById("__promo")) return
    const root = document.createElement("div")
    root.id = "__promo"
    root.innerHTML = `
      <style>
        #__promo,#__promo *{box-sizing:border-box;pointer-events:none!important;font-family:Montserrat,system-ui,sans-serif}
        #__cur{position:fixed;z-index:2147483647;left:0;top:0;width:30px;height:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
        #__rip{position:fixed;z-index:2147483646;width:14px;height:14px;border-radius:50%;border:3px solid #16a34a;opacity:0;transform:translate(-50%,-50%) scale(.4)}
        #__rip.go{animation:__r .6s ease-out}
        @keyframes __r{0%{opacity:.95;transform:translate(-50%,-50%) scale(.4)}100%{opacity:0;transform:translate(-50%,-50%) scale(3.4)}}
        #__spot{position:fixed;z-index:2147483640;border-radius:18px;opacity:0;box-shadow:0 0 0 100vmax rgba(8,20,14,.55),0 0 0 4px #4ade80,0 0 34px 8px rgba(74,222,128,.55);transition:all .5s cubic-bezier(.4,0,.2,1)}
        #__spot.on{opacity:1}
        #__card{position:fixed;inset:0;z-index:2147483644;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:linear-gradient(135deg,#052e1a,#0f7a4a 60%,#16a34a);color:#fff;text-align:center;opacity:0;transition:opacity .6s;padding:0 8vw}
        #__card.on{opacity:1}
        #__card h1{margin:0;font-size:min(64px,9vw);line-height:1.1;font-weight:800;letter-spacing:-.5px}
        #__card p{margin:0;font-size:min(30px,5vw);font-weight:500;opacity:.92}
        #__card .tag{font-size:min(22px,4vw);font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.8}
        #__badge{position:fixed;z-index:2147483641;left:50%;top:10px;transform:translateX(-50%);padding:6px 16px;border-radius:999px;background:rgba(6,40,24,.92);color:#fff;font-weight:700;font-size:15px;letter-spacing:.5px}
      </style>
      <div id="__spot"></div>
      <div id="__card"><div class="tag"></div><h1></h1><p></p></div>
      <div id="__rip"></div>
      ${cfg.badge ? `<div id="__badge">${cfg.badge}</div>` : ""}
      <svg id="__cur" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`
    document.documentElement.appendChild(root)
    const cur = root.querySelector("#__cur")
    const rip = root.querySelector("#__rip")
    const put = (x, y) => { cur.style.transform = `translate(${x - 4}px,${y - 2}px)` }
    let sx = 0, sy = 0
    try { sx = Number(sessionStorage.getItem("__mx") ?? cfg.w / 2); sy = Number(sessionStorage.getItem("__my") ?? cfg.h / 2) } catch { sx = cfg.w / 2; sy = cfg.h / 2 }
    put(sx, sy)
    window.addEventListener("mousemove", (e) => { put(e.clientX, e.clientY); try { sessionStorage.setItem("__mx", e.clientX); sessionStorage.setItem("__my", e.clientY) } catch {} }, true)
    window.addEventListener("mousedown", (e) => { rip.style.left = e.clientX + "px"; rip.style.top = e.clientY + "px"; rip.classList.remove("go"); void rip.offsetWidth; rip.classList.add("go") }, true)
    if (cfg.intro) {
      let seen = false
      try { seen = !!sessionStorage.getItem("__intro") } catch {}
      if (!seen) {
        const d = root.querySelector("#__card")
        d.querySelector(".tag").textContent = cfg.intro.tag ?? ""
        d.querySelector("h1").textContent = cfg.intro.title
        d.querySelector("p").textContent = cfg.intro.sub ?? ""
        d.style.transition = "none"
        d.classList.add("on")
        setTimeout(() => { d.style.transition = "" }, 50)
      }
    }
    // Oculta la etiqueta «Cerrado» (el negocio demo está fuera de horario; solo afecta a la grabación).
    if (cfg.hideClosed) setInterval(() => { document.querySelectorAll("button, span").forEach((b) => { if ((b.textContent || "").trim() === "Cerrado") b.style.visibility = "hidden" }) }, 300)
  }
  document.addEventListener("DOMContentLoaded", install)
  if (document.readyState !== "loading") install()
}

const cardHtml = (i) => `<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:linear-gradient(135deg,#052e1a,#0f7a4a 60%,#16a34a);color:#fff;font-family:Montserrat,system-ui,sans-serif;text-align:center;padding:0 8vw;box-sizing:border-box">
  <div style="font-size:min(22px,4vw);font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.8">${i.tag ?? ""}</div>
  <h1 style="margin:0;font-size:min(64px,9vw);font-weight:800;letter-spacing:-.5px;line-height:1.1">${i.title}</h1>
  <p style="margin:0;font-size:min(30px,5vw);font-weight:500;opacity:.92">${i.sub ?? ""}</p></body>`

/**
 * Abre un contexto con video y capa de cursor/foco. `intro` muestra una tarjeta al arrancar (la voz puede hablar sobre ella).
 * Devuelve helpers: go, tap, moveTo, focus, card, finish…
 */
export async function startScene(browser, { name, storageState, viewport = { width: 1536, height: 864 }, recordSize, scale = 1, intro, badge, hideClosed }) {
  const W = viewport.width
  const H = viewport.height
  fs.mkdirSync(outDir, { recursive: true })
  const rawDir = path.join(outDir, "raw-" + name + "-" + Date.now())
  const context = await browser.newContext({
    viewport,
    storageState,
    deviceScaleFactor: scale,
    recordVideo: { dir: rawDir, size: recordSize ?? { width: W * scale, height: H * scale } },
  })
  await context.addInitScript(OVERLAY, { w: W, h: H, intro, badge, hideClosed })
  const page = await context.newPage()
  const zooms = []
  if (intro) {
    await page.setContent(cardHtml(intro))
    await sleep(150)
  }
  const wall0 = Date.now()
  const s = { name, page, context, W, H, wall0, zooms, intro }

  s.go = async (url, { settle = 900 } = {}) => {
    await page.goto(url.startsWith("http") ? url : base + url, { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})
    await sleep(settle)
    await page.evaluate(() => { try { sessionStorage.setItem("__intro", "1") } catch {} })
  }
  s.card = (tag, title, sub) =>
    page.evaluate(([a, b, c]) => {
      const d = document.getElementById("__card")
      if (!d) return
      if (!b) { d.classList.remove("on"); return }
      d.querySelector(".tag").textContent = a ?? ""
      d.querySelector("h1").textContent = b
      d.querySelector("p").textContent = c ?? ""
      d.classList.add("on")
    }, [tag, title, sub])
  s.pause = sleep
  s.moveTo = async (loc, { dx = 0, dy = 0, steps = 22 } = {}) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {})
    const box = await loc.boundingBox()
    if (!box) return
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps })
    await sleep(180)
  }
  s.tap = async (loc, opts) => {
    await s.moveTo(loc, opts)
    await loc.click({ delay: 80 })
    await sleep(350)
  }
  /** Navega con el menú lateral (sin recargar la página); si el enlace no está visible, carga la dirección. */
  s.nav = async (href) => {
    const a = page.locator(`aside a[href="${href}"]`).first()
    if (await a.isVisible().catch(() => false)) {
      await s.tap(a)
      await page.waitForURL((u) => u.pathname === href, { timeout: 15000 }).catch(() => {})
      await page.waitForLoadState("networkidle").catch(() => {})
      await sleep(900)
    } else await s.go(href)
  }
  s.type = async (text, delay = 110) => { await page.keyboard.type(text, { delay }) }
  /** Resalta una zona (locator o {x,y,width,height}) con foco y acercamiento durante `ms`. */
  s.focus = async (target, { ms = 3200, pad = 22, z } = {}) => {
    const box = typeof target.boundingBox === "function" ? await target.boundingBox() : target
    if (!box) return
    const x = Math.max(0, box.x - pad)
    const y = Math.max(0, box.y - pad)
    const w = Math.min(W - x, box.width + pad * 2)
    const h = Math.min(H - y, box.height + pad * 2)
    const zf = z ?? Math.min(2.1, Math.max(1.3, Math.min(W / (w + 140), H / (h + 120))))
    await page.evaluate(([a, b, c, d]) => { const e = document.getElementById("__spot"); if (!e) return; Object.assign(e.style, { left: a + "px", top: b + "px", width: c + "px", height: d + "px" }); e.classList.add("on") }, [x, y, w, h])
    const now = Date.now()
    zooms.push({ a: now, b: now + ms, cx: x + w / 2, cy: y + h / 2, z: zf })
    await sleep(ms)
    await page.evaluate(() => document.getElementById("__spot")?.classList.remove("on"))
    await sleep(500)
  }
  /** Zoom sin recuadro (para seguir una acción en una zona). */
  s.zoomTo = (rect, ms, z = 1.6) => zooms.push({ a: Date.now(), b: Date.now() + ms, cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2, z })
  s.finish = async () => {
    const endMs = Date.now()
    await context.close()
    const raw = await page.video().path()
    return { name, raw, wall0, endMs, zooms, W, H, scale }
  }
  return s
}

// ── Montaje final ───────────────────────────────────────────────────────────────────────────────────────────────
/** Segundos de video en que aparece la primera tarjeta (se descarta el blanco inicial de la grabación). */
function firstCardTime(raw) {
  const r = ffmpeg(["-t", "8", "-i", raw, "-vf", "signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"], { allowFail: true })
  const lines = (r.stdout ?? "").split(/\r?\n/)
  let t = 0
  for (const line of lines) {
    const m = line.match(/pts_time:([\d.]+)/)
    if (m) t = Number(m[1])
    const y = line.match(/YAVG=([\d.]+)/)
    if (y && Number(y[1]) < 150) return t
  }
  return 0
}

function zoomChain(zooms, W, H, g0) {
  if (!zooms.length) return null
  const r = 0.55
  const ev = zooms.map((e) => ({ a: ((e.a - g0) / 1000).toFixed(3), b: ((e.b - g0) / 1000).toFixed(3), cx: e.cx, cy: e.cy, z: e.z }))
  const env = ev.map((e) => {
    const p = `clip(min((t-${e.a})/${r},(${e.b}-t)/${r}),0,1)`
    return `(${p}*${p}*(3-2*${p}))`
  })
  const Z = `(1${ev.map((e, i) => `+(${(e.z - 1).toFixed(3)})*${env[i]}`).join("")})`
  const CX = `(${W / 2}${ev.map((e, i) => `+(${(e.cx - W / 2).toFixed(1)})*${env[i]}`).join("")})`
  const CY = `(${H / 2}${ev.map((e, i) => `+(${(e.cy - H / 2).toFixed(1)})*${env[i]}`).join("")})`
  return `scale=w='trunc(${W}*${Z}/2)*2':h='trunc(${H}*${Z}/2)*2':eval=frame:flags=bicubic,crop=w=${W}:h=${H}:x='clip(${CX}*${Z}-${W / 2},0,${W}*${Z}-${W}-2)':y='clip(${CY}*${Z}-${H / 2},0,${H}*${Z}-${H}-2)'`
}

/**
 * Une una o varias escenas grabadas con la pista de voz.
 * `layout(inputs)` devuelve el filtro de composición cuando hay más de una escena (por defecto, una sola).
 */
export function render({ scenes, track, out, layout, extra = [], fadeOut = 0.6 }) {
  fs.writeFileSync(out + ".state.json", JSON.stringify({ scenes, audio: track.audio }), "utf8")
  const probe = scenes.map((s) => ({ ...s, tc: firstCardTime(s.raw) }))
  const g0 = Math.max(...probe.map((s) => s.wall0))
  const endMs = Math.max(...probe.map((s) => s.endMs))
  const total = (endMs - g0) / 1000
  const args = []
  const filters = []
  probe.forEach((s, i) => {
    const ss = s.tc + (g0 - s.wall0) / 1000
    args.push("-ss", ss.toFixed(3), "-i", s.raw)
    const q = s.scale ?? 1
    const z = zoomChain(s.zooms.map((e) => ({ ...e, cx: e.cx * q, cy: e.cy * q })), s.W * q, s.H * q, g0)
    // El video grabado puede venir a otra resolución (pantalla de alta densidad): se normaliza al tamaño lógico.
    filters.push(`[${i}:v]fps=25,scale=${s.W * (s.scale ?? 1)}:${s.H * (s.scale ?? 1)}${z ? "," + z : ""},setsar=1[v${i}]`)
  })
  extra.forEach((f) => args.push("-loop", "1", "-framerate", "25", "-i", f))
  const n0 = probe.length + extra.length
  track.audio.forEach((a, k) => args.push("-i", a.file))
  const aLabels = track.audio.map((a, k) => {
    const d = Math.max(0, Math.round(a.ms - g0))
    filters.push(`[${n0 + k}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${d}:all=1[a${k}]`)
    return `[a${k}]`
  })
  filters.push(`${aLabels.join("")}amix=inputs=${aLabels.length}:normalize=0:duration=longest,volume=1.4,apad[aout]`)
  if (layout) filters.push(layout(probe, total))
  else filters.push(`[v0]null[vout]`)
  filters.push(`[vout]fade=t=out:st=${(total - fadeOut).toFixed(2)}:d=${fadeOut}[vf]`)
  const script = path.join(outDir, "filters-" + path.basename(out) + ".txt")
  fs.writeFileSync(script, filters.join(";\n"), "utf8")
  ffmpeg([...args, "-/filter_complex", script, "-map", "[vf]", "-map", "[aout]", "-t", total.toFixed(2), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "25", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out])
  const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1)
  console.log("VIDEO", out, mb + " MB", total.toFixed(1) + " s")
  return out
}

export function concat(files, out) {
  const args = []
  files.forEach((f) => args.push("-i", f))
  const norm = files.map((_, i) => `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25[n${i}]`).join(";")
  const chain = files.map((_, i) => `[n${i}][${i}:a]`).join("")
  ffmpeg([...args, "-filter_complex", `${norm};${chain}concat=n=${files.length}:v=1:a=1[v][a]`, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out])
  console.log("VIDEO", out, (fs.statSync(out).size / 1024 / 1024).toFixed(1) + " MB")
}
