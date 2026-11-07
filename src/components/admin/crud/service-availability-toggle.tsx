"use client"

import { useEffect, useState } from "react"
import { CalendarClock, Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { Switch } from "@/components/ui/switch"
import { hasPermission } from "@/lib/auth/permissions"
import { swalError } from "@/lib/swal"

interface ServiceProduct {
  id?: unknown
  isActive?: unknown
  isAvailable?: unknown
  productType?: unknown
  trackInventory?: unknown
}

/** Servicio = producto estándar activo sin control de inventario (mismo criterio que la API). */
export function isServiceProduct(p: ServiceProduct | null | undefined): boolean {
  return !!p && p.isActive !== false && p.productType === "standard" && p.trackInventory === false
}

/**
 * Pausa o reanuda un servicio desde el pie del modal del producto. Es una acción inmediata (no
 * espera a «Guardar cambios»): llega a todas las cajas y a la tienda del portal al instante.
 * Solo se muestra con el permiso pos.toggle_services y para servicios ya creados.
 */
export function ServiceAvailabilityToggle({
  product,
  onChanged,
}: {
  product: ServiceProduct | null
  onChanged?: (isAvailable: boolean) => void
}) {
  const { data: session } = useSession()
  const allowed = hasPermission(session, "pos.toggle_services")
  const [checked, setChecked] = useState(product?.isAvailable !== false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setChecked(product?.isAvailable !== false)
  }, [product?.id, product?.isAvailable])

  if (!allowed || !product?.id || !isServiceProduct(product)) return null

  const change = async (next: boolean) => {
    setBusy(true)
    setChecked(next)
    try {
      const res = await fetch("/api/pos/services", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: String(product.id), isAvailable: next }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cambiar el servicio")
      onChanged?.(next)
    } catch (err) {
      setChecked(!next)
      swalError("No se pudo cambiar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <label data-guide="service-availability" className="mr-auto flex cursor-pointer items-center gap-2 text-sm">
      {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <CalendarClock className="size-4 text-muted-foreground" />}
      <Switch checked={checked} disabled={busy} onCheckedChange={(v) => void change(v)} aria-label={checked ? "Pausar servicio" : "Reanudar servicio"} />
      <span className="font-medium">{checked ? "Disponible en venta" : "En pausa"}</span>
    </label>
  )
}
