import type { $Enums, Prisma } from "@prisma/client"
import { formatCutIndications } from "@/lib/styles/cut"
import { prisma } from "@/lib/db"
import { round2 } from "@/lib/pos/money"
import { createSale, PosError } from "@/lib/pos/server"
import { notifyCustomer } from "@/lib/notifications/customer-channels"
import { missingRequiredChecklist } from "@/lib/checklists/server"
import { publish } from "@/lib/realtime"
import type { PosSalePayload } from "@/types/pos"

// Órdenes de servicio (autolavado, taller, estética…): se recibe un vehículo u objeto del cliente, se le
// asigna lugar y llavero, avanza por las etapas de su flujo y, al estar listo, se cobra con UNA venta ligada.
// Los precios salen de la base de datos: el cliente solo propone qué servicios.

export const SERVICE_ORDER_MODES: $Enums.BusinessMode[] = ["services", "hybrid"]

export class ServiceOrderError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const channel = (organizationId: string) => `service-orders:${organizationId}`

/** Canal del cliente del portal: solo recibe los cambios de SUS órdenes. */
export const portalOrdersChannel = (organizationId: string, customerId: string) => `portal-service-orders:${organizationId}:${customerId}`

/** Avisa a los tableros abiertos de la empresa (y al cliente dueño de la orden) que algo cambió. */
export function broadcastServiceOrderChange(organizationId: string, orderId: string, type: string, customerId?: string | null) {
  publish(channel(organizationId), { orderId, type })
  if (customerId) publish(portalOrdersChannel(organizationId, customerId), { orderId, type })
}
export { channel as serviceOrdersChannel }

// ── Flujos ───────────────────────────────────────────────────────────────────

export interface FlowStageDto {
  id: string
  label: string
  notifyCustomer: boolean
  isReady: boolean
}

export interface FlowDto {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isActive: boolean
  stages: FlowStageDto[]
  productIds: string[]
}

const flowInclude = {
  stages: { where: { isActive: true }, orderBy: { sortOrder: "asc" as const } },
  services: { select: { productId: true } },
} satisfies Prisma.ServiceFlowInclude

type FlowRow = Prisma.ServiceFlowGetPayload<{ include: typeof flowInclude }>

const flowDto = (f: FlowRow): FlowDto => ({
  id: f.id,
  name: f.name,
  description: f.description,
  isDefault: f.isDefault,
  isActive: f.isActive,
  stages: f.stages.map((s) => ({ id: s.id, label: s.label, notifyCustomer: s.notifyCustomer, isReady: s.isReady })),
  productIds: f.services.map((s) => s.productId),
})

/** Flujo de arranque si la empresa aún no configura ninguno: Recibido → En proceso → Listo. */
export async function ensureDefaultFlow(organizationId: string) {
  const existing = await prisma.serviceFlow.findFirst({ where: { organizationId, isActive: true }, select: { id: true } })
  if (existing) return
  await prisma.serviceFlow.create({
    data: {
      organizationId,
      name: "Servicio general",
      description: "Flujo de arranque: puedes cambiar sus etapas o crear otros por tipo de servicio.",
      isDefault: true,
      stages: {
        create: [
          { label: "Recibido", sortOrder: 0 },
          { label: "En proceso", sortOrder: 1 },
          { label: "Listo para entregar", sortOrder: 2, notifyCustomer: true, isReady: true },
        ],
      },
    },
  })
}

export async function listFlows(organizationId: string): Promise<FlowDto[]> {
  await ensureDefaultFlow(organizationId)
  const rows = await prisma.serviceFlow.findMany({ where: { organizationId, isActive: true }, include: flowInclude, orderBy: [{ isDefault: "desc" }, { name: "asc" }] })
  return rows.map(flowDto)
}

export interface FlowInput {
  id?: string
  name: string
  description?: string | null
  isDefault?: boolean
  stages: { id?: string; label: string; notifyCustomer?: boolean; isReady?: boolean }[]
  productIds?: string[]
}

