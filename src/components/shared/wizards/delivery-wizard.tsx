"use client"

import { useState } from "react"
import { Truck, Store } from "lucide-react"
import { WizardShell, type WizardStep } from "./wizard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { swalError, swalLoading, swalClose } from "@/lib/swal"
import { cn } from "@/lib/utils"

interface DeliveryData {
  deliveryEnabled: boolean
  deliveryFee: number
  pickupEnabled: boolean
  pickupFee: number
  onlinePaymentEnabled: boolean
}

const steps: WizardStep[] = [
  { id: "config", title: "Configuración" },
  { id: "confirm", title: "Confirmar" },
]

interface Props {
  initial?: Partial<DeliveryData>
  onSave: (data: DeliveryData) => Promise<void>
  onClose: () => void
}

export function DeliveryWizard({ initial, onSave, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<DeliveryData>({
    deliveryEnabled: initial?.deliveryEnabled ?? true,
    deliveryFee: initial?.deliveryFee ?? 45,
    pickupEnabled: initial?.pickupEnabled ?? true,
    pickupFee: initial?.pickupFee ?? 0,
    onlinePaymentEnabled: initial?.onlinePaymentEnabled ?? false,
  })
  const update = (p: Partial<DeliveryData>) => setForm((f) => ({ ...f, ...p }))

  const submit = async () => {
    swalLoading("Guardando…")
    setLoading(true)
    try { await onSave(form); swalClose(); onClose() }
    catch (err) { swalError("Error", err instanceof Error ? err.message : undefined) }
    finally { setLoading(false) }
  }

  return (
    <WizardShell steps={steps} onFinish={submit} finishLabel={loading ? "Guardando…" : "Guardar"} loading={loading}>
      {({ step }) => {
        if (step.id === "config") {
          return (
            <div className="space-y-4">
              <div className={cn("rounded-xl border p-3 space-y-2", form.deliveryEnabled && "border-emerald-500/40 bg-emerald-500/5")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Truck className="size-4 text-emerald-600" /><span className="text-sm font-medium">Envío a domicilio</span></div>
                  <Switch checked={form.deliveryEnabled} onCheckedChange={(c) => update({ deliveryEnabled: c })} />
                </div>
                {form.deliveryEnabled && (
                  <div><Label>Costo de envío ($)</Label><Input type="number" min={0} step={0.01} value={form.deliveryFee} onChange={(e) => update({ deliveryFee: parseFloat(e.target.value) || 0 })} /></div>
                )}
              </div>
              <div className={cn("rounded-xl border p-3 space-y-2", form.pickupEnabled && "border-emerald-500/40 bg-emerald-500/5")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Store className="size-4 text-emerald-600" /><span className="text-sm font-medium">Recoger en sucursal</span></div>
                  <Switch checked={form.pickupEnabled} onCheckedChange={(c) => update({ pickupEnabled: c })} />
                </div>
                {form.pickupEnabled && (
                  <div><Label>Costo por recoger ($)</Label><Input type="number" min={0} step={0.01} value={form.pickupFee} onChange={(e) => update({ pickupFee: parseFloat(e.target.value) || 0 })} placeholder="Gratis" /></div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">Pago en línea</span>
                <Switch checked={form.onlinePaymentEnabled} onCheckedChange={(c) => update({ onlinePaymentEnabled: c })} />
              </div>
            </div>
          )
        }
        if (step.id === "confirm") {
          return (
            <div className="space-y-2 rounded-2xl border bg-muted/30 p-4 text-sm">
              <p>🚚 Envío: {form.deliveryEnabled ? `$${form.deliveryFee}` : "No"}</p>
              <p>🏪 Pickup: {form.pickupEnabled ? (form.pickupFee > 0 ? `$${form.pickupFee}` : "Gratis") : "No"}</p>
              <p>💳 Pago en línea: {form.onlinePaymentEnabled ? "Sí" : "No"}</p>
            </div>
          )
        }
        return null
      }}
    </WizardShell>
  )
}
