"use client"

import { useCallback, useEffect, useState } from "react"
import * as yup from "yup"
import { AlertCircle, Save, Landmark, DollarSign, Clock, ShieldCheck, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { Skeleton } from "@/components/ui/skeleton"
import { swalToast } from "@/lib/swal"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"

interface CreditPolicyForm {
  creditEnabled: boolean
  defaultLimit: string
  maxDaysToPay: string
  requireApproval: boolean
  allowPartialPayments: boolean
  interestRate: string
  notifyBeforeDays: string
}

const DEFAULTS: CreditPolicyForm = {
  creditEnabled: false,
  defaultLimit: "",
  maxDaysToPay: "30",
  requireApproval: true,
  allowPartialPayments: true,
  interestRate: "",
  notifyBeforeDays: "3",
}

const optionalNumber = () => yup.number().transform((value, original) => original === "" ? undefined : value).typeError("Ingresa un número válido")

export function CreditPolicyForm() {
  const [form, setForm] = useState<CreditPolicyForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/credit-policy")
      if (!res.ok) throw new Error()
      const { policy: data } = await res.json()
      setForm({
        creditEnabled: data.creditEnabled ?? false,
        defaultLimit: data.defaultLimit != null ? String(data.defaultLimit) : "",
        maxDaysToPay: String(data.maxDaysToPay ?? 30),
        requireApproval: data.requireApproval ?? true,
        allowPartialPayments: data.allowPartialPayments ?? true,
        interestRate: data.interestRate != null ? String(data.interestRate) : "",
        notifyBeforeDays: String(data.notifyBeforeDays ?? 3),
      })
    } catch {
      setFormError("No se pudo cargar la política de crédito; se muestran valores predeterminados.")
      setForm({ ...DEFAULTS })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const ready = Boolean(form)
  useEffect(() => {
    if (!ready) return
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("credit-policy-form"))
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, ready])

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!form) return
    if (form.creditEnabled) {
      try {
        await yup.object({
          defaultLimit: optionalNumber().min(0, "El límite no puede ser negativo"),
          maxDaysToPay: yup.number().typeError("Ingresa un número válido").integer("Usa días completos").min(1, "Mínimo 1 día").required("Campo obligatorio"),
          notifyBeforeDays: yup.number().typeError("Ingresa un número válido").integer("Usa días completos").min(0, "No puede ser negativo").required("Campo obligatorio"),
          interestRate: optionalNumber().min(0, "La tasa no puede ser negativa").max(100, "Máximo 100%"),
        }).validate(form, { abortEarly: false })
        setErrors({})
      } catch (error) {
        if (error instanceof yup.ValidationError) {
          const next: Record<string, string> = {}
          for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message
          setErrors(next)
          const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`credit-${key}`, message]))
          window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "credit-policy-form"))
        }
        return
      }
    } else {
      setErrors({})
    }
    setSaving(true)
    setFormError(undefined)
    try {
      const res = await fetch("/api/credit-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditEnabled: form.creditEnabled,
          defaultLimit: form.defaultLimit !== "" ? Number(form.defaultLimit) : null,
          maxDaysToPay: Number(form.maxDaysToPay) || 30,
          requireApproval: form.requireApproval,
          allowPartialPayments: form.allowPartialPayments,
          interestRate: form.interestRate !== "" ? Number(form.interestRate) : null,
          notifyBeforeDays: Number(form.notifyBeforeDays) || 3,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "No se pudo guardar la política")
      }
      const { policy: data } = await res.json()
      setForm({
        creditEnabled: data.creditEnabled ?? false,
        defaultLimit: data.defaultLimit != null ? String(data.defaultLimit) : "",
        maxDaysToPay: String(data.maxDaysToPay ?? 30),
        requireApproval: data.requireApproval ?? true,
        allowPartialPayments: data.allowPartialPayments ?? true,
        interestRate: data.interestRate != null ? String(data.interestRate) : "",
        notifyBeforeDays: String(data.notifyBeforeDays ?? 3),
      })
      swalToast("Política de crédito guardada")
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
      </div>
    )
  }

  return (
    <form id="credit-policy-form" noValidate onSubmit={save} className="space-y-6">
      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}
        </div>
      )}
      <div className="space-y-4 rounded-lg border p-4" data-guide="credit-config">
        <SwitchField
          id="credit-enabled"
          label="Habilitar crédito"
          className="font-semibold"
          icon={<Landmark className="size-4" />}
          checked={form.creditEnabled}
          onCheckedChange={(v) => setForm({ ...form, creditEnabled: v })}
          border={false}
        />

        {form.creditEnabled && (
          <>
            <InputGroupField
              id="credit-defaultLimit"
              label="Límite de crédito default"
              type="number"
              min={0}
              step="0.01"
              placeholder="Sin límite"
              leftIcon={<DollarSign className="size-4" />}
              value={form.defaultLimit}
              onChange={(e) => setForm({ ...form, defaultLimit: e.target.value })}
              error={errors.defaultLimit}
            />

            <InputGroupField
              id="credit-maxDaysToPay"
              label="Días máximos para pagar"
              type="number"
              min={1}
              step="1"
              placeholder="30"
              leftIcon={<Clock className="size-4" />}
              value={form.maxDaysToPay}
              onChange={(e) => setForm({ ...form, maxDaysToPay: e.target.value })}
              required
              error={errors.maxDaysToPay}
            />

            <InputGroupField
              id="credit-notifyBeforeDays"
              label="Notificar antes de vencer (días)"
              type="number"
              min={0}
              step="1"
              placeholder="3"
              leftIcon={<AlertTriangle className="size-4" />}
              value={form.notifyBeforeDays}
              onChange={(e) => setForm({ ...form, notifyBeforeDays: e.target.value })}
              required
              error={errors.notifyBeforeDays}
            />

            <InputGroupField
              id="credit-interestRate"
              label="Tasa de interés mensual (%)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="0 (sin interés)"
              leftIcon={<DollarSign className="size-4" />}
              value={form.interestRate}
              onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
              error={errors.interestRate}
            />

            <div className="space-y-2 border rounded-lg p-3">
              <SwitchField
                id="credit-requireApproval"
                label="Requiere aprobación de supervisor"
                icon={<ShieldCheck className="size-4" />}
                checked={form.requireApproval}
                onCheckedChange={(v) => setForm({ ...form, requireApproval: v })}
                border={false}
              />

              <SwitchField
                id="credit-allowPartial"
                label="Permitir pagos parciales"
                icon={<DollarSign className="size-4" />}
                checked={form.allowPartialPayments}
                onCheckedChange={(v) => setForm({ ...form, allowPartialPayments: v })}
                border={false}
              />
            </div>
          </>
        )}
      </div>

      <Button type="submit" disabled={saving} data-guide="credit-save">
        <Save className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  )
}
