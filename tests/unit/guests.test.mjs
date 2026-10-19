import assert from "node:assert/strict"
import test from "node:test"
import { cleanGuestName, groupByGuest, hasGuests, MAX_GUEST_NAME } from "../../src/lib/guests.ts"

test("el nombre de la persona se limpia y se acota", () => {
  assert.equal(cleanGuestName("  Juan   Pérez "), "Juan Pérez")
  assert.equal(cleanGuestName(""), null)
  assert.equal(cleanGuestName("   "), null)
  assert.equal(cleanGuestName(undefined), null)
  assert.equal(cleanGuestName(42), null)
  assert.equal(cleanGuestName("x".repeat(200))?.length, MAX_GUEST_NAME)
})

test("sin nombres el pedido es un solo grupo sin título", () => {
  const items = [{ n: 1 }, { n: 2 }]
  const groups = groupByGuest(items, () => null)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].guest, null)
  assert.equal(hasGuests(items, () => null), false)
})

test("con nombres agrupa por persona conservando el orden de aparición", () => {
  const items = [
    { n: 1, g: "Juan" },
    { n: 2, g: "Miguel" },
    { n: 3, g: "juan" },
    { n: 4, g: null },
  ]
  const groups = groupByGuest(items, (i) => i.g)
  assert.deepEqual(groups.map((g) => g.guest), ["Juan", "Miguel", null])
  assert.deepEqual(groups[0].items.map((i) => i.n), [1, 3])
  assert.equal(hasGuests(items, (i) => i.g), true)
})