/** Crea o actualiza un flujo con sus etapas (en el orden recibido) y los servicios que lo usan. */
export async function saveFlow(organizationId: string, input: FlowInput): Promise<FlowDto> {
  const name = input.name?.trim().slice(0, 80)
  if (!name) throw new ServiceOrderError("Ponle nombre al flujo")
  const stages = (input.stages ?? []).map((s) => ({ ...s, label: s.label?.trim().slice(0, 60) })).filter((s) => s.label)
  if (stages.length < 2) throw new ServiceOrderError("Un flujo necesita al menos dos etapas (por ejemplo, Recibido y Listo)")
  if (!stages.some((s) => s.isReady)) throw new ServiceOrderError("Marca cuál etapa significa «Listo para entregar»")
  if (stages.filter((s) => s.isReady).length > 1) throw new ServiceOrderError("Solo una etapa puede ser «Listo para entregar»")

  const productIds = [...new Set(input.productIds ?? [])]
  if (productIds.length) {
    const valid = await prisma.product.count({ where: { id: { in: productIds }, organizationId, isActive: true } })
    if (valid !== productIds.length) throw new ServiceOrderError("Algún servicio no pertenece a la empresa activa", 404)
  }

  const flowId = await prisma.$transaction(async (tx) => {
    let id = input.id
    if (id) {
      const existing = await tx.serviceFlow.findFirst({ where: { id, organizationId }, select: { id: true } })
      if (!existing) throw new ServiceOrderError("Flujo no encontrado", 404)
      await tx.serviceFlow.update({ where: { id }, data: { name, description: input.description?.trim() || null } })
    } else {
      id = (await tx.serviceFlow.create({ data: { organizationId, name, description: input.description?.trim() || null } })).id
    }
    if (input.isDefault) {
      await tx.serviceFlow.updateMany({ where: { organizationId, id: { not: id } }, data: { isDefault: false } })
      await tx.serviceFlow.update({ where: { id }, data: { isDefault: true } })
    }

    // Etapas: se conservan las que ya existen (por id) para no perder las órdenes que están en ellas.
    const current = await tx.serviceFlowStage.findMany({ where: { flowId: id }, select: { id: true } })
    const keep = new Set<string>()
    for (const [index, st] of stages.entries()) {
      const data = { label: st.label, sortOrder: index, notifyCustomer: Boolean(st.notifyCustomer || st.isReady), isReady: Boolean(st.isReady), isActive: true }
      if (st.id && current.some((c) => c.id === st.id)) {
        await tx.serviceFlowStage.update({ where: { id: st.id }, data })
        keep.add(st.id)
      } else {
        keep.add((await tx.serviceFlowStage.create({ data: { flowId: id, ...data } })).id)
      }
    }
    // Las que se quitaron: con órdenes se desactivan; sin órdenes se eliminan.
    for (const old of current.filter((c) => !keep.has(c.id))) {
      const used = await tx.serviceOrder.count({ where: { stageId: old.id } })
      if (used) await tx.serviceFlowStage.update({ where: { id: old.id }, data: { isActive: false } })
      else await tx.serviceFlowStage.delete({ where: { id: old.id } })
    }

    // Servicios del flujo: un servicio pertenece a un solo flujo.
    await tx.serviceFlowService.deleteMany({ where: { flowId: id } })
    if (productIds.length) {
      await tx.serviceFlowService.deleteMany({ where: { productId: { in: productIds }, flow: { organizationId } } })
      await tx.serviceFlowService.createMany({ data: productIds.map((productId) => ({ flowId: id!, productId })) })
    }
    return id!
  })
  const row = await prisma.serviceFlow.findUniqueOrThrow({ where: { id: flowId }, include: flowInclude })
  return flowDto(row)
}

