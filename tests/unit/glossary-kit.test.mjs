import assert from "node:assert/strict"
import test from "node:test"
import { GLOSSARY } from "../../src/lib/glossary.ts"
import { kitWhatsappUrl } from "../../src/lib/whatsapp.ts"

test("todas las palabras del glosario traen explicación corta y larga", () => {
  const entries = Object.entries(GLOSSARY)
  assert.ok(entries.length >= 15)
  for (const [id, e] of entries) {
    assert.ok(e.term && e.short && e.body, `${id} está incompleta`)
    assert.ok(e.short.length < 120, `${id}: la frase corta debe ser corta`)
  }
  for (const id of ["fondo-inicial", "corte", "bajo-minimo", "bi", "medidas", "puestos", "cedis", "tipo-negocio"]) {
    assert.ok(GLOSSARY[id], `falta ${id}`)
  }
})

test("la cotización del Kit POS lista piezas y opciones, sin precios", () => {
  const url = decodeURIComponent(
    kitWhatsappUrl([
      { name: "Tablet / Computadora", option: "Tablet", quantity: 2 },
      { name: "Impresora", option: null, quantity: 1 },
    ])
  )
  assert.match(url, /2 × Tablet \(Tablet \/ Computadora\)/)
  assert.match(url, /1 × Impresora/)
  assert.doesNotMatch(url, /\$\s?\d/)
})
