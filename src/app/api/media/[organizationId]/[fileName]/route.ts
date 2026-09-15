import { readFile } from "node:fs/promises"
import { NextResponse } from "next/server"
import { uploadedFilePath } from "@/lib/uploads/storage"

const TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; fileName: string }> }
) {
  const { organizationId, fileName } = await context.params
  const filePath = uploadedFilePath(organizationId, fileName)
  if (!filePath) return NextResponse.json({ error: "Archivo inválido" }, { status: 400 })

  try {
    const data = await readFile(filePath)
    const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
    return new NextResponse(data, {
      headers: {
        "Content-Type": TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 })
  }
}
