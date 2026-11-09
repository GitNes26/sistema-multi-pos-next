// Pantalla de turnos para la clientela (autolavado, barbería, taller…). Parte PURA: arma el tablero a partir de las
// órdenes abiertas y listas; no toca la base de datos (así se prueba sin servidor).
//
//  · En espera  = orden abierta en la PRIMERA etapa de su flujo (todavía no empieza).
//  · En proceso = orden abierta en cualquier otra etapa (con su avance por etapas).
//  · Listos     = orden lista para entregar (el cliente debe pasar por su vehículo).
// El tiempo estimado sale de la hora prometida de la orden o, si no hay, del tiempo típico que ese flujo tarda en
// quedar listo (mediana de las últimas órdenes). Solo se muestra el folio y la descripción del vehículo (placa
// enmascarada): nunca el nombre ni el teléfono del cliente.

export interface TurnOrderRow {
  id: string
  number: number
  status: "open" | "ready" | string
  createdAt: Date
  promisedAt: Date | null
  readyAt: Date | null
  flowId: string
  stageId: string
  stageLabel: string
  stages: { id: string; label: string; isReady: boolean }[]
  assetLabel: string | null
  assetReference: string | null
  stationName: string | null
  services: string[]
}

export type TurnStepState = "done" | "current" | "todo"

export interface TurnCard {
  id: string
  number: number
  vehicle: string
  services: string[]
  stageLabel: string
  steps: { label: string; state: TurnStepState }[]
  /** Minutos desde que se recibió. */
  elapsedMin: number
  /** Hora estimada de término (null si no hay forma de estimarla). */
  estimatedReadyAt: string | null
  /** Minutos que faltan (0 = ya debería estar); null si no hay estimado. */
  remainingMin: number | null
  /** El estimado ya pasó. */
  overdue: boolean
  stationName: string | null
  /** Solo en la cola: lugar que lleva (1 = sigue). */
  position?: number
  /** Solo en listos: minutos que lleva listo. */
  readyForMin?: number
  readyAt?: string | null
}

export interface TurnsBoard {
  generatedAt: string
  waiting: TurnCard[]
  inProgress: TurnCard[]
  ready: TurnCard[]
  /** Tiempo típico (min) por flujo, para mostrar «tarda unos X min». */
  typicalMinByFlow: Record<string, number | null>
}

/** Mediana de una lista de minutos (null si hay pocas muestras para confiar). */
export function typicalMinutes(samples: number[], minSamples = 3): number | null {
  const clean = samples.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (clean.length < minSamples) return null
  const mid = Math.floor(clean.length / 2)
  return Math.round(clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2)
}

/** «Tsuru gris · •••123»: descripción del vehículo con la placa enmascarada (solo los últimos 3 caracteres). */
export function maskedVehicle(label: string | null, reference: string | null): string {
  const base = (label ?? "").trim()
  const ref = (reference ?? "").replace(/\s+/g, "")
  const tail = ref.length > 3 ? `•••${ref.slice(-3)}` : ref ? "•••" : ""
  return [base || "Vehículo", tail].filter(Boolean).join(" · ")
}

const minutesBetween = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000))

function steps(row: TurnOrderRow): TurnCard["steps"] {
  const at = row.stages.findIndex((s) => s.id === row.stageId)
  return row.stages.map((s, i) => ({ label: s.label, state: row.status === "ready" || i < at ? "done" : i === at ? "current" : "todo" }))
}

export function buildTurnsBoard(rows: TurnOrderRow[], now: Date, typicalByFlow: Record<string, number | null> = {}): TurnsBoard {
  const card = (row: TurnOrderRow): TurnCard => {
    const typical = typicalByFlow[row.flowId] ?? null
    const estimate = row.promisedAt ?? (typical ? new Date(row.createdAt.getTime() + typical * 60_000) : null)
    return {
      id: row.id,
      number: row.number,
      vehicle: maskedVehicle(row.assetLabel, row.assetReference),
      services: row.services,
      stageLabel: row.stageLabel,
      steps: steps(row),
      elapsedMin: minutesBetween(row.createdAt, now),
      estimatedReadyAt: estimate ? estimate.toISOString() : null,
      remainingMin: estimate ? Math.max(0, Math.ceil((estimate.getTime() - now.getTime()) / 60_000)) : null,
      overdue: estimate ? estimate.getTime() < now.getTime() : false,
      stationName: row.stationName,
    }
  }

  const open = rows.filter((r) => r.status === "open").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const isFirstStage = (r: TurnOrderRow) => r.stages.length > 0 && r.stages[0].id === r.stageId
  const waiting = open.filter(isFirstStage).map((r, i) => ({ ...card(r), position: i + 1 }))
  const inProgress = open.filter((r) => !isFirstStage(r)).map(card)
  const ready = rows
    .filter((r) => r.status === "ready")
    .sort((a, b) => (b.readyAt ?? b.createdAt).getTime() - (a.readyAt ?? a.createdAt).getTime())
    .map((r) => ({ ...card(r), readyForMin: r.readyAt ? minutesBetween(r.readyAt, now) : 0, readyAt: r.readyAt ? r.readyAt.toISOString() : null }))

  return { generatedAt: now.toISOString(), waiting, inProgress, ready, typicalMinByFlow: typicalByFlow }
}
