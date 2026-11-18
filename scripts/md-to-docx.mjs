// Convierte un Markdown de docs/ a Word (.docx) sin contenido duplicado a mano.
// Uso: node scripts/md-to-docx.mjs [entrada.md] [salida.docx]
// Por defecto: docs/ANALISIS_NEGOCIOS_MULTI_POS.md -> mismo nombre .docx.
import fs from "node:fs"
import path from "node:path"
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

const input = process.argv[2] ?? "docs/ANALISIS_NEGOCIOS_MULTI_POS.md"
const output = process.argv[3] ?? input.replace(/\.md$/i, ".docx")
const BLUE = "1a56db"
const GRAY = "f3f4f6"
const lines = fs.readFileSync(input, "utf8").replace(/\r\n/g, "\n").split("\n")

// Inline: **negrita**, *cursiva*, `código`, [texto](enlace) → solo el texto.
function runs(text, base = {}) {
  const clean = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g
  let last = 0
  for (const m of clean.matchAll(re)) {
    if (m.index > last) out.push(new TextRun({ text: clean.slice(last, m.index), ...base }))
    const t = m[0]
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }))
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Consolas", ...base }))
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }))
    last = m.index + t.length
  }
  if (last < clean.length) out.push(new TextRun({ text: clean.slice(last), ...base }))
  return out
}

const headingLevels = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
]
const headingSize = [32, 28, 24, 22]

function heading(level, text) {
  return new Paragraph({
    heading: headingLevels[level - 1] ?? HeadingLevel.HEADING_4,
    spacing: { before: level === 1 ? 400 : 240, after: 140 },
    keepNext: true,
    children: runs(text, {
      bold: true,
      size: headingSize[level - 1] ?? 22,
      color: level <= 2 ? BLUE : undefined,
    }),
  })
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "d1d5db" }
const borders = { top: border, bottom: border, left: border, right: border }

function table(rows) {
  const cells = rows.map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
  const header = cells[0]
  const body = cells.slice(2) // la fila 1 es el separador |---|
  const cols = header.length
  const width = Math.floor(9360 / cols)
  const mk = (row, isHeader) =>
    new TableRow({
      tableHeader: isHeader,
      children: Array.from({ length: cols }, (_, i) =>
        new TableCell({
          width: { size: width, type: WidthType.DXA },
          borders,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: isHeader ? { type: ShadingType.CLEAR, fill: GRAY, color: "auto" } : undefined,
          children: [
            new Paragraph({
              children: runs(row[i] ?? "", { size: 18, bold: isHeader || undefined }),
            }),
          ],
        })
      ),
    })
  return new Table({
    width: { size: width * cols, type: WidthType.DXA },
    columnWidths: Array(cols).fill(width),
    rows: [mk(header, true), ...body.map((r) => mk(r, false))],
  })
}

const children = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (!line.trim()) continue
  if (/^-{3,}$/.test(line.trim())) continue
  const h = line.match(/^(#{1,4})\s+(.*)$/)
  if (h) {
    children.push(heading(h[1].length, h[2]))
    continue
  }
  if (line.trim().startsWith("|")) {
    const block = []
    while (i < lines.length && lines[i].trim().startsWith("|")) block.push(lines[i++])
    i--
    if (block.length >= 2) children.push(table(block), new Paragraph({ spacing: { after: 120 }, children: [] }))
    continue
  }
  const bullet = line.match(/^(\s*)[-*]\s+(.*)$/)
  if (bullet) {
    children.push(
      new Paragraph({
        numbering: { reference: "bullets", level: Math.min(Math.floor(bullet[1].length / 2), 2) },
        spacing: { after: 60 },
        children: runs(bullet[2]),
      })
    )
    continue
  }
  const num = line.match(/^\s*\d+\.\s+(.*)$/)
  if (num) {
    children.push(
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 60 },
        children: runs(num[1]),
      })
    )
    continue
  }
  if (line.startsWith(">")) {
    children.push(
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 120 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 8 } },
        children: runs(line.replace(/^>\s?/, ""), { italics: true }),
      })
    )
    continue
  }
  children.push(new Paragraph({ spacing: { after: 120 }, children: runs(line.trim()) }))
}

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [0, 1, 2].map((level) => ({
          level,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540 + level * 360, hanging: 260 } } },
        })),
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 300 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } },
      children,
    },
  ],
})

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, await Packer.toBuffer(doc))
console.log(`Generado ${output} (${children.length} bloques)`)
