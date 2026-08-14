"use client";

import { RotateCcw, TicketPercent, UserRound, Wallet } from "lucide-react";
import { usePosStore, selectCustomer } from "@/stores/pos-store";
import { usePosTotals } from "@/hooks/use-pos-totals";
import type { PosLineItem } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TicketItemRow } from "./ticket-item-row";

interface TicketPanelProps {
  onEditBulk: (item: PosLineItem) => void;
  onOpenCustomer: () => void;
  onOpenDiscount: () => void;
  onCheckout: () => void;
}

export function TicketPanel({
  onEditBulk,
  onOpenCustomer,
  onOpenDiscount,
  onCheckout,
}: TicketPanelProps) {
  const items = usePosStore((s) => s.items);
  const customerId = usePosStore((s) => s.customerId);
  const clearTicket = usePosStore((s) => s.clearTicket);
  const setQty = usePosStore((s) => s.setQty);
  const removeItem = usePosStore((s) => s.removeItem);

  const t = usePosTotals();
  const customer = selectCustomer(customerId);

  const increment = (key: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (item.kind === "bulk") {
      // Los productos a granel se editan desde el modal (6.6b).
      onEditBulk(item);
      return;
    }
    if (item.trackInventory && item.qty + 1 > Math.floor(item.stock)) return;
    setQty(key, item.qty + 1);
  };

  const decrement = (key: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (item.qty <= 1) {
      removeItem(key);
      return;
    }
    setQty(key, item.qty - 1);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Ticket
          </h2>
          <p className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "artículo" : "artículos"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!items.length}
          onClick={clearTicket}
          className="text-muted-foreground"
        >
          <RotateCcw className="size-4" />
          Limpiar
        </Button>
      </div>

      <div className="scrollbar-none flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Wallet className="size-8" />
            <p className="text-sm">Selecciona productos para comenzar</p>
          </div>
        ) : (
          items.map((item) => (
            <TicketItemRow
              key={item.key}
              item={item}
              onIncrement={increment}
              onDecrement={decrement}
              onRemove={removeItem}
              onEdit={onEditBulk}
            />
          ))
        )}
      </div>

      <div className="space-y-2 border-t p-3">
        {customer && (
          <button
            type="button"
            onClick={onOpenCustomer}
            className="flex w-full items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-left transition hover:bg-muted"
          >
            <UserRound className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{customer.fullName}</span>
            <span className="shrink-0 text-xs font-semibold text-amber-600">
              {Math.floor(customer.points)} pts
            </span>
          </button>
        )}

        {t.discounts.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-500">
            <span className="truncate">{d.label}</span>
            <span>-{money(d.amount)}</span>
          </div>
        ))}
        {t.pointsRedeemedValue > 0 && (
          <div className="flex items-center justify-between text-xs text-primary">
            <span>Puntos canjeados ({Math.floor(t.pointsRedeemed)})</span>
            <span>-{money(t.pointsRedeemedValue)}</span>
          </div>
        )}

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(t.subtotal)}</span>
          </div>
          {t.discountTotal > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Descuentos</span>
              <span className="tabular-nums">-{money(t.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Impuestos</span>
            <span className="tabular-nums">{money(t.tax)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 text-lg font-bold">
            <span>Total</span>
            <span className="tabular-nums">{money(t.total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onOpenCustomer}>
            <UserRound className="size-4" />
            Cliente
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenDiscount} disabled={!items.length}>
            <TicketPercent className="size-4" />
            Descuento
          </Button>
        </div>

        <Button
          size="lg"
          disabled={!items.length || t.payable <= 0}
          onClick={onCheckout}
          className={cn("w-full", t.payable > 0 && "shadow-lg")}
        >
          Cobrar · {money(t.payable)}
        </Button>
      </div>
    </div>
  );
}