"use client"

import { motion, AnimatePresence } from "framer-motion"
import { GripVertical, RotateCcw, ChevronUp, ChevronDown, Plus, Settings } from "lucide-react"
import { usePortalStore } from "@/stores/portal-store"
import { ALL_NAV_ITEMS, type NavItemId } from "@/components/portal/portal-shell"
import { Button } from "@/components/ui/button"
import { SwipeableRow } from "@/components/shared/swipeable-row"
import { swalToast } from "@/lib/swal"

const DEFAULT_ORDER: NavItemId[] = ["home", "store", "orders", "lists", "profile"]

export function NavCustomizer() {
  const navOrder = usePortalStore((s) => s.navOrder)
  const setNavOrder = usePortalStore((s) => s.setNavOrder)

  const orderedItems = navOrder
    .map((id) => ALL_NAV_ITEMS.find((item) => item.id === id)!)
    .filter(Boolean)

  const availableItems = ALL_NAV_ITEMS.filter(
    (item) => !navOrder.includes(item.id)
  )

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= navOrder.length) return
    const next = [...navOrder]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setNavOrder(next)
  }

  const addItem = (id: NavItemId) => {
    if (navOrder.length >= 5) {
      swalToast("Máximo 5 botones en la barra")
      return
    }
    setNavOrder([...navOrder, id])
  }

  const removeItem = (id: NavItemId) => {
    if (navOrder.length <= 3) {
      swalToast("Mínimo 3 botones")
      return
    }
    setNavOrder(navOrder.filter((i) => i !== id))
  }

  const reset = () => setNavOrder(DEFAULT_ORDER)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-primary" />
          <p className="text-sm font-medium">
            Barra de navegación
          </p>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
            {navOrder.length}/5
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={reset}
        >
          <RotateCcw className="size-3.5" /> Restablecer
        </Button>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence>
          {orderedItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.2 }}
              >
                <SwipeableRow onDelete={() => removeItem(item.id)}>
                  <div className="flex items-center gap-2.5 rounded-xl border bg-card p-3 shadow-sm">
                    <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/50" />
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => moveItem(idx, idx - 1)}
                        disabled={idx === 0}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        onClick={() => moveItem(idx, idx + 1)}
                        disabled={idx === orderedItems.length - 1}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                  </div>
                </SwipeableRow>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {availableItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Disponibles</p>
          <div className="flex flex-wrap gap-1.5">
            {availableItems.map((item) => {
              const Icon = item.icon
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => addItem(item.id)}
                  className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="size-3" />
                  <Icon className="size-3" />
                  {item.label}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
