"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw, TicketPercent, UserRound, Wallet, Sparkles, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePosStore, selectCustomer } from "@/stores/pos-store";
import { usePosTotals } from "@/hooks/use-pos-totals";
import type { PosLineItem } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { pointsToMoney } from "@/lib/pos/pricing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/base/animated-number";
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
  const promotions = usePosStore((s) => s.promotions);
  const clearTicket = usePosStore((s) => s.clearTicket);
  const setQty = usePosStore((s) => s.setQty);
  const removeItem = usePosStore((s) => s.removeItem);

  const t = usePosTotals();
  const customer = selectCustomer(customerId);
  const loyalty = usePosStore((s) => s.loyalty);

  // Promociones casi logradas (75-99%)
  const nearPromos = promotions.filter((p) => {
    if (p.minAmount <= 0 || p.couponCode) return false;
    if (p.startsAt && new Date(p.startsAt) > new Date()) return false;
    if (p.endsAt && new Date(p.endsAt) < new Date()) return false;
    const pct = t.subtotal > 0 ? (t.subtotal / p.minAmount) * 100 : 0;
    return pct >= 75 && pct < 100;
  });

  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevCountRef = useRef(0);
  const [flash, setFlash] = useState<{ key: string; nonce: number }>({ key: "", nonce: 0 });
  const [justAdded, setJustAdded] = useState(false);

  // Auto-scroll al fondo solo cuando se AGREGA un producto nuevo
  useEffect(() => {
    const el = listRef.current;
    if (el && items.length > prevCountRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 600);
    }
    prevCountRef.current = items.length;
  }, [items]);

  const notifyChange = (key: string) => {
    setFlash((prev) => ({ key, nonce: prev.nonce + 1 }));
    rowRefs.current[key]?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const increment = (key: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (item.kind === "bulk") { onEditBulk(item); return; }
    if (item.trackInventory && item.qty + 1 > Math.floor(item.stock)) return;
    setQty(key, item.qty + 1);
    notifyChange(key);
  };

  const decrement = (key: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (item.qty <= 1) { removeItem(key); return; }
    setQty(key, item.qty - 1);
    notifyChange(key);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
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
          className="text-muted-foreground hover:text-destructive"
        >
          <RotateCcw className="size-4" />
          Limpiar
        </Button>
      </div>

      {/* Banner: promoción casi lograda */}
      <AnimatePresence>
        {nearPromos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-2.5"
          >
            {nearPromos.map((p) => {
              const pct = Math.round((t.subtotal / p.minAmount) * 100);
              const remaining = Math.max(0, p.minAmount - t.subtotal);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <Target className="size-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      ¡Casi! Te faltan <span className="font-bold">{money(remaining)}</span> para "{p.name}"
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-200/50 dark:bg-amber-800/30">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-amber-600">{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items list */}
      <div ref={listRef} className="scrollbar-none flex-1 space-y-2 overflow-y-auto p-3">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground"
            >
              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/50">
                <Wallet className="size-8 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium">Selecciona productos</p>
                <p className="text-xs text-muted-foreground">para comenzar un nuevo ticket</p>
              </div>
            </motion.div>
          ) : (
            items.map((item) => (
              <motion.div
                key={item.key}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -100, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              >
                <TicketItemRow
                  item={item}
                  itemRef={(el) => { rowRefs.current[item.key] = el; }}
                  flashNonce={flash.key === item.key ? flash.nonce : 0}
                  onIncrement={increment}
                  onDecrement={decrement}
                  onRemove={removeItem}
                  onEdit={onEditBulk}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Totals + actions — fixed bottom */}
      <div className="space-y-3 border-t bg-card px-4 py-3">
        {/* Customer */}
        <AnimatePresence>
          {customer && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              type="button"
              onClick={onOpenCustomer}
              className="flex w-full items-center gap-2.5 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2.5 text-left transition hover:bg-accent/15 active:scale-[0.98]"
            >
              <UserRound className="size-4 shrink-0 text-accent-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{customer.fullName}</span>
              <CheckCircle2 className="size-4 shrink-0 text-accent-foreground" />
              <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600">
                {money(pointsToMoney(customer.points, loyalty.pointValue))} · {Math.floor(customer.points)} pts
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Discounts */}
        <AnimatePresence>
          {t.discounts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1"
            >
              {t.discounts.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                  <span className="truncate">{d.label}</span>
                  <span className="font-medium">-{money(d.amount)}</span>
                </div>
              ))}
            </motion.div>
          )}
          {t.pointsRedeemedValue > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between text-xs text-primary"
            >
              <span>Puntos canjeados ({Math.floor(t.pointsRedeemed)})</span>
              <span className="font-medium">-{money(t.pointsRedeemedValue)}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary */}
        <div className="space-y-1.5 rounded-xl bg-muted/30 px-3 py-2.5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(t.subtotal)}</span>
          </div>
          {t.discountTotal > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
              <span>Descuentos</span>
              <span className="tabular-nums">-{money(t.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Impuestos</span>
            <span className="tabular-nums">{money(t.tax)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-base font-bold">Total</span>
            <AnimatedNumber
              value={t.total}
              format={money}
              className="text-xl font-black tabular-nums"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onOpenCustomer} className="h-10">
            <UserRound className="size-4" />
            Cliente
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenDiscount} disabled={!items.length} className="h-10">
            <TicketPercent className="size-4" />
            Descuento
          </Button>
        </div>

        {/* Checkout button */}
        <Button
          size="lg"
          disabled={!items.length || t.payable <= 0}
          onClick={onCheckout}
          className={cn(
            "relative h-14 w-full text-base font-bold",
            t.payable > 0 && "shadow-lg shadow-primary/25"
          )}
        >
          <AnimatePresence mode="wait">
            {justAdded ? (
              <motion.span
                key="added"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2"
              >
                <Sparkles className="size-5" /> Agregado
              </motion.span>
            ) : (
              <motion.span
                key="cobrar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2"
              >
                Cobrar · <AnimatedNumber value={t.payable} format={money} className="tabular-nums" />
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}
