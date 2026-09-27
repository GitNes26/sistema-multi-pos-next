import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import {
  computePay,
  DEFAULT_WORK_DAYS,
  periodDays,
  scheduledDays,
  type ConceptLine,
  type PayCapture,
  type PayConditions,
} from "@/lib/payroll/calc"

// Nómina ligera: configuración de pago por empleado, conceptos
// configurables, periodos con captura manual y recibos.

const num = (v: unknown) => (v == null ? 0 : Number(v))
const dateOnly = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new CrudError("Fecha inválida", 400)
  return new Date(`${s}T00:00:00.000Z`)
}
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const lines = (v: unknown): Omit<ConceptLine, "amount">[] =>
  Array.isArray(v)
    ? v
        .map((x) => x as Record<string, unknown>)
        .map((x) => ({ name: String(x.name ?? "").slice(0, 80), calc: x.calc === "percent" ? ("percent" as const) : ("fixed" as const), value: Math.max(0, num(x.value)) }))
        .filter((x) => x.name.trim())
    : []

const employeeSelect = {
  id: true,
  fullName: true,
  employeeCode: true,
  imageUrl: true,
  isActive: true,
  salaryType: true,
  salaryAmount: true,
  paymentFrequency: true,
  workDays: true,
  shiftStart: true,
  shiftEnd: true,
  dailyHours: true,
  overtimeRate: true,
  holidayRate: true,
  restDayRate: true,
  commissionRate: true,
  receivesTips: true,
  payMethod: true,
  position: { select: { name: true } },
  location: { select: { name: true } },
  user: { select: { email: true } },
} satisfies Prisma.EmployeeSelect

type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>

function workDaysOf(e: { workDays: unknown }): number[] {
  return Array.isArray(e.workDays) ? (e.workDays as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6) : DEFAULT_WORK_DAYS
}

function serializeEmployee(e: EmployeeRow) {
  return {
    id: e.id,
    fullName: e.fullName,
    employeeCode: e.employeeCode,
    imageUrl: e.imageUrl,
    isActive: e.isActive,
    email: e.user?.email ?? null,
    position: e.position?.name ?? null,
    location: e.location?.name ?? null,
    salaryType: e.salaryType,
    salaryAmount: num(e.salaryAmount),
    paymentFrequency: e.paymentFrequency,
    workDays: workDaysOf(e),
    shiftStart: e.shiftStart,
    shiftEnd: e.shiftEnd,
    dailyHours: num(e.dailyHours),
    overtimeRate: num(e.overtimeRate),
    holidayRate: num(e.holidayRate),
    restDayRate: num(e.restDayRate),
    commissionRate: num(e.commissionRate),
    receivesTips: e.receivesTips,
    payMethod: e.payMethod,
  }
}

const conditions = (e: EmployeeRow): PayConditions => ({
  salaryType: e.salaryType,
  salaryAmount: num(e.salaryAmount),
  dailyHours: num(e.dailyHours),
  overtimeRate: num(e.overtimeRate),
  holidayRate: num(e.holidayRate),
  restDayRate: num(e.restDayRate),
  commissionRate: num(e.commissionRate),
})

export async function payrollWorkspace(organizationId: string) {
  const [employees, concepts, periods] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId, isActive: true }, select: employeeSelect, orderBy: { fullName: "asc" } }),
    prisma.payrollConcept.findMany({ where: { organizationId, isActive: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.payrollPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: "desc" },
      take: 60,
      include: { entries: { select: { netPay: true, grossPay: true, paidAt: true } } },
    }),
  ])
  return {
    employees: employees.map(serializeEmployee),
    concepts: concepts.map((c) => ({ id: c.id, name: c.name, kind: c.kind, calc: c.calc, amount: num(c.amount) })),
    periods: periods.map((p) => ({
      id: p.id,
      folio: p.folio,
      frequency: p.frequency,
      startDate: isoDate(p.startDate),
      endDate: isoDate(p.endDate),
      status: p.status,
      employees: p.entries.length,
      gross: p.entries.reduce((s, e) => s + num(e.grossPay), 0),
      net: p.entries.reduce((s, e) => s + num(e.netPay), 0),
      paid: p.entries.filter((e) => e.paidAt).length,
      createdAt: p.createdAt.toISOString(),
    })),
  }
}

