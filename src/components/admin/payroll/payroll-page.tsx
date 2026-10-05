"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronRight, Clock, HandCoins, Loader2, Pencil, Plus, Save, Settings2, Trash2, Users, Wallet, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/base/time-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { PageHeader } from "@/components/layout/page-header"
import { DatePicker, EntityCell, SegmentedFilter, StatusPill, SwitchField } from "@/components/base"
import { money } from "@/lib/pos/money"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"
import {
  FREQUENCY_LABELS,
  PAY_METHOD_LABELS,
  SALARY_TYPE_LABELS,
  WEEKDAY_LABELS,
  rates,
  suggestPeriod,
} from "@/lib/payroll/calc"
import { fmtDate, PERIOD_STATUS, payrollApi, type PayConcept, type PayEmployee, type PayPeriodRow } from "./payroll-api"

// Nómina ligera: periodos, configuración de pago por empleado y conceptos.
// No calcula impuestos (ISR/IMSS) ni timbra; el recibo es un comprobante interno.

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromIso = (s: string) => (s ? new Date(`${s}T12:00:00`) : null)

export function PayrollPage({ icon }: { icon?: React.ReactNode }) {
  const router = useRouter()
  const [data, setData] = useState<{ employees: PayEmployee[]; concepts: PayConcept[]; periods: PayPeriodRow[] } | null>(null)
  const [tab, setTab] = useState("periods")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PayEmployee | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await payrollApi.workspace())
    } catch (err) {
      swalError("No se pudo cargar la nómina", err instanceof Error ? err.message : undefined)
      setData({ employees: [], concepts: [], periods: [] })
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const unconfigured = data?.employees.filter((e) => !e.salaryType || e.salaryAmount <= 0).length ?? 0

  return (
    <>
      <div data-guide="payroll-header">
      <PageHeader
        icon={icon}
        title="Nómina"
        description="Calcula la paga de tu equipo por periodo: sueldo, horas extra, festivos, descansos, comisiones y propinas. Recibo impreso o por correo."
        actions={
          <Button data-guide="payroll-new" onClick={() => setCreating(true)} disabled={!data?.employees.length}>
            <Plus className="size-4" /> Nueva nómina
          </Button>
        }
      />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="periods" data-guide="payroll-periods-tab">Nóminas</TabsTrigger>
          <TabsTrigger value="employees" data-guide="payroll-employees-tab">
            Empleados y pago
            {unconfigured > 0 && <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-xs text-warning-ink">{unconfigured}</span>}
          </TabsTrigger>
          <TabsTrigger value="concepts" data-guide="payroll-concepts-tab">Percepciones y deducciones</TabsTrigger>
        </TabsList>

        <TabsContent value="periods">
          {!data ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
          ) : data.periods.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Aún no hay nóminas"
              text="1) Configura cómo se le paga a cada empleado. 2) Crea la nómina del periodo: se precargan días, ventas y propinas. 3) Ajusta lo capturado, cierra y entrega recibos."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => setTab("employees")}>
                    <Settings2 className="size-4" /> Configurar pagos
                  </Button>
                  <Button onClick={() => setCreating(true)} disabled={!data.employees.length}>
                    <Plus className="size-4" /> Crear la primera
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.periods.map((p) => {
                const st = PERIOD_STATUS[p.status] ?? PERIOD_STATUS.draft
                return (
                  <Link key={p.id} href={`/admin/payroll/${p.id}`} className="press group block rounded-2xl border bg-card p-4 shadow-e1 transition-shadow hover:shadow-e2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {p.folio} · {FREQUENCY_LABELS[p.frequency] ?? p.frequency}
                        </p>
                        <p className="mt-0.5 font-semibold">
                          {fmtDate(p.startDate)} – {fmtDate(p.endDate)}
                        </p>
                      </div>
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <Users className="size-3.5" /> {p.employees} empleados
                        </p>
                        {p.status !== "draft" && (
                          <p className="mt-0.5">
                            Pagados {p.paid} de {p.employees}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Neto a pagar</p>
                        <p className="font-heading text-xl font-semibold tabular-nums">{money(p.net)}</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="employees">
          {!data ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : data.employees.length === 0 ? (
            <EmptyState icon={Users} title="Sin empleados activos" text="Da de alta a tu equipo en Catálogos → Empleados y vuelve aquí para definir cómo se les paga." />
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="divide-y">
                {data.employees.map((e) => {
                  const missing = !e.salaryType || e.salaryAmount <= 0
                  return (
                    <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <EntityCell title={e.fullName} subtitle={[e.position, e.location].filter(Boolean).join(" · ") || e.employeeCode || undefined} image={e.imageUrl} className="min-w-52 flex-1" />
                      <div className="min-w-40 text-sm">
                        {missing ? (
                          <StatusPill tone="warning">Sin sueldo definido</StatusPill>
                        ) : (
                          <>
                            <p className="font-semibold tabular-nums">
                              {money(e.salaryAmount)} <span className="text-xs font-normal text-muted-foreground">{SALARY_TYPE_LABELS[e.salaryType]}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">Pago {FREQUENCY_LABELS[e.paymentFrequency]?.toLowerCase()} · {PAY_METHOD_LABELS[e.payMethod]}</p>
                          </>
                        )}
                      </div>
                      <div className="min-w-44 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {e.workDays.map((d) => WEEKDAY_LABELS[d]).join(" ")}
                          {e.shiftStart && e.shiftEnd ? ` · ${e.shiftStart}–${e.shiftEnd}` : ` · ${e.dailyHours} h`}
                        </p>
                        <p className="mt-0.5">
                          Extra ×{e.overtimeRate} · Festivo ×{e.holidayRate} · Descanso ×{e.restDayRate}
                          {e.commissionRate ? ` · ${e.commissionRate}% ventas` : ""}
                          {e.receivesTips ? " · Propinas" : ""}
                        </p>
                      </div>
                      <Button variant={missing ? "default" : "outline"} size="sm" data-guide="payroll-configure" onClick={() => setEditing(e)}>
                        <Settings2 className="size-4" /> Configurar
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="concepts">
          <ConceptsPanel concepts={data?.concepts ?? null} onChange={load} />
        </TabsContent>
      </Tabs>

      {editing && (
        <EmployeePayDialog
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
      {data && (
        <NewPeriodDialog
          open={creating}
          onOpenChange={setCreating}
          employees={data.employees}
          onCreated={(id) => router.push(`/admin/payroll/${id}`)}
        />
      )}
    </>
  )
}

function EmptyState({ icon: Icon, title, text, action }: { icon: typeof Users; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">{text}</p>
      </div>
      {action}
    </div>
  )
}

// ── Configuración de pago de un empleado ────────────────────────────────────

function EmployeePayDialog({ employee, onClose, onSaved }: { employee: PayEmployee; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...employee, salaryType: employee.salaryType || "monthly" })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof PayEmployee>(k: K, v: PayEmployee[K]) => setF((c) => ({ ...c, [k]: v }))
  const r = rates({ ...f })
  const numInput = (k: "salaryAmount" | "dailyHours" | "overtimeRate" | "holidayRate" | "restDayRate" | "commissionRate", label: string, hint?: string, step = "0.01") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min="0" step={step} value={String(f[k])} onChange={(e) => set(k, Number(e.target.value))} className="tabular-nums" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )

  const save = async () => {
    setSaving(true)
    try {
      await payrollApi.action("employee.pay", { ...f, id: employee.id })
      swalToast("Pago configurado")
      onSaved()
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      icon={<HandCoins className="size-5" />}
      title={`Pago de ${employee.fullName}`}
      description="Estas condiciones se usan al crear cada nómina."
      size="2xl"
      bodyClassName="space-y-5"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Guardar
          </Button>
        </>
      }
    >
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Sueldo</h3>
        <SegmentedFilter
          ariaLabel="Tipo de sueldo"
          value={f.salaryType}
          onChange={(v) => set("salaryType", v)}
          options={["monthly", "weekly", "daily", "hourly", "commission"].map((v) => ({ value: v, label: SALARY_TYPE_LABELS[v] }))}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {f.salaryType !== "commission" && numInput("salaryAmount", f.salaryType === "hourly" ? "Pago por hora" : f.salaryType === "daily" ? "Salario diario" : f.salaryType === "weekly" ? "Sueldo semanal" : "Sueldo mensual")}
          <div className="space-y-1">
            <Label className="text-xs">Se paga</Label>
            <SegmentedFilter ariaLabel="Frecuencia" value={f.paymentFrequency} onChange={(v) => set("paymentFrequency", v)} options={["weekly", "biweekly", "monthly"].map((v) => ({ value: v, label: FREQUENCY_LABELS[v] }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Forma de pago</Label>
            <SegmentedFilter ariaLabel="Forma de pago" value={f.payMethod} onChange={(v) => set("payMethod", v)} options={["cash", "transfer", "check"].map((v) => ({ value: v, label: PAY_METHOD_LABELS[v] }))} />
          </div>
        </div>
        {f.salaryType !== "commission" && (
          <p className="text-xs text-muted-foreground">
            Equivale a <b className="text-foreground">{money(r.daily)}</b> por día y <b className="text-foreground">{money(r.hourly)}</b> por hora.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Horario</h3>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, d) => {
            const on = f.workDays.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => set("workDays", on ? f.workDays.filter((x) => x !== d) : [...f.workDays, d].sort())}
                className={cn("press h-9 w-12 rounded-lg border text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">Los días sin marcar son de descanso. Si trabaja un descanso se paga aparte.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <TimePicker label="Entrada" value={f.shiftStart ?? null} onChange={(v) => set("shiftStart", v || null)} />
          </div>
          <div className="space-y-1">
            <TimePicker label="Salida" value={f.shiftEnd ?? null} onChange={(v) => set("shiftEnd", v || null)} />
          </div>
          {numInput("dailyHours", "Horas por jornada", undefined, "0.5")}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Pagos especiales</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {numInput("overtimeRate", "Hora extra ×", "0 = no se pagan")}
          {numInput("holidayRate", "Festivo trabajado ×", "Adicional al sueldo")}
          {numInput("restDayRate", "Descanso trabajado ×", "Adicional al sueldo")}
          {numInput("commissionRate", "Comisión % ventas", "0 = sin comisión")}
        </div>
        <SwitchField id="pay-tips" label="Recibe propinas" description="Se suman las propinas de sus ventas del periodo (editable)" checked={f.receivesTips} onCheckedChange={(v) => set("receivesTips", v)} />
      </section>
    </DialogComponent>
  )
}

// ── Conceptos configurables ─────────────────────────────────────────────────

function ConceptsPanel({ concepts, onChange }: { concepts: PayConcept[] | null; onChange: () => void }) {
  const [draft, setDraft] = useState({ name: "", kind: "perception", calc: "fixed", amount: "" })
  // Concepto que se está editando (null = alta de uno nuevo).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const startEdit = (c: PayConcept) => {
    setEditingId(c.id)
    setDraft({ name: c.name, kind: c.kind, calc: c.calc, amount: String(c.amount) })
    window.requestAnimationFrame(() => document.getElementById("concept-name")?.focus())
  }
  const cancelEdit = () => {
    setEditingId(null)
    setDraft({ name: "", kind: "perception", calc: "fixed", amount: "" })
  }
  const add = async () => {
    setSaving(true)
    try {
      await payrollApi.action("concept.save", { ...draft, id: editingId ?? undefined, amount: Number(draft.amount) || 0 })
      setDraft({ name: "", kind: draft.kind, calc: "fixed", amount: "" })
      setEditingId(null)
      onChange()
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }
  const remove = async (c: PayConcept) => {
    if (!(await swalConfirm("Quitar concepto", `«${c.name}» ya no se agregará a nuevas nóminas. Las existentes no cambian.`))) return
    await payrollApi.action("concept.delete", { id: c.id }).catch(() => undefined)
    onChange()
  }
  if (!concepts) return <Skeleton className="h-64 rounded-2xl" />
  const col = (kind: "perception" | "deduction") => {
    const list = concepts.filter((c) => c.kind === kind)
    return (
      <div className="rounded-2xl border bg-card p-4">
        <p className="font-semibold">{kind === "perception" ? "Percepciones (suman)" : "Deducciones (restan)"}</p>
        <p className="text-xs text-muted-foreground">
          {kind === "perception" ? "Bonos, vales, ayuda de transporte… El % se calcula sobre el sueldo base." : "Préstamos, uniformes, faltantes de caja… El % se calcula sobre el total de percepciones."}
        </p>
        <ul className="mt-3 divide-y rounded-xl border">
          {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Ninguna todavía</li>}
          {list.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {c.calc === "percent" ? `${c.amount}%` : money(c.amount)}
                <Button variant="ghost" size="icon" className="size-11 desk:size-7" aria-label={`Editar ${c.name}`} onClick={() => startEdit(c)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-11 text-destructive desk:size-7" aria-label={`Quitar ${c.name}`} onClick={() => void remove(c)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-muted/30 p-4">
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="concept-name" className="text-xs">{editingId ? "Editando concepto" : "Nuevo concepto"}</Label>
          <Input id="concept-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. Bono de puntualidad" />
        </div>
        <SegmentedFilter ariaLabel="Tipo" value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })} options={[{ value: "perception", label: "Suma" }, { value: "deduction", label: "Resta" }]} />
        <SegmentedFilter ariaLabel="Cálculo" value={draft.calc} onChange={(v) => setDraft({ ...draft, calc: v })} options={[{ value: "fixed", label: "$ fijo" }, { value: "percent", label: "%" }]} />
        <Input type="number" inputMode="decimal" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder={draft.calc === "percent" ? "%" : "$"} className="w-24 tabular-nums" />
        {editingId && <Button variant="ghost" onClick={cancelEdit} disabled={saving}>Cancelar</Button>}
        <Button onClick={() => void add()} disabled={!draft.name.trim() || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : editingId ? <Save className="size-4" /> : <Plus className="size-4" />} {editingId ? "Guardar cambios" : "Agregar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Los conceptos activos se agregan a cada nómina nueva; en cada empleado puedes quitarlos o cambiar el importe. No se calculan ISR ni IMSS.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {col("perception")}
        {col("deduction")}
      </div>
    </div>
  )
}

// ── Nueva nómina ────────────────────────────────────────────────────────────

function NewPeriodDialog({ open, onOpenChange, employees, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; employees: PayEmployee[]; onCreated: (id: string) => void }) {
  const [frequency, setFrequency] = useState("biweekly")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [holidays, setHolidays] = useState<string[]>([])
  const [holidayDraft, setHolidayDraft] = useState<Date | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const s = suggestPeriod(frequency)
    setStart(s.start)
    setEnd(s.end)
    setHolidays([])
    setSelected(employees.filter((e) => e.paymentFrequency === frequency).map((e) => e.id))
  }, [open, frequency, employees])

  const sorted = useMemo(() => [...employees].sort((a, b) => Number(b.paymentFrequency === frequency) - Number(a.paymentFrequency === frequency)), [employees, frequency])

  const create = async () => {
    setSaving(true)
    try {
      const res = await payrollApi.action<{ ok: boolean; id: string; folio: string }>("period.create", { frequency, startDate: start, endDate: end, holidays, employeeIds: selected })
      swalToast(`Nómina ${res.folio} creada`)
      onOpenChange(false)
      onCreated(res.id)
    } catch (err) {
      swalError("No se pudo crear", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<CalendarDays className="size-5" />}
      title="Nueva nómina"
      description="Se precargan los días del horario de cada quien, sus ventas y propinas. Después ajustas lo que haga falta."
      size="2xl"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void create()} disabled={saving || !selected.length || !start || !end}>
            {saving && <Loader2 className="size-4 animate-spin" />} Crear nómina ({selected.length})
          </Button>
        </>
      }
    >
      <SegmentedFilter ariaLabel="Frecuencia" value={frequency} onChange={setFrequency} options={["weekly", "biweekly", "monthly"].map((v) => ({ value: v, label: FREQUENCY_LABELS[v] }))} />
      <div className="grid gap-3 sm:grid-cols-2">
        <DatePicker label="Desde" value={fromIso(start)} onChange={(d) => setStart(d ? toIso(d) : "")} />
        <DatePicker label="Hasta" value={fromIso(end)} onChange={(d) => setEnd(d ? toIso(d) : "")} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Días festivos del periodo</Label>
        <div className="flex flex-wrap items-center gap-2">
          {holidays.map((h) => (
            <span key={h} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {fmtDate(h)}
              <button type="button" aria-label="Quitar festivo" onClick={() => setHolidays(holidays.filter((x) => x !== h))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
          <div className="w-44">
            <DatePicker
              value={holidayDraft}
              placeholder="Agregar festivo"
              disabledBefore={fromIso(start) ?? undefined}
              disabledAfter={fromIso(end) ?? undefined}
              onChange={(d) => {
                setHolidayDraft(null)
                if (d && !holidays.includes(toIso(d))) setHolidays([...holidays, toIso(d)].sort())
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Si un festivo cae en día laboral se marca como trabajado (pago adicional); puedes quitarlo por empleado.</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Empleados</Label>
          <button type="button" className="text-xs font-medium text-primary" onClick={() => setSelected(selected.length === employees.length ? [] : employees.map((e) => e.id))}>
            {selected.length === employees.length ? "Quitar todos" : "Seleccionar todos"}
          </button>
        </div>
        <div className="max-h-60 divide-y overflow-auto rounded-xl border">
          {sorted.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
              <Checkbox checked={selected.includes(e.id)} onCheckedChange={(v) => setSelected(v === true ? [...selected, e.id] : selected.filter((x) => x !== e.id))} />
              <span className="flex-1 font-medium">{e.fullName}</span>
              <span className="text-xs text-muted-foreground">
                {e.salaryType && e.salaryAmount > 0 ? `${SALARY_TYPE_LABELS[e.salaryType]} · pago ${FREQUENCY_LABELS[e.paymentFrequency]?.toLowerCase()}` : "Sin sueldo definido"}
              </span>
            </label>
          ))}
        </div>
      </div>
    </DialogComponent>
  )
}

