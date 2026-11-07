import { prisma } from "@/lib/db"
import { ServiceOrderError } from "./server"

// Lo que el cliente del portal ve y hace con sus vehículos y servicios. Todo se resuelve por el cliente
// de la sesión (nunca por datos del cuerpo): solo sus vehículos y solo sus órdenes.

export interface PortalAsset {
  id: string
  label: string
  reference: string | null
  brand: string | null
  model: string | null
  color: string | null
  size: string | null
}

export interface PortalOrder {
  id: string
  number: number
  status: string
  statusLabel: string
  asset: { label: string; reference: string | null } | null
  services: string[]
  stage: string
  /** Etapas del flujo con la actual marcada (barra de avance). */
  steps: { label: string; state: "done" | "current" | "todo" }[]
  total: number
  promisedAt: string | null
  readyAt: string | null
  deliveredAt: string | null
  createdAt: string
}

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}

export async function listPortalAssets(organizationId: string, customerId: string): Promise<PortalAsset[]> {
  const rows = await prisma.customerAsset.findMany({
    where: { organizationId, customerId, isActive: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, label: true, reference: true, brand: true, model: true, color: true, size: true },
  })
  return rows
}

export async function createPortalAsset(organizationId: string, customerId: string, input: Record<string, unknown>): Promise<PortalAsset> {
  const count = await prisma.customerAsset.count({ where: { organizationId, customerId, isActive: true } })
  if (count >= 30) throw new ServiceOrderError("Ya tienes el máximo de vehículos registrados", 409)
  const reference = text(input.reference, 40)?.toUpperCase() ?? null
  const brand = text(input.brand, 60)
  const model = text(input.model, 60)
  const color = text(input.color, 40)
  const label = text(input.label, 120) ?? ([brand, model, color].filter(Boolean).join(" ") || reference || "")
  if (!label) throw new ServiceOrderError("Escribe un nombre, la placa o la marca y el modelo")
  return prisma.customerAsset.create({
    data: { organizationId, customerId, kind: "vehicle", label, reference, brand, model, color, size: text(input.size, 40) },
    select: { id: true, label: true, reference: true, brand: true, model: true, color: true, size: true },
  })
}

export async function removePortalAsset(organizationId: string, customerId: string, id: string) {
  const done = await prisma.customerAsset.updateMany({ where: { id, organizationId, customerId, isActive: true }, data: { isActive: false } })
  if (done.count !== 1) throw new ServiceOrderError("Vehículo no encontrado", 404)
}

const STATUS_LABEL: Record<string, string> = { open: "En proceso", ready: "Listo para entregar", delivered: "Entregado", cancelled: "Cancelado" }

/** Órdenes del cliente: en curso y las entregadas o canceladas de la última semana. */
export async function listPortalOrders(organizationId: string, customerId: string): Promise<PortalOrder[]> {
  const since = new Date(Date.now() - 7 * 86_400_000)
  const rows = await prisma.serviceOrder.findMany({
    where: { organizationId, customerId, OR: [{ status: { in: ["open", "ready"] } }, { createdAt: { gte: since } }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      promisedAt: true,
      readyAt: true,
      deliveredAt: true,
      createdAt: true,
      stage: { select: { id: true, label: true } },
      asset: { select: { label: true, reference: true } },
      items: { select: { productName: true } },
      flow: { select: { stages: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true } } } },
    },
  })
  return rows.map((o) => {
    const at = o.flow.stages.findIndex((s) => s.id === o.stage.id)
    const finished = o.status === "delivered"
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      statusLabel: STATUS_LABEL[o.status] ?? o.status,
      asset: o.asset,
      services: o.items.map((i) => i.productName),
      stage: o.stage.label,
      steps: o.flow.stages.map((s, i) => ({ label: s.label, state: finished || i < at ? ("done" as const) : i === at ? ("current" as const) : ("todo" as const) })),
      total: Number(o.total),
      promisedAt: o.promisedAt?.toISOString() ?? null,
      readyAt: o.readyAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    }
  })
}
