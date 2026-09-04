"use client"

import { useCallback, useEffect, useState } from "react"
import { Save, Truck, Store, DollarSign, Coins, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { Skeleton } from "@/components/ui/skeleton"
import { swalToast, swalError } from "@/lib/swal"
import {
  ScheduleEditor,
  emptySchedule,
  type DaySchedule,
} from "@/components/base/schedule-editor"
import { SwitchField } from "@/components/base/switch-field"

interface PolicyForm {
  pickupEnabled: boolean
  pickupMinAmount: string
  pickupFeeEnabled: boolean
  pickupFee: string
  pickupSchedule: DaySchedule[]
  deliveryEnabled: boolean
  deliveryMinAmount: string
  deliveryFeeEnabled: boolean
  deliveryFee: string
  deliverySchedule: DaySchedule[]
  deliveryRadiusKm: string
  deliveryEstimatedMins: string
}

export function DeliveryPolicyForm() {
  const [form, setForm] = useState<PolicyForm | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/delivery-policy")
      if (!res.ok) throw new Error()
      const { policy: raw } = await res.json()
      // Negocio nuevo: puede no existir política todavía (policy === null).
      const data = raw ?? {}
      setForm({
        pickupEnabled: data.pickupEnabled ?? false,
        pickupMinAmount:
          data.pickupMinAmount != null ? String(data.pickupMinAmount) : "",
        pickupFeeEnabled: data.pickupFeeEnabled ?? false,
        pickupFee: data.pickupFee != null ? String(data.pickupFee) : "",
        pickupSchedule: Array.isArray(data.pickupSchedule)
          ? data.pickupSchedule
          : emptySchedule(),
        deliveryEnabled: data.deliveryEnabled ?? false,
        deliveryMinAmount:
          data.deliveryMinAmount != null ? String(data.deliveryMinAmount) : "",
        deliveryFeeEnabled: data.deliveryFeeEnabled ?? false,
        deliveryFee: data.deliveryFee != null ? String(data.deliveryFee) : "",
        deliverySchedule: Array.isArray(data.deliverySchedule)
          ? data.deliverySchedule
          : emptySchedule(),
        deliveryRadiusKm:
          data.deliveryRadiusKm != null ? String(data.deliveryRadiusKm) : "",
        deliveryEstimatedMins:
          data.deliveryEstimatedMins != null
            ? String(data.deliveryEstimatedMins)
            : "",
      })
    } catch {
      swalError("Error", "No se pudo cargar la política de entrega")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch("/api/delivery-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupEnabled: form.pickupEnabled,
          pickupMinAmount:
            form.pickupMinAmount !== "" ? Number(form.pickupMinAmount) : null,
          pickupFeeEnabled: form.pickupFeeEnabled,
          pickupFee: form.pickupFee !== "" ? Number(form.pickupFee) : 0,
          pickupSchedule: form.pickupSchedule,
          deliveryEnabled: form.deliveryEnabled,
          deliveryMinAmount:
            form.deliveryMinAmount !== ""
              ? Number(form.deliveryMinAmount)
              : null,
          deliveryFeeEnabled: form.deliveryFeeEnabled,
          deliveryFee: form.deliveryFee !== "" ? Number(form.deliveryFee) : 0,
          deliverySchedule: form.deliverySchedule,
          deliveryRadiusKm:
            form.deliveryRadiusKm !== "" ? Number(form.deliveryRadiusKm) : null,
          deliveryEstimatedMins:
            form.deliveryEstimatedMins !== ""
              ? Number(form.deliveryEstimatedMins)
              : null,
        }),
      })
      if (!res.ok) throw new Error()
      const { policy: raw } = await res.json()
      const data = raw ?? {}
      setForm({
        pickupEnabled: data.pickupEnabled ?? false,
        pickupMinAmount:
          data.pickupMinAmount != null ? String(data.pickupMinAmount) : "",
        pickupFeeEnabled: data.pickupFeeEnabled ?? false,
        pickupFee: data.pickupFee != null ? String(data.pickupFee) : "",
        pickupSchedule: Array.isArray(data.pickupSchedule)
          ? data.pickupSchedule
          : emptySchedule(),
        deliveryEnabled: data.deliveryEnabled ?? false,
        deliveryMinAmount:
          data.deliveryMinAmount != null ? String(data.deliveryMinAmount) : "",
        deliveryFeeEnabled: data.deliveryFeeEnabled ?? false,
        deliveryFee: data.deliveryFee != null ? String(data.deliveryFee) : "",
        deliverySchedule: Array.isArray(data.deliverySchedule)
          ? data.deliverySchedule
          : emptySchedule(),
        deliveryRadiusKm:
          data.deliveryRadiusKm != null ? String(data.deliveryRadiusKm) : "",
        deliveryEstimatedMins:
          data.deliveryEstimatedMins != null
            ? String(data.deliveryEstimatedMins)
            : "",
      })
      swalToast("Política de entrega guardada")
    } catch {
      swalError("No se pudo guardar", "Intenta de nuevo")
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-3">
        {/* ── Recoger en sucursal ── */}
        <section className="space-y-3 rounded-lg border p-4">
          <SwitchField
            id="SwitchRecogerEnSucursal"
            label="Recoger en sucursal"
            className={"font-semibold"}
            icon={<Store className="size-4" />}
            checked={form.pickupEnabled}
            onCheckedChange={(v) => setForm({ ...form, pickupEnabled: v })}
            border={false}
          />

          {form.pickupEnabled && (
            <>
              <InputGroupField
                label="Monto mínimo"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                // leftIcon={<span className="text-sm">$</span>}
                leftIcon={<DollarSign className="size-4" />}
                value={form.pickupMinAmount}
                onChange={(e) =>
                  setForm({ ...form, pickupMinAmount: e.target.value })
                }
              />

              <div className={"border rounded-lg p-2 my-4"}>
                <SwitchField
                  id="SwitchRecogerCobrarTarifa"
                  label="Cobrar tarifa"
                  icon={<Coins className="size-4" />}
                  className="mb-3"
                  checked={form.pickupFeeEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, pickupFeeEnabled: v })
                  }
                  border={false}
                />

                {form.pickupFeeEnabled && (
                  <InputGroupField
                    label="Tarifa de recogida"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    leftIcon={<DollarSign className="size-4" />}
                    value={form.pickupFee}
                    onChange={(e) =>
                      setForm({ ...form, pickupFee: e.target.value })
                    }
                  />
                )}
              </div>
              <div className="space-y-2 border rounded-lg p-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="size-4 text-muted-foreground" />
                  Horario
                </div>
                <ScheduleEditor
                  schedule={form.pickupSchedule}
                  onChange={(s) => setForm({ ...form, pickupSchedule: s })}
                />
              </div>
            </>
          )}
        </section>

        {/* ── Entrega a domicilio ── */}
        <section className="space-y-3 rounded-lg border p-4">
          <SwitchField
            id="SwitchEntregaADomicilio"
            label="Entrega a domicilio"
            className={"font-semibold"}
            icon={<Truck className="size-4" />}
            checked={form.deliveryEnabled}
            onCheckedChange={(v) => setForm({ ...form, deliveryEnabled: v })}
            border={false}
          />

          {form.deliveryEnabled && (
            <>
              <InputGroupField
                label="Monto mínimo"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                leftIcon={<DollarSign className="size-4" />}
                value={form.deliveryMinAmount}
                onChange={(e) =>
                  setForm({ ...form, deliveryMinAmount: e.target.value })
                }
              />

              <div className={"border rounded-lg p-2 my-4"}>
                <SwitchField
                  id="SwitchEntregaCobrarTarifa"
                  label="Cobrar tarifa"
                  icon={<Coins className="size-4" />}
                  className="mb-3"
                  checked={form.deliveryFeeEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, deliveryFeeEnabled: v })
                  }
                  border={false}
                />

                {form.deliveryFeeEnabled && (
                  <InputGroupField
                    label="Tarifa de envío"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    leftIcon={<DollarSign className="size-4" />}
                    value={form.deliveryFee}
                    onChange={(e) =>
                      setForm({ ...form, deliveryFee: e.target.value })
                    }
                  />
                )}
              </div>
              <div className="border rounded-lg p-2 grid gap-3 sm:grid-cols-2">
                <InputGroupField
                  label="Radio de entrega (km)"
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="0"
                  leftIcon={<Truck className="size-4" />}
                  value={form.deliveryRadiusKm}
                  onChange={(e) =>
                    setForm({ ...form, deliveryRadiusKm: e.target.value })
                  }
                />
                <InputGroupField
                  label="Tiempo estimado (min)"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="0"
                  leftIcon={<Clock className="size-4" />}
                  value={form.deliveryEstimatedMins}
                  onChange={(e) =>
                    setForm({ ...form, deliveryEstimatedMins: e.target.value })
                  }
                />
              </div>

              <div className="border rounded-lg p-2 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="size-4 text-muted-foreground" />
                  Horario
                </div>
                <ScheduleEditor
                  schedule={form.deliverySchedule}
                  onChange={(s) => setForm({ ...form, deliverySchedule: s })}
                />
              </div>
            </>
          )}
        </section>
      </div>

      <Button onClick={save} disabled={saving}>
        <Save className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  )
}
