import { readFile } from "node:fs/promises"
import { join } from "node:path"
import sharp from "sharp"
import { DEFAULT_LOGO_URL } from "@/lib/brand"
import { resolveUploadedUrlPath } from "@/lib/uploads/storage"

/**
 * Carga el logo de la empresa para los documentos PDF. Las imágenes subidas se guardan en WebP
 * (que pdfkit no soporta), así que siempre se entrega un PNG acotado, leído del disco si es
 * una subida local o descargado si es una URL externa.
 */
export async function loadLogoPng(url: string | null | undefined, maxPx = 320): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  // Sin logo de empresa se usa el oficial de Multi-POS (está en /public).
  const source = url || DEFAULT_LOGO_URL
  try {
    let raw: Buffer | null = null
    const local = resolveUploadedUrlPath(source)
    if (local) raw = await readFile(local).catch(() => null)
    if (!raw && source.startsWith("/") && !source.startsWith("//")) raw = await readFile(join(process.cwd(), "public", source)).catch(() => null)
    if (!raw) {
      const abs = /^https?:/i.test(source) ? source : new URL(source, process.env.NEXTAUTH_URL ?? "http://localhost:3000").toString()
      const res = await fetch(abs)
      if (res.ok) raw = Buffer.from(await res.arrayBuffer())
    }
    if (!raw) return null
    const out = await sharp(raw).resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true })
    return { buffer: out.data, width: out.info.width, height: out.info.height }
  } catch {
    return null
  }
}

/** URL absoluta para correos y documentos HTML. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^https?:/i.test(url)) return url
  return new URL(url, process.env.NEXTAUTH_URL ?? "http://localhost:3000").toString()
}
