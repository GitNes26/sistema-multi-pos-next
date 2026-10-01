import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { prisma } from "../../src/lib/db/client"
import snapshot from "./data/nessik-test.json"

// Empresa de pruebas "NESSIK Test" con datos listos para probar: equipo,
// catálogo completo (variantes, tópicos, recetas), inventario, proveedores,
// compras, ventas, pedidos, traslados, promociones y publicaciones.
//
// Los registros viven en `data/nessik-test.json` y CONSERVAN los ids del
// servidor: así las imágenes guardadas por carpeta de id siguen enlazadas cada
// vez que se reinicia la base o se corre este seed. Se generó con
// `scripts/extract-seed-from-dump.mjs` (sin contraseñas, tokens ni personas
// reales, y sin devoluciones: esas se prueban a mano).
//
// Es idempotente (createMany + skipDuplicates): en producción solo agrega lo
// que falta y nunca pisa lo existente. Se ejecuta en cada seed de producción
// salvo SEED_NESSIK_TEST=false.

export const NESSIK_TEST = {
  orgName: "NESSIK Test",
  password: process.env.NESSIK_TEST_PASSWORD ?? "Nessik2026!",
  owner: { email: "propietario@nessik.test", name: "Néstor Propietario", code: "NT-001" },
  worker: { email: "trabajador@nessik.test", name: "Laura Trabajadora", code: "NT-002" },
  customer: { email: "cliente@nessik.test", name: "Carlos Cliente", code: "NTC-001" },
}

export function isNessikTestEnabled() {
  return (process.env.SEED_NESSIK_TEST ?? "true").toLowerCase() !== "false"
}

const LEGAL_VERSION = "2026-09-25"

type Rows = Record<string, unknown>[]
const TABLES = snapshot.tables as unknown as Record<string, Rows>

const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.dbName ?? m.name, m]))

/** Orden de carga: primero las tablas de las que dependen las demás. */
function loadOrder(names: string[]) {
  const set = new Set(names)
  const deps = new Map<string, Set<string>>()
  for (const t of names) {
    const d = new Set<string>()
    for (const f of models.get(t)!.fields) {
      if (f.kind !== "object" || !f.relationFromFields?.length) continue
      const target = Prisma.dmmf.datamodel.models.find((x) => x.name === f.type)
      const dbName = target?.dbName ?? target?.name
      if (dbName && dbName !== t && set.has(dbName)) d.add(dbName)
    }
    deps.set(t, d)
  }
  const out: string[] = []
  const done = new Set<string>()
  while (out.length < names.length) {
    const next = names.filter((t) => !done.has(t) && [...deps.get(t)!].every((x) => done.has(x)))
    if (!next.length) throw new Error("Dependencia circular en los datos de NESSIK Test")
    for (const t of next) {
      out.push(t)
      done.add(t)
    }
  }
  return out
}

/** Valor guardado → tipo que espera Prisma. */
function coerce(type: string, value: unknown) {
  if (value === null || value === undefined) return null
  switch (type) {
    case "Int":
    case "Float":
      return Number(value)
    case "BigInt":
      return BigInt(value as string)
    case "Boolean":
      return value === true || value === 1 || value === "1"
    case "DateTime": {
      const text = String(value)
      return new Date(text.includes("T") ? text : `${text.replace(" ", "T")}Z`)
    }
    case "Json":
      return typeof value === "string" ? JSON.parse(value) : value
    default:
      return value // String, Decimal (texto) y enums
  }
}

export async function seedNessikTest() {
  const passwordHash = await bcrypt.hash(NESSIK_TEST.password, 10)
  const now = new Date()
  const access = { passwordHash, isActive: true, activationRequired: false, emailVerified: now, legalAcceptedAt: now, legalVersion: LEGAL_VERSION }

  const org = TABLES.organizations[0] as { id: string; name: string }

  // Base local anterior con la empresa bajo otros ids: no se mezcla.
  const existing = await prisma.organization.findFirst({ where: { name: org.name }, select: { id: true } })
  if (existing && existing.id !== org.id) {
    await prisma.organization.update({ where: { id: existing.id }, data: { isBlocked: false, blockedReason: null } })
    console.log("ℹ️  NESSIK Test existe con otros ids (base local anterior): no se recarga. Reinicia la base para cargar los datos con sus ids.")
    return existing.id
  }

  // Usuarios: conservan su id; si el correo ya existe se reutiliza.
  const userMap = new Map<string, string>()
  for (const u of TABLES.users as { id: string; email: string; fullName: string; isSuperadmin: unknown }[]) {
    if (u.isSuperadmin === "1" || u.isSuperadmin === 1) {
      const sa = await prisma.user.findFirst({ where: { isSuperadmin: true }, select: { id: true } })
      if (sa) userMap.set(u.id, sa.id)
      continue
    }
    const saved = await prisma.user.upsert({
      where: { email: u.email },
      update: { ...access, fullName: u.fullName },
      create: { id: u.id, email: u.email, fullName: u.fullName, ...access },
      select: { id: true },
    })
    userMap.set(u.id, saved.id)
  }

  // Unidades de medida globales: se enlazan por abreviatura.
  const unitMap = new Map<string, string>()
  const localUnits = await prisma.unitOfMeasure.findMany({ where: { organizationId: null }, select: { id: true, abbreviation: true } })
  for (const u of (snapshot as unknown as { units: { id: string; abbreviation: string }[] }).units) {
    const local = localUnits.find((x) => x.abbreviation === u.abbreviation)
    if (local) unitMap.set(u.id, local.id)
  }

  let inserted = 0
  for (const table of loadOrder(Object.keys(TABLES).filter((t) => t !== "users" && models.has(t)))) {
    const model = models.get(table)!
    const scalars = new Map(model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => [f.name, f]))
    const userFields = new Set<string>()
    const unitFields = new Set<string>()
    for (const f of model.fields) {
      if (f.kind !== "object" || !f.relationFromFields?.length) continue
      if (f.type === "User") f.relationFromFields.forEach((x) => userFields.add(x))
      if (f.type === "UnitOfMeasure") f.relationFromFields.forEach((x) => unitFields.add(x))
    }
    const data = TABLES[table].map((row) => {
      const out: Record<string, unknown> = {}
      for (const [name, field] of scalars) {
        if (!(name in row)) continue
        let value = row[name]
        if (typeof value === "string" && userFields.has(name) && userMap.has(value)) value = userMap.get(value)
        if (typeof value === "string" && unitFields.has(name) && unitMap.has(value)) value = unitMap.get(value)
        out[name] = coerce(field.type, value)
      }
      return out
    })
    const delegate = (prisma as unknown as Record<string, { createMany: (a: unknown) => Promise<{ count: number }> }>)[model.name.charAt(0).toLowerCase() + model.name.slice(1)]
    inserted += (await delegate.createMany({ data, skipDuplicates: true })).count
  }

  await prisma.organization.update({ where: { id: org.id }, data: { isBlocked: false, blockedReason: null } })

  // Suscripción vigente (plan más alto) para que no se bloquee.
  const plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "desc" } })
  if (plan && !(await prisma.organizationSubscription.findUnique({ where: { organizationId: org.id } }))) {
    await prisma.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: "active",
        periodEndsAt: new Date("2099-12-31T23:59:59.000Z"),
        extraLocations: 10,
        extraEmployeePacks: 10,
        autoBlockOnPastDue: false,
        notes: "Empresa de pruebas NESSIK",
      },
    })
  }

  console.log(`✅ NESSIK Test: ${inserted} registros nuevos cargados con los ids del servidor`)
  return org.id
}
