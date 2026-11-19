import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import type { PermissionKey } from "@/lib/auth/permission-keys"
import { planDeniedKeys } from "@/lib/billing/plan-permissions"
import { demoLabel, monthlyCost, PERMANENT_DEMO_DAYS, daysUntil } from "@/lib/billing/demo"

/** Motivo de bloqueo cuando termina una prueba gratis sin convertirse en suscripción. */
export const DEMO_ENDED_REASON = "Tu prueba gratis terminó. Contáctanos para continuar"

export const DEFAULT_PLAN_FEATURES = ["Punto de venta", "Panel administrativo", "Portal de clientes", "Inventario", "Reportes"]

/** Permisos que el plan contratado por la empresa no incluye. */
export async function planDeniedPermissions(organizationId: string | null | undefined): Promise<PermissionKey[]> {
  if (!organizationId) return []
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    select: { plan: { select: { permissions: true } } },
  })
  return planDeniedKeys(subscription?.plan.permissions)
}

export async function subscriptionUsage(organizationId: string) {
  const [subscription, locations, employees] = await Promise.all([
    prisma.organizationSubscription.findUnique({ where: { organizationId }, include: { plan: true } }),
    prisma.location.count({ where: { organizationId, isActive: true } }),
    prisma.employee.count({ where: { organizationId, isActive: true } }),
  ])
  if (!subscription) return { subscription: null, locations, employees, locationLimit: null, employeeLimit: null }
  return {
    subscription,
    locations,
    employees,
    locationLimit: subscription.plan.includedLocations + subscription.extraLocations,
    employeeLimit: subscription.plan.includedEmployees + subscription.extraEmployeePacks * subscription.plan.extraEmployeePackSize,
  }
}

export async function assertSubscriptionCapacity(organizationId: string, resource: "locations" | "employees") {
  const usage = await subscriptionUsage(organizationId)
  if (!usage.subscription) return
  const limit = resource === "locations" ? usage.locationLimit! : usage.employeeLimit!
  const current = resource === "locations" ? usage.locations : usage.employees
  if (current >= limit) throw new CrudError(`Tu plan permite ${limit} ${resource === "locations" ? "sucursal(es)" : "empleado(s)"}. Actualiza el plan o contrata capacidad adicional.`, 409)
}

export async function syncExpiredSubscriptions(now = new Date()) {
  const reminderLimit = new Date(now); reminderLimit.setDate(reminderLimit.getDate() + 31)
  const due = await prisma.organizationSubscription.findMany({ where: { status: "active", periodEndsAt: { gte: now, lte: reminderLimit } }, include: { organization: { select: { ownerId: true } }, plan: { select: { name: true } } } })
  const reminderCopy = (row: (typeof due)[number]) =>
    row.isDemo
      ? { title: "Tu prueba gratis está por terminar", body: `Tu prueba del plan ${row.plan.name} termina el ${row.periodEndsAt.toLocaleDateString("es-MX")}. Contáctanos para continuar sin interrupciones.` }
      : { title: "Tu suscripción está por vencer", body: `${row.plan.name} vence el ${row.periodEndsAt.toLocaleDateString("es-MX")}. Registra el pago para evitar la suspensión.` }
  for (const row of due) {
    const remindAt = new Date(row.periodEndsAt); remindAt.setDate(remindAt.getDate() - row.reminderDaysBefore)
    if (remindAt <= now && (!row.lastReminderAt || row.lastReminderAt < remindAt)) {
      await prisma.$transaction([
        prisma.notification.create({ data: { organizationId: row.organizationId, recipientUserId: row.organization.ownerId, kind: "subscription_due", ...reminderCopy(row), severity: "warning", link: "/admin/settings/my-plan" } }),
        prisma.organizationSubscription.update({ where: { id: row.id }, data: { lastReminderAt: now } }),
      ])
    }
  }
  const expired = await prisma.organizationSubscription.findMany({ where: { autoBlockOnPastDue: true, status: { in: ["active", "past_due"] }, periodEndsAt: { lt: now }, OR: [{ graceEndsAt: null }, { graceEndsAt: { lt: now } }] }, select: { id: true, organizationId: true, isDemo: true } })
  if (!expired.length) return 0
  await prisma.$transaction([
    prisma.organizationSubscription.updateMany({ where: { id: { in: expired.map((row) => row.id) } }, data: { status: "suspended" } }),
    prisma.organization.updateMany({ where: { id: { in: expired.filter((row) => !row.isDemo).map((row) => row.organizationId) } }, data: { isBlocked: true, blockedReason: "Suscripción vencida sin pago registrado" } }),
    prisma.organization.updateMany({ where: { id: { in: expired.filter((row) => row.isDemo).map((row) => row.organizationId) } }, data: { isBlocked: true, blockedReason: DEMO_ENDED_REASON } }),
  ])
  return expired.length
}

/** Datos de la prueba gratis de la empresa (null si no es demo): lo que se muestra en el banner y en «Mi plan». */
export async function demoTrialInfo(organizationId: string | null | undefined) {
  if (!organizationId) return null
  const sub = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    select: { isDemo: true, periodEndsAt: true, extraLocations: true, extraEmployeePacks: true, plan: { select: { name: true, monthlyPrice: true, extraLocationPrice: true, extraEmployeePackPrice: true } } },
  })
  if (!sub?.isDemo) return null
  return {
    endsAt: sub.periodEndsAt.toISOString(),
    daysLeft: daysUntil(sub.periodEndsAt),
    permanent: daysUntil(sub.periodEndsAt) > PERMANENT_DEMO_DAYS,
    label: demoLabel(sub.periodEndsAt),
    planName: sub.plan.name,
    monthlyCost: monthlyCost(sub.plan, sub.extraLocations, sub.extraEmployeePacks),
  }
}
