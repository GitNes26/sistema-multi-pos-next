import assert from "node:assert/strict"
import test from "node:test"
import { databaseUrlWithPool } from "../../src/lib/db/client.ts"

test("agrega tamaño de pool y espera a la URL de la base de datos", () => {
  const url = new URL(databaseUrlWithPool("mysql://u:p@localhost:3306/app", {}))
  assert.equal(url.searchParams.get("connection_limit"), "25")
  assert.equal(url.searchParams.get("pool_timeout"), "20")
})

test("respeta DB_POOL_SIZE y no pisa lo que la URL ya define", () => {
  assert.equal(new URL(databaseUrlWithPool("mysql://u:p@h/app", { DB_POOL_SIZE: "40" })).searchParams.get("connection_limit"), "40")
  assert.equal(new URL(databaseUrlWithPool("mysql://u:p@h/app?connection_limit=5", { DB_POOL_SIZE: "40" })).searchParams.get("connection_limit"), "5")
  assert.equal(databaseUrlWithPool(undefined, {}), undefined)
})
