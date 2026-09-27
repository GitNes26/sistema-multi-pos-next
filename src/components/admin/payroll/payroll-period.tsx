"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Calculator, CheckCircle2, Lock, Mail, Pencil, Plus, Printer, RefreshCw, RotateCcw, Trash2, Wallet, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { BackButton } from "@/components/shared/back-button"
import { AnimatedNumber, EntityCell, RowActions, SegmentedFilter, StatusPill } from "@/components/base"
import { money } from "@/lib/pos/money"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"
import { computePay, FREQUENCY_LABELS, PAY_METHOD_LABELS, SALARY_TYPE_LABELS, type ConceptCalc, type PayCapture } from "@/lib/payroll/calc"
import { receiptPrintDocument } from "@/lib/payroll/receipt-html"
import { fmtDate, PERIOD_STATUS, payrollApi, type PayCompany, type PayEntry, type PayPeriod } from "./payroll-api"

export function PayrollPeriodView({ id }: { id: string }) {
  const router = useRouter()
  const [period, setPeriod] = useState<PayPeriod | null>(null)
  const [company, setCompany] = useState<PayCompany | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<PayEntry | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await payrollApi.period(id)
      setPeriod(res.period)
      setCompany(res.company)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar")
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(true)
    try {
      await payrollApi.action(action, body)
      if (ok) swalToast(ok)
      await load()
    } catch (err) {
      swalError("No se pudo completar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const print = (entries: PayEntry[]) => {
    if (!period || !company) return
    // Iframe oculto: imprime sin abrir ventanas emergentes (que suelen bloquearse).
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
    document.body.appendChild(frame)
    const doc = frame.contentWindow?.document
    if (!doc) {
      frame.remove()
      swalError("No se pudo preparar la impresión")
      return
    }
    doc.open()
    doc.write(receiptPrintDocument(period, entries, company))
    doc.close()
    window.setTimeout(() => frame.remove(), 60_000)
  }

  const email = async (e: PayEntry) => {
    setBusy(true)
    try {
      const res = await payrollApi.action<{ ok: boolean; to: string }>("entry.email", { id: e.id })
      swalToast(`Recibo enviado a ${res.to}`)
      await load()
    } catch (err) {
      swalError("No se pudo enviar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const totals = useMemo(() => {
    const t = { gross: 0, deductions: 0, net: 0, tips: 0, extra: 0, paid: 0 }
    for (const e of period?.entries ?? []) {
      t.gross += e.grossPay
      t.deductions += e.totalDeductions
      t.net += e.netPay
      t.tips += e.tips
      t.extra += e.overtimePay + e.holidayPay + e.restDayPay
      if (e.paidAt) t.paid++
    }
    return t
  }, [period])

  if (error) return <p className="py-10 text-center text-muted-foreground">{error}</p>
  if (!period) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  const st = PERIOD_STATUS[period.status] ?? PERIOD_STATUS.draft
  const draft = period.status === "draft"

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <BackButton fallback="/admin/payroll" label="Nómina" showLabel />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">
            Nómina {period.folio} · {FREQUENCY_LABELS[period.frequency] ?? period.frequency}
          </p>
          <h1 className="mt-0.5 font-heading text-xl font-semibold tracking-tight">
            {fmtDate(period.startDate)} – {fmtDate(period.endDate)} <span className="text-base font-normal text-muted-foreground">({period.days} días)</span>
          </h1>
          {period.holidays.length > 0 && <p className="text-xs text-muted-foreground">Festivos: {period.holidays.map(fmtDate).join(", ")}</p>}
        </div>
        <StatusPill tone={st.tone} className="text-sm">{st.label}</StatusPill>
      </div>

      {/* Pasos y acciones */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-e1">
        <ol className="flex flex-1 flex-wrap items-center gap-2 text-sm">
          {[
            { key: "draft", label: "1 · Captura y revisa" },
            { key: "closed", label: "2 · Cierra (se congela)" },
            { key: "paid", label: "3 · Paga y entrega recibos" },
          ].map((s, i, arr) => {
            const reached = arr.findIndex((x) => x.key === period.status) >= i
            return (
              <li key={s.key} className={cn("rounded-full px-3 py-1 font-medium", reached ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {s.label}
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          {draft && (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void run("period.recalc", { id }, "Recalculada con las condiciones actuales")} title="Aplica cambios hechos en la configuración de pago de los empleados">
                <RefreshCw className="size-4" /> Recalcular
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={busy}
                onClick={async () => {
                  if (await swalConfirm("Eliminar nómina", "Se borra el borrador y lo capturado.", { danger: true })) {
                    await payrollApi.action("period.delete", { id }).then(() => router.push("/admin/payroll")).catch((err) => swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined))
                  }
                }}
              >
                <Trash2 className="size-4" /> Eliminar
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void run("period.status", { id, status: "closed" }, "Nómina cerrada")}>
                <Lock className="size-4" /> Cerrar nómina
              </Button>
            </>
          )}
          {!draft && (
            <>
              <Button variant="outline" size="sm" onClick={() => print(period.entries)}>
                <Printer className="size-4" /> Imprimir todos
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run("period.status", { id, status: "draft" }, "Nómina reabierta")}>
                <RotateCcw className="size-4" /> Reabrir
              </Button>
              {period.status === "closed" && (
                <Button size="sm" disabled={busy} onClick={() => void run("period.status", { id, status: "paid" }, "Nómina pagada")}>
                  <CheckCircle2 className="size-4" /> Marcar todo pagado
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Percepciones", value: totals.gross },
          { label: "Deducciones", value: totals.deductions },
          { label: "Extras (horas, festivos, descansos)", value: totals.extra },
          { label: "Neto a pagar", value: totals.net, strong: true },
        ].map((k) => (
          <div key={k.label} className={cn("rounded-2xl border bg-card p-4", k.strong && "border-primary/30 bg-primary/5")}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <AnimatedNumber value={k.value} format={(v) => money(v)} className={cn("font-heading font-semibold tabular-nums", k.strong ? "text-2xl" : "text-xl")} />
          </div>
        ))}
      </div>

      {/* Empleados */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Empleado</span>
          <span>Capturado</span>
          <span className="text-right">Percepciones</span>
          <span className="text-right">Deducciones</span>
          <span className="text-right">Neto</span>
          <span className="w-24" />
        </div>
        <div className="divide-y">
          {period.entries.map((e) => (
            <div key={e.id} className="grid items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto]">
              <EntityCell title={e.employee.fullName} subtitle={`${SALARY_TYPE_LABELS[e.salaryType] ?? "—"}${e.salaryAmount ? ` · ${money(e.salaryAmount)}` : ""}`} image={e.employee.imageUrl} />
              <p className="text-xs text-muted-foreground">
                {e.salaryType === "hourly" ? `${e.hoursWorked} h` : `${e.daysWorked} días`}
                {e.absences ? ` · ${e.absences} faltas` : ""}
                {e.overtimeHours ? ` · ${e.overtimeHours} h extra` : ""}
                {e.holidayDays ? ` · ${e.holidayDays} festivo` : ""}
                {e.restDaysWorked ? ` · ${e.restDaysWorked} descanso` : ""}
                {e.tips ? ` · propinas ${money(e.tips)}` : ""}
              </p>
              <p className="text-right text-sm tabular-nums">{money(e.grossPay)}</p>
              <p className="text-right text-sm tabular-nums text-muted-foreground">{e.totalDeductions ? `−${money(e.totalDeductions)}` : "—"}</p>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{money(e.netPay)}</p>
                <p className="text-xs text-muted-foreground">
                  {e.paidAt ? <span className="text-success-ink">Pagado</span> : PAY_METHOD_LABELS[e.payMethod]}
                  {e.emailedAt ? " · enviado" : ""}
                </p>
              </div>
              <RowActions
                name={e.employee.fullName}
                primary={draft ? { label: "Capturar", icon: Pencil, onSelect: () => setEditing(e) } : { label: "Recibo", icon: Printer, onSelect: () => print([e]) }}
                items={[
                  { label: "Ver detalle", icon: Calculator, hidden: draft, onSelect: () => setEditing(e) },
                  { label: "Imprimir recibo", icon: Printer, hidden: draft, onSelect: () => print([e]) },
                  { label: "Enviar recibo por correo", icon: Mail, hidden: draft || !e.employee.email, disabled: busy, onSelect: () => void email(e) },
                  { label: e.paidAt ? "Marcar como no pagado" : "Marcar como pagado", icon: Wallet, hidden: draft, onSelect: () => void run("entry.paid", { id: e.id, paid: !e.paidAt }) },
                ]}
              />
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Comprobante interno de pago: no calcula ISR/IMSS ni es un CFDI de nómina.</p>

      {editing && (
        <EntryDialog
          entry={editing}
          days={period.days}
          readOnly={!draft}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

// ── Captura de un empleado con vista previa en vivo ─────────────────────────

type Line = { name: string; calc: ConceptCalc; value: number }

function EntryDialog({ entry, days, readOnly, onClose, onSaved }: { entry: PayEntry; days: number; readOnly: boolean; onClose: () => void; onSaved: () => void }) {
  const [cap, setCap] = useState<PayCapture>({
    daysWorked: entry.daysWorked,
    hoursWorked: entry.hoursWorked,
    absences: entry.absences,
    overtimeHours: entry.overtimeHours,
    holidayDays: entry.holidayDays,
    restDaysWorked: entry.restDaysWorked,
    salesTotal: entry.salesTotal,
    tips: entry.tips,
    perceptions: entry.perceptions.map(({ name, calc, value }) => ({ name, calc, value })),
    deductions: entry.deductions.map(({ name, calc, value }) => ({ name, calc, value })),
  })
  const [payMethod, setPayMethod] = useState(entry.payMethod)
  const [notes, setNotes] = useState(entry.notes ?? "")
  const [saving, setSaving] = useState(false)
  const emp = entry.employee
  const pay = computePay(
    { salaryType: entry.salaryType, salaryAmount: entry.salaryAmount, dailyHours: emp.dailyHours, overtimeRate: emp.overtimeRate, holidayRate: emp.holidayRate, restDayRate: emp.restDayRate, commissionRate: emp.commissionRate },
    cap,
    days
  )
  const set = (k: keyof PayCapture, v: number) => setCap((c) => ({ ...c, [k]: Math.max(0, v) }))
  const field = (k: "daysWorked" | "hoursWorked" | "absences" | "overtimeHours" | "holidayDays" | "restDaysWorked" | "salesTotal" | "tips", label: string, hint?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min="0" step="0.5" value={String(cap[k])} disabled={readOnly} onChange={(e) => set(k, Number(e.target.value))} onFocus={(e) => e.target.select()} className="tabular-nums" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
  const salaryType = entry.salaryType
  const lineEditor = (key: "perceptions" | "deductions", title: string) => {
    const list = cap[key] as Line[]
    const update = (i: number, patch: Partial<Line>) => setCap((c) => ({ ...c, [key]: (c[key] as Line[]).map((l, j) => (j === i ? { ...l, ...patch } : l)) }))
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {list.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={l.name} disabled={readOnly} onChange={(e) => update(i, { name: e.target.value })} className="h-8 flex-1" aria-label="Concepto" />
            <SegmentedFilter ariaLabel="Cálculo" value={l.calc} onChange={(v) => !readOnly && update(i, { calc: v })} options={[{ value: "fixed", label: "$" }, { value: "percent", label: "%" }]} />
            <Input type="number" min="0" step="0.01" value={String(l.value)} disabled={readOnly} onChange={(e) => update(i, { value: Math.max(0, Number(e.target.value)) })} className="h-8 w-24 tabular-nums" aria-label="Importe" />
            {!readOnly && (
              <Button variant="ghost" size="icon" className="size-8" aria-label="Quitar" onClick={() => setCap((c) => ({ ...c, [key]: (c[key] as Line[]).filter((_, j) => j !== i) }))}>
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={() => setCap((c) => ({ ...c, [key]: [...(c[key] as Line[]), { name: "", calc: "fixed", value: 0 }] }))}>
            <Plus className="size-4" /> Agregar
          </Button>
        )}
      </div>
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      await payrollApi.action("entry.update", { id: entry.id, ...cap, payMethod, notes })
      swalToast("Captura guardada")
      onSaved()
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const row = (label: string, amount: number, detail?: string, negative = false) =>
    amount ? (
      <div className="flex items-baseline justify-between gap-2 py-1 text-sm">
        <span className="text-muted-foreground">
          {label}
          {detail && <span className="block text-xs">{detail}</span>}
        </span>
        <span className="font-medium tabular-nums">
          {negative ? "−" : ""}
          {money(amount)}
        </span>
      </div>
    ) : null

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      icon={<Calculator className="size-5" />}
      title={emp.fullName}
      description={`${SALARY_TYPE_LABELS[salaryType] ?? "Sin sueldo"}${entry.salaryAmount ? ` de ${money(entry.salaryAmount)}` : ""} · día ${money(pay.dailyRate)} · hora ${money(pay.hourlyRate)}`}
      size="4xl"
      bodyClassName="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
      footer={
        readOnly ? (
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving}>Guardar captura</Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {salaryType === "hourly"
            ? field("hoursWorked", "Horas trabajadas")
            : salaryType === "daily"
              ? field("daysWorked", "Días trabajados")
              : field("absences", "Faltas", "Se descuentan del sueldo")}
          {salaryType !== "hourly" && salaryType !== "daily" && field("daysWorked", "Días trabajados", "Informativo")}
          {field("overtimeHours", "Horas extra", `× ${emp.overtimeRate}`)}
          {field("holidayDays", "Festivos trabajados", `× ${emp.holidayRate} adicional`)}
          {field("restDaysWorked", "Descansos trabajados", `× ${emp.restDayRate} adicional`)}
          {field("tips", "Propinas")}
          {emp.commissionRate > 0 && field("salesTotal", "Ventas del periodo", `${emp.commissionRate}% de comisión`)}
        </div>
        {lineEditor("perceptions", "Otras percepciones")}
        {lineEditor("deductions", "Deducciones")}
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Forma de pago</Label>
            <SegmentedFilter ariaLabel="Forma de pago" value={payMethod} onChange={(v) => !readOnly && setPayMethod(v)} options={["cash", "transfer", "check"].map((v) => ({ value: v, label: PAY_METHOD_LABELS[v] }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nota en el recibo</Label>
            <Textarea rows={2} value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <aside className="h-fit rounded-2xl border bg-muted/30 p-4 md:sticky md:top-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cálculo</p>
        <div className="mt-2 divide-y">
          <div>
            {row("Sueldo", pay.basePay, salaryType === "hourly" ? `${cap.hoursWorked} h × ${money(pay.hourlyRate)}` : salaryType === "daily" ? `${cap.daysWorked} días × ${money(pay.dailyRate)}` : `${days - cap.absences} días × ${money(pay.dailyRate)}`)}
            {row("Horas extra", pay.overtimePay, `${cap.overtimeHours} h × ${money(pay.hourlyRate)} × ${emp.overtimeRate}`)}
            {row("Festivos", pay.holidayPay)}
            {row("Descansos trabajados", pay.restDayPay)}
            {row("Comisión", pay.commissionPay)}
            {row("Propinas", pay.tips)}
            {pay.perceptions.map((p, i) => <div key={i}>{row(p.name, p.amount, p.calc === "percent" ? `${p.value}% del sueldo` : undefined)}</div>)}
          </div>
          <div className="flex justify-between py-2 text-sm font-semibold">
            <span>Percepciones</span>
            <span className="tabular-nums">{money(pay.grossPay)}</span>
          </div>
          {pay.deductions.length > 0 && <div>{pay.deductions.map((d, i) => <div key={i}>{row(d.name, d.amount, d.calc === "percent" ? `${d.value}% de percepciones` : undefined, true)}</div>)}</div>}
        </div>
        <div className="mt-3 flex items-baseline justify-between rounded-xl bg-foreground px-4 py-3 text-background">
          <span className="text-sm">Neto a pagar</span>
          <AnimatedNumber value={pay.netPay} duration={0.35} format={(v) => money(v)} className="font-heading text-2xl font-semibold tabular-nums" />
        </div>
      </aside>
    </DialogComponent>
  )
}
