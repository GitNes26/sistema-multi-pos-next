import { prisma } from "@/lib/db"

// Listas de revisión: puntos a verificar al recibir (daños previos, objetos en el vehículo) y al entregar.
// Una lista por empresa, tipo de objeto y fase. Cada revisión guarda el texto de cada punto tal como se
// revisó, con su estado, nota y foto, aunque la lista cambie después. Sirve a órdenes de servicio y, con
// el mismo motor, a las rentas (entrega y devolución).

export class ChecklistError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const SUBJECT_TYPES = ["service_order", "reservation"] as const
export const PHASES = ["intake", "delivery", "return"] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]
export type Phase = (typeof PHASES)[number]
export const PHASE_LABEL: Record<Phase, string> = { intake: "ingreso", delivery: "entrega", return: "devolución" }

const isSubject = (v: unknown): v is SubjectType => SUBJECT_TYPES.includes(v as SubjectType)
const isPhase = (v: unknown): v is Phase => PHASES.includes(v as Phase)

export interface TemplateDto {
  id: string
  subjectType: string
  phase: string
  name: string
  isRequired: boolean
  items: { id: string; label: string; requirePhoto: boolean }[]
}

const templateInclude = { items: { orderBy: { sortOrder: "asc" as const } } }

type TemplateRow = NonNullable<Awaited<ReturnType<typeof findTemplate>>>
function findTemplate(organizationId: string, subjectType: string, phase: string) {
  return prisma.checklistTemplate.findFirst({ where: { organizationId, subjectType, phase, isActive: true }, include: templateInclude })
}
const dto = (t: TemplateRow): TemplateDto => ({
  id: t.id,
  subjectType: t.subjectType,
  phase: t.phase,
  name: t.name,
  isRequired: t.isRequired,
  items: t.items.map((i) => ({ id: i.id, label: i.label, requirePhoto: i.requirePhoto })),
})

export async function listTemplates(organizationId: string, subjectType: string): Promise<TemplateDto[]> {
  if (!isSubject(subjectType)) throw new ChecklistError("Tipo de revisión no válido")
  const rows = await prisma.checklistTemplate.findMany({ where: { organizationId, subjectType, isActive: true }, include: templateInclude, orderBy: { phase: "asc" } })
  return rows.map(dto)
}

export interface TemplateInput {
  subjectType: string
  phase: string
  name?: string
  isRequired?: boolean
  items: { label: string; requirePhoto?: boolean }[]
}

/** Crea o reemplaza la lista de una fase. Sin puntos, la desactiva (la fase queda sin lista). */
export async function saveTemplate(organizationId: string, input: TemplateInput): Promise<TemplateDto | null> {
  if (!isSubject(input.subjectType)) throw new ChecklistError("Tipo de revisión no válido")
  if (!isPhase(input.phase)) throw new ChecklistError("Fase no válida")
  const items = (input.items ?? []).map((i) => ({ label: String(i.label ?? "").trim().slice(0, 120), requirePhoto: i.requirePhoto !== false })).filter((i) => i.label)
  if (items.length > 30) throw new ChecklistError("Máximo 30 puntos por lista")
  const name = input.name?.trim().slice(0, 80) || `Revisión de ${PHASE_LABEL[input.phase]}`

  if (items.length === 0) {
    await prisma.checklistTemplate.updateMany({ where: { organizationId, subjectType: input.subjectType, phase: input.phase }, data: { isActive: false, isRequired: false } })
    return null
  }
  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.checklistTemplate.findUnique({ where: { organizationId_subjectType_phase: { organizationId, subjectType: input.subjectType, phase: input.phase } } })
    const template = existing
      ? await tx.checklistTemplate.update({ where: { id: existing.id }, data: { name, isRequired: Boolean(input.isRequired), isActive: true } })
      : await tx.checklistTemplate.create({ data: { organizationId, subjectType: input.subjectType, phase: input.phase, name, isRequired: Boolean(input.isRequired) } })
    await tx.checklistTemplateItem.deleteMany({ where: { templateId: template.id } })
    await tx.checklistTemplateItem.createMany({ data: items.map((i, sortOrder) => ({ templateId: template.id, label: i.label, requirePhoto: i.requirePhoto, sortOrder })) })
    return template.id
  })
  return dto((await prisma.checklistTemplate.findUnique({ where: { id: saved }, include: templateInclude }))!)
}

