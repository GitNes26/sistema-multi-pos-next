"use client"

import { useState } from "react"
import { GripVertical, RotateCcw } from "lucide-react"
import { usePortalStore } from "@/stores/portal-store"
import { ALL_NAV_ITEMS, type NavItemId } from "@/components/portal/portal-shell"
import { Button } from "@/components/ui/button"
import { swalToast } from "@/lib/swal"

const DEFAULT_ORDER: NavItemId[] = ["home", "store", "orders", "lists", "profile"]

export function NavCustomizer() {
  const navOrder = usePortalStore((s) => s.navOrder)
  const setNavOrder = usePortalStore((s) => s.setNavOrder)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Barra de navegación ({navOrder.length}/5)
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={reset}
        >
          <RotateCcw className="size-3" /> Restablecer
        </Button>
      </div>

      <div className="space-y-1">
        {orderedItems.map((item, idx) => {
          const Icon = item.icon
          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragIdx !== null && dragIdx !== idx) {
                  moveItem(dragIdx, idx)
                  setDragIdx(idx)
                }
              }}
              onDragEnd={() => setDragIdx(null)}
              className="flex items-center gap-2 rounded-lg border bg-background p-2"
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
              <Icon className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm">{item.label}</span>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveItem(idx, idx - 1)}
                  disabled={idx === 0}
                  className="size-6 text-xs"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveItem(idx, idx + 1)}
                  disabled={idx === orderedItems.length - 1}
                  className="size-6 text-xs"
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeItem(item.id)}
                  className="size-6 text-destructive"
                >
                  ×
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {availableItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Disponibles:</p>
          <div className="flex flex-wrap gap-1">
            {availableItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => addItem(item.id)}
                >
                  <Icon className="size-3" /> {item.label}
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
