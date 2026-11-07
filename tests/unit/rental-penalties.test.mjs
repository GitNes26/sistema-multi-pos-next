import assert from "node:assert/strict"
import { test } from "node:test"
import { computeLateFee, lateDays, settleDeposit } from "../../src/lib/reservations/penalties.ts"

const ends = new Date("2026-11-10T18:00:00Z")
const at = (minutes) => new Date(ends.getTime() + minutes * 60_000)

test("a tiempo o dentro de la gracia no hay retraso", () => {
  assert.equal(lateDays(ends, at(-30), 60), 0)
  assert.equal(lateDays(ends, at(60), 60), 0)
  assert.equal(computeLateFee(ends, at(45), { lateFeePerDay: 200, graceMinutes: 60 }), 0)
})

test("pasada la gracia se cobra por día o fracción", () => {
  assert.equal(lateDays(ends, at(61), 60), 1)
  assert.equal(lateDays(ends, at(60 + 24 * 60), 60), 1)
  assert.equal(lateDays(ends, at(60 + 24 * 60 + 1), 60), 2)
  assert.equal(computeLateFee(ends, at(60 + 3 * 24 * 60), { lateFeePerDay: 150.5, graceMinutes: 60 }), 451.5)
})

test("sin cargo por día configurado no se cobra retraso", () => {
  assert.equal(computeLateFee(ends, at(5000), { lateFeePerDay: 0, graceMinutes: 0 }), 0)
})

test("el depósito cubre los cargos y se regresa lo que sobra", () => {
  assert.deepEqual(settleDeposit(1000, 0), { retained: 0, refund: 1000, balanceDue: 0 })
  assert.deepEqual(settleDeposit(1000, 350.25), { retained: 350.25, refund: 649.75, balanceDue: 0 })
})

test("si los cargos exceden el depósito queda saldo por cobrar", () => {
  assert.deepEqual(settleDeposit(500, 800), { retained: 500, refund: 0, balanceDue: 300 })
  assert.deepEqual(settleDeposit(0, 120), { retained: 0, refund: 0, balanceDue: 120 })
})
