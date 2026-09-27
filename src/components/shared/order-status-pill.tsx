import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/orders/client"

// Estado de un pedido con el mismo aspecto en panel, POS, portal e historial
// de mesas. Tono por significado: espera (warning), en proceso (info/primary),
// listo/entregado (success), cancelado (danger).

export const ORDER_STATUS_TONE: Record<OrderStatusKey, StatusTone> = {
  pending: "warning",
  confirmed: "info",
  preparing: "primary",
  ready: "success",
  in_transit: "info",
  at_destination: "primary",
  delivered: "success",
  cancelled: "danger",
}

export function OrderStatusPill({ status, className }: { status: string; className?: string }) {
  const key = status as OrderStatusKey
  return (
    <StatusPill tone={ORDER_STATUS_TONE[key] ?? "neutral"} className={className}>
      {ORDER_STATUS_LABELS[key] ?? status}
    </StatusPill>
  )
}
