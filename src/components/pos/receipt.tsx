"use client";

import type { PosSalePayload } from "@/types/pos";
import { money, qty } from "@/lib/pos/money";
import { PAYMENT_METHOD_LABELS, RECEIPT_WIDTH } from "@/lib/pos/config";

interface ReceiptProps {
  sale: { id: string; saleNumber: string; locationName: string };
  payload: PosSalePayload;
  cashierName: string;
}

/**
 * 6.12 – Ticket térmico de 80mm. El área con `id="receipt-print"` es la única
 * que se imprime (ver @media print en globals.css).
 */
export function Receipt({ sale, payload, cashierName }: ReceiptProps) {
  const date = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div
      id="receipt-print"
      className="mx-auto bg-white px-3 py-4 font-mono text-[10px] leading-snug text-black"
      style={{ width: RECEIPT_WIDTH }}
    >
      <div className="text-center">
        <p className="text-sm font-bold uppercase leading-tight">{sale.locationName}</p>
        <p>Ticket: {sale.saleNumber}</p>
        <p>{date}</p>
        <p>Cajero: {cashierName || "—"}</p>
      </div>

      <div className="my-2 border-t border-dashed border-black/60" />

      {payload.items.map((i, idx) => (
        <div key={idx} className="mb-1">
          <p className="font-semibold leading-tight">{i.productName}</p>
          {i.bulkQuantityDisplay && <p className="text-[9px] text-black/70">{i.bulkQuantityDisplay}</p>}
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
            <span>Puntos canjeados</span>
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

      {payload.customerId && (
        <p className="mt-1">
          Puntos por esta compra:{" "}
          <span className="font-bold">{Math.floor(payload.pointsEarned)}</span>
        </p>
      )}

      <div className="mt-3 text-center">
        <p>¡Gracias por su compra!</p>
      </div>
    </div>
  );
}