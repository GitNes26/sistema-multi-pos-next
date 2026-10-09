import { NextResponse } from "next/server"
import { randomBytes, randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth/users"
import { mailConfigured, sendWelcomeLink } from "@/lib/auth/mail"
import { processUploadedImage } from "@/lib/uploads/image-process"
import { uploadedFilePath, uploadedMediaUrl } from "@/lib/uploads/storage"

// Registro público de clientes desde el login del portal. Crea la CUENTA (compartida
// entre negocios) y envía el enlace para activarla; el número de cliente se asigna
// cuando la persona elige o se une a un negocio (cada negocio lleva el suyo).
// Es el mismo alta que hace el panel administrativo o el POS: activa por defecto.

const MAX_PHOTO = 5 * 1024 * 1024
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: Request) {
  let fields: Record<string, string> = {}
  let photo: File | null = null
  try {
    const form = await req.formData()
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") fields[k] = v.trim()
      else if (k === "photo" && v.size > 0) photo = v
    }
  } catch {
    fields = {}
  }

  const fullName = fields.fullName ?? ""
  const phone = (fields.phone ?? "").replace(/[^\d+]/g, "")
  const email = (fields.email ?? "").toLowerCase()
  const address = fields.address || null
  const errors: Record<string, string> = {}
  if (fullName.length < 3) errors.fullName = "Escribe tu nombre completo"
  if (phone.replace(/\D/g, "").length < 10) errors.phone = "Escribe un teléfono de 10 dígitos"
  if (!EMAIL_RE.test(email)) errors.email = "Escribe un correo válido"
  if (photo && (!PHOTO_TYPES.has(photo.type) || photo.size > MAX_PHOTO)) errors.photo = "La foto debe ser JPG, PNG o WEBP de hasta 5 MB"
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, error: "Revisa los datos", errors }, { status: 400 })
  if (process.env.NODE_ENV === "production" && !mailConfigured()) {
    return NextResponse.json({ ok: false, error: "El registro no está disponible por ahora. Pide que te den de alta en tienda." }, { status: 503 })
  }

  // Respuesta neutra si el correo ya existe (no revela qué correos tienen cuenta).
  const neutral = { ok: true, message: "Te enviamos un correo con el enlace para activar tu cuenta." }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, activationRequired: true } })
  if (existing) {
    if (existing.activationRequired && mailConfigured()) await sendWelcomeLink(email).catch((e) => console.error("[register] reenvío", e))
    return NextResponse.json(neutral)
  }

  let avatarUrl: string | null = null
  if (photo) {
    try {
      const processed = await processUploadedImage(Buffer.from(await photo.arrayBuffer()), photo.type)
      const name = `${randomUUID()}.${processed.ext}`
      const filePath = uploadedFilePath("_accounts", name)
      if (filePath) {
        await mkdir(path.dirname(filePath), { recursive: true })
        await writeFile(filePath, processed.buffer)
        avatarUrl = uploadedMediaUrl("_accounts", name)
      }
    } catch (e) {
      console.error("[register] foto", e)
    }
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      fullName,
      phone,
      avatarUrl,
      isActive: true,
      activationRequired: true,
      profile: address ? { create: { fullName, phone, avatarUrl, preferences: { address } } } : undefined,
    },
  })
  if (mailConfigured()) await sendWelcomeLink(email).catch((e) => console.error("[register] correo", e))
  return NextResponse.json(neutral)
}
