import { prisma } from "@/lib/db"
import { nextCustomerCode } from "@/lib/crud/modules/customers"
import { setMembership } from "@/lib/auth/users"

/**
 * Liga una cuenta (User) con un negocio como cliente. La cuenta es compartida entre
 * negocios, pero todo lo que genera (pedidos, puntos, crédito, listas, favoritos,
 * ventas) queda en el Customer de ese negocio, con su propio número de cliente.
 */
export async function joinBusiness(userId: string, organizationId: string) {
  const [user, org] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true, isActive: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, isBlocked: true } }),
  ])
  if (!user || !user.isActive) throw new Error("Cuenta no disponible")
  if (!org || org.isBlocked) throw new Error("Este negocio no está disponible")

  const existing = await prisma.customer.findUnique({ where: { organizationId_userId: { organizationId, userId } } })
  if (existing) {
    if (!existing.isActive) await prisma.customer.update({ where: { id: existing.id }, data: { isActive: true } })
    return existing
  }

  // El teléfono es único por negocio: si ya lo usa otro cliente se omite en este alta.
  const phoneTaken = user.phone ? await prisma.customer.findFirst({ where: { organizationId, phone: user.phone }, select: { id: true } }) : null
  const hasMembership = await prisma.membership.findFirst({ where: { userId, organizationId }, select: { id: true } })
  if (!hasMembership) await setMembership(userId, organizationId, "customer")

  // Reintenta si dos altas simultáneas toman el mismo número consecutivo.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.customer.create({
        data: {
          organizationId,
          userId,
          customerCode: await nextCustomerCode(organizationId),
          fullName: user.fullName,
          phone: phoneTaken ? null : user.phone,
          email: user.email.endsWith("@portal.local") ? null : user.email,
          imageUrl: user.avatarUrl,
          isActive: true,
        },
      })
    } catch (err) {
      if (attempt === 2) throw err
    }
  }
  throw new Error("No se pudo registrar el cliente")
}
