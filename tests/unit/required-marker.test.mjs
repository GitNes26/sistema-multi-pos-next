import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

// Convención: todo componente base de formulario con prop `required` pinta un asterisco rojo en su etiqueta.
const dir = new URL("../../src/components/base/", import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"))

test("los componentes base con `required` muestran el asterisco rojo", () => {
  const withRequired = files.filter((f) => /required\?: boolean/.test(readFileSync(new URL(f, dir), "utf8")))
  assert.ok(withRequired.length >= 8, "se esperaban los campos de formulario base")
  for (const file of withRequired) {
    const source = readFileSync(new URL(file, dir), "utf8")
    assert.match(source, /required && <span className="text-destructive"> \*<\/span>/, `${file} no pinta el asterisco rojo`)
  }
})
