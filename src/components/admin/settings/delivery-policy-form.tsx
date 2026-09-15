"use client"

import { useCallback, useEffect, useState } from "react"
import * as yup from "yup"
import { AlertCircle, Save, Truck, Store, DollarSign, Coins, Clock, Route } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { Skeleton } from "@/components/ui/skeleton"
import { swalToast } from "@/lib/swal"
import {
  ScheduleEditor,
  emptySchedule,
  type DaySchedule,
} from "@/components/base/schedule-editor"
import { SwitchField } from "@/components/base/switch-field"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"

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
  deliveryFeeType: "fixed" | "per_km"
  deliveryFeePerKm: string
  deliverySchedule: DaySchedule[]
  deliveryRadiusKm: string
  deliveryEstimatedMins: string
}

function normalizePolicy(raw: Record<string, unknown> | null | undefined): PolicyForm {
  const data = raw ?? {}
  return {
    pickupEnabled: Boolean(data.pickupEnabled),
    pickupMinAmount: data.pickupMinAmount != null ? String(data.pickupMinAmount) : "",
    pickupFeeEnabled: Boolean(data.pickupFeeEnabled),
    pickupFee: data.pickupFee != null ? String(data.pickupFee) : "",
    pickupSchedule: Array.isArray(data.pickupSchedule) ? data.pickupSchedule as DaySchedule[] : emptySchedule(),
    deliveryEnabled: Boolean(data.deliveryEnabled),
    deliveryMinAmount: data.deliveryMinAmount != null ? String(data.deliveryMinAmount) : "",
    deliveryFeeEnabled: Boolean(data.deliveryFeeEnabled),
    deliveryFee: data.deliveryFee != null ? String(data.deliveryFee) : "",
    deliveryFeeType: data.deliveryFeeType === "per_km" ? "per_km" : "fixed",
    deliveryFeePerKm: data.deliveryFeePerKm != null ? String(data.deliveryFeePerKm) : "",
    deliverySchedule: Array.isArray(data.deliverySchedule) ? data.deliverySchedule as DaySchedule[] : emptySchedule(),
    deliveryRadiusKm: data.deliveryRadiusKm != null ? String(data.deliveryRadiusKm) : "",
    deliveryEstimatedMins: data.deliveryEstimatedMins != null ? String(data.deliveryEstimatedMins) : "",
  }
}

const optionalNumber = () => yup.number().transform((value, original) => original === "" ? undefined : value).typeError("Ingresa un número válido")

