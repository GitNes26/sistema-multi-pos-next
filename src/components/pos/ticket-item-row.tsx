"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Package, Pencil, Plus, Trash2, Check, StickyNote, Scale } from "lucide-react";
import type { PosLineItem } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import { ThumbImage } from "@/components/base/thumb-image";

interface TicketItemRowProps {
  item: PosLineItem;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  onEdit?: (item: PosLineItem) => void;
  itemRef?: (el: HTMLDivElement | null) => void;
  flashNonce?: number;
}

export const TicketItemRow = memo(function TicketItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onEdit,
  itemRef,
  flashNonce,
}: TicketItemRowProps) {
  const total = item.qty * item.unitPrice;
  const [flashing, setFlashing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulso de resaltado cuando cambia la cantidad de este ítem.
  useEffect(() => {
    if (!flashNonce) return;
    setFlashing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlashing(false), 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flashNonce]);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Fondo de eliminación al deslizar (6.14) */}
      <div className="absolute inset-0 flex items-center justify-end gap-2 rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground">
        <Trash2 className="size-5" /> Quitar
      </div>
      <motion.div
        ref={itemRef}
        drag="x"
        dragConstraints={{ left: -96, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -72 || info.velocity.x < -400) onRemove(item.key);
        }}
        className={cn(
          "relative rounded-xl border bg-card p-3",
          flashing && "ticket-flash"
        )}
      >
        <div className="flex items-start gap-2">
          {item.imageUrl ? (
            <ThumbImage
              src={item.imageUrl}
              alt={item.name}
              className="size-12 shrink-0 rounded-lg border object-cover"
            />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Package className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</p>
              {(item.sentQty ?? 0) > 0 && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular",
                    (item.sentQty ?? 0) >= item.qty
                      ? "bg-success/10 text-success-ink"
                      : "bg-warning/10 text-warning-ink"
                  )}
                >
                  <Check className="mr-0.5 inline size-3 align-[-1px]" strokeWidth={3} />
                  {(item.sentQty ?? 0) >= item.qty ? "Cocina" : `${item.sentQty}/${item.qty}`}
                </span>
              )}
            </div>
            {/* Selected options */}
            {item.selectedOptions && item.selectedOptions.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {item.selectedOptions.map((opt, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {opt.optionName}: {opt.value}
                    {opt.extraPrice > 0 && <span className="font-medium">+{money(opt.extraPrice)}</span>}
                  </span>
                ))}
              </div>
            )}
            {/* Item notes */}
            {item.notes && (
              <p className="mt-1 flex items-start gap-1 text-xs text-warning-ink">
                <StickyNote className="mt-px size-3 shrink-0" />
                <span className="line-clamp-2">{item.notes}</span>
              </p>
            )}
            {item.bulkQuantityDisplay ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs leading-tight text-muted-foreground tabular">
                <Scale className="size-3" /> {item.bulkQuantityDisplay}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground tabular">
                {money(item.unitPrice)} c/u
              </p>
            )}
          </div>
          <p className="text-base font-bold tracking-tight tabular-nums">{money(total)}</p>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-xl bg-muted p-0.5">
              <button
                type="button"
                onClick={() => onDecrement(item.key)}
                disabled={item.qty <= 1}
                className="flex size-11 touch-manipulation items-center justify-center rounded-[10px] transition hover:bg-background active:scale-95 disabled:opacity-35"
                aria-label={`Disminuir ${item.name}`}
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                {item.qty} {item.unitAbbrev}
              </span>
              <button
                type="button"
                onClick={() => onIncrement(item.key)}
                className="flex size-11 touch-manipulation items-center justify-center rounded-[10px] transition hover:bg-background active:scale-95"
                aria-label={`Aumentar ${item.name}`}
              >
                <Plus className="size-4" />
              </button>
            </div>
            {item.kind === "bulk" && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="flex size-11 touch-manipulation items-center justify-center rounded-xl border transition hover:bg-muted active:scale-95"
                aria-label="Editar cantidad"
              >
                <Pencil className="size-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.key)}
            className={cn(
              "flex size-11 touch-manipulation items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive active:scale-95"
            )}
            aria-label={`Quitar ${item.name}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
});
