"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CreditCard, Hash, Landmark, Save, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { swalToast } from "@/lib/swal"

interface TransferForm {
  enabled: boolean
  bank: string
  holder: string
  clabe: string
  account: string
  card: string
  note: string
}

/** Datos para recibir transferencias: se muestran en la ventana de cobro del POS cuando están habilitados. */
export function TransferInfoSection() {
  const [form, setForm] = useState<TransferForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    fetch("/api/settings/payments/transfer")
      .then((r) => r.json())
      .then((d) => (d.ok ? setForm(d.transfer) : setError(d.error ?? "No se pudieron cargar los datos")))
      .catch(() => setError("No se pudieron cargar los datos de transferencia"))
  }, [])

  if (!form) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <Skeleton className="h-40 w-full" />

  const set = <K extends keyof TransferForm>(key: K, value: TransferForm[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(undefined)
    try {
      const res = await fetch("/api/settings/payments/transfer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar")
      setForm(data.transfer)
      swalToast("Datos de transferencia guardados")
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="mt-6 space-y-4 rounded-lg border p-4" id="transfer-info-form">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Landmark className="size-4 text-muted-foreground" />Cobro por transferencia o depósito</p>
        <p className="text-xs text-muted-foreground">Al habilitarlo, la ventana de cobro del POS muestra estos datos (con botón de copiar) para que el cliente transfiera. Solo los ve el personal.</p>
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />{error}
        </div>
      )}
      <SwitchField id="transfer-enabled" label="Mostrar datos de transferencia en el POS" checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <InputGroupField id="transfer-bank" label="Banco" leftIcon={<Landmark className="size-4" />} value={form.bank} onChange={(e) => set("bank", e.target.value)} />
        <InputGroupField id="transfer-holder" label="Titular" leftIcon={<UserRound className="size-4" />} value={form.holder} onChange={(e) => set("holder", e.target.value)} />
        <InputGroupField id="transfer-clabe" label="CLABE interbancaria" helper="18 dígitos" inputMode="numeric" maxLength={18} leftIcon={<Hash className="size-4" />} value={form.clabe} onChange={(e) => set("clabe", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField id="transfer-account" label="Número de cuenta" inputMode="numeric" leftIcon={<Hash className="size-4" />} value={form.account} onChange={(e) => set("account", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField id="transfer-card" label="Tarjeta para depósito" helper="Opcional" inputMode="numeric" maxLength={19} leftIcon={<CreditCard className="size-4" />} value={form.card} onChange={(e) => set("card", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField id="transfer-note" label="Indicación" helper="Ej. enviar comprobante al WhatsApp" maxLength={300} value={form.note} onChange={(e) => set("note", e.target.value)} />
      </div>
      <Button type="submit" disabled={saving}>
        <Save className="size-4" /> {saving ? "Guardando…" : "Guardar datos de transferencia"}
      </Button>
    </form>
  )
}
