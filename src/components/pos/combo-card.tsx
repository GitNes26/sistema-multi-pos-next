"use client"

import { memo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Puzzle, Tag } from "lucide-react"
import type { PosCombo } from "@/types/pos"
import { money } from "@/lib/pos/money"
import { cn } from "@/lib/utils"

interface ComboCardProps {
  combo: PosCombo
  onSelect: (combo: PosCombo) => void
}

export const ComboCard = memo(function ComboCard({ combo, onSelect }: ComboCardProps) {
  const [added, setAdded] = useState(false)

  // Calculate original price and savings
  const originalPrice = combo.items.reduce((sum, item) => {
    // Each item's price is its extraPrice (the price delta or base)
    // The combo items don't carry unit prices directly, so we use extraPrice as approximation
    return sum + (item.extraPrice || 0)
  }, 0)
  const savings = originalPrice > 0 ? Math.max(0, originalPrice - combo.comboPrice) : 0

  const handleClick = () => {
    onSelect(combo)
    setAdded(true)
    setTimeout(() => setAdded(false), 600)
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.96 }}
      className={cn(
        "group relative flex h-full flex-col gap-2 rounded-2xl border-2 border-dashed bg-card p-2.5 text-left shadow-sm transition",
        "hover:border-emerald-500/70 hover:shadow-md hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20",
        added && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
      )}
    >
      {/* Added feedback overlay */}
      <AnimatePresence>
        {added && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-emerald-500/10"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
              <Check className="size-5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combo badge */}
      <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        <Puzzle className="size-3" /> Combo
      </span>

      {/* Item count badge */}
      <span className="absolute right-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
        {combo.items.length} productos
      </span>

      {/* Image or placeholder */}
      <div className="relative flex h-16 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
        {combo.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={combo.imageUrl}
            alt={combo.name}
            className="size-full rounded-xl object-cover"
          />
        ) : (
          <Puzzle className="size-6 text-emerald-500" />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-1">
        <div className="flex items-start justify-between gap-1">
          <p className="line-clamp-2 text-xs font-semibold leading-tight">{combo.name}</p>
        </div>

        {/* Items preview */}
        <div className="flex flex-wrap gap-0.5">
          {combo.items.slice(0, 3).map((item) => (
            <span
              key={item.id}
              className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground"
            >
              {item.quantity}× {item.productName}
            </span>
          ))}
          {combo.items.length > 3 && (
            <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
              +{combo.items.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-1">
          <div className="flex flex-col">
            <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {money(combo.comboPrice)}
            </p>
            {savings > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-emerald-500">
                <Tag className="size-2.5" />
                Ahorro {money(savings)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  )
})