export async function updateEmployeePay(organizationId: string, employeeId: string, input: Record<string, unknown>) {
  const e = await prisma.employee.findFirst({ where: { id: employeeId, organizationId }, select: { id: true } })
  if (!e) throw new CrudError("Empleado no encontrado", 404)
  const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null)
  const rate = (v: unknown, max = 10) => Math.min(max, Math.max(0, num(v)))
  const salaryTypes = ["monthly", "weekly", "daily", "hourly", "commission", ""]
  const data: Prisma.EmployeeUpdateInput = {
    ...(input.salaryType !== undefined ? { salaryType: salaryTypes.includes(String(input.salaryType)) ? String(input.salaryType) : "" } : {}),
    ...(input.salaryAmount !== undefined ? { salaryAmount: Math.max(0, num(input.salaryAmount)) } : {}),
    ...(input.paymentFrequency !== undefined ? { paymentFrequency: ["weekly", "biweekly", "monthly"].includes(String(input.paymentFrequency)) ? String(input.paymentFrequency) : "biweekly" } : {}),
    ...(input.workDays !== undefined ? { workDays: Array.isArray(input.workDays) ? [...new Set((input.workDays as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6))].sort() : DEFAULT_WORK_DAYS } : {}),
    ...(input.shiftStart !== undefined ? { shiftStart: time(input.shiftStart) } : {}),
    ...(input.shiftEnd !== undefined ? { shiftEnd: time(input.shiftEnd) } : {}),
    ...(input.dailyHours !== undefined ? { dailyHours: Math.min(24, Math.max(1, num(input.dailyHours) || 8)) } : {}),
    ...(input.overtimeRate !== undefined ? { overtimeRate: rate(input.overtimeRate) } : {}),
    ...(input.holidayRate !== undefined ? { holidayRate: rate(input.holidayRate) } : {}),
    ...(input.restDayRate !== undefined ? { restDayRate: rate(input.restDayRate) } : {}),
    ...(input.commissionRate !== undefined ? { commissionRate: rate(input.commissionRate, 100) } : {}),
    ...(input.receivesTips !== undefined ? { receivesTips: input.receivesTips === true } : {}),
    ...(input.payMethod !== undefined ? { payMethod: ["cash", "transfer", "check"].includes(String(input.payMethod)) ? String(input.payMethod) : "cash" } : {}),
  }
  const updated = await prisma.employee.update({ where: { id: employeeId }, data, select: employeeSelect })
  return serializeEmployee(updated)
}

export async function saveConcept(organizationId: string, input: Record<string, unknown>) {
  const name = String(input.name ?? "").trim()
  if (!name) throw new CrudError("Escribe el nombre del concepto", 400, "name")
  const data = {
    name: name.slice(0, 80),
    kind: input.kind === "deduction" ? "deduction" : "perception",
    calc: input.calc === "percent" ? "percent" : "fixed",
    amount: Math.max(0, num(input.amount)),
  }
  if (input.calc === "percent" && data.amount > 100) throw new CrudError("El porcentaje no puede ser mayor a 100", 400, "amount")
  if (input.id) {
    const found = await prisma.payrollConcept.findFirst({ where: { id: String(input.id), organizationId } })
    if (!found) throw new CrudError("Concepto no encontrado", 404)
    return prisma.payrollConcept.update({ where: { id: found.id }, data })
  }
  return prisma.payrollConcept.create({ data: { organizationId, ...data } })
}

export async function deleteConcept(organizationId: string, id: string) {
  await prisma.payrollConcept.updateMany({ where: { id, organizationId }, data: { isActive: false } })
  return { ok: true }
}