/** Flujo de un conjunto de servicios: el del primero que pertenezca a alguno; si no, el predeterminado. */
async function flowForProducts(organizationId: string, productIds: string[]) {
  await ensureDefaultFlow(organizationId)
  for (const productId of productIds) {
    const link = await prisma.serviceFlowService.findFirst({ where: { productId, flow: { organizationId, isActive: true } }, select: { flowId: true } })
    if (link) return link.flowId
  }
  const fallback =
    (await prisma.serviceFlow.findFirst({ where: { organizationId, isActive: true, isDefault: true }, select: { id: true } })) ??
    (await prisma.serviceFlow.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } }))
  if (!fallback) throw new ServiceOrderError("No hay un flujo de servicio configurado", 409)
  return fallback.id
}

// ── Órdenes ──────────────────────────────────────────────────────────────────

const orderInclude = {
  customer: { select: { id: true, fullName: true, phone: true } },
  asset: { select: { id: true, label: true, reference: true, size: true } },
  station: { select: { id: true, name: true } },
  employee: { select: { id: true, fullName: true } },
  flow: { select: { id: true, name: true } },
  stage: { select: { id: true, label: true, isReady: true } },
  items: { select: { id: true, productName: true, variantName: true, quantity: true, unitPrice: true, lineTotal: true } },
} satisfies Prisma.ServiceOrderInclude

type OrderRow = Prisma.ServiceOrderGetPayload<{ include: typeof orderInclude }>

export interface ServiceOrderDto {
  id: string
  number: number
  status: string
  keyTag: string | null
  indications: string | null
  promisedAt: string | null
  readyAt: string | null
  deliveredAt: string | null
  createdAt: string
  total: number
  saleId: string | null
  customer: { id: string; fullName: string; phone: string | null } | null
  asset: { id: string; label: string; reference: string | null; size: string | null } | null
  station: { id: string; name: string } | null
  employee: { id: string; fullName: string } | null
  flow: { id: string; name: string }
  stage: { id: string; label: string; isReady: boolean }
  items: { id: string; productName: string; variantName: string | null; quantity: number; unitPrice: number; lineTotal: number }[]
}

const orderDto = (o: OrderRow): ServiceOrderDto => ({
  id: o.id,
  number: o.number,
  status: o.status,
  keyTag: o.keyTag,
  indications: o.indications,
  promisedAt: o.promisedAt?.toISOString() ?? null,
  readyAt: o.readyAt?.toISOString() ?? null,
  deliveredAt: o.deliveredAt?.toISOString() ?? null,
  createdAt: o.createdAt.toISOString(),
  total: Number(o.total),
  saleId: o.saleId,
  customer: o.customer,
  asset: o.asset,
  station: o.station,
  employee: o.employee,
  flow: o.flow,
  stage: o.stage,
  items: o.items.map((i) => ({ id: i.id, productName: i.productName, variantName: i.variantName, quantity: i.quantity, unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal) })),
})

type Db = Prisma.TransactionClient | typeof prisma

function addEvent(db: Db, organizationId: string, orderId: string, type: string, detail: string | null, actorUserId?: string | null) {
  return db.serviceOrderEvent.create({ data: { organizationId, orderId, type, detail: detail?.slice(0, 500) ?? null, actorUserId: actorUserId ?? null } })
}

/** Etiqueta del llavero normalizada («  a-12 » → «A-12»). */
const normKey = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase().slice(0, 20) : null)

async function assertKeyTagFree(db: Db, organizationId: string, keyTag: string, exceptOrderId?: string) {
  const clash = await db.serviceOrder.findFirst({
    where: { organizationId, keyTag, status: { in: ["open", "ready"] }, ...(exceptOrderId ? { id: { not: exceptOrderId } } : {}) },
    select: { number: true },
  })
  if (clash) throw new ServiceOrderError(`El llavero ${keyTag} ya está en uso en la orden #${clash.number}`, 409)
}

