import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"

export const DEFAULT_PLAN_FEATURES = ["Punto de venta", "Panel administrativo", "Portal de clientes", "Inventario", "Reportes"]

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
  for (const row of due) {
    const remindAt = new Date(row.periodEndsAt); remindAt.setDate(remindAt.getDate() - row.reminderDaysBefore)
    if (remindAt <= now && (!row.lastReminderAt || row.lastReminderAt < remindAt)) {
      await prisma.$transaction([
        prisma.notification.create({ data: { organizationId: row.organizationId, recipientUserId: row.organization.ownerId, kind: "subscription_due", title: "Tu suscripción está por vencer", body: `${row.plan.name} vence el ${row.periodEndsAt.toLocaleDateString("es-MX")}. Registra el pago para evitar la suspensión.`, severity: "warning", link: "/admin/settings/my-plan" } }),
        prisma.organizationSubscription.update({ where: { id: row.id }, data: { lastReminderAt: now } }),
      ])
    }
  }
  const expired = await prisma.organizationSubscription.findMany({ where: { autoBlockOnPastDue: true, status: { in: ["active", "past_due"] }, periodEndsAt: { lt: now }, OR: [{ graceEndsAt: null }, { graceEndsAt: { lt: now } }] }, select: { id: true, organizationId: true } })
  if (!expired.length) return 0
  await prisma.$transaction([
    prisma.organizationSubscription.updateMany({ where: { id: { in: expired.map((row) => row.id) } }, data: { status: "suspended" } }),
    prisma.organization.updateMany({ where: { id: { in: expired.map((row) => row.organizationId) } }, data: { isBlocked: true, blockedReason: "Suscripción vencida sin pago registrado" } }),
  ])
  return expired.length
}