/** Ventas y propinas del empleado en el periodo (ventas completadas). */
async function salesOf(organizationId: string, employeeIds: string[], start: Date, end: Date) {
  const endExclusive = new Date(end.getTime() + 86400000)
  const rows = await prisma.sale.groupBy({
    by: ["employeeId"],
    where: { organizationId, employeeId: { in: employeeIds }, status: "completed", createdAt: { gte: start, lt: endExclusive } },
    _sum: { total: true, tip: true },
  })
  return new Map(rows.map((r) => [r.employeeId, { total: num(r._sum.total), tips: num(r._sum.tip) }]))
}

function entryData(e: EmployeeRow, cap: PayCapture, days: number) {
  const pay = computePay(conditions(e), cap, days)
  return {
    salaryType: e.salaryType,
    salaryAmount: num(e.salaryAmount),
    dailyRate: pay.dailyRate,
    hourlyRate: pay.hourlyRate,
    daysWorked: cap.daysWorked,
    hoursWorked: cap.hoursWorked,
    absences: cap.absences,
    overtimeHours: cap.overtimeHours,
    holidayDays: cap.holidayDays,
    restDaysWorked: cap.restDaysWorked,
    salesTotal: cap.salesTotal,
    basePay: pay.basePay,
    overtimePay: pay.overtimePay,
    holidayPay: pay.holidayPay,
    restDayPay: pay.restDayPay,
    commissionPay: pay.commissionPay,
    tips: pay.tips,
    perceptions: pay.perceptions as unknown as Prisma.InputJsonValue,
    deductions: pay.deductions as unknown as Prisma.InputJsonValue,
    grossPay: pay.grossPay,
    totalDeductions: pay.totalDeductions,
    netPay: pay.netPay,
  }
}

export async function createPeriod(
  organizationId: string,
  userId: string,
  input: { frequency?: string; startDate: string; endDate: string; holidays?: string[]; employeeIds?: string[]; notes?: string }
) {
  const start = dateOnly(input.startDate)
  const end = dateOnly(input.endDate)
  if (end < start) throw new CrudError("La fecha final debe ser posterior a la inicial", 400, "endDate")
  const days = periodDays(input.startDate, input.endDate)
  if (days > 62) throw new CrudError("El periodo no puede pasar de 62 días", 400, "endDate")
  const holidays = (input.holidays ?? []).filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h) && h >= input.startDate && h <= input.endDate)

  const employees = await prisma.employee.findMany({
    where: { organizationId, isActive: true, ...(input.employeeIds?.length ? { id: { in: input.employeeIds } } : {}) },
    select: employeeSelect,
  })
  if (!employees.length) throw new CrudError("No hay empleados activos para esta nómina", 400)
  const [concepts, sales, count] = await Promise.all([
    prisma.payrollConcept.findMany({ where: { organizationId, isActive: true } }),
    salesOf(organizationId, employees.map((e) => e.id), start, end),
    prisma.payrollPeriod.count({ where: { organizationId } }),
  ])
  const perceptions = concepts.filter((c) => c.kind === "perception").map((c) => ({ name: c.name, calc: c.calc as "fixed" | "percent", value: num(c.amount) }))
  const deductions = concepts.filter((c) => c.kind === "deduction").map((c) => ({ name: c.name, calc: c.calc as "fixed" | "percent", value: num(c.amount) }))

  const period = await prisma.payrollPeriod.create({
    data: {
      organizationId,
      folio: `N-${String(count + 1).padStart(4, "0")}`,
      frequency: ["weekly", "biweekly", "monthly"].includes(String(input.frequency)) ? String(input.frequency) : "custom",
      startDate: start,
      endDate: end,
      holidays,
      notes: input.notes?.trim() || null,
      createdById: userId,
      entries: {
        create: employees.map((e) => {
          const wd = workDaysOf(e)
          const scheduled = scheduledDays(input.startDate, input.endDate, wd)
          // Festivos que caen en día laborable: por defecto se asume que se trabajaron (se pueden quitar).
          const holidayOnWorkday = holidays.filter((h) => wd.includes(new Date(`${h}T12:00:00`).getDay())).length
          const s = sales.get(e.id)
          const cap: PayCapture = {
            daysWorked: scheduled,
            hoursWorked: Math.round(scheduled * num(e.dailyHours) * 100) / 100,
            absences: 0,
            overtimeHours: 0,
            holidayDays: holidayOnWorkday,
            restDaysWorked: 0,
            salesTotal: s?.total ?? 0,
            tips: e.receivesTips ? (s?.tips ?? 0) : 0,
            perceptions,
            deductions,
          }
          return { organizationId, employeeId: e.id, payMethod: e.payMethod, ...entryData(e, cap, days) }
        }),
      },
    },
  })
  return { id: period.id, folio: period.folio }
}