async function assertStationFree(db: Db, organizationId: string, stationId: string, exceptOrderId?: string) {
  const clash = await db.serviceOrder.findFirst({
    where: { organizationId, stationId, status: "open", ...(exceptOrderId ? { id: { not: exceptOrderId } } : {}) },
    select: { number: true, station: { select: { name: true } } },
  })
  if (clash) throw new ServiceOrderError(`${clash.station?.name ?? "Ese lugar"} está ocupado por la orden #${clash.number}`, 409)
}

export interface CreateOrderInput {
  customerId?: string | null
  assetId?: string | null
  stationId?: string | null
  employeeId?: string | null
  keyTag?: string | null
  indications?: string | null
  promisedAt?: Date | null
  items: { variantId: string; quantity?: number }[]
  locationId?: string | null
  actorUserId?: string | null
  appointmentId?: string | null
}

export async function createServiceOrder(organizationId: string, input: CreateOrderInput): Promise<ServiceOrderDto> {
  if (!input.items?.length) throw new ServiceOrderError("Elige al menos un servicio")
  if (input.items.length > 20) throw new ServiceOrderError("Demasiados servicios en una orden")

  if (input.customerId && !(await prisma.customer.findFirst({ where: { id: input.customerId, organizationId }, select: { id: true } }))) {
    throw new ServiceOrderError("Cliente no encontrado en esta empresa", 404)
  }
  if (input.assetId) {
    const asset = await prisma.customerAsset.findFirst({ where: { id: input.assetId, organizationId, isActive: true }, select: { customerId: true } })
    if (!asset) throw new ServiceOrderError("Vehículo no encontrado", 404)
    if (input.customerId && asset.customerId !== input.customerId) throw new ServiceOrderError("El vehículo no pertenece a ese cliente", 409)
  }
  if (input.stationId && !(await prisma.serviceStation.findFirst({ where: { id: input.stationId, organizationId, isActive: true }, select: { id: true } }))) {
    throw new ServiceOrderError("Lugar de atención no encontrado", 404)
  }
  if (input.employeeId && !(await prisma.employee.findFirst({ where: { id: input.employeeId, organizationId, isActive: true }, select: { id: true } }))) {
    throw new ServiceOrderError("Empleado no encontrado", 404)
  }

  // Precios y nombres salen de la base de datos, nunca del cliente.
  const variantIds = [...new Set(input.items.map((i) => i.variantId))]
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, organizationId, isActive: true, product: { isActive: true, trackInventory: false } },
    select: { id: true, name: true, price: true, product: { select: { id: true, name: true } } },
  })
  if (variants.length !== variantIds.length) throw new ServiceOrderError("Algún servicio ya no está disponible", 409)
  const byId = new Map(variants.map((v) => [v.id, v]))
  const lines = input.items.map((i) => {
    const v = byId.get(i.variantId)!
    const quantity = Math.min(99, Math.max(1, Math.floor(Number(i.quantity) || 1)))
    const unitPrice = round2(Number(v.price))
    return { variantId: v.id, productId: v.product.id, productName: v.product.name, variantName: v.name && v.name !== "Default" ? v.name : null, quantity, unitPrice, lineTotal: round2(unitPrice * quantity) }
  })
  const total = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0))

  const flowId = await flowForProducts(organizationId, lines.map((l) => l.productId))
  const firstStage = await prisma.serviceFlowStage.findFirst({ where: { flowId, isActive: true }, orderBy: { sortOrder: "asc" } })
  if (!firstStage) throw new ServiceOrderError("El flujo no tiene etapas", 409)

  const locationId =
    input.locationId ??
    (await prisma.location.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ??
    null
  const keyTag = normKey(input.keyTag)

  // El folio es consecutivo por empresa; si dos órdenes chocan en el mismo número, se reintenta.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const id = await prisma.$transaction(async (tx) => {
        if (keyTag) await assertKeyTagFree(tx, organizationId, keyTag)
        if (input.stationId) await assertStationFree(tx, organizationId, input.stationId)
        const last = await tx.serviceOrder.aggregate({ where: { organizationId }, _max: { number: true } })
        const order = await tx.serviceOrder.create({
          data: {
            organizationId,
            locationId,
            number: (last._max.number ?? 0) + 1,
            customerId: input.customerId || null,
            assetId: input.assetId || null,
            stationId: input.stationId || null,
            employeeId: input.employeeId || null,
            flowId,
            stageId: firstStage.id,
            status: firstStage.isReady ? "ready" : "open",
            readyAt: firstStage.isReady ? new Date() : null,
            keyTag,
            appointmentId: input.appointmentId ?? null,
            indications: input.indications?.trim().slice(0, 2000) || null,
            promisedAt: input.promisedAt ?? null,
            total,
            createdByUserId: input.actorUserId ?? null,
            items: { create: lines.map(({ variantId, productName, variantName, quantity, unitPrice, lineTotal }) => ({ variantId, productName, variantName, quantity, unitPrice, lineTotal })) },
          },
        })
        await addEvent(tx, organizationId, order.id, "created", `Orden #${order.number} · ${lines.map((l) => l.productName).join(", ")}`, input.actorUserId)
        return order.id
      })
      broadcastServiceOrderChange(organizationId, id, "created", input.customerId)
      return await getServiceOrder(organizationId, id)
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002" && attempt < 3) continue
      throw err
    }
  }
  throw new ServiceOrderError("No se pudo asignar el folio de la orden", 409)
}

