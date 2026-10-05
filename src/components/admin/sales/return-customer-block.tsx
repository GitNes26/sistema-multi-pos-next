"use client"

import { UserRound, UserRoundX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OptionSelect } from "@/components/admin/crud/option-select"
import type { CrudField } from "@/components/admin/crud/crud-config"
import type { ReturnSettlement } from "@/lib/api"
import { money } from "@/lib/pos/money"

const CUSTOMER_FIELD: CrudField = {
  key: "customerId",
  label: "Cliente a quien se bonifica",
  type: "select",
  required: true,
  optionsModule: "customers",
  optionLabel: "fullName",
  placeholder: "Busca o registra al cliente",
}

/**
 * Cliente de una bonificación (puntos o crédito): si la venta lo tiene se muestra con su saldo
 * actual y el nuevo; si no, se pide asignar uno existente o registrarlo en el momento.
 */
export function ReturnCustomerBlock({
  ctx,
  saleHasCustomer,
  customerId,
  onCustomerChange,
  pointsMoney = 0,
  creditMoney = 0,
}: {
  ctx: ReturnSettlement | null
  saleHasCustomer: boolean
  customerId: string
  onCustomerChange: (id: string) => void
  /** Monto (en dinero) que se convertirá en puntos. */
  pointsMoney?: number
  /** Monto que se abonará a la deuda de crédito. */
  creditMoney?: number
}) {
  const customer = ctx?.customer ?? null
  const points = Math.round(pointsMoney * (ctx?.pointsPerCurrency ?? 0))

  if (!customer) {
    return (
      <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-warning-ink">
          <UserRoundX className="size-4" /> Esta venta no tiene un cliente ligado
        </p>
        <p className="text-xs text-muted-foreground">Asigna un cliente existente o regístralo para poder bonificarle.</p>
        <OptionSelect field={CUSTOMER_FIELD} value={customerId} onChange={onCustomerChange} id="return-customer" icon={<UserRound className="size-4" />} />
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 font-semibold">
          <UserRound className="size-4 shrink-0 text-primary" />
          <span className="truncate">{customer.name}</span>
        </p>
        {!saleHasCustomer && (
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => onCustomerChange("")}>
            Cambiar
          </Button>
        )}
      </div>
      {(ctx?.loyaltyEnabled ?? false) && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Puntos</span>
          <span className="tabular-nums">
            {customer.points.toLocaleString("es-MX")} → <b>{(customer.points + points).toLocaleString("es-MX")}</b>
            {points > 0 && <span className="ml-1 text-success-ink">(+{points.toLocaleString("es-MX")})</span>}
          </span>
        </div>
      )}
      {(ctx?.creditEnabled ?? false) && customer.hasCreditAccount && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Adeudo de crédito</span>
          <span className="tabular-nums">
            {money(customer.creditBalance)} → <b>{money(Math.max(0, customer.creditBalance - creditMoney))}</b>
          </span>
        </div>
      )}
    </div>
  )
}
