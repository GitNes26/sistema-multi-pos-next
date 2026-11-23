import test from "node:test"
import assert from "node:assert/strict"
import bcrypt from "bcryptjs"
import { prisma } from "../src/lib/db/client.ts"
import { updateUserAccount, UserAccountError } from "../src/lib/settings/user-account.ts"

// Edicion de usuarios: el admin de una empresa solo toca a los suyos; correo y contrasena solo si no comparte empresas.
test("editar usuario respeta el alcance de la empresa y cierra sesiones al cambiar credenciales", async () => {
  const [orgA, orgB] = await prisma.organization.findMany({ take: 2, orderBy: { createdAt: "asc" }, select: { id: true } })
  assert.ok(orgA && orgB)
  const stamp = Date.now()
  const mk = (tag) => prisma.user.create({ data: { email: `ut-${tag}-${stamp}@test.local`, fullName: `UT ${tag}`, passwordHash: "x" } })
  const solo = await mk("solo")
  const shared = await mk("shared")
  const other = await mk("other")
  const created = [solo, shared, other]
  try {
    await prisma.membership.create({ data: { userId: solo.id, organizationId: orgA.id, role: "cashier" } })
    await prisma.membership.createMany({ data: [{ userId: shared.id, organizationId: orgA.id, role: "cashier" }, { userId: shared.id, organizationId: orgB.id, role: "cashier" }] })
    await prisma.membership.create({ data: { userId: other.id, organizationId: orgB.id, role: "cashier" } })

    const ok = await updateUserAccount({ userId: solo.id, scopeOrganizationId: orgA.id, actorUserId: "actor", input: { fullName: "Nuevo Nombre", email: `UT-NEW-${stamp}@test.local`, password: "ClaveNueva123" } })
    assert.equal(ok.email, `ut-new-${stamp}@test.local`)
    assert.equal(ok.credentialsChanged, true)
    const row = await prisma.user.findUnique({ where: { id: solo.id } })
    assert.equal(row.fullName, "Nuevo Nombre")
    assert.equal(row.authVersion, 1)
    assert.ok(await bcrypt.compare("ClaveNueva123", row.passwordHash))

    // Sin cambios de credenciales no se cierran sesiones.
    await updateUserAccount({ userId: solo.id, scopeOrganizationId: orgA.id, actorUserId: "actor", input: { phone: "555 123 4567" } })
    assert.equal((await prisma.user.findUnique({ where: { id: solo.id } })).authVersion, 1)

    // Usuario de otra empresa: no existe para este admin.
    await assert.rejects(() => updateUserAccount({ userId: other.id, scopeOrganizationId: orgA.id, actorUserId: "actor", input: { fullName: "X" } }), (e) => e instanceof UserAccountError && e.status === 404)
    // Compartido: nombre si, correo/contrasena no (solo superadmin).
    await updateUserAccount({ userId: shared.id, scopeOrganizationId: orgA.id, actorUserId: "actor", input: { fullName: "Compartido" } })
    await assert.rejects(() => updateUserAccount({ userId: shared.id, scopeOrganizationId: orgA.id, actorUserId: "actor", input: { password: "OtraClave123" } }), (e) => e instanceof UserAccountError && e.status === 403)
    const asSuper = await updateUserAccount({ userId: shared.id, scopeOrganizationId: null, actorUserId: "super", input: { password: "OtraClave123" } })
    assert.equal(asSuper.credentialsChanged, true)
    // Correo repetido y contrasena corta.
    await assert.rejects(() => updateUserAccount({ userId: solo.id, scopeOrganizationId: null, actorUserId: "super", input: { email: other.email } }), (e) => e.status === 409)
    await assert.rejects(() => updateUserAccount({ userId: solo.id, scopeOrganizationId: null, actorUserId: "super", input: { password: "corta" } }), UserAccountError)
  } finally {
    await prisma.membership.deleteMany({ where: { userId: { in: created.map((u) => u.id) } } })
    await prisma.user.deleteMany({ where: { id: { in: created.map((u) => u.id) } } })
    await prisma.$disconnect()
  }
})
