"use client"

import { useState } from "react"
import { Truck, Store, Clock } from "lucide-react"
import { WizardShell, type WizardStep } from "./wizard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { swalError, swalLoading, swalClose } from "@/lib/swal"
import { cn } from "@/lib/utils"
import {
  ScheduleEditor,
  emptySchedule,
  buildLegend,
  type DaySchedule,
} from "@/components/base/schedule-editor"

interface DeliveryData {
  deliveryEnabled: boolean
  deliveryFee: number
  deliveryRadiusKm: number | null
  deliveryEstimatedMins: number | null
  deliverySchedule: DaySchedule[]
  pickupEnabled: boolean
  pickupFee: number
  pickupSchedule: DaySchedule[]
  onlinePaymentEnabled: boolean
}

const steps: WizardStep[] = [
  { id: "config", title: "Configuración" },
  { id: "schedule", title: "Horarios" },
  { id: "confirm", title: "Confirmar" },
]

interface Props {
  initial?: Partial<DeliveryData>
  onSave: (data: DeliveryData) => Promise<void>
  onClose: () => void
  /** Se invoca cuando el usuario toca el switch de pago en línea: debe llevar
   *  a la configuración real de la pasarela (Stripe/MercadoPago). */
  onEnableOnlinePayment?: () => void
}