export function DeliveryPolicyForm() {
  const [form, setForm] = useState<PolicyForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/delivery-policy")
      if (!res.ok) throw new Error()
      const { policy: raw } = await res.json()
      // Negocio nuevo: puede no existir política todavía (policy === null).
      setForm(normalizePolicy(raw))
    } catch {
      setFormError("No se pudo cargar la política de entrega; se muestran valores predeterminados.")
      setForm(normalizePolicy(null))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const ready = Boolean(form)
  useEffect(() => {
    if (!ready) return
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("delivery-policy-form"))
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, ready])

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!form) return
    const shape: Record<string, yup.AnySchema> = {}
    if (form.pickupEnabled) {
      shape.pickupMinAmount = optionalNumber().min(0, "El monto no puede ser negativo")
      if (form.pickupFeeEnabled) shape.pickupFee = optionalNumber().required("La tarifa es obligatoria").min(0, "La tarifa no puede ser negativa")
    }
    if (form.deliveryEnabled) {
      shape.deliveryMinAmount = optionalNumber().min(0, "El monto no puede ser negativo")
      if (form.deliveryFeeEnabled) {
        const key = form.deliveryFeeType === "per_km" ? "deliveryFeePerKm" : "deliveryFee"
        shape[key] = optionalNumber().required("La tarifa es obligatoria").min(0, "La tarifa no puede ser negativa")
      }
      shape.deliveryRadiusKm = optionalNumber().moreThan(0, "El radio debe ser mayor que cero")
      shape.deliveryEstimatedMins = optionalNumber().integer("Usa minutos completos").moreThan(0, "El tiempo debe ser mayor que cero")
    }
    try {
      await yup.object(shape).validate(form, { abortEarly: false })
      setErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message
        setErrors(next)
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`delivery-${key}`, message]))
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "delivery-policy-form"))
      }
      return
    }
    setSaving(true)
    setFormError(undefined)
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
          deliveryFeeType: form.deliveryFeeType,
          deliveryFeePerKm: form.deliveryFeePerKm !== "" ? Number(form.deliveryFeePerKm) : 0,
          deliverySchedule: form.deliverySchedule,
          deliveryRadiusKm:
            form.deliveryRadiusKm !== "" ? Number(form.deliveryRadiusKm) : null,
          deliveryEstimatedMins:
            form.deliveryEstimatedMins !== ""
              ? Number(form.deliveryEstimatedMins)
              : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "No se pudo guardar la política")
      }
      const { policy: raw } = await res.json()
      setForm(normalizePolicy(raw))
      swalToast("Política de entrega guardada")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo guardar la política")
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
    <form id="delivery-policy-form" noValidate onSubmit={save} className="space-y-6">
      {formError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}</div>}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* ── Recoger en sucursal ── */}
        <section className="space-y-3 rounded-lg border p-4" data-guide="delivery-pickup">
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
                id="delivery-pickupMinAmount"
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
                error={errors.pickupMinAmount}
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
                    id="delivery-pickupFee"
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
                    required
                    error={errors.pickupFee}
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
        <section className="space-y-3 rounded-lg border p-4" data-guide="delivery-home">
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
                id="delivery-deliveryMinAmount"
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
                error={errors.deliveryMinAmount}
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

                {form.deliveryFeeEnabled && (<div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de calcular la tarifa">
                    {([['fixed', 'Tarifa fija'], ['per_km', 'Por kilómetro']] as const).map(([value, label]) => (
                      <button key={value} type="button" role="radio" aria-checked={form.deliveryFeeType === value}
                        onClick={() => setForm({ ...form, deliveryFeeType: value })}
                        className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors ${form.deliveryFeeType === value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <InputGroupField
                    id={form.deliveryFeeType === "per_km" ? "delivery-deliveryFeePerKm" : "delivery-deliveryFee"}
                    label={form.deliveryFeeType === "per_km" ? "Precio por kilómetro" : "Tarifa fija de envío"}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    leftIcon={form.deliveryFeeType === "per_km" ? <Route className="size-4" /> : <DollarSign className="size-4" />}
                    value={form.deliveryFeeType === "per_km" ? form.deliveryFeePerKm : form.deliveryFee}
                    onChange={(e) =>
                      setForm(form.deliveryFeeType === "per_km" ? { ...form, deliveryFeePerKm: e.target.value } : { ...form, deliveryFee: e.target.value })
                    }
                    required
                    error={form.deliveryFeeType === "per_km" ? errors.deliveryFeePerKm : errors.deliveryFee}
                  />
                  <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                    {form.deliveryFeeType === "per_km"
                      ? `Ejemplo: un domicilio a 8 km × $${Number(form.deliveryFeePerKm || 0).toFixed(2)} = $${(8 * Number(form.deliveryFeePerKm || 0)).toFixed(2)} de envío. La distancia se calcula desde la sucursal habilitada más cercana.`
                      : `Ejemplo: si defines $${Number(form.deliveryFee || 0).toFixed(2)}, el cliente pagará esa cantidad por cualquier entrega dentro del radio permitido.`}
                  </p>
                </div>)}
              </div>
              <div className="border rounded-lg p-2 grid gap-3 sm:grid-cols-2">
                <InputGroupField
                  id="delivery-deliveryRadiusKm"
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
                  error={errors.deliveryRadiusKm}
                />
                <InputGroupField
                  id="delivery-deliveryEstimatedMins"
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
                  error={errors.deliveryEstimatedMins}
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

      <Button type="submit" disabled={saving} data-guide="delivery-save">
        <Save className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  )
}
