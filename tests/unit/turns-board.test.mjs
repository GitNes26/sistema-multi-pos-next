import assert from "node:assert/strict"
import test from "node:test"
import { buildTurnsBoard, maskedVehicle, typicalMinutes } from "../../src/lib/service-orders/turns-board.ts"

const stages = [
  { id: "s1", label: "Recibido", isReady: false },
  { id: "s2", label: "Lavando", isReady: false },
  { id: "s3", label: "Listo", isReady: true },
]
const base = (over) => ({ id: "x", number: 1, status: "open", createdAt: new Date("2026-11-09T10:00:00Z"), promisedAt: null, readyAt: null, flowId: "f", stageId: "s1", stageLabel: "Recibido", stages, assetLabel: "Tsuru gris", assetReference: "ABC-123", stationName: null, services: ["Lavado"], ...over })
const now = new Date("2026-11-09T10:30:00Z")

test("la placa se enmascara y no sale ningún dato personal", () => {
  assert.equal(maskedVehicle("Tsuru gris", "ABC-123"), "Tsuru gris · •••123")
  assert.equal(maskedVehicle(null, null), "Vehículo")
  assert.equal(maskedVehicle("Moto", "A1"), "Moto · •••")
})

test("en espera, en proceso y listos se separan por etapa y estado", () => {
  const board = buildTurnsBoard([
    base({ id: "a", number: 1, stageId: "s1" }),
    base({ id: "b", number: 2, stageId: "s1", createdAt: new Date("2026-11-09T10:05:00Z") }),
    base({ id: "c", number: 3, stageId: "s2", stageLabel: "Lavando" }),
    base({ id: "d", number: 4, status: "ready", stageId: "s3", stageLabel: "Listo", readyAt: new Date("2026-11-09T10:20:00Z") }),
  ], now)
  assert.deepEqual(board.waiting.map((t) => [t.number, t.position]), [[1, 1], [2, 2]])
  assert.deepEqual(board.inProgress.map((t) => t.number), [3])
  assert.deepEqual(board.ready.map((t) => t.number), [4])
  assert.equal(board.ready[0].readyForMin, 10)
})

test("el avance por etapas marca hechas, actual y pendientes", () => {
  const [card] = buildTurnsBoard([base({ stageId: "s2", stageLabel: "Lavando" })], now).inProgress
  assert.deepEqual(card.steps.map((s) => s.state), ["done", "current", "todo"])
  const [done] = buildTurnsBoard([base({ status: "ready", stageId: "s3", readyAt: now })], now).ready
  assert.ok(done.steps.every((s) => s.state === "done"))
})

test("el tiempo transcurrido y el estimado salen de la hora prometida o del tiempo típico", () => {
  const promised = buildTurnsBoard([base({ promisedAt: new Date("2026-11-09T10:45:00Z"), stageId: "s2" })], now).inProgress[0]
  assert.equal(promised.elapsedMin, 30)
  assert.equal(promised.remainingMin, 15)
  assert.equal(promised.overdue, false)
  const typical = buildTurnsBoard([base({ stageId: "s2" })], now, { f: 40 }).inProgress[0]
  assert.equal(typical.remainingMin, 10)
  const late = buildTurnsBoard([base({ promisedAt: new Date("2026-11-09T10:20:00Z"), stageId: "s2" })], now).inProgress[0]
  assert.equal(late.overdue, true)
  assert.equal(late.remainingMin, 0)
  const unknown = buildTurnsBoard([base({ stageId: "s2" })], now).inProgress[0]
  assert.equal(unknown.estimatedReadyAt, null)
  assert.equal(unknown.remainingMin, null)
})

test("el tiempo típico es la mediana y pide muestras suficientes", () => {
  assert.equal(typicalMinutes([20, 40, 30]), 30)
  assert.equal(typicalMinutes([20, 40, 30, 50]), 35)
  assert.equal(typicalMinutes([20, 40]), null)
  assert.equal(typicalMinutes([0, -5, NaN, 10, 20, 30]), 20)
})

test("canceladas y entregadas no aparecen", () => {
  const board = buildTurnsBoard([base({ status: "delivered" }), base({ status: "cancelled" })], now)
  assert.equal(board.waiting.length + board.inProgress.length + board.ready.length, 0)
})
