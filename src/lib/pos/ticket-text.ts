// Texto de ticket que no se encima con el importe: parte la etiqueta en renglones que caben en el ancho
// disponible (cortando por palabras y, si una palabra no cabe, por letras) y, pasado el máximo de renglones,
// termina con «…». Módulo puro: la medida del texto la da quien llama (PDFKit, canvas o pruebas).

export interface WrapOptions {
  /** Máximo de renglones; lo que sobre se corta con «…». */
  maxLines?: number
}

export function wrapByWidth(text: string, maxWidth: number, measure: (s: string) => number, { maxLines = 3 }: WrapOptions = {}): string[] {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return [""]
  const lines: string[] = []
  let current = ""
  const push = (line: string) => lines.push(line)
  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) {
      push(current)
      current = ""
    }
    // Una palabra más ancha que el renglón se parte por letras.
    let rest = word
    while (measure(rest) > maxWidth) {
      let cut = rest.length - 1
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut--
      push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    current = rest
  }
  if (current) push(current)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}