export async function getServiceOrder(organizationId: string, id: string): Promise<ServiceOrderDto> {
  const row = await prisma.serviceOrder.findFirst({ where: { id, organizationId }, include: orderInclude })
  if (!row) throw new ServiceOrderError("Orden no encontrada", 404)
  return orderDto(row)
}

/** Tablero: órdenes abiertas o listas, y las entregadas del último día. */
export async function listServiceOrders(organizationId: string, opts: { flowId?: string | null; locationId?: string | null } = {}) {
  const since = new Date(Date.now() - 86_400_000)
  const rows = await prisma.serviceOrder.findMany({
    where: {
      organizationId,
      ...(opts.flowId ? { flowId: opts.flowId } : {}),
      ...(opts.locationId ? { locationId: opts.locationId } : {}),
      OR: [{ status: { in: ["open", "ready"] } }, { status: "delivered", deliveredAt: { gte: since } }],
    },
    include: orderInclude,
    orderBy: { createdAt: "asc" },
    take: 300,
  })
  return rows.map(orderDto)
}

export async function getServiceOrderHistory(organizationId: string, id: string) {
  const rows = await prisma.serviceOrderEvent.findMany({
    where: { organizationId, orderId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, detail: true, createdAt: true, actor: { select: { fullName: true } } },
  })
  return rows.map((r) => ({ id: r.id, type: r.type, detail: r.detail, at: r.createdAt.toISOString(), actor: r.actor?.fullName ?? null }))
}

export interface UpdateOrderInput {
  stageId?: string
  /** null = quitar el lugar. */
  stationId?: string | null
  employeeId?: string | null
  keyTag?: string | null
  indications?: string | null
  promisedAt?: Date | null
  actorUserId?: string | null
}