export interface RunDto {
  id: string
  phase: string
  notes: string | null
  createdAt: string
  createdBy: string | null
  items: { label: string; status: string; note: string | null; photoUrl: string | null }[]
}

/** Última revisión de cada fase del objeto. */
export async function latestRuns(organizationId: string, subjectType: string, subjectId: string): Promise<Record<string, RunDto>> {
  const rows = await prisma.checklistRun.findMany({
    where: { organizationId, subjectType, subjectId },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { sortOrder: "asc" } }, createdBy: { select: { fullName: true } } },
  })
  const out: Record<string, RunDto> = {}
  for (const r of rows) {
    if (out[r.phase]) continue
    out[r.phase] = {
      id: r.id,
      phase: r.phase,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy?.fullName ?? null,
      items: r.items.map((i) => ({ label: i.label, status: i.status, note: i.note, photoUrl: i.photoUrl })),
    }
  }
  return out
}

export interface RunInput {
  subjectType: string
  subjectId: string
  phase: string
  notes?: string | null
  items: { label: string; status: string; note?: string | null; photoUrl?: string | null }[]
  actorUserId?: string | null
}

const STATUSES = ["ok", "issue", "na"]

/** Guarda una revisión validada contra la lista vigente: todos los puntos, y foto donde se exige. */
export async function saveRun(organizationId: string, input: RunInput): Promise<{ id: string; issues: number }> {
  if (!isSubject(input.subjectType)) throw new ChecklistError("Tipo de revisión no válido")
  if (!isPhase(input.phase)) throw new ChecklistError("Fase no válida")
  const template = await findTemplate(organizationId, input.subjectType, input.phase)
  if (!template) throw new ChecklistError(`No hay lista de revisión de ${PHASE_LABEL[input.phase]} configurada`, 404)

  const byLabel = new Map((input.items ?? []).map((i) => [String(i.label), i]))
  const rows = template.items.map((tpl, sortOrder) => {
    const given = byLabel.get(tpl.label)
    if (!given || !STATUSES.includes(given.status)) throw new ChecklistError(`Falta revisar: ${tpl.label}`)
    const photoUrl = typeof given.photoUrl === "string" && given.photoUrl.trim() ? given.photoUrl.trim().slice(0, 500) : null
    if (given.status === "issue" && tpl.requirePhoto && !photoUrl) throw new ChecklistError(`Agrega una foto del problema: ${tpl.label}`)
    return { label: tpl.label, status: given.status, note: given.note?.trim().slice(0, 300) || null, photoUrl, sortOrder }
  })
  const run = await prisma.checklistRun.create({
    data: {
      organizationId,
      templateId: template.id,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      phase: input.phase,
      notes: input.notes?.trim().slice(0, 2000) || null,
      createdByUserId: input.actorUserId ?? null,
      items: { create: rows },
    },
  })
  return { id: run.id, issues: rows.filter((r) => r.status === "issue").length }
}

/** Nombre de la lista obligatoria que aún no se completó para esa fase (o null si no hay pendiente). */
export async function missingRequiredChecklist(organizationId: string, subjectType: SubjectType, subjectId: string, phase: Phase): Promise<string | null> {
  const template = await prisma.checklistTemplate.findFirst({ where: { organizationId, subjectType, phase, isActive: true, isRequired: true }, select: { name: true } })
  if (!template) return null
  const done = await prisma.checklistRun.count({ where: { organizationId, subjectType, subjectId, phase } })
  return done ? null : template.name
}
