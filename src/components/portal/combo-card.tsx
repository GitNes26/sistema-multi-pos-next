"use client"

import { motion } from "framer-motion"
import { Puzzle, Tag, Check } from "lucide-react"
import type { PortalCombo } from "@/lib/portal/server"
import { money } from "@/lib/pos/money"
import { cn } from "@/lib/utils"
import { ThumbImage } from "@/components/base/thumb-image"

interface PortalComboCardProps {
  combo: PortalCombo
  onAdd?: (combo: PortalCombo) => void
}

export function PortalComboCard({ combo, onAdd }: PortalComboCardProps) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative w-64 shrink-0 overflow-hidden rounded-2xl border bg-card transition",
        "hover:border-primary/40 desk:hover:shadow-e2",
        onAdd && "cursor-pointer"
      )}
      onClick={() => onAdd?.(combo)}
      role={onAdd ? "button" : undefined}
      tabIndex={onAdd ? 0 : undefined}
      onKeyDown={(e) => {
        if (onAdd && e.key === "Enter") onAdd(combo)
      }}
    >
      {/* Combo badge */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-sm">
        <Puzzle className="size-3" />
        COMBO
      </div>

      {/* Item count */}
      <div className="absolute right-2 top-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white">
        {combo.items.length} productos
      </div>

      {/* Image */}
      {combo.imageUrl ? (
        <ThumbImage
          src={combo.imageUrl}
          alt={combo.name}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-surface-sunken">
          <Puzzle className="size-10 text-muted-foreground" />
        </div>
      )}

      <div className="p-3">
        {/* Name */}
        <p className="line-clamp-1 text-sm font-bold">{combo.name}</p>

        {/* Description */}
        {combo.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {combo.description}
          </p>
        )}

        {/* Items preview */}
        <div className="mt-2 flex flex-wrap gap-1">
          {combo.items.slice(0, 4).map((ci) => (
            <span
              key={ci.id}
              className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >
              {ci.quantity}× {ci.productName}
            </span>
          ))}
          {combo.items.length > 4 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              +{combo.items.length - 4}
            </span>
          )}
        </div>

        {/* Price and savings */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-lg font-extrabold text-primary">
              {money(combo.comboPrice)}
            </p>
            {combo.savings > 0 && (
              <div className="flex items-center gap-1 text-xs text-success-ink">
                <Tag className="size-3" />
                <span className="font-semibold">Ahorra {money(combo.savings)}</span>
              </div>
            )}
          </div>
          {onAdd && (
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90">
              <Check className="size-4" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
