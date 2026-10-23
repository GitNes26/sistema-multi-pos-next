import assert from "node:assert/strict"
import test from "node:test"
import { pickFrequent, recordVisit, scoreOf, HALF_LIFE_DAYS } from "../../src/lib/nav-usage.ts"

const DAY = 86_400_000
const KEYS = ["/pos", "/admin/products", "/admin/inventory", "/admin/sales", "/admin/orders", "/admin/customers", "/admin/reports", "/admin/payroll"]

test("sin historial el menú arranca con las pantallas por defecto", () => {
  assert.deepEqual([...pickFrequent(KEYS, {}, 0)], ["/pos", "/admin/products", "/admin/inventory", "/admin/sales"])
})

test("las pantallas con visitas reales superan a las sugeridas", () => {
  let store = {}
  for (let i = 0; i < 3; i += 1) store = recordVisit(store, "/admin/payroll", 1000)
  store = recordVisit(store, "/admin/reports", 1000)
  const picked = pickFrequent(KEYS, store, 1000)
  assert.equal(picked.size, 4)
  assert.equal(picked.has("/admin/payroll"), true)
  assert.equal(picked.has("/admin/reports"), true)
})

test("el menú se ajusta: lo que dejas de usar pierde lugar frente a lo nuevo", () => {
  let store = {}
  for (let i = 0; i < 10; i += 1) store = recordVisit(store, "/admin/reports", 0)
  assert.equal(pickFrequent(KEYS, store, 0).has("/admin/reports"), true)
  // Pasan 8 semanas sin entrar a reportes y ahora se usa mucho nómina.
  const later = 56 * DAY
  for (let i = 0; i < 6; i += 1) store = recordVisit(store, "/admin/payroll", later)
  const picked = pickFrequent(KEYS, store, later)
  assert.equal(picked.has("/admin/payroll"), true)
  assert.ok(scoreOf(store["/admin/reports"], later) < scoreOf(store["/admin/payroll"], later))
})

test("una visita pesa la mitad después de la vida media y el almacén no crece sin límite", () => {
  const store = recordVisit({}, "/pos", 0)
  assert.ok(Math.abs(scoreOf(store["/pos"], HALF_LIFE_DAYS * DAY) - 0.5) < 1e-9)
  let big = {}
  for (let i = 0; i < 200; i += 1) big = recordVisit(big, `/ruta/${i}`, i)
  assert.ok(Object.keys(big).length <= 60)
})