export async function getPeriod(organizationId: string, id: string) {
  const p = await prisma.payrollPeriod.findFirst({
    where: { id, organizationId },
    include: { entries: { include: { employee: { select: employeeSelect } }, orderBy: { employee: { fullName: "asc" } } } },
  })
  if (!p) throw new CrudError("Nómina no encontrada", 404)
  return {
    id: p.id,
    folio: p.folio,
    frequency: p.frequency,
    startDate: isoDate(p.startDate),
    endDate: isoDate(p.endDate),
    days: periodDays(isoDate(p.startDate), isoDate(p.endDate)),
    holidays: (Array.isArray(p.holidays) ? p.holidays : []) as string[],
    status: p.status,
    notes: p.notes,
    closedAt: p.closedAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
    entries: p.entries.map((e) => ({
      id: e.id,
      employee: serializeEmployee(e.employee),
      salaryType: e.salaryType,
      salaryAmount: num(e.salaryAmount),
      dailyRate: num(e.dailyRate),
      hourlyRate: num(e.hourlyRate),
      daysWorked: num(e.daysWorked),
      hoursWorked: num(e.hoursWorked),
      absences: num(e.absences),
      overtimeHours: num(e.overtimeHours),
      holidayDays: num(e.holidayDays),
      restDaysWorked: num(e.restDaysWorked),
      salesTotal: num(e.salesTotal),
      basePay: num(e.basePay),
      overtimePay: num(e.overtimePay),
      holidayPay: num(e.holidayPay),
      restDayPay: num(e.restDayPay),
      commissionPay: num(e.commissionPay),
      tips: num(e.tips),
      perceptions: (Array.isArray(e.perceptions) ? e.perceptions : []) as unknown as ConceptLine[],
      deductions: (Array.isArray(e.deductions) ? e.deductions : []) as unknown as ConceptLine[],
      grossPay: num(e.grossPay),
      totalDeductions: num(e.totalDeductions),
      netPay: num(e.netPay),
      payMethod: e.payMethod,
      notes: e.notes,
      paidAt: e.paidAt?.toISOString() ?? null,
      emailedAt: e.emailedAt?.toISOString() ?? null,
    })),
  }
}

export type PayrollPeriodDetail = Awaited<ReturnType<typeof getPeriod>>

