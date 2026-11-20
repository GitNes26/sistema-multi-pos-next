import test from "node:test"
import assert from "node:assert/strict"
import { prisma } from "../src/lib/db/client.ts"
import { saveCustomPlan, subscriptionUsage } from "../src/lib/billing/subscriptions.ts"
import { planDeniedKeys } from "../src/lib/billing/plan-permissions.ts"

// Plan Personalizado: plan propio de la empresa, fuera del catalogo, con limites y accesos libres.
test("el plan personalizado fija capacidad, precio y accesos, se reutiliza y no sale en el catalogo", async () => {
  const org = await prisma.organization.findFirst({ where: { name: "Supermercado Demo" } })
  assert.ok(org)
  const before = await prisma.organizationSubscription.findUnique({ where: { organizationId: org.id } })
  let createdPlanId = null
  try {
    const id = await saveCustomPlan(org.id, { monthlyPrice: 1234.5, locations: 7, employees: 42, permissions: ["pos.sell"] })
    createdPlanId = id
    await prisma.organizationSubscription.update({ where: { organizationId: org.id }, data: { planId: id, extraLocations: 0, extraEmployeePacks: 0 } })
    const usage = await subscriptionUsage(org.id)
    assert.equal(usage.locationLimit, 7)
    assert.equal(usage.employeeLimit, 42)
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } })
    assert.equal(plan.isCustom, true)
    assert.equal(Number(plan.monthlyPrice), 1234.5)
    assert.ok(planDeniedKeys(plan.permissions).includes("reports.view"))
    // Reutiliza el mismo plan al volver a guardar.
    const again = await saveCustomPlan(org.id, { monthlyPrice: 10, locations: 2, employees: 3, permissions: null })
    assert.equal(again, id)
    assert.equal((await prisma.subscriptionPlan.findUnique({ where: { id } })).permissions, null)
    // No aparece en el catalogo.
    const catalog = await prisma.subscriptionPlan.findMany({ where: { isActive: true, isCustom: false } })
    assert.ok(!catalog.some((p) => p.id === id))
    await assert.rejects(() => saveCustomPlan(org.id, { monthlyPrice: 1, locations: 0, employees: 1 }))
  } finally {
    if (before) await prisma.organizationSubscription.update({ where: { organizationId: org.id }, data: { planId: before.planId, extraLocations: before.extraLocations, extraEmployeePacks: before.extraEmployeePacks } })
    if (createdPlanId) await prisma.subscriptionPlan.delete({ where: { id: createdPlanId } })
    await prisma.$disconnect()
  }
})
