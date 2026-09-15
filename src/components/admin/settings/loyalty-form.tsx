"use client"

import { useEffect, useState } from "react"
import * as yup from "yup"
import { AlertCircle, Coins, DollarSign, Sparkles } from "lucide-react"
import { settingsApi } from "@/lib/settings/client"
import type { LoyaltySettings } from "@/lib/settings/server"
import { swalToast } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { money } from "@/lib/pos/money"

export function LoyaltyForm() {
  const [form, setForm] = useState<LoyaltySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  useEffect(() => {
    settingsApi
      .loyalty()
      .then((d) => setForm(d.settings))
      .catch(() => setFormError("No se pudo cargar la configuración de lealtad"))
  }, [])

  const ready = Boolean(form)
  useEffect(() => {
    if (!ready) return
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("loyalty-form"))
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, ready])

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!form) return
    try {
      await yup.object({
        pointsPerCurrency: yup.number().typeError("Ingresa un número válido").min(0, "No puede ser negativo").required("Campo obligatorio"),
        pointValue: yup.number().typeError("Ingresa un número válido").min(0, "No puede ser negativo").required("Campo obligatorio"),
      }).validate(form, { abortEarly: false })
      setErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message
        setErrors(next)
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`loyalty-${key}`, message]))
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "loyalty-form"))
      }
      return
    }
    setSaving(true)
    setFormError(undefined)
    try {
      const res = await settingsApi.updateLoyalty({
        pointsPerCurrency: Number(form.pointsPerCurrency),
        pointValue: Number(form.pointValue),
        loyaltyEnabled: form.loyaltyEnabled,
      })
      setForm(res.settings)
      swalToast("Configuración de lealtad guardada")
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la configuración")
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const exampleAmount = 100
  const examplePoints = Math.round(exampleAmount * Number(form.pointsPerCurrency) * 100) / 100
  const exampleValue = examplePoints * Number(form.pointValue)

  return (
    <form id="loyalty-form" noValidate onSubmit={save} className="space-y-4">
      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}
        </div>
      )}
      <SwitchField
        id="loyalty-enabled"
        label="Lealtad habilitada"
        description="Acumular y canjear puntos"
        icon={<Coins className="size-4" />}
        className="mb-3"
        checked={form.loyaltyEnabled}
        onCheckedChange={(v) => setForm({ ...form, loyaltyEnabled: v })}
      />
      <div className="grid gap-4 sm:grid-cols-2 mt-3">
        <InputGroupField
          id="loyalty-pointsPerCurrency"
          label="Puntos que gana por cada $1"
          helper="Multiplica el total de la compra por esta cantidad."
          type="number"
          min={0}
          step="0.01"
          leftIcon={<Coins className="size-4" />}
          value={form.pointsPerCurrency}
          onChange={(e) =>
            setForm({ ...form, pointsPerCurrency: Number(e.target.value) })
          }
          error={errors.pointsPerCurrency}
        />
        <InputGroupField
          id="loyalty-pointValue"
          label="Cuánto vale 1 punto"
          helper="Importe que se descuenta cuando el cliente canjea un punto."
          type="number"
          min={0}
          step="0.01"
          leftIcon={<DollarSign className="size-4" />}
          value={form.pointValue}
          onChange={(e) =>
            setForm({ ...form, pointValue: Number(e.target.value) })
          }
          error={errors.pointValue}
        />
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Así funciona la regla</p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <p><strong>$1 comprado</strong><br />genera {form.pointsPerCurrency || 0} punto(s)</p>
          <p><strong>1 punto</strong><br />equivale a {money(Number(form.pointValue) || 0)}</p>
          <p><strong>Compra de {money(exampleAmount)}</strong><br />genera {examplePoints} punto(s), equivalentes a {money(exampleValue)}</p>
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        <Sparkles className="size-4" />{" "}
        {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  )
}
