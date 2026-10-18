import { prisma } from "@/lib/db"
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types"
import { createExpense, restoreExpense, serializeExpense, todayYmd, updateExpense, voidExpense } from "@/lib/expenses/server"

export type ExpenseDto = ReturnType<typeof serializeExpense>

const include = { location: { select: { name: true } } } as const

export const expensesModule: CrudModule<ExpenseDto> = {
  key: "expenses",

  async createDefaults() {
    return { expenseDate: todayYmd(), category: "other", paidFrom: "other" }
  },

  async list(organizationId, params: ListParams): Promise<CrudListResult<ExpenseDto>> {
    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.min(100, params.pageSize ?? 20)
    const q = params.q?.trim() ?? ""
    const where = {
      organizationId,
      ...(q ? { OR: [{ description: { contains: q } }, { supplierName: { contains: q } }, { notes: { contains: q } }] } : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include,
        orderBy: [{ isActive: "desc" }, { expenseDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expense.count({ where }),
    ])
    return { rows: rows.map(serializeExpense), total }
  },

  async get(organizationId, id) {
    const row = await prisma.expense.findFirst({ where: { id, organizationId }, include })
    if (!row) throw new CrudError("Gasto no encontrado", 404)
    return serializeExpense(row)
  },

  async create(organizationId, input, ctx) {
    const employee = await prisma.employee.findFirst({ where: { organizationId, userId: ctx.userId }, select: { id: true } })
    return createExpense(organizationId, input as Record<string, unknown>, { userId: ctx.userId, employeeId: employee?.id ?? null })
  },

  async update(organizationId, id, input) {
    return updateExpense(organizationId, id, input as Record<string, unknown>)
  },

  async remove(organizationId, id) {
    await voidExpense(organizationId, id)
  },

  async restore(organizationId, id) {
    await restoreExpense(organizationId, id)
  },
}