export async function updateServiceOrder(organizationId: string, id: string, input: UpdateOrderInput): Promise<ServiceOrderDto> {
  let notify: { customerId: string; title: string; body: string; locationId: string | null } | null = null

  await prisma.$transaction(async (tx) => {
    const order = await tx.serviceOrder.findFirst({
      where: { id, organizationId },
      include: { stage: { select: { label: true } }, asset: { select: { label: true, reference: true } } },
    })
    if (!order) throw new ServiceOrderError("Orden no encontrada", 404)
    if (order.status === "delivered" || order.status === "cancelled") throw new ServiceOrderError("La orden ya está cerrada", 409)

    const data: Prisma.ServiceOrderUncheckedUpdateInput = {}

    if (input.stationId !== undefined && input.stationId !== order.stationId) {
      if (input.stationId) {
        const station = await tx.serviceStation.findFirst({ where: { id: input.stationId, organizationId, isActive: true }, select: { name: true } })
        if (!station) throw new ServiceOrderError("Lugar de atención no encontrado", 404)
        await assertStationFree(tx, organizationId, input.stationId, id)
        await addEvent(tx, organizationId, id, "station", `Lugar: ${station.name}`, input.actorUserId)
      } else {
        await addEvent(tx, organizationId, id, "station", "Se quitó el lugar", input.actorUserId)
      }
      data.stationId = input.stationId
    }
    if (input.employeeId !== undefined && input.employeeId !== order.employeeId) {
      if (input.employeeId && !(await tx.employee.findFirst({ where: { id: input.employeeId, organizationId, isActive: true }, select: { id: true } }))) {
        throw new ServiceOrderError("Empleado no encontrado", 404)
      }
      data.employeeId = input.employeeId
    }
    if (input.keyTag !== undefined) {
      const keyTag = normKey(input.keyTag)
      if (keyTag !== order.keyTag) {
        if (keyTag) await assertKeyTagFree(tx, organizationId, keyTag, id)
        data.keyTag = keyTag
        await addEvent(tx, organizationId, id, "key", keyTag ? `Llavero ${keyTag}` : "Se quitó el llavero", input.actorUserId)
      }
    }
    if (input.indications !== undefined) data.indications = input.indications?.trim().slice(0, 2000) || null
    if (input.promisedAt !== undefined) data.promisedAt = input.promisedAt

    if (input.stageId && input.stageId !== order.stageId) {
      const stage = await tx.serviceFlowStage.findFirst({ where: { id: input.stageId, flowId: order.flowId, isActive: true } })
      if (!stage) throw new ServiceOrderError("Esa etapa no pertenece al flujo de la orden", 400)
      // Si la revisión de ingreso es obligatoria, no se sale de la primera etapa sin hacerla.
      const first = await tx.serviceFlowStage.findFirst({ where: { flowId: order.flowId, isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true } })
      if (first?.id === order.stageId) {
        const pending = await missingRequiredChecklist(organizationId, "service_order", id, "intake")
        if (pending) throw new ServiceOrderError(`Antes de avanzar completa la ${pending.toLowerCase()}`, 409)
      }
      // Reclamo atómico: si dos personas la mueven a la vez, solo una gana.
      const claimed = await tx.serviceOrder.updateMany({
        where: { id, organizationId, stageId: order.stageId, status: { in: ["open", "ready"] } },
        data: { stageId: stage.id, status: stage.isReady ? "ready" : "open", readyAt: stage.isReady ? new Date() : null },
      })
      if (claimed.count !== 1) throw new ServiceOrderError("La orden cambió mientras se movía; vuelve a intentarlo", 409)
      await addEvent(tx, organizationId, id, "stage", `${order.stage.label} → ${stage.label}`, input.actorUserId)
      // Listo = el vehículo sale del espacio de lavado: la bahía queda libre para el siguiente.
      if (stage.isReady && order.stationId && data.stationId === undefined) {
        data.stationId = null
        await addEvent(tx, organizationId, id, "station", "Bahía liberada: el vehículo está listo", input.actorUserId)
      }
      if (order.customerId && (stage.notifyCustomer || stage.isReady)) {
        const what = order.asset ? `Tu ${order.asset.label}${order.asset.reference ? ` (${order.asset.reference})` : ""}` : `Tu orden #${order.number}`
        notify = {
          customerId: order.customerId,
          title: stage.isReady ? "¡Tu servicio está listo!" : `Tu servicio: ${stage.label}`,
          body: stage.isReady ? `${what} está listo para entregar.` : `${what} pasó a «${stage.label}».`,
          locationId: order.locationId,
        }
      }
    }

    if (Object.keys(data).length) await tx.serviceOrder.update({ where: { id }, data })
  })

  const result = await getServiceOrder(organizationId, id)
  broadcastServiceOrderChange(organizationId, id, "updated", result.customer?.id)
  if (notify) {
    const n = notify as { customerId: string; title: string; body: string; locationId: string | null }
    // El aviso no frena la operación: se envía después de guardar y su resultado queda en el historial.
    void notifyCustomer({ organizationId, customerId: n.customerId, kind: "service_order", title: n.title, body: n.body, link: "/portal/vehicles", locationId: n.locationId }).then((sent) =>
      addEvent(prisma, organizationId, id, "notified", sent.length ? `Aviso al cliente (${sent.join(", ")})` : "Aviso al cliente: sin canal disponible", input.actorUserId).catch(() => undefined)
    )
  }
  return result
}

