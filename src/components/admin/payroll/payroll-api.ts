import type { PayrollPeriodDetail } from "@/lib/payroll/server"

// Cliente de /api/payroll (la pantalla de nómina).

export interface PayEmployee {
  id: string
  fullName: string
  employeeCode: string | null
  imageUrl: string | null
  email: string | null
  position: string | null
  location: string | null
  salaryType: string
  salaryAmount: number
  paymentFrequency: string
  workDays: number[]
  shiftStart: string | null
  shiftEnd: string | null
  dailyHours: number
  overtimeRate: number
  holidayRate: number
  restDayRate: number
  commissionRate: number
  receivesTips: boolean
  payMethod: string
}

export interface PayConcept {
  id: string
  name: string
  kind: "perception" | "deduction" | string
  calc: "fixed" | "percent" | string
  amount: number
}

export interface PayPeriodRow {
  id: string
  folio: string
  frequency: string
  startDate: string
  endDate: string
  status: "draft" | "closed" | "paid" | string
  employees: number
  gross: number
  net: number
  paid: number
  createdAt: string
}

export type PayPeriod = PayrollPeriodDetail
export type PayEntry = PayrollPeriodDetail["entries"][number]
export interface PayCompany {
  name: string
  legalName: string | null
  taxId: string | null
  logoUrl: string | null
}

async function request<T>(init?: RequestInit, query = ""): Promise<T> {
  const res = await fetch(`/api/payroll${query}`, { headers: { "Content-Type": "application/json" }, ...init })
  const data = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null
  if (!res.ok || !data || data.ok === false) throw new Error(data?.error ?? "Error de nómina")
  return data
}

export const payrollApi = {
  workspace: () => request<{ employees: PayEmployee[]; concepts: PayConcept[]; periods: PayPeriodRow[] }>(),
  period: (id: string) => request<{ period: PayPeriod; company: PayCompany }>(undefined, `?periodId=${encodeURIComponent(id)}`),
  action: <T = { ok: boolean }>(action: string, body: Record<string, unknown> = {}) =>
    request<T>({ method: "POST", body: JSON.stringify({ action, ...body }) }),
}

export const PERIOD_STATUS: Record<string, { label: string; tone: "warning" | "info" | "success" | "neutral" }> = {
  draft: { label: "Borrador", tone: "warning" },
  closed: { label: "Cerrada · por pagar", tone: "info" },
  paid: { label: "Pagada", tone: "success" },
}

export const fmtDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
