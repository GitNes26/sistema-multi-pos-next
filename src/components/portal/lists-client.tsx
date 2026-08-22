"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion"
import { Copy, Plus, Trash2, ListChecks, ShoppingCart, Pencil } from "lucide-react"
import { portalApi } from "@/lib/portal/client"
import type { ShoppingListRow } from "@/lib/portal/server"
import { swalConfirm, swalError, swalPrompt, swalToast } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { EmptyState } from "@/components/shared/empty-state"
import { usePortalStore } from "@/stores/portal-store"

function SwipeableRow({
  children,
  onDelete,
}: {
  children: React.ReactNode
  onDelete: () => void
}) {
  const x = useMotionValue(0)
  const bg = useTransform(x, [-100, -50, 0], ["#ef4444", "#f97316", "transparent"])
  const opacity = useTransform(x, [-100, -50, 0], [1, 0.8, 0])

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <motion.div
        style={{ backgroundColor: bg }}
        className="absolute inset-0 flex items-center justify-end rounded-xl pr-4"
      >
        <motion.div style={{ opacity }} className="flex items-center gap-2 text-white">
          <Trash2 className="size-5" />
        </motion.div>
      </motion.div>

      {/* Foreground */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) onDelete()
        }}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  )
}

export function ListsClient() {
  const router = useRouter()
  const [lists, setLists] = useState<ShoppingListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const load = useCallback(() => {
    portalApi
      .lists()
      .then((d) => setLists(d.lists))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    const name = await swalPrompt("Nueva lista", "Nombre de la lista…", undefined, "Ej. Despensa semanal")
    if (!name) return
    try {
      const res = await portalApi.createList({ name, notes: null, items: [] })
      swalToast("Lista creada")
      router.push(`/portal/lists/${res.list.id}`)
    } catch (err) {
      swalError("No se pudo crear", err instanceof Error ? err.message : undefined)
    }
  }

  const duplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await portalApi.duplicateList(id)
      swalToast("Lista duplicada")
      setLists((prev) =>
        prev
          ? [
              {
                id: res.list.id,
                name: res.list.name,
                notes: res.list.notes,
                itemsCount: res.list.items.length,
                createdAt: res.list.createdAt,
              },
              ...prev,
            ]
          : prev
      )
    } catch (err) {
      swalError("No se pudo duplicar", err instanceof Error ? err.message : undefined)
    }
  }

  const remove = async (id: string) => {
    const ok = await swalConfirm("Eliminar lista", "¿Seguro que quieres eliminar esta lista?", { danger: true })
    if (!ok) return
    try {
      await portalApi.deleteList(id)
      setLists((prev) => (prev ? prev.filter((l) => l.id !== id) : prev))
      swalToast("Lista eliminada", "info")
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined)
    }
  }

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(id)
    setEditName(currentName)
  }

  const saveRename = async () => {
    if (!editingId || !editName.trim()) return
    try {
      const existing = lists?.find((l) => l.id === editingId)
      await portalApi.updateList(editingId, {
        name: editName.trim(),
        items: [],
        notes: existing?.notes ?? null,
      })
      setLists((prev) =>
        prev ? prev.map((l) => (l.id === editingId ? { ...l, name: editName.trim() } : l)) : prev
      )
      swalToast("Lista renombrada")
    } catch {
      // silent
    }
    setEditingId(null)
  }

  const addAllToCart = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await portalApi.list(listId)
      let added = 0
      for (const item of res.list.items) {
        const products = usePortalStore.getState().products
        const product = products.find((p) => p.variants.some((v) => v.id === item.variantId))
        if (product) {
          const variant = product.variants.find((v) => v.id === item.variantId)
          if (variant) {
            usePortalStore.getState().addStandard(product, variant, item.quantity)
            added++
          }
        }
      }
      if (added > 0) {
        swalToast(`${added} producto${added > 1 ? "s" : ""} agregado${added > 1 ? "s" : ""} al carrito`)
      } else {
        swalToast("No se encontraron productos", "info")
      }
    } catch {
      swalToast("No se pudo agregar la lista", "info")
    }
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Mis listas</h1>
          <Button size="sm" className="rounded-xl" onClick={create}>
            <Plus className="size-4" /> Nueva
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!lists ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tienes listas"
            description="Crea una lista para organizar tu compra."
          />
        ) : (
          <AnimatePresence>
            {lists.map((l, idx) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: idx * 0.05 }}
              >
                <SwipeableRow onDelete={() => remove(l.id)}>
                  <div
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-sm active:bg-muted/30"
                    onClick={() => router.push(`/portal/lists/${l.id}`)}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ListChecks className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {editingId === l.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={saveRename}
                          onKeyDown={(e) => e.key === "Enter" && saveRename()}
                          className="w-full bg-transparent text-sm font-semibold outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="truncate text-sm font-semibold">{l.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {l.itemsCount} producto{l.itemsCount !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-8 text-primary"
                        onClick={(e) => addAllToCart(l.id, e)}
                        aria-label="Agregar al carrito"
                      >
                        <ShoppingCart className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-8"
                        onClick={(e) => startRename(l.id, l.name, e)}
                        aria-label="Renombrar"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-8"
                        onClick={(e) => duplicate(l.id, e)}
                        aria-label="Duplicar"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </SwipeableRow>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </PullToRefresh>
  )
}
