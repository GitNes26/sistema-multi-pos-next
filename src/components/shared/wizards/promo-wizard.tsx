"use client"

import { useState } from "react"
import { Percent, DollarSign, Gift, Tag } from "lucide-react"
import { WizardShell, type WizardStep } from "./wizard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { swalError, swalLoading, swalClose } from "@/lib/swal"
import { cn } from "@/lib/utils"

type Benefit = "percent_off" | "fixed_amount" | "buy_x_get_y" | "next_purchase_coupon"

interface PromoData {
  name: string
  benefit: Benefit
  value: number
  minAmount: number
  couponCode: string
  isActive: boolean
}

const BENEFITS: { key: Benefit; label: string; icon: React.ReactNode }[] = [
  { key: "percent_off", label: "Descuento %", icon: <Percent className="size-4" /> },
  { key: "fixed_amount", label: "Descuento fijo", icon: <DollarSign className="size-4" /> },
  { key: "buy_x_get_y", label: "Compra X lleva Y", icon: <Gift className="size-4" /> },
  { key: "next_purchase_coupon", label: "Cupón próxima compra", icon: <Tag className="size-4" /> },
]

const steps: WizardStep[] = [
  { id: "config", title: "Promoción" },
  { id: "confirm", title: "Confirmar" },
]

interface Props {
  onSave: (data: PromoData) => Promise<void>
  onClose: () => void
}

export function PromoWizard({ onSave, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<PromoData>({ name: "", benefit: "percent_off", value: 10, minAmount: 0, couponCode: "", isActive: true })
  const update = (p: Partial<PromoData>) => setForm((f) => ({ ...f, ...p }))

  const preview = (() => {
    if (!form.name) return ""
    const parts: string[] = []
    if (form.benefit === "percent_off") parts.push(`${form.value}% de descuento en todo el pedido`)
    else if (form.benefit === "fixed_amount") parts.push(`$${form.value} de descuento`)
    else if (form.benefit === "buy_x_get_y") parts.push(`Compra 2 lleva 1`)
    else if (form.benefit === "next_purchase_coupon") parts.push(`Cupón de $${form.value} para próxima compra`)
    if (form.minAmount > 0) parts.push(`compra mínima $${form.minAmount}`)
    if (form.couponCode) parts.push(`código "${form.couponCode}"`)
    return parts.join(". ") + "."
  })()

  const submit = async () => {
    if (!form.name.trim()) { swalError("Nombre obligatorio"); return }
    setLoading(true)
    try { await onSave(form); swalClose(); onClose() }
    catch (err) { swalError("Error", err instanceof Error ? err.message : undefined) }
    finally { setLoading(false) }
  }

  return (
    <WizardShell steps={steps} onFinish={submit} finishLabel={loading ? "Guardando…" : "Crear promoción"} loading={loading}>
      {({ step }) => {
        if (step.id === "config") {
          return (
            <div className="space-y-3">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Ej. 10% de descuento" /></div>
              <div>
                <Label>Tipo de beneficio</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {BENEFITS.map((b) => (
                    <button key={b.key} type="button" onClick={() => update({ benefit: b.key })}
                      className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                        form.benefit === b.key ? "border-primary bg-primary/5 text-primary" : "border-muted-foreground/20 text-muted-foreground hover:border-primary/50"
                      )}>
                      {b.icon} {b.label}
                    </button>
                  ))}
                </div>
              </div>
              {(form.benefit === "percent_off" || form.benefit === "fixed_amount" || form.benefit === "next_purchase_coupon") && (
                <div><Label>{form.benefit === "percent_off" ? "Porcentaje (%)" : "Monto ($)"}</Label><Input type="number" min={0} value={form.value || ""} onChange={(e) => update({ value: parseFloat(e.target.value) || 0 })} /></div>
              )}
              <div><Label>Compra mínima ($)</Label><Input type="number" min={0} value={form.minAmount || ""} onChange={(e) => update({ minAmount: parseFloat(e.target.value) || 0 })} placeholder="Sin mínimo" /></div>
              <div><Label>Código de cupón</Label><Input value={form.couponCode} onChange={(e) => update({ couponCode: e.target.value.toUpperCase() })} placeholder="Opcional" /></div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">Activa inmediatamente</span>
                <Switch checked={form.isActive} onCheckedChange={(c) => update({ isActive: c })} />
              </div>
              {preview && <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">📝 {preview}</div>}
            </div>
          )
        }
        if (step.id === "confirm") {
          return (
            <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
              <p className="font-bold">{form.name || "—"}</p>
              <p className="text-sm text-muted-foreground">{BENEFITS.find((b) => b.key === form.benefit)?.label} · ${form.value} · Min ${form.minAmount} · {form.isActive ? "Activa" : "Inactiva"}</p>
              {preview && <p className="text-xs text-emerald-700 dark:text-emerald-400">{preview}</p>}
            </div>
          )
        }
        return null
      }}
    </WizardShell>
  )
}
