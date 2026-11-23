import { prisma } from "@/lib/db"
import { hashPassword, normalizeIdentifier } from "@/lib/auth/users"

// Edición de los datos de acceso de un usuario (nombre, correo, teléfono y contraseña) por quien lo administra.
//  · Dueño/administrador de una empresa (`users.manage`): solo usuarios de SU empresa que no sean superadmin y que
//    no pertenezcan a otras empresas (si los comparte, cambiar correo o contraseña afectaría a otro negocio:
//    solo el nombre y el teléfono; el correo y la contraseña los cambia el superadmin).
//  · Superadmin: cualquier usuario.

export type UserAccountInput = { fullName?: string; email?: string; phone?: string | null; password?: string }

export class UserAccountError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export async function updateUserAccount(opts: {
  userId: string
  /** Empresa del administrador; null = superadmin (sin restricción). */
  scopeOrganizationId: string | null
  actorUserId: string | null
  input: UserAccountInput
}): Promise<{ userId: string; email: string; fullName: string; credentialsChanged: boolean }> {
  const { userId, scopeOrganizationId, actorUserId, input } = opts
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, isSuperadmin: true, activationRequired: true, memberships: { select: { organizationId: true } } },
  })
  if (!target) throw new UserAccountError("Usuario no encontrado", 404)

  const wantsCredentials = (input.email !== undefined && normalizeIdentifier(input.email) !== target.email) || Boolean(input.password)
  if (scopeOrganizationId) {
    const inOrg = target.memberships.some((m) => m.organizationId === scopeOrganizationId)
    if (!inOrg || target.isSuperadmin) throw new UserAccountError("Usuario no encontrado", 404)
    const sharedWithOthers = target.memberships.some((m) => m.organizationId !== scopeOrganizationId)
    if (wantsCredentials && sharedWithOthers) {
      throw new UserAccountError("Este usuario también pertenece a otras organizaciones: solo el superadmin puede cambiar su correo o contraseña.", 403)
    }
  }

  const data: {
    fullName?: string
    email?: string
    phone?: string | null
    passwordHash?: string
    activationRequired?: boolean
    authVersion?: { increment: number }
  } = {}
  if (input.fullName !== undefined) {
    const fullName = input.fullName.trim()
    if (!fullName) throw new UserAccountError("El nombre es obligatorio")
    if (fullName.length > 160) throw new UserAccountError("El nombre admite máximo 160 caracteres")
    data.fullName = fullName
  }
  if (input.phone !== undefined) {
    const phone = (input.phone ?? "").trim()
    if (phone && !/^[\d\s()+-]{7,20}$/.test(phone)) throw new UserAccountError("Teléfono inválido")
    data.phone = phone || null
  }
  let emailChanged = false
  if (input.email !== undefined) {
    const email = normalizeIdentifier(input.email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserAccountError("Correo inválido")
    if (email !== target.email) {
      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      if (taken && taken.id !== target.id) throw new UserAccountError("Ya existe un usuario con ese correo", 409)
      data.email = email
      emailChanged = true
    }
  }
  let passwordChanged = false
  if (input.password) {
    if (input.password.length < 8) throw new UserAccountError("La contraseña debe tener al menos 8 caracteres")
    data.passwordHash = await hashPassword(input.password)
    // Quien la define está dando acceso directo: ya no espera el enlace de activación.
    if (target.activationRequired) data.activationRequired = false
    passwordChanged = true
  }
  const credentialsChanged = emailChanged || passwordChanged
  // Cierra las sesiones abiertas del usuario (salvo la de quien se edita a sí mismo).
  if (credentialsChanged && actorUserId !== target.id) data.authVersion = { increment: 1 }

  const updated = await prisma.user.update({ where: { id: target.id }, data, select: { email: true, fullName: true } })
  return { userId: target.id, email: updated.email, fullName: updated.fullName, credentialsChanged }
}
