// Ficha de estilo del cliente (CustomerAsset de tipo «profile»): indicaciones estructuradas del corte que
// se guardan en `attributes` y se vuelcan como texto a la orden de servicio cuando el cliente llega.

export interface CutField {
  key: string
  label: string
  placeholder: string
}

export const CUT_FIELDS: CutField[] = [
  { key: "cutSides", label: "Laterales / degradado", placeholder: "Ej. degradado bajo, máquina 1 a 0" },
  { key: "cutTop", label: "Parte superior", placeholder: "Ej. 4 cm, textura, hacia el frente" },
  { key: "cutBeard", label: "Barba y bigote", placeholder: "Ej. perfilada, 2 mm, sin bigote" },
  { key: "cutExtras", label: "Cejas y detalles", placeholder: "Ej. cejas con navaja, líneas" },
  { key: "cutProducts", label: "Producto de peinado", placeholder: "Ej. cera mate, sin gel" },
]

const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "")

/** Valores de la ficha leídos del JSON `attributes` (solo los campos conocidos). */
export function cutFromAttributes(attributes: unknown): Record<string, string> {
  const source = attributes && typeof attributes === "object" && !Array.isArray(attributes) ? (attributes as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  for (const field of CUT_FIELDS) {
    const value = clean(source[field.key])
    if (value) out[field.key] = value
  }
  return out
}

/** Texto para las indicaciones de la orden: «Laterales: …\nBarba: …». */
export function formatCutIndications(attributes: unknown): string {
  const values = cutFromAttributes(attributes)
  return CUT_FIELDS.filter((f) => values[f.key]).map((f) => `${f.label}: ${values[f.key]}`).join("\n")
}