export async function cancelServiceOrder(organizationId: string, id: string, opts: { reason?: string | null; actorUserId?: string | null }) {
  const before = await prisma.serviceOrder.findFirst({ where: { id, organizationId }, select: { customerId: true } })
  const claimed = await prisma.serviceOrder.updateMany({ where: { id, organizationId, status: { in: ["open", "ready"] } }, data: { status: "cancelled", stationId: null } })
  if (claimed.count !== 1) throw new ServiceOrderError("La orden ya está cerrada o no existe", 409)
  await addEvent(prisma, organizationId, id, "cancelled", opts.reason?.trim() || "Orden cancelada", opts.actorUserId)
  broadcastServiceOrderChange(organizationId, id, "cancelled", before?.customerId)
}

/** Cobra la orden: crea UNA venta con todos sus servicios y la liga (ticket, caja y reportes). */
export async function checkoutServiceOrder(
  organizationId: string,
  id: string,
  method: $Enums.PaymentMethod,
  ctx: { userId: string; employeeId: string | null }
) {
  const order = await prisma.serviceOrder.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      number: true,
      status: true,
      locationId: true,
      customerId: true,
      appointmentId: true,
      items: { select: { variantId: true, quantity: true, variant: { select: { id: true, price: true, productId: true, product: { select: { name: true, taxRate: true } } } } } },
    },
  })
  if (!order) throw new ServiceOrderError("Orden no encontrada", 404)
  if (order.status === "delivered") throw new ServiceOrderError("La orden ya fue cobrada", 409)
  if (order.status === "cancelled") throw new ServiceOrderError("La orden está cancelada", 409)
  if (order.status !== "ready") throw new ServiceOrderError("La orden aún no está lista: avánzala a «Listo para entregar» para cobrarla", 409)
  const pendingDelivery = await missingRequiredChecklist(organizationId, "service_order", id, "delivery")
  if (pendingDelivery) throw new ServiceOrderError(`Antes de cobrar completa la ${pendingDelivery.toLowerCase()}`, 409)

  // Reclamar el cobro antes de crear la venta para que dos solicitudes no generen ventas duplicadas.
  const claimed = await prisma.serviceOrder.updateMany({ where: { id, organizationId, status: "ready" }, data: { status: "delivered", deliveredAt: new Date(), stationId: null } })
  if (claimed.count !== 1) throw new ServiceOrderError("La orden ya fue cobrada o cambió de estado", 409)

  // Se recalcula con los precios VIGENTES de la base de datos al momento de cobrar.
  const items = order.items.map((i) => {
    const price = round2(Number(i.variant.price))
    const taxRate = Number(i.variant.product.taxRate)
    const lineTotal = round2(price * i.quantity)
    return { i, price, taxRate, lineTotal, tax: round2(lineTotal * taxRate) }
  })
  const subtotal = round2(items.reduce((s, l) => s + l.lineTotal, 0))
  const tax = round2(items.reduce((s, l) => s + l.tax, 0))
  const total = round2(subtotal + tax)

  const payload: PosSalePayload = {
    items: items.map(({ i, price, taxRate, lineTotal }) => ({
      productId: i.variant.productId,
      variantId: i.variant.id,
      productType: "standard",
      productName: i.variant.product.name,
      variantName: null,
      quantity: i.quantity,
      unitId: null,
      unitPrice: price,
      totalPrice: lineTotal,
      discount: 0,
      taxRate,
      lineTotal,
      trackInventory: false,
      notes: `Orden de servicio #${order.number}`,
      extraPrice: 0,
    })),
    customerId: order.customerId ?? undefined,
    subtotal,
    discount: 0,
    tax,
    total,
    changeGiven: 0,
    pointsEarned: order.customerId ? total : 0,
    pointsRedeemed: 0,
    pointsRedeemedValue: 0,
    payments: [{ method, amount: total }],
    discounts: [],
  }

  const locationId =
    order.locationId ?? (await prisma.location.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id
  if (!locationId) {
    await prisma.serviceOrder.updateMany({ where: { id, status: "delivered", saleId: null }, data: { status: "ready", deliveredAt: null } })
    throw new ServiceOrderError("Sin sucursal configurada", 400)
  }

  let sale
  try {
    sale = await createSale(organizationId, locationId, payload, ctx)
  } catch (err) {
    await prisma.serviceOrder.updateMany({ where: { id, status: "delivered", saleId: null }, data: { status: "ready", deliveredAt: null } })
    if (err instanceof PosError) throw new ServiceOrderError(err.message, err.status)
    throw err
  }

  await prisma.serviceOrder.updateMany({ where: { id, status: "delivered", saleId: null }, data: { saleId: sale.id, total } })
  // La cita de origen queda cobrada con esta misma venta (sin duplicar ticket ni caja).
  if (order.appointmentId) {
    await prisma.appointment.updateMany({ where: { id: order.appointmentId, organizationId, saleId: null }, data: { status: "completed", saleId: sale.id } })
  }
  await addEvent(prisma, organizationId, id, "delivered", `Cobrada y entregada · venta ${sale.saleNumber}`, ctx.userId)
  broadcastServiceOrderChange(organizationId, id, "delivered", order.customerId)
  return { saleId: sale.id, saleNumber: sale.saleNumber, locationName: sale.locationName, total }
}

