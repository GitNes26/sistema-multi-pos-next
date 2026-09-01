import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { ordersGuard, ordersErrorResponse } from "@/app/api/orders/guard"

// GET /api/combos — list combos for the organization
export async function GET(req: NextRequest) {
  const guard = await ordersGuard("products.manage")
  if (guard instanceof NextResponse) return guard
  try {
    const combos = await prisma.productCombo.findMany({
      where: { organizationId: guard.organizationId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                variants: { select: { id: true, name: true, price: true } },
              },
            },
            variant: { select: { id: true, name: true, price: true } },
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    })
    return NextResponse.json(combos)
  } catch (err) {
    return ordersErrorResponse(err)
  }
}

// POST /api/combos — create a combo
export async function POST(req: NextRequest) {
  const guard = await ordersGuard("products.manage")
  if (guard instanceof NextResponse) return guard
  const organizationId = guard.organizationId
  try {

    const body = await req.json()
    const { name, description, imageUrl, comboPrice, isActive, items } = body as {
      name: string
      description?: string
      imageUrl?: string
      comboPrice: number
      isActive?: boolean
      items?: {
        productId: string
        variantId?: string
        quantity?: number
        extraPrice?: number
      }[]
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 })
    }
    if (typeof comboPrice !== "number" || comboPrice < 0) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Agrega al menos un producto al combo" }, { status: 400 })
    }

    const combo = await prisma.productCombo.create({
      data: {
        organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        comboPrice,
        isActive: isActive ?? true,
        items: {
          create: items.map((item, idx) => ({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity ?? 1,
            extraPrice: item.extraPrice ?? 0,
            position: idx,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                variants: { select: { id: true, name: true, price: true } },
              },
            },
            variant: { select: { id: true, name: true, price: true } },
          },
        },
      },
    })

    return NextResponse.json(combo, { status: 201 })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}

// PUT /api/combos — update a combo
export async function PUT(req: NextRequest) {
  const guard = await ordersGuard("products.manage")
  if (guard instanceof NextResponse) return guard
  const organizationId = guard.organizationId
  try {

    const body = await req.json()
    const { id, name, description, imageUrl, comboPrice, isActive, items } = body as {
      id: string
      name: string
      description?: string
      imageUrl?: string
      comboPrice: number
      isActive?: boolean
      items?: {
        id?: string
        productId: string
        variantId?: string
        quantity?: number
        extraPrice?: number
      }[]
    }

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.productCombo.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Combo no encontrado" }, { status: 404 })
    }

    // Delete existing items and recreate
    const combo = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.comboItem.deleteMany({ where: { comboId: id } })

      return tx.productCombo.update({
        where: { id },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          imageUrl: imageUrl?.trim() || null,
          comboPrice,
          isActive: isActive ?? true,
          items: {
            create: (items ?? []).map((item, idx) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity ?? 1,
              extraPrice: item.extraPrice ?? 0,
              position: idx,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
              variant: { select: { id: true, name: true } },
            },
          },
        },
      })
    })

    return NextResponse.json(combo)
  } catch (err) {
    return ordersErrorResponse(err)
  }
}

// DELETE /api/combos — delete a combo
export async function DELETE(req: NextRequest) {
  const guard = await ordersGuard("products.manage")
  if (guard instanceof NextResponse) return guard
  const organizationId = guard.organizationId
  try {

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const existing = await prisma.productCombo.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Combo no encontrado" }, { status: 404 })
    }

    await prisma.comboItem.deleteMany({ where: { comboId: id } })
    await prisma.productCombo.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}
