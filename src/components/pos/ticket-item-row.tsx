"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Minus, Package, Plus, Scale, StickyNote, Trash2 } from "lucide-react";
import type { PosLineItem } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import { ThumbImage } from "@/components/base/thumb-image";

interface TicketItemRowProps {
  item: PosLineItem;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  /** Fija la cantidad escrita (50 piezas sin sumar de 1 en 1). */
  onSetQty?: (key: string, qty: number) => void;
  onEdit?: (item: PosLineItem) => void;
  itemRef?: (el: HTMLDivElement | null) => void;
  flashNonce?: number;
}

/**
 * Línea compacta del ticket: nombre y detalle a la izquierda, selector de
 * cantidad (− 1 +) y total a la derecha, todo en una fila. La cantidad se
 * toca para escribirla; con 1 pieza el «−» se vuelve papelera (y también se
 * quita deslizando). Así caben más artículos sin achicar los botones táctiles.
 */
export const TicketItemRow = memo(function TicketItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onSetQty,
  onEdit,
  itemRef,
  flashNonce,
}: TicketItemRowProps) {
  const total = item.qty * item.unitPrice;
  const [flashing, setFlashing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  // Toque en foto/descripción: muestra u oculta el texto completo.
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((v) => !v);
  const [draft, setDraft] = useState("");
  const isBulk = item.kind === "bulk";

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

  const commit = () => {
    setEditing(false);
    const next = Math.floor(Number(draft.replace(",", ".")));
    if (!Number.isFinite(next) || next < 1 || next === item.qty) return;
    onSetQty?.(item.key, next);
  };

  const sent = item.sentQty ?? 0;
  const step = "flex size-10 touch-manipulation items-center justify-center rounded-lg transition hover:bg-background active:scale-95 disabled:opacity-35 desk:size-8";

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
        className={cn("relative flex items-center gap-2 rounded-xl border bg-card py-1.5 pl-1.5 pr-2", flashing && "ticket-flash")}
      >
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={expanded ? `Contraer ${item.name}` : `Ver detalle completo de ${item.name}`}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
        {item.imageUrl ? (
          <ThumbImage src={item.imageUrl} alt="" className="size-10 shrink-0 rounded-lg border object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Package className="size-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
            <span className={expanded ? "" : "line-clamp-2"}>{item.name}</span>
            {sent > 0 && (
              <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular", sent >= item.qty ? "bg-success/10 text-success-ink" : "bg-warning/10 text-warning-ink")}>
                <Check className="mr-0.5 inline size-3 align-[-1px]" strokeWidth={3} />
                {sent >= item.qty ? "Cocina" : `${sent}/${item.qty}`}
              </span>
            )}
          </p>
          {/* Tópicos y notas en una sola línea para no crecer la fila */}
          {item.selectedOptions && item.selectedOptions.length > 0 && (
            <p className={cn("text-xs text-primary", !expanded && "truncate")}>
              {item.selectedOptions.map((o) => o.value).join(" · ")}
              {item.extraPrice ? <span className="font-medium"> +{money(item.extraPrice)}</span> : null}
            </p>
          )}
          {item.notes && (
            <p className="flex items-start gap-1 text-xs text-warning-ink">
              <StickyNote className="mt-0.5 size-3 shrink-0" />
              <span className={expanded ? "" : "truncate"}>{item.notes}</span>
            </p>
          )}
          <p className="flex items-center gap-1 text-xs leading-tight text-muted-foreground tabular">
            {isBulk ? (
              <>
                <Scale className="size-3" /> {item.bulkQuantityDisplay ?? `${item.qty} ${item.unitAbbrev}`}
              </>
            ) : (
              <>{money(item.unitPrice)} c/u</>
            )}
          </p>
        </div>
        </div>

        {isBulk ? (
          // Granel: la cantidad se captura con el modal de peso/monto.
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit?.(item)}
              className="min-h-10 touch-manipulation rounded-lg bg-muted px-2.5 text-sm font-semibold tabular-nums transition hover:bg-background active:scale-95"
              aria-label={`Editar cantidad de ${item.name}`}
            >
              {item.qty} {item.unitAbbrev}
            </button>
            <button type="button" onClick={() => onRemove(item.key)} className={cn(step, "text-muted-foreground hover:text-destructive")} aria-label={`Quitar ${item.name}`}>
              <Trash2 className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center rounded-xl bg-muted p-0.5">
            <button
              type="button"
              onClick={() => onDecrement(item.key)}
              className={cn(step, item.qty <= 1 && "text-destructive")}
              aria-label={item.qty <= 1 ? `Quitar ${item.name}` : `Disminuir ${item.name}`}
            >
              {item.qty <= 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
            </button>
            {editing ? (
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setDraft(String(item.qty));
                    setEditing(false);
                  }
                }}
                aria-label={`Cantidad de ${item.name}`}
                className="h-10 w-12 rounded-md border border-primary bg-background text-center text-sm font-semibold tabular-nums outline-none desk:h-8"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(String(item.qty));
                  setEditing(true);
                }}
                className="h-10 min-w-9 touch-manipulation rounded-md px-1 text-center text-sm font-semibold tabular-nums transition hover:bg-background desk:h-8"
                aria-label={`${item.qty} piezas de ${item.name}. Toca para escribir la cantidad`}
                aria-live="polite"
              >
                {item.qty}
              </button>
            )}
            <button type="button" onClick={() => onIncrement(item.key)} className={step} aria-label={`Aumentar ${item.name}`}>
              <Plus className="size-4" />
            </button>
          </div>
        )}

        <p className="w-[4.5rem] shrink-0 text-right text-sm font-bold tracking-tight tabular-nums">{money(total)}</p>
      </motion.div>
    </div>
  );
});
