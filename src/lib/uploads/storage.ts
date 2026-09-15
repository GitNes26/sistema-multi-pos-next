import path from "node:path"

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/
const SAFE_FILE = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/

export function uploadsRoot() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads")
}

export function uploadedFilePath(organizationId: string, fileName: string) {
  if (!SAFE_SEGMENT.test(organizationId) || !SAFE_FILE.test(fileName)) return null
  return path.join(uploadsRoot(), organizationId, fileName)
}

export function uploadedMediaUrl(organizationId: string, fileName: string) {
  return `/api/media/${encodeURIComponent(organizationId)}/${encodeURIComponent(fileName)}`
}

/** Resuelve URLs nuevas y antiguas del almacenamiento local para PDFs. */
export function resolveUploadedUrlPath(url: string) {
  const match = url.match(/^\/(?:api\/media|uploads)\/([^/]+)\/([^/?#]+)$/)
  if (!match) return null
  return uploadedFilePath(decodeURIComponent(match[1]), decodeURIComponent(match[2]))
}
