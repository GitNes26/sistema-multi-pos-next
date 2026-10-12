"use client"

import { useEffect, useState } from "react"
import { Check, CheckCircle2, Copy, Link2, Loader2, Truck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroupField } from "@/components/base/input-group-field"
import { FormCombobox } from "@/components/base/form-combobox"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { crudApi } from "@/lib/api"
import { swalError, swalToast } from "@/lib/swal"
import { transfersApi, type TransferDetail } from "@/lib/inventory/transfers-client"

/**
 * Responsable del traslado, como un repartidor. Dos opciones (basta una): un trabajador, que lo
 * ve en «Mis entregas» y comparte su ubicación, o solo un nombre (servicio externo), que recibe un
 * enlace para compartirla sin cuenta. Una vez que el trabajador confirma, la asignación se bloquea.
 */
export function TransferDriverCard({ t, onChanged }: { t: TransferDetail; onChanged: () => void }) {
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([])
  const [employeeId, setEmployeeId] = useState<string>(t.driver.employeeId ?? "")
  const [name, setName] = useState(t.driver.employeeId ? "" : (t.driver.name ?? ""))
  const [vehicle, setVehicle] = useState(t.vehicle ?? "")
  const [expectedAt, setExpectedAt] = useState<Date | null>(t.expectedAt ? new Date(t.expectedAt) : null)
  const [errors, setErrors] = useState<{ driver?: string; vehicle?: string }>({})
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    crudApi
      .list("employees", { pageSize: 250 })
      .then((r) => setEmployees(r.rows.filter((e) => e.isActive !== false).map((e) => ({ value: String(e.id), label: String(e.fullName ?? e.name ?? "Empleado") }))))
      .catch(() => setEmployees([]))
  }, [])

  const assigned = Boolean(t.driver.name)
  // El trabajador ya confirmó: no se puede cambiar la asignación.
  const locked = Boolean(t.driver.employeeId && t.driver.accepted)
  const unchanged =
    assigned &&
    (t.driver.employeeId ?? "") === employeeId &&
    (employeeId ? true : (t.driver.name ?? "") === name.trim()) &&
    (t.vehicle ?? "") === vehicle.trim() &&
    (t.expectedAt ? new Date(t.expectedAt).getTime() : null) === (expectedAt ? expectedAt.getTime() : null)

  const link = t.driver.trackToken && typeof window !== "undefined" ? `${window.location.origin}/traslado/${t.driver.trackToken}` : null

  const save = async () => {
    const next: typeof errors = {}
    if (!employeeId && !name.trim()) next.driver = "Elige un trabajador o escribe el nombre de quien lo lleva"
    if (!vehicle.trim()) next.vehicle = "Escribe el vehículo y las placas"
    setErrors(next)
    if (next.driver || next.vehicle) return
    setBusy(true)
    try {
      await transfersApi.action(t.id, {
        action: "assign",
        employeeId: employeeId || undefined,
        name: employeeId ? undefined : name.trim(),
        vehicle: vehicle.trim(),
        expectedAt: expectedAt ? expectedAt.toISOString() : null,
      })
      swalToast("Chofer asignado")
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

  const status = !assigned
    ? "Sin chofer asignado"
    : t.driver.employeeId
      ? `${t.driver.name} · ${t.driver.accepted ? "confirmó la asignación" : "falta que confirme"}`
      : `${t.driver.name} · servicio externo`

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-e1">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Truck className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Chofer del traslado</h2>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormCombobox
          id="driver-employee"
          label="¿Quién lo lleva? (trabajador)"
          required
          icon={<User className="size-4" />}
          options={employees}
          value={employeeId || null}
          onChange={(v) => {
            setEmployeeId(v ?? "")
            if (v) setName("")
            setErrors((e) => ({ ...e, driver: undefined }))
          }}
          onClear={() => setEmployeeId("")}
          clearable
          searchable
          disabled={locked}
          placeholder="Elegir trabajador…"
          error={errors.driver}
        />
        <InputGroupField
          id="driver-name"
          label="O escribe su nombre"
          value={name}
          disabled={locked || Boolean(employeeId)}
          onChange={(e) => {
            setName(e.target.value)
            if (e.target.value) setEmployeeId("")
            setErrors((x) => ({ ...x, driver: undefined }))
          }}
          leftIcon={<User className="size-4" />}
          placeholder="Servicio externo, proveedor, paquetería…"
        />
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        Basta una opción. Un trabajador lo ve en «Mis entregas»; un nombre externo recibe un enlace para compartir su ubicación.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <InputGroupField
          id="driver-vehicle"
          label="Vehículo y placas"
          required
          value={vehicle}
          disabled={locked}
          onChange={(e) => {
            setVehicle(e.target.value)
            setErrors((x) => ({ ...x, vehicle: undefined }))
          }}
          leftIcon={<Truck className="size-4" />}
          placeholder="Ej. Camioneta blanca ABC-123"
          error={errors.vehicle}
        />
        <DateTimePicker label="Llegada estimada" value={expectedAt} onChange={setExpectedAt} />
      </div>

      <Button
        className="w-full"
        variant={assigned && unchanged ? "outline" : "default"}
        onClick={() => void save()}
        disabled={busy || locked || (assigned && unchanged && Boolean(t.driver.employeeId))}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : assigned && unchanged ? (
          <CheckCircle2 className="size-4 text-success-ink" />
        ) : (
          <Truck className="size-4" />
        )}
        {locked ? "Chofer confirmado" : assigned && unchanged ? "Chofer asignado" : assigned ? "Actualizar chofer" : "Asignar chofer"}
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