export async function updateEntry(organizationId: string, entryId: string, input: Record<string, unknown>) {
  const entry = await prisma.payrollEntry.findFirst({
    where: { id: entryId, organizationId },
    include: { period: true, employee: { select: employeeSelect } },
  })
  if (!entry) throw new CrudError("Registro no encontrado", 404)
  if (entry.period.status !== "draft") throw new CrudError("La nómina ya está cerrada; reábrela para editar", 409)
  const pick = (k: keyof PayCapture, fallback: unknown) => Math.max(0, num(input[k] !== undefined ? input[k] : fallback))
  const cap: PayCapture = {
    daysWorked: pick("daysWorked", entry.daysWorked),
    hoursWorked: pick("hoursWorked", entry.hoursWorked),
    absences: pick("absences", entry.absences),
    overtimeHours: pick("overtimeHours", entry.overtimeHours),
    holidayDays: pick("holidayDays", entry.holidayDays),
    restDaysWorked: pick("restDaysWorked", entry.restDaysWorked),
    salesTotal: pick("salesTotal", entry.salesTotal),
    tips: pick("tips", entry.tips),
    perceptions: input.perceptions !== undefined ? lines(input.perceptions) : lines(entry.perceptions),
    deductions: input.deductions !== undefined ? lines(input.deductions) : lines(entry.deductions),
  }
  const days = periodDays(isoDate(entry.period.startDate), isoDate(entry.period.endDate))
  await prisma.payrollEntry.update({
    where: { id: entry.id },
    data: {
      ...entryData(entry.employee, cap, days),
      ...(input.payMethod !== undefined ? { payMethod: ["cash", "transfer", "check"].includes(String(input.payMethod)) ? String(input.payMethod) : "cash" } : {}),
      ...(input.notes !== undefined ? { notes: String(input.notes ?? "").trim() || null } : {}),
    },
  })
  return { ok: true }
}

/** Recalcula todas las filas con las condiciones actuales de cada empleado. */
export async function recalcPeriod(organizationId: string, periodId: string) {
  const p = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId }, include: { entries: true } })
  if (!p) throw new CrudError("Nómina no encontrada", 404)
  if (p.status !== "draft") throw new CrudError("La nómina ya está cerrada", 409)
  for (const e of p.entries) await updateEntry(organizationId, e.id, {})
  return { ok: true }
}

export async function setPeriodStatus(organizationId: string, periodId: string, status: string) {
  const p = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId } })
  if (!p) throw new CrudError("Nómina no encontrada", 404)
  if (!["draft", "closed", "paid"].includes(status)) throw new CrudError("Estado inválido", 400)
  const now = new Date()
  await prisma.$transaction([
    prisma.payrollPeriod.update({
      where: { id: p.id },
      data: {
        status,
        closedAt: status === "draft" ? null : (p.closedAt ?? now),
        paidAt: status === "paid" ? now : null,
      },
    }),
    ...(status === "paid" ? [prisma.payrollEntry.updateMany({ where: { periodId: p.id, paidAt: null }, data: { paidAt: now } })] : []),
    ...(status === "draft" ? [prisma.payrollEntry.updateMany({ where: { periodId: p.id }, data: { paidAt: null } })] : []),
  ])
  return { ok: true }
}

export async function markEntryPaid(organizationId: string, entryId: string, paid: boolean) {
  const entry = await prisma.payrollEntry.findFirst({ where: { id: entryId, organizationId }, include: { period: true } })
  if (!entry) throw new CrudError("Registro no encontrado", 404)
  if (entry.period.status === "draft") throw new CrudError("Cierra la nómina antes de registrar pagos", 409)
  await prisma.payrollEntry.update({ where: { id: entry.id }, data: { paidAt: paid ? new Date() : null } })
  return { ok: true }
}

export async function deletePeriod(organizationId: string, periodId: string) {
  const p = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId } })
  if (!p) throw new CrudError("Nómina no encontrada", 404)
  if (p.status !== "draft") throw new CrudError("Solo se pueden eliminar nóminas en borrador", 409)
  await prisma.payrollPeriod.delete({ where: { id: p.id } })
  return { ok: true }
}

/** Datos de la empresa para el encabezado del recibo. */
export async function receiptCompany(organizationId: string) {
  const [org, company] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId }, select: { tradeName: true, legalName: true, taxId: true, logoUrl: true } }),
  ])
  return {
    name: company?.tradeName ?? company?.legalName ?? org?.name ?? "Empresa",
    legalName: company?.legalName ?? null,
    taxId: company?.taxId ?? null,
    logoUrl: company?.logoUrl ?? null,
  }
}
