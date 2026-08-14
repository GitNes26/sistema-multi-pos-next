"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import type { PosLineItem } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";

interface TicketItemRowProps {
  item: PosLineItem;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  onEdit?: (item: PosLineItem) => void;
}

export const TicketItemRow = memo(function TicketItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onEdit,
}: TicketItemRowProps) {
  const total = item.qty * item.unitPrice;

  return (
    <div className="relative overflow-hidden">
      {/* Fondo de eliminación al deslizar (6.14) */}
      <div className="absolute inset-0 flex items-center justify-end bg-destructive/90 px-4">
        <Trash2 className="size-5 text-white" />
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -96, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -72 || info.velocity.x < -400) onRemove(item.key);
        }}
        className="relative rounded-xl border bg-card p-2.5"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-medium leading-tight">{item.name}</p>
            {item.bulkQuantityDisplay ? (
              <p className="mt-0.5 text-[11px] leading-tight text-violet-600">
                {item.bulkQuantityDisplay}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {money(item.unitPrice)} c/u
              </p>
            )}
          </div>
          <p className="text-sm font-bold tabular-nums">{money(total)}</p>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onDecrement(item.key)}
              disabled={item.qty <= 1}
              className="flex size-7 items-center justify-center rounded-lg border transition hover:bg-muted disabled:opacity-40"
              aria-label="Disminuir"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-9 text-center text-sm font-semibold tabular-nums">
              {item.qty} {item.unitAbbrev}
            </span>
            <button
              type="button"
              onClick={() => onIncrement(item.key)}
              className="flex size-7 items-center justify-center rounded-lg border transition hover:bg-muted"
              aria-label="Aumentar"
            >
              <Plus className="size-3.5" />
            </button>
            {item.kind === "bulk" && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="flex size-7 items-center justify-center rounded-lg border transition hover:bg-muted"
                aria-label="Editar cantidad"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.key)}
            className={cn(
              "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            )}
            aria-label="Eliminar"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
});