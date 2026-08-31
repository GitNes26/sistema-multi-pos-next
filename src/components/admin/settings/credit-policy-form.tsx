"use client"

import { useCallback, useEffect, useState } from "react"
import { Save, Landmark, DollarSign, Clock, ShieldCheck, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { Skeleton } from "@/components/ui/skeleton"
import { swalToast, swalError } from "@/lib/swal"

interface CreditPolicyForm {
  creditEnabled: boolean
  defaultLimit: string
  maxDaysToPay: string
  requireApproval: boolean
  allowPartialPayments: boolean
  interestRate: string
  notifyBeforeDays: string
}

export function CreditPolicyForm() {
  const [form, setForm] = useState<CreditPolicyForm | null>(null)
  const [saving, setSaving] = useState(false)

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
      swalError("Error", "No se pudo cargar la política de crédito")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!form) return
    setSaving(true)
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
      swalToast("Política de crédito guardada")
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border p-4">
        <SwitchField
          id="SwitchCreditEnabled"
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
              label="Límite de crédito default"
              type="number"
              min={0}
              step="0.01"
              placeholder="Sin límite"
              leftIcon={<DollarSign className="size-4" />}
              value={form.defaultLimit}
              onChange={(e) => setForm({ ...form, defaultLimit: e.target.value })}
            />

            <InputGroupField
              label="Días máximos para pagar"
              type="number"
              min={1}
              step="1"
              placeholder="30"
              leftIcon={<Clock className="size-4" />}
              value={form.maxDaysToPay}
              onChange={(e) => setForm({ ...form, maxDaysToPay: e.target.value })}
            />

            <InputGroupField
              label="Notificar antes de vencer (días)"
              type="number"
              min={0}
              step="1"
              placeholder="3"
              leftIcon={<AlertTriangle className="size-4" />}
              value={form.notifyBeforeDays}
              onChange={(e) => setForm({ ...form, notifyBeforeDays: e.target.value })}
            />

            <InputGroupField
              label="Tasa de interés mensual (%)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="0 (sin interés)"
              leftIcon={<DollarSign className="size-4" />}
              value={form.interestRate}
              onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
            />

            <div className="space-y-2 border rounded-lg p-3">
              <SwitchField
                id="SwitchRequireApproval"
                label="Requiere aprobación de supervisor"
                icon={<ShieldCheck className="size-4" />}
                checked={form.requireApproval}
                onCheckedChange={(v) => setForm({ ...form, requireApproval: v })}
                border={false}
              />

              <SwitchField
                id="SwitchAllowPartial"
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

      <Button onClick={save} disabled={saving}>
        <Save className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  )
}
