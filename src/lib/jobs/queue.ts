import type { BackgroundJob, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

// Cola de trabajos en segundo plano respaldada por MySQL (tabla `background_jobs`).
//
// Para qué: tareas que tardan segundos o minutos (importar 5 000 productos, recalcular, enviar)
// no deben dejar al usuario esperando con la pantalla trabada. La petición solo registra el trabajo
// y responde; un ejecutor lo toma, avisa su avance y guarda el resultado.
//
// Garantías:
//  - Varias instancias a la vez: cada trabajo se "reclama" con un UPDATE condicionado
//    (status = queued), así solo una lo ejecuta.
//  - Reintentos con espera creciente y límite (`maxAttempts`).
//  - Si una instancia se cae a media tarea, el trabajo vencido (running > 15 min) se reencola.
//  - Los errores se guardan (texto corto) para mostrarlos; nunca tumban el servidor.

export type JobStatus = "queued" | "running" | "done" | "failed"

export interface JobContext {
  job: BackgroundJob
  /** Avance 0–100; se guarda como máximo cada 750 ms para no saturar la base de datos. */
  progress: (pct: number) => Promise<void>
}

export type JobHandler = (payload: Record<string, unknown>, ctx: JobContext) => Promise<Prisma.InputJsonValue | void>

const handlers = new Map<string, JobHandler>()

export function registerJobHandler(type: string, handler: JobHandler) {
  handlers.set(type, handler)
}

export const JOB_STALE_MS = 15 * 60_000
const CONCURRENCY = Math.max(1, Number(process.env.JOBS_CONCURRENCY) || 2)

// Singleton: en desarrollo cada ruta evalúa sus módulos por separado.
const g = globalThis as unknown as { __mpJobs?: { running: number; kicked: boolean } }
const state = (g.__mpJobs ??= { running: 0, kicked: false })

export interface EnqueueInput {
  type: string
  organizationId?: string | null
  userId?: string | null
  payload: Record<string, unknown>
  maxAttempts?: number
  runAt?: Date
}

/** Registra un trabajo y despierta al ejecutor. Responde de inmediato. */
export async function enqueueJob(input: EnqueueInput): Promise<BackgroundJob> {
  const job = await prisma.backgroundJob.create({
    data: {
      type: input.type,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      payload: input.payload as Prisma.InputJsonValue,
      maxAttempts: input.maxAttempts ?? 3,
      ...(input.runAt ? { runAt: input.runAt } : {}),
    },
  })
  kickJobs()
  return job
}

/** Despierta al ejecutor sin bloquear a quien llama. */
export function kickJobs() {
  if (state.kicked) return
  state.kicked = true
  setImmediate(() => {
    state.kicked = false
    void runDueJobs().catch((err) => console.error("[jobs] ejecutor:", err))
  })
}

/** Reencola los trabajos que quedaron "running" por una caída del proceso. */
export async function recoverStaleJobs(now = new Date()) {
  const cutoff = new Date(now.getTime() - JOB_STALE_MS)
  const stale = await prisma.backgroundJob.findMany({ where: { status: "running", lockedAt: { lt: cutoff } }, select: { id: true, attempts: true, maxAttempts: true } })
  for (const job of stale) {
    const exhausted = job.attempts >= job.maxAttempts
    await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: "running", lockedAt: { lt: cutoff } },
      data: exhausted
        ? { status: "failed", error: "El proceso se interrumpió y se agotaron los intentos", finishedAt: now }
        : { status: "queued", lockedAt: null, runAt: now },
    })
  }
  return stale.length
}

