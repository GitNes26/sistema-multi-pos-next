"use client"

import { useEffect, useState } from "react"
import { Bike, CheckCircle2, Clock, Loader2, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormCombobox } from "@/components/base/form-combobox"
import { swalError, swalToast } from "@/lib/swal"
import type { OrderDetail } from "@/lib/orders/client"

interface DriverOption {
  employeeId: string
  name: string
  position: string | null
  isCourier: boolean
  activeOrders: number
}

/**
 * Reparto del pedido a domicilio: quién lo lleva y si ya lo aceptó. Se asigna a
 * cualquier empleado (los de rol Repartidor aparecen primero) o lo toma quien
 * lo va a llevar. Sin repartidor no se puede enviar el pedido.
 */
export function DriverPanel({ order, canAssign, onChanged }: { order: OrderDetail; canAssign: boolean; onChanged: () => void }) {
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [employeeId, setEmployeeId] = useState("")
  const [busy, setBusy] = useState(false)
  const editable = canAssign && ["ready", "in_transit", "at_destination"].includes(order.status)

  useEffect(() => {
    if (!editable) return
    fetch("/api/orders/" + order.id + "/driver")
      .then((r) => r.json())
      .then((d) => d.ok && setDrivers(d.drivers))
      .catch(() => undefined)
  }, [editable, order.id])

  const post = async (body: Record<string, unknown>, message: string) => {
    setBusy(true)
    try {
      const res = await fetch("/api/orders/" + order.id + "/driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      swalToast(message)
      setEmployeeId("")
      onChanged()
    } catch (err) {
      swalError("No se pudo asignar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const d = order.driver
  return (
    <section className="rounded-2xl border bg-card p-4" aria-label="Reparto">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Bike className="size-4 text-primary" /> Reparto
      </h3>
      {d ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <strong>{d.name}</strong>
          {d.acceptedAt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success-ink">
              <CheckCircle2 className="size-3" /> Aceptó la entrega
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-ink">
              <Clock className="size-3" /> Asignado · falta que acepte
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Sin repartidor. Asigna a alguien del equipo o que lo tome quien lo va a llevar.</p>
      )}

      {editable && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <FormCombobox
            id="driver-select"
            label={d ? "Cambiar repartidor" : "Asignar repartidor"}
            options={drivers.map((x) => ({
              value: x.employeeId,
              label: x.name,
              meta: [x.isCourier ? "Repartidor" : x.position, x.activeOrders ? `${x.activeOrders} en curso` : null].filter(Boolean).join(" · "),
            }))}
            value={employeeId}
            onChange={setEmployeeId}
            placeholder="Elegir empleado…"
            className="min-w-52 flex-1"
          />
          <Button disabled={!employeeId || busy} onClick={() => void post({ action: "assign", employeeId }, "Repartidor asignado")}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />} Asignar
          </Button>
        </div>
      )}
    </section>
  )
}
