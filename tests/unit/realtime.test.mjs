import test from "node:test"
import assert from "node:assert/strict"

const rt = await import("../../src/lib/realtime/index.ts")

function fakeController() {
  const chunks = []
  return { chunks, enqueue: (c) => chunks.push(new TextDecoder().decode(c)) }
}

test("publish entrega solo a los suscriptores del canal y se puede dar de baja", () => {
  const a = fakeController()
  const b = fakeController()
  const off = rt.subscribe("t:a", a)
  rt.subscribe("t:b", b)
  rt.publish("t:a", { x: 1 })
  assert.deepEqual(a.chunks, ['data: {"x":1}\n\n'])
  assert.equal(b.chunks.length, 0)
  assert.equal(rt.subscriberCount("t:a"), 1)
  off()
  assert.equal(rt.subscriberCount("t:a"), 0)
})

test("el driver recibe cada publicación y un fallo no rompe la difusión local", () => {
  const a = fakeController()
  rt.subscribe("t:d", a)
  const seen = []
  rt.setRealtimeDriver({ publish: (c, d) => { seen.push([c, d]); throw new Error("redis caído") } })
  rt.publish("t:d", { y: 2 })
  rt.setRealtimeDriver(null)
  assert.equal(a.chunks.length, 1)
  assert.deepEqual(seen, [["t:d", { y: 2 }]])
})
