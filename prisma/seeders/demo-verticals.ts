import { prisma } from "../../src/lib/db/client"
import { saveLoyaltyProgram } from "../../src/lib/loyalty/server"
import { applyBusinessTemplate } from "../../src/lib/templates/server"
import { saveWarrantyRule } from "../../src/lib/warranty/server"

// Datos demo de los verticales (autolavado, barbería, renta, fidelidad y garantías) para recorrer sus pantallas en la
// empresa «Híbrido Demo». Es idempotente: se puede correr varias veces sin duplicar nada.

const DEMO_ORG_NAME = "Híbrido Demo"
const FEE_NAME = "Membresía mensual de lavados"

export interface VerticalsDemoSummary {
  organizationId: string | null
  created: string[]
}

export async function seedVerticalsDemo(): Promise<VerticalsDemoSummary> {
  const org = await prisma.organization.findFirst({ where: { name: DEMO_ORG_NAME }, select: { id: true } })
  if (!org) return { organizationId: null, created: [] }
  const organizationId = org.id
  const created: string[] = []

  // Plantillas (servicios de ejemplo, bahías, sillas, flujo, tarjeta de visitas y política de renta)
  for (const key of ["carwash", "barber", "rental"]) {
    const result = await applyBusinessTemplate(organizationId, key)
    created.push(...result.created)
  }

  const services = await prisma.product.findMany({ where: { organizationId, name: { in: ["Lavado básico", "Lavado completo", "Encerado"] } }, select: { id: true, name: true } })
  const byName = new Map(services.map((s) => [s.name, s.id]))

  // Membresía mensual: la cuota es un producto del catálogo
  let fee = await prisma.product.findFirst({ where: { organizationId, name: FEE_NAME }, select: { id: true } })
  if (!fee) {
    fee = await prisma.product.create({ data: { organizationId, name: FEE_NAME, trackInventory: false, variants: { create: { organizationId, name: "Default", price: 400 } } }, select: { id: true } })
    created.push(`Producto «${FEE_NAME}» ($400)`)
  }
  let program = await prisma.loyaltyProgram.findFirst({ where: { organizationId, kind: "membership", packProductId: fee.id }, select: { id: true } })
  if (!program) {
    program = await saveLoyaltyProgram(organizationId, {
      kind: "membership", presetKey: "member_4", name: "Membresía mensual: 4 lavados al mes", packUses: 4, packProductId: fee.id,
      targetProductIds: [...byName.values()], periodDays: 30, rollover: false, reminderDays: 3,
      terms: "Los lavados incluidos se renuevan al pagar la cuota del mes. Los lavados sin usar no se acumulan. La membresía es personal e intransferible.",
    })
    created.push("Membresía «4 lavados al mes»")
  }

  // Garantía: si llueve el mismo día, el lavado exterior (aquí, el básico) se repite sin costo
  if (!(await prisma.warrantyRule.findFirst({ where: { organizationId, presetKey: "rain_same_day" }, select: { id: true } }))) {
    await saveWarrantyRule(organizationId, {
      presetKey: "rain_same_day", name: "Lluvia el mismo día",
      appliesToProductIds: [byName.get("Lavado básico"), byName.get("Lavado completo")].filter(Boolean),
      coversProductIds: [byName.get("Lavado básico")].filter(Boolean), windowHours: 24, sameDayOnly: true, discountPercent: 100,
    })
    created.push("Garantía «Lluvia el mismo día»")
  }

  // Un cliente del portal con membresía vigente para ver el detalle (vence en 20 días, 3 lavados disponibles)
  const customerUser = await prisma.user.findFirst({ where: { email: "hcli-001@hibrido.local" }, select: { id: true } })
  const customer = customerUser ? await prisma.customer.findFirst({ where: { organizationId, userId: customerUser.id }, select: { id: true } }) : null
  if (customer) {
    const existing = await prisma.loyaltyCard.findUnique({ where: { customerId_programId: { customerId: customer.id, programId: program.id } } })
    if (!existing) {
      const now = Date.now()
      await prisma.loyaltyCard.create({
        data: { organizationId, customerId: customer.id, programId: program.id, credits: 3, startedAt: new Date(now - 10 * 86_400_000), expiresAt: new Date(now + 20 * 86_400_000) },
      })
      created.push("Membresía vigente del cliente demo hcli-001")
    }
  }
  return { organizationId, created }
}
