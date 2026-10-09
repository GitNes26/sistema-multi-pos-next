import PDFDocument from "pdfkit"
import { loadLogoPng } from "@/lib/documents/branding"

// Plano de sala en PDF: una hoja horizontal por sala, a escala, con el logo de la empresa.

export interface PlanPdfTable {
  number: number
  name: string | null
  capacity: number
  shape: string
  width: number | null
  height: number | null
  posX: number | null
  posY: number | null
  rotation: number
}
export interface PlanPdfNode {
  kind: string
  label: string | null
  posX: number
  posY: number
  rotation: number
}
export interface PlanPdfPage {
  title: string
  tables: PlanPdfTable[]
  nodes: PlanPdfNode[]
}

const NODE_LABEL: Record<string, string> = {
  entrance: "Entrada",
  exit: "Salida",
  restroom: "Baños",
  kitchen: "Cocina",
  bar_station: "Estación",
  cashier: "Caja",
  stairs: "Escaleras",
  other: "Zona",
}

const defaultSize = (shape: string) =>
  shape === "rectangle" || shape === "booth" ? { w: 140, h: 76 } : shape === "bar" ? { w: 168, h: 56 } : { w: 84, h: 84 }

export async function buildFloorPlanPdf(opts: { company: string; logoUrl: string | null; subtitle?: string; pages: PlanPdfPage[] }): Promise<Buffer> {
  const logo = await loadLogoPng(opts.logoUrl, 240)
  const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 28, autoFirstPage: false })
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  const pages = opts.pages.length ? opts.pages : [{ title: "Sin salas", tables: [], nodes: [] }]
  for (const page of pages) {
    doc.addPage()
    const W = doc.page.width
    const H = doc.page.height
    const m = 28
    let textX = m
    if (logo) {
      try {
        doc.image(logo.buffer, m, m, { fit: [90, 40] })
        textX = m + 100
      } catch {
        /* sin logo */
      }
    }
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(16).text(opts.company, textX, m + 2, { width: W - textX - m })
    doc.font("Helvetica").fontSize(11).fillColor("#4b5563").text(`Plano · ${page.title}${opts.subtitle ? ` · ${opts.subtitle}` : ""}`, textX, m + 24, { width: W - textX - m })

    const top = m + 56
    const area = { x: m, y: top, w: W - m * 2, h: H - top - m - 14 }
    doc.roundedRect(area.x, area.y, area.w, area.h, 6).lineWidth(0.8).strokeColor("#d1d5db").stroke()

    // Escala: ajusta el contenido real (con margen) al área disponible.
    const boxes = [
      ...page.tables.map((t) => {
        const d = defaultSize(t.shape)
        const w = t.width ?? d.w
        const h = t.height ?? d.h
        return { x: t.posX ?? 60, y: t.posY ?? 60, w, h }
      }),
      ...page.nodes.map((n) => ({ x: n.posX, y: n.posY, w: 64, h: 48 })),
    ]
    if (!boxes.length) {
      doc.fillColor("#9ca3af").fontSize(12).text("Sin elementos en este plano", area.x, area.y + area.h / 2 - 6, { width: area.w, align: "center" })
      continue
    }
    const minX = Math.min(...boxes.map((b) => b.x - b.w / 2)) - 16
    const maxX = Math.max(...boxes.map((b) => b.x + b.w / 2)) + 16
    const minY = Math.min(...boxes.map((b) => b.y - b.h / 2)) - 16
    const maxY = Math.max(...boxes.map((b) => b.y + b.h / 2)) + 16
    const scale = Math.min(area.w / (maxX - minX), area.h / (maxY - minY), 1.6)
    const ox = area.x + (area.w - (maxX - minX) * scale) / 2 - minX * scale
    const oy = area.y + (area.h - (maxY - minY) * scale) / 2 - minY * scale

    for (const t of page.tables) {
      const d = defaultSize(t.shape)
      const w = (t.width ?? d.w) * scale
      const h = (t.height ?? d.h) * scale
      const cx = ox + (t.posX ?? 60) * scale
      const cy = oy + (t.posY ?? 60) * scale
      doc.save()
      doc.rotate(t.rotation || 0, { origin: [cx, cy] })
      doc.lineWidth(1.2).strokeColor("#374151").fillColor("#f3f4f6")
      if (t.shape === "round") doc.ellipse(cx, cy, w / 2, h / 2).fillAndStroke()
      else if (t.shape === "bar") doc.roundedRect(cx - w / 2, cy - h / 2, w, h, h / 2).fillAndStroke()
      else doc.roundedRect(cx - w / 2, cy - h / 2, w, h, 6 * scale).fillAndStroke()
      doc.restore()
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(Math.max(8, 13 * scale)).text(String(t.number), cx - w / 2, cy - 8 * scale, { width: w, align: "center", lineBreak: false })
      doc.font("Helvetica").fillColor("#4b5563").fontSize(Math.max(6, 8 * scale)).text(`${t.capacity} pers.`, cx - w / 2, cy + 5 * scale, { width: w, align: "center", lineBreak: false })
    }

    for (const n of page.nodes) {
      const w = 64 * scale
      const h = 48 * scale
      const cx = ox + n.posX * scale
      const cy = oy + n.posY * scale
      doc.save()
      doc.rotate(n.rotation || 0, { origin: [cx, cy] })
      doc.lineWidth(1).dash(3, { space: 2 }).strokeColor("#6b7280").fillColor("#e5e7eb")
      doc.roundedRect(cx - w / 2, cy - h / 2, w, h, 4).fillAndStroke()
      doc.undash()
      if (n.kind === "stairs") {
        // Peldaños: cuatro escalones ascendentes dentro del recuadro.
        doc.strokeColor("#374151").lineWidth(1)
        const sx = cx - w / 2 + 6 * scale
        const sy = cy + h / 2 - 8 * scale
        const stepW = (w - 12 * scale) / 4
        const stepH = (h - 22 * scale) / 4
        doc.moveTo(sx, sy)
        for (let i = 0; i < 4; i++) doc.lineTo(sx + stepW * i, sy - stepH * i).lineTo(sx + stepW * (i + 1), sy - stepH * i)
        doc.stroke()
      }
      doc.restore()
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(Math.max(6, 8 * scale)).text(n.label || NODE_LABEL[n.kind] || "Zona", cx - w / 2, cy + h / 2 - 12 * scale, { width: w, align: "center", lineBreak: false })
    }

    doc.fillColor("#9ca3af").font("Helvetica").fontSize(8).text(`Generado el ${new Date().toLocaleString("es-MX")}`, m, H - m, { width: W - m * 2, align: "right" })
  }
  doc.end()
  return done
}