/** Toma y ejecuta trabajos vencidos hasta llenar la concurrencia. Devuelve cuántos terminó. */
export async function runDueJobs(): Promise<number> {
  let finished = 0
  while (state.running < CONCURRENCY) {
    const next = await prisma.backgroundJob.findFirst({
      where: { status: "queued", runAt: { lte: new Date() } },
      orderBy: { runAt: "asc" },
      select: { id: true },
    })
    if (!next) break
    // Reclamo atómico: si otra instancia lo tomó primero, count = 0 y se busca el siguiente.
    const claimed = await prisma.backgroundJob.updateMany({
      where: { id: next.id, status: "queued" },
      data: { status: "running", lockedAt: new Date(), startedAt: new Date(), attempts: { increment: 1 } },
    })
    if (claimed.count !== 1) continue
    state.running += 1
    // Se ejecuta en paralelo hasta la concurrencia; el bucle sigue reclamando.
    void execute(next.id).finally(() => {
      state.running -= 1
      finished += 1
    })
  }
  return finished
}

async function execute(id: string) {
  const job = await prisma.backgroundJob.findUnique({ where: { id } })
  if (!job) return
  const handler = handlers.get(job.type)
  if (!handler) {
    await prisma.backgroundJob.update({ where: { id }, data: { status: "failed", error: `Tipo de trabajo desconocido: ${job.type}`, finishedAt: new Date() } })
    return
  }
  let lastSaved = 0
  const progress = async (pct: number) => {
    const now = Date.now()
    if (now - lastSaved < 750 && pct < 100) return
    lastSaved = now
    await prisma.backgroundJob.update({ where: { id }, data: { progress: Math.max(0, Math.min(100, Math.round(pct))), lockedAt: new Date() } }).catch(() => undefined)
  }
  try {
    const result = await handler((job.payload ?? {}) as Record<string, unknown>, { job, progress })
    await prisma.backgroundJob.update({
      where: { id },
      data: { status: "done", progress: 100, result: (result ?? {}) as Prisma.InputJsonValue, error: null, finishedAt: new Date(), lockedAt: null },
    })
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 480)
    const exhausted = job.attempts >= job.maxAttempts
    console.error(`[jobs] ${job.type} ${id} falló (intento ${job.attempts}/${job.maxAttempts}):`, err)
    await prisma.backgroundJob.update({
      where: { id },
      data: exhausted
        ? { status: "failed", error: message, finishedAt: new Date(), lockedAt: null }
        : // Espera creciente: 30 s, 2 min, 8 min…
          { status: "queued", error: message, lockedAt: null, runAt: new Date(Date.now() + 30_000 * 4 ** (job.attempts - 1)) },
    })
  }
}

/** Estado de la cola para monitoreo (`/api/health`). */
export async function jobStats() {
  const rows = await prisma.backgroundJob.groupBy({ by: ["status"], _count: { _all: true } })
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.status] = row._count._all
  return { ...counts, runningHere: state.running }
}

/** Tareas de mantenimiento que se registran una vez al día (la purga es idempotente). */
const DAILY_JOBS = ["maintenance.notifications"]

export async function ensureDailyJobs(now = new Date()) {
  const since = new Date(now.getTime() - 20 * 3_600_000)
  for (const type of DAILY_JOBS) {
    const recent = await prisma.backgroundJob.findFirst({ where: { type, createdAt: { gte: since } }, select: { id: true } })
    if (!recent) await enqueueJob({ type, payload: {}, maxAttempts: 2 })
  }
}

/** Arranca el sondeo periódico (reintentos y recuperación) una sola vez por proceso. */
export function startJobRunner(intervalMs = 5_000) {
  const gg = globalThis as unknown as { __mpJobTimer?: ReturnType<typeof setInterval> }
  if (gg.__mpJobTimer || process.env.JOBS_DISABLED === "1") return
  let tick = 0
  gg.__mpJobTimer = setInterval(() => {
    tick += 1
    void (async () => {
      if (tick % 12 === 0) await recoverStaleJobs()
      // Al arrancar (con un minuto de margen) y luego cada hora se revisa si toca el mantenimiento diario.
      if (tick === 12 || tick % 720 === 0) await ensureDailyJobs()
      await runDueJobs()
    })().catch((err) => console.error("[jobs] sondeo:", err))
  }, intervalMs)
  gg.__mpJobTimer.unref?.()
}