/**
 * «Llegó» → orden de servicio: el cliente ya se presentó, así que la cita pasa a ser una orden con su silla,
 * empleado, vehículo o ficha de estilo y las indicaciones (ficha del cliente + notas de la cita).
 */
export async function startOrderFromAppointment(organizationId: string, appointmentId: string, actorUserId?: string | null): Promise<ServiceOrderDto> {
  const ap = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId },
    select: {
      id: true, status: true, checkedInAt: true, customerId: true, assetId: true, stationId: true, employeeId: true,
      variantId: true, endsAt: true, notes: true, locationId: true,
      asset: { select: { attributes: true, notes: true } },
      serviceOrder: { select: { number: true } },
    },
  })
  if (!ap) throw new ServiceOrderError("Cita no encontrada", 404)
  if (ap.serviceOrder) throw new ServiceOrderError(`La cita ya tiene la orden #${ap.serviceOrder.number}`, 409)
  if (ap.status === "cancelled" || ap.status === "completed") throw new ServiceOrderError("La cita ya está cerrada", 409)
  if (!ap.checkedInAt) throw new ServiceOrderError("Registra primero la llegada del cliente («Llegó»)", 409)
  const indications = [formatCutIndications(ap.asset?.attributes), ap.asset?.notes, ap.notes].filter((v) => v && String(v).trim()).join("\n")
  return createServiceOrder(organizationId, {
    customerId: ap.customerId,
    assetId: ap.assetId,
    stationId: ap.stationId,
    employeeId: ap.employeeId,
    indications: indications || null,
    promisedAt: ap.endsAt,
    items: [{ variantId: ap.variantId, quantity: 1 }],
    locationId: ap.locationId,
    actorUserId,
    appointmentId: ap.id,
  })
}
