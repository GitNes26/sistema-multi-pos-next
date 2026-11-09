import { prisma } from "@/lib/db"
import { presetByKey } from "@/lib/loyalty/presets"
import { saveLoyaltyProgram } from "@/lib/loyalty/server"
import { BUSINESS_TEMPLATES, templateByKey, type BusinessTemplate } from "./definitions"

export class TemplateError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export interface TemplateStatus extends BusinessTemplate {
  /** ¿Aplica al modo de negocio de la empresa? */
  available: boolean
  /** ¿Ya existe todo lo que crea? */
  applied: boolean
}

export async function listTemplates(organizationId: string): Promise<TemplateStatus[]> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } })
  const mode = org?.businessMode ?? "retail"
  const [products, policy] = await Promise.all([
    prisma.product.findMany({ where: { organizationId }, select: { name: true } }),
    prisma.rentalPolicy.findUnique({ where: { organizationId }, select: { organizationId: true } }),
  ])
  const names = new Set(products.map((p) => p.name))
  return BUSINESS_TEMPLATES.map((t) => ({
    ...t,
    available: t.modes.includes(mode),
    applied: t.rentalPolicy ? Boolean(policy) : t.services.every((s) => names.has(s.name)),
  }))
}

/**
 * Aplica una plantilla: crea solo lo que falta (por nombre) y devuelve lo creado y lo que ya existía, así que se
 * puede repetir sin duplicar nada ni pisar lo que el dueño ya editó.
 */
export async function applyBusinessTemplate(organizationId: string, key: string): Promise<{ created: string[]; existing: string[] }> {
  const template = templateByKey(key)
  if (!template) throw new TemplateError("Plantilla no encontrada", 404)
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } })
  if (!org) throw new TemplateError("Empresa no encontrada", 404)
  if (!template.modes.includes(org.businessMode)) {
    throw new TemplateError(`La plantilla «${template.label}» no aplica al tipo de negocio de tu empresa.`, 409)
  }
  const created: string[] = []
  const existing: string[] = []
  const location = await prisma.location.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } })

  // Servicios de ejemplo (sin inventario)
  const productIds: string[] = []
  for (const svc of template.services) {
    const found = await prisma.product.findFirst({ where: { organizationId, name: svc.name }, select: { id: true } })
    if (found) {
      existing.push(`Servicio «${svc.name}»`)
      productIds.push(found.id)
      continue
    }
    const p = await prisma.product.create({ data: { organizationId, name: svc.name, trackInventory: false, variants: { create: { organizationId, name: "Default", price: svc.price } } } })
    productIds.push(p.id)
    created.push(`Servicio «${svc.name}» ($${svc.price})`)
  }

  // Lugares de atención
  if (template.stations) {
    for (let i = 1; i <= template.stations.count; i++) {
      const name = `${template.stations.prefix} ${i}`
      if (await prisma.serviceStation.findFirst({ where: { organizationId, name }, select: { id: true } })) {
        existing.push(name)
        continue
      }
      await prisma.serviceStation.create({ data: { organizationId, locationId: location?.id ?? null, name, kind: template.stations.kind, sortOrder: i } })
      created.push(name)
    }
  }

  // Flujo por etapas con los servicios de la plantilla
  if (template.flow) {
    const flow = await prisma.serviceFlow.findFirst({ where: { organizationId, name: template.flow.name }, select: { id: true } })
    if (flow) existing.push(`Flujo «${template.flow.name}»`)
    else {
      await prisma.serviceFlow.create({
        data: {
          organizationId,
          name: template.flow.name,
          stages: { create: template.flow.stages.map((s, i) => ({ label: s.label, sortOrder: i, notifyCustomer: Boolean(s.notifyCustomer), isReady: Boolean(s.isReady) })) },
          services: { create: productIds.map((productId) => ({ productId })) },
        },
      })
      created.push(`Flujo «${template.flow.name}»`)
    }
  }

  // Programa de fidelidad desde la opción precargada
  const preset = presetByKey(template.loyaltyPresetKey)
  if (preset) {
    if (await prisma.loyaltyProgram.findFirst({ where: { organizationId, presetKey: preset.key }, select: { id: true } })) existing.push(`Programa «${preset.name}»`)
    else {
      await saveLoyaltyProgram(organizationId, { kind: preset.kind, presetKey: preset.key, name: preset.name, visitsRequired: preset.visitsRequired, discountPercent: preset.discountPercent, targetProductIds: productIds })
      created.push(`Programa de fidelidad «${preset.name}»`)
    }
  }

  // Política de renta (solo si la empresa aún no tiene una)
  if (template.rentalPolicy) {
    if (await prisma.rentalPolicy.findUnique({ where: { organizationId }, select: { organizationId: true } })) existing.push("Política de renta")
    else {
      await prisma.rentalPolicy.create({ data: { organizationId, ...template.rentalPolicy } })
      created.push("Política de renta")
    }
  }
  return { created, existing }
}
