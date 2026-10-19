import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db"
import { hasPermission } from "@/lib/auth/permissions"

export const dynamic = "force-dynamic"

// Componentes del Kit POS que se ofrecen en la landing. Es de plataforma (no
// pertenece a ninguna empresa): solo quien tenga `kit.manage` (hoy el
// superadministrador) lo edita. El precio mínimo estimado es interno.

const deny = () => NextResponse.json({ ok: false, error: "Solo el superadministrador puede gestionar el Kit POS" }, { status: 403 })

function parseOptions(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n|,/) : []
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))].slice(0, 8)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!hasPermission(session, "kit.manage")) return deny()
  const items = await prisma.kitComponent.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
  return NextResponse.json({
    ok: true,
    items: items.map((i) => ({ ...i, internalMinPrice: Number(i.internalMinPrice), options: Array.isArray(i.options) ? (i.options as string[]) : [] })),
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!hasPermission(session, "kit.manage")) return deny()
  try {
    const body = await request.json()
    if (body.action === "delete") {
      await prisma.kitComponent.delete({ where: { id: String(body.id) } })
      return NextResponse.json({ ok: true })
    }
    const name = String(body.name ?? "").trim()
    if (!name) throw new Error("Escribe el nombre del componente")
    const price = Number(body.internalMinPrice ?? 0)
    if (!Number.isFinite(price) || price < 0) throw new Error("El precio mínimo estimado no puede ser negativo")
    const options = parseOptions(body.options)
    const data = {
      name: name.slice(0, 120),
      description: String(body.description ?? "").trim().slice(0, 190) || null,
      imageUrl: String(body.imageUrl ?? "").trim().slice(0, 190) || null,
      options: options.length ? options : undefined,
      internalMinPrice: price,
      sortOrder: Math.trunc(Number(body.sortOrder ?? 0)) || 0,
      isActive: body.isActive !== false,
    }
    const item = body.id
      ? await prisma.kitComponent.update({ where: { id: String(body.id) }, data: { ...data, options: options.length ? options : [] } })
      : await prisma.kitComponent.create({ data })
    return NextResponse.json({ ok: true, item: { ...item, internalMinPrice: Number(item.internalMinPrice) } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No fue posible guardar el componente" }, { status: 400 })
  }
}
