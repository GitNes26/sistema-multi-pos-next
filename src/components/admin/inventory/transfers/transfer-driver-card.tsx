"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Link2, Loader2, Truck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { FormCombobox } from "@/components/base/form-combobox"
import { crudApi } from "@/lib/api"
import { swalError, swalToast } from "@/lib/swal"
import { transfersApi, type TransferDetail } from "@/lib/inventory/transfers-client"

/**
 * Responsable del traslado, como un repartidor: un trabajador (usa su interfaz en /repartidor y
 * comparte su ubicación) o solo un nombre, con un enlace para compartir la ubicación sin cuenta.
 * Se puede cambiar mientras el traslado siga activo, también en camino.
 */
export function TransferDriverCard({ t, onChanged }: { t: TransferDetail; onChanged: () => void }) {
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([])
  const [employeeId, setEmployeeId] = useState<string | null>(t.driver.employeeId)
  const [name, setName] = useState(t.driver.employeeId ? "" : (t.driver.name ?? ""))
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    crudApi
      .list("employees", { pageSize: 250 })
      .then((r) => setEmployees(r.rows.filter((e) => e.isActive !== false).map((e) => ({ value: String(e.id), label: String(e.fullName ?? e.name ?? "Empleado") }))))
      .catch(() => setEmployees([]))
  }, [])

  const link = t.driver.trackToken && typeof window !== "undefined" ? `${window.location.origin}/traslado/${t.driver.trackToken}` : null

  const save = async () => {
    if (!employeeId && !name.trim()) {
      swalError("Falta el responsable", "Elige un trabajador o escribe el nombre de quien lo lleva.")
      return
    }
    setBusy(true)
    try {
      await transfersApi.action(t.id, { action: "assign", employeeId: employeeId ?? undefined, name: employeeId ? undefined : name.trim() })
      swalToast("Responsable asignado")
      onChanged()
    } catch (err) {
      swalError("No se pudo asignar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      swalError("No se pudo copiar el enlace")
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-e1">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Truck className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Chofer del traslado</h2>
          <p className="text-xs text-muted-foreground">
            {t.driver.name
              ? t.driver.employeeId
                ? `${t.driver.name} · ${t.driver.accepted ? "ya aceptó" : "falta que acepte"}`
                : `${t.driver.name} · sin cuenta`
              : "Sin chofer asignado"}
          </p>
        </div>
      </div>

      <FormCombobox
        label="Trabajador"
        icon={<User className="size-4" />}
        options={employees}
        value={employeeId}
        onChange={(v) => {
          setEmployeeId(v || null)
          if (v) setName("")
        }}
        onClear={() => setEmployeeId(null)}
        clearable
        searchable
        placeholder="Elige a quien lo lleva"
        helper="Lo verá en su interfaz de entregas y compartirá su ubicación."
      />
      {!employeeId && (
        <InputGroupField
          label="…o escribe el nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<User className="size-4" />}
          placeholder="Si no es trabajador (proveedor, familiar, paquetería)"
          helper="Recibirá un enlace para compartir su ubicación sin necesidad de cuenta."
        />
      )}
      <Button className="w-full" onClick={() => void save()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} Asignar chofer
      </Button>

      {link && (
        <div className="space-y-1.5 rounded-xl bg-muted/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Link2 className="size-3.5" /> Enlace para compartir su ubicación
          </p>
          <p className="break-all text-xs text-muted-foreground">{link}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://wa.me/?text=${encodeURIComponent(`Traslado ${t.folio}: comparte tu ubicación aquí ${link}`)}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