export function DeliveryWizard({ initial, onSave, onClose, onEnableOnlinePayment }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<DeliveryData>({
    deliveryEnabled: initial?.deliveryEnabled ?? true,
    deliveryFee: initial?.deliveryFee ?? 45,
    deliveryRadiusKm: initial?.deliveryRadiusKm ?? 5,
    deliveryEstimatedMins: initial?.deliveryEstimatedMins ?? 45,
    deliverySchedule: initial?.deliverySchedule ?? emptySchedule(),
    pickupEnabled: initial?.pickupEnabled ?? true,
    pickupFee: initial?.pickupFee ?? 0,
    pickupSchedule: initial?.pickupSchedule ?? emptySchedule(),
    onlinePaymentEnabled: initial?.onlinePaymentEnabled ?? false,
  })
  const update = (p: Partial<DeliveryData>) => setForm((f) => ({ ...f, ...p }))

  const submit = async () => {
    swalLoading("Guardando…")
    setLoading(true)
    try {
      await onSave(form)
      swalClose()
      onClose()
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <WizardShell steps={steps} onFinish={submit} finishLabel={loading ? "Guardando…" : "Guardar"} loading={loading}>
      {({ step, goNext, isLast }) => {
        if (step.id === "config") {
          return (
            <div className="space-y-4">
              <div className={cn("rounded-xl border p-3 space-y-3", form.deliveryEnabled && "border-emerald-500/40 bg-emerald-500/5")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Truck className="size-4 text-emerald-600" /><span className="text-sm font-medium">Envío a domicilio</span></div>
                  <Switch checked={form.deliveryEnabled} onCheckedChange={(c) => update({ deliveryEnabled: c })} />
                </div>
                {form.deliveryEnabled && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Costo de envío ($)</Label><Input type="number" min={0} step={0.01} value={form.deliveryFee} onChange={(e) => update({ deliveryFee: parseFloat(e.target.value) || 0 })} /></div>
                    <div><Label>Radio de reparto (km)</Label><Input type="number" min={0} step={0.5} value={form.deliveryRadiusKm ?? ""} placeholder="5" onChange={(e) => update({ deliveryRadiusKm: e.target.value !== "" ? parseFloat(e.target.value) : null })} /></div>
                    <div className="sm:col-span-2"><Label>Tiempo estimado de entrega (min)</Label><Input type="number" min={0} step={5} value={form.deliveryEstimatedMins ?? ""} placeholder="45" onChange={(e) => update({ deliveryEstimatedMins: e.target.value !== "" ? Math.round(parseFloat(e.target.value)) : null })} /></div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">El horario de reparto se configura en el siguiente paso.</p>
              </div>

              <div className={cn("rounded-xl border p-3 space-y-3", form.pickupEnabled && "border-emerald-500/40 bg-emerald-500/5")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Store className="size-4 text-emerald-600" /><span className="text-sm font-medium">Recoger en sucursal</span></div>
                  <Switch checked={form.pickupEnabled} onCheckedChange={(c) => update({ pickupEnabled: c })} />
                </div>
                {form.pickupEnabled && (
                  <>
                    <div><Label>Costo por recoger ($)</Label><Input type="number" min={0} step={0.01} value={form.pickupFee} onChange={(e) => update({ pickupFee: parseFloat(e.target.value) || 0 })} placeholder="Gratis" /></div>
                    <p className="text-xs text-muted-foreground">El horario de recoger se configura en el siguiente paso.</p>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div>
                  <span className="text-sm font-medium">Pago en línea</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {form.onlinePaymentEnabled
                      ? "Activo: tus clientes pagan con tarjeta en el portal."
                      : "Conecta Stripe o MercadoPago para cobrar en línea."}
                    {onEnableOnlinePayment && (
                      <span className="block text-[11px]">
                        Toca el interruptor para abrir Ajustes → Pagos.
                      </span>
                    )}
                  </p>
                </div>
                <Switch
                  checked={form.onlinePaymentEnabled}
                  onCheckedChange={(c) => {
                    // El estado real vive en la pasarela (Ajustes → Pagos); el
                    // switch solo enciende/apaga navegando a esa configuración.
                    if (onEnableOnlinePayment) {
                      onEnableOnlinePayment()
                      return
                    }
                    update({ onlinePaymentEnabled: c })
                  }}
                />
              </div>
            </div>
          )
        }

        if (step.id === "schedule") {
          return (
            <div className="space-y-4">
              {!form.deliveryEnabled && !form.pickupEnabled && (
                <p className="text-sm text-muted-foreground">Habilita envío o recoger para definir su horario.</p>
              )}
              {form.deliveryEnabled && (
                <div className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Truck className="size-4 text-emerald-600" />
                    <span className="text-sm font-medium">Horario de envío a domicilio</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {buildLegend(form.deliverySchedule)}
                    </span>
                  </div>
                  <ScheduleEditor
                    schedule={form.deliverySchedule}
                    onChange={(s) => update({ deliverySchedule: s })}
                  />
                </div>
              )}
              {form.pickupEnabled && (
                <div className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Store className="size-4 text-emerald-600" />
                    <span className="text-sm font-medium">Horario de recoger en sucursal</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {buildLegend(form.pickupSchedule)}
                    </span>
                  </div>
                  <ScheduleEditor
                    schedule={form.pickupSchedule}
                    onChange={(s) => update({ pickupSchedule: s })}
                  />
                </div>
              )}
            </div>
          )
        }

        if (step.id === "confirm") {
          return (
            <div className="space-y-2 rounded-2xl border bg-muted/30 p-4 text-sm">
              <p className="flex items-center gap-2">
                <Truck className="size-4 text-emerald-600" />
                Envío: {form.deliveryEnabled ? `$${form.deliveryFee}` : "No"}
                {form.deliveryEnabled && (form.deliveryRadiusKm != null || form.deliveryEstimatedMins != null) && (
                  <span className="text-muted-foreground">
                    {form.deliveryRadiusKm != null && ` · ${form.deliveryRadiusKm} km`}
                    {form.deliveryEstimatedMins != null && ` · ~${form.deliveryEstimatedMins} min`}
                  </span>
                )}
              </p>
              {form.deliveryEnabled && (
                <p className="flex items-center gap-2 pl-6 text-muted-foreground">
                  <Clock className="size-3.5" /> {buildLegend(form.deliverySchedule)}
                </p>
              )}
              <p className="flex items-center gap-2">
                <Store className="size-4 text-emerald-600" />
                Pickup: {form.pickupEnabled ? (form.pickupFee > 0 ? `$${form.pickupFee}` : "Gratis") : "No"}
              </p>
              {form.pickupEnabled && (
                <p className="flex items-center gap-2 pl-6 text-muted-foreground">
                  <Clock className="size-3.5" /> {buildLegend(form.pickupSchedule)}
                </p>
              )}
              <p>💳 Pago en línea: {form.onlinePaymentEnabled ? "Sí" : "No"}</p>
            </div>
          )
        }
        return null
      }}
    </WizardShell>
  )
}
