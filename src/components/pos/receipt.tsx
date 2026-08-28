"use client"

import type { PosCustomer, PosSalePayload } from "@/types/pos"
import { money, qty } from "@/lib/pos/money"
import { PAYMENT_METHOD_LABELS, RECEIPT_WIDTH } from "@/lib/pos/config"

interface ReceiptProps {
  sale: { id: string; saleNumber: string; locationName: string }
  payload: PosSalePayload
  cashierName: string
  registerName?: string
  company?: {
    name: string | null
    logoUrl: string | null
    address: string | null
    city: string | null
    phone: string | null
    ticketFooter: string | null
  }
  customer?: PosCustomer | null
}

/**
 * 6.12 – Ticket térmico de 80mm (rediseñado): empresa + sucursal, caja,
 * cajero, cliente y puntos.
 */
export function Receipt({
  sale,
  payload,
  cashierName,
  registerName,
  company,
  customer,
}: ReceiptProps) {
  const date = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  })

  const newPoints = customer
    ? Math.floor(customer.points)
    : null

  return (
    <div
      id="receipt-print"
      className="mx-auto bg-white px-3 py-4 font-mono text-[10px] leading-snug text-black"
      style={{ width: RECEIPT_WIDTH }}
    >
      <div className="text-center">
        {company?.logoUrl && (
          <img
            src={company.logoUrl}
            alt="Logo"
            className="mx-auto mb-1 h-10 w-auto object-contain"
          />
        )}
        <p className="text-sm font-bold uppercase leading-tight">
          {company?.name ?? "Empresa"} - {sale.locationName}
        </p>
        {company?.address && (
          <p>
            {company.address}
            {company.city ? `, ${company.city}` : ""}
          </p>
        )}
        {company?.phone && <p>Tel: {company.phone}</p>}
        <p className="mt-1">Ticket: {sale.saleNumber}</p>
        <p>{date}</p>
        {registerName && <p>Caja: {registerName}</p>}
        <p>Cajero: {cashierName || "—"}</p>
      </div>

      <div className="my-2 border-t border-dashed border-black/60" />

      {customer && (
        <>
          <div className="mb-2">
            <p className="font-bold">Cliente:</p>
            <p>{customer.fullName}</p>
            {customer.customerCode && (
              <p>Nº cliente: {customer.customerCode}</p>
            )}
          </div>

          <div className="my-2 border-t border-dashed border-black/60" />
        </>
      )}

      {payload.items.map((i, idx) => (
        <div key={idx} className="mb-1">
          <p className="font-semibold leading-tight">{i.productName}</p>
          {i.bulkQuantityDisplay && (
            <p className="text-[9px] text-black/70">{i.bulkQuantityDisplay}</p>
          )}
          <div className="flex justify-between">
            <span className="text-[9px]">
              {qty(i.quantity)} × {money(i.unitPrice)}
            </span>
            <span>{money(i.lineTotal ?? i.totalPrice ?? 0)}</span>
          </div>
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-black/60" />

      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(payload.subtotal)}</span>
        </div>
        {payload.discounts.map((d, idx) => (
          <div key={idx} className="flex justify-between">
            <span className="truncate pr-2">{d.label}</span>
            <span>-{money(d.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between">
          <span>Impuestos</span>
          <span>{money(payload.tax)}</span>
        </div>
        {payload.pointsRedeemedValue > 0 && (
          <div className="flex justify-between">
            <span>Puntos canjeados ({payload.pointsRedeemed})</span>
            <span>-{money(payload.pointsRedeemedValue)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{money(payload.total)}</span>
        </div>
        {payload.changeGiven > 0 && (
          <div className="flex justify-between">
            <span>Cambio</span>
            <span>{money(payload.changeGiven)}</span>
          </div>
        )}
      </div>

      <div className="my-2 border-t border-dashed border-black/60" />

      <div className="space-y-0.5">
        {payload.payments.map((p, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
            <span>{money(p.amount)}</span>
          </div>
        ))}
      </div>

      {customer && (
        <div className="mt-1 space-y-0.5">
          <p>
            Puntos ganados:{" "}
            <span className="font-bold">
              {Math.floor(payload.pointsEarned)}
            </span>
          </p>
          {newPoints !== null && (
            <p>
              Puntos totales: <span className="font-bold">{newPoints}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-3 text-center">
        {company?.ticketFooter && (
          <p className="mb-1 whitespace-pre-line text-[9px] text-black/70">
            {company.ticketFooter}
          </p>
        )}
        <p>¡Gracias por su compra!</p>
      </div>
    </div>
  )
}
