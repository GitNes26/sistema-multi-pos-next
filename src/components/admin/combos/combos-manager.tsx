"use client"

import { ActiveStatusPill } from "@/components/shared/status-pills"
import { useEffect, useState, useCallback, useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Package,
  Plus,
  Trash2,
  Pencil,
  ShoppingCart,
  DollarSign,
  Puzzle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/base/data-table"
import { Spinner } from "@/components/base/spinner"
import { EmptyState } from "@/components/shared/empty-state"
import { DialogComponent } from "@/components/ui/dialog"
import { money } from "@/lib/pos/money"
import { swalConfirm } from "@/lib/swal"
import { ComboWizard } from "./combo-wizard"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ComboProductVariant {
  id: string
  name: string
  price: number
}

interface ComboProduct {
  id: string
  name: string
  imageUrl?: string | null
  variants: ComboProductVariant[]
}

interface ComboVariant {
  id: string
  name: string
  price: number
}

interface ComboItem {
  id: string
  productId: string
  variantId?: string | null
  quantity: number
  extraPrice: number
  position: number
  product: ComboProduct
  variant?: ComboVariant | null
}

interface Combo {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  comboPrice: number
  isActive: boolean
  createdAt: string
  items: ComboItem[]
}

interface ProductOption {
  id: string
  name: string
  imageUrl?: string | null
  variants: ComboProductVariant[]
}

// La API serializa los Decimal como texto ("120.00"): sin convertirlos, la
// suma de precios concatenaba cadenas y el ahorro salía en miles de millones.
function normalizeCombo(c: Combo): Combo {
  return {
    ...c,
    comboPrice: Number(c.comboPrice ?? 0),
    items: (c.items ?? []).map((i) => ({
      ...i,
      quantity: Number(i.quantity ?? 0),
      extraPrice: Number(i.extraPrice ?? 0),
      variant: i.variant ? { ...i.variant, price: Number(i.variant.price ?? 0) } : i.variant,
      product: i.product
        ? { ...i.product, variants: (i.product.variants ?? []).map((v) => ({ ...v, price: Number(v.price ?? 0) })) }
        : i.product,
    })),
  }
}

// Helper: get price from combo item (variant price or first variant of product)
function getItemUnitPrice(item: { productId: string; variantId?: string | null; extraPrice: number }, product?: ComboProduct, variant?: ComboVariant | null): number {
  // Prefer variant price
  if (variant?.price) return Number(variant.price)
  // Fallback: first variant of product
  if (product?.variants?.[0]?.price) return Number(product.variants[0].price)
  return 0
}

/* ------------------------------------------------------------------ */
/*  Main CombosManager                                                 */
/* ------------------------------------------------------------------ */

export function CombosManager() {
  const [combos, setCombos] = useState<Combo[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
  const [detailCombo, setDetailCombo] = useState<Combo | null>(null)

  const fetchCombos = useCallback(async () => {
    try {
      const res = await fetch("/api/combos")
      if (res.ok) setCombos(((await res.json()) as Combo[]).map(normalizeCombo))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/crud/products?pageSize=200")
      if (res.ok) {
        const data = await res.json()
        setProducts(
          (data.rows ?? data).map((p: Record<string, unknown>) => {
            const variants = (p.variants ?? []) as { id: string; name: string; price: number }[]
            return {
              id: p.id as string,
              name: p.name as string,
              imageUrl: p.imageUrl as string | null,
              variants: variants.map((v) => ({ id: v.id, name: v.name ?? "Default", price: Number(v.price ?? 0) })),
            }
          }),
        )
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchCombos()
    fetchProducts()
  }, [fetchCombos, fetchProducts])

  const handleSave = async (data: {
    id?: string
    name: string
    description: string
    imageUrl: string
    comboPrice: number
    isActive: boolean
    items: {
      productId: string
      variantId?: string
      quantity: number
      extraPrice: number
    }[]
  }) => {
    const method = data.id ? "PUT" : "POST"
    const res = await fetch("/api/combos", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Error" }))
      throw new Error(err.error)
    }
    fetchCombos()
  }

  const handleDelete = async (id: string) => {
    if (!(await swalConfirm("Eliminar combo", "Dejará de aparecer en el POS y en el portal.", { danger: true }))) return
    await fetch(`/api/combos?id=${id}`, { method: "DELETE" })
    fetchCombos()
  }

  /* Stats */
  const activeCombos = combos.filter((c) => c.isActive).length
  const totalItems = combos.reduce((sum, c) => sum + c.items.length, 0)

  /* Columns — using ColumnDef<Combo> from tanstack */
  const columns = useMemo<ColumnDef<Combo>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Combo",
        cell: ({ row }) => {
          const combo = row.original
          return (
            <div className="flex items-center gap-3">
              {combo.imageUrl ? (
                <img
                  src={combo.imageUrl}
                  alt={combo.name}
                  className="size-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success-ink">
                  <Package className="size-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{combo.name}</p>
                {combo.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {combo.description}
                  </p>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: "items",
        accessorKey: "items",
        header: "Productos",
        cell: ({ row }) => {
          const items = row.original.items
          return (
            <div className="flex flex-wrap gap-1">
              {items.slice(0, 3).map((item) => (
                <Badge key={item.id} variant="secondary" className="text-xs">
                  {item.quantity}× {item.product.name}{item.variant?.name && item.variant.name !== "Default" ? ` (${item.variant.name})` : ""}
                </Badge>
              ))}
              {items.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{items.length - 3}
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        id: "comboPrice",
        accessorKey: "comboPrice",
        header: "Precio",
        cell: ({ row }) => {
          const combo = row.original
          const original = combo.items.reduce(
            (sum, i) => sum + getItemUnitPrice(i, i.product, i.variant) * i.quantity + i.extraPrice,
            0,
          )
          const discount = original - combo.comboPrice
          return (
            <div>
              <span className="font-bold tabular-nums">{money(combo.comboPrice)}</span>
              {discount > 0 && (
                <span className="ml-1 text-xs text-success-ink">
                  (−{money(discount)})
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: "isActive",
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) => (
          <ActiveStatusPill active={row.original.isActive} />
        ),
      },
    ],
    [],
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success-ink">
              <Package className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{combos.length}</p>
              <p className="text-xs text-muted-foreground">Combos totales</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info/10 text-info-ink">
              <ShoppingCart className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCombos}</p>
              <p className="text-xs text-muted-foreground">Activos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning-ink">
              <DollarSign className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalItems}</p>
              <p className="text-xs text-muted-foreground">Productos en combos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {combos.length} combo{combos.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => setFormOpen(true)} data-guide="combo-new">
          <Plus className="mr-1 size-4" />
          Nuevo combo
        </Button>
      </div>

      {/* DataTable */}
      {combos.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="No hay combos"
          description="Crea tu primer combo para agrupar productos con precio especial"
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-1 size-4" />
              Crear combo
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={combos}
          searchable
          pageSize={10}
          rowKey={(row) => row.id}
          onRefresh={() => fetchCombos()}
          refreshing={loading}
          renderCard={(combo) => (
            <div
              className="rounded-xl border p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setDetailCombo(combo)}
            >
              <div className="flex items-center gap-3">
                {combo.imageUrl ? (
                  <img
                    src={combo.imageUrl}
                    alt={combo.name}
                    className="size-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-lg bg-success/10 text-success-ink">
                    <Package className="size-6" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold">{combo.name}</p>
                  <p className="text-sm font-bold tabular-nums">{money(combo.comboPrice)}</p>
                </div>
                <ActiveStatusPill active={combo.isActive} />
              </div>              <div className="flex flex-wrap gap-1">
                {combo.items.slice(0, 4).map((item) => (
                  <Badge key={item.id} variant="secondary" className="text-xs">
                    {item.quantity}× {item.product.name}{item.variant?.name && item.variant.name !== "Default" ? ` (${item.variant.name})` : ""}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingCombo(combo)
                    setFormOpen(true)
                  }}
                >
                  <Pencil className="mr-1 size-3" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(combo.id)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* Create/Edit: asistente en 3 pasos */}
      <ComboWizard
        open={formOpen}
        onOpenChange={(o) => {
          if (!o) {
            setFormOpen(false)
            setEditingCombo(null)
          }
        }}
        initial={editingCombo}
        products={products}
        onSave={handleSave}
      />

      {/* Detail dialog */}
      <DialogComponent
        open={Boolean(detailCombo)}
        onOpenChange={(o) => {
          if (!o) setDetailCombo(null)
        }}
        title={detailCombo?.name ?? ""}
        description={detailCombo?.description ?? "Detalle del combo"}
        size="lg"
      >
        {detailCombo && (
          <div className="space-y-4">
            {detailCombo.imageUrl && (
              <img
                src={detailCombo.imageUrl}
                alt={detailCombo.name}
                className="w-full rounded-xl object-cover"
              />
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Precio combo</span>
              <span className="text-xl font-bold">{money(detailCombo.comboPrice)}</span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Productos incluidos:</p>
              {detailCombo.items.map((item) => {
                const originalPrice = getItemUnitPrice(item, item.product, item.variant) * item.quantity
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      {item.product?.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="size-8 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                          <Package className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {item.quantity}× {item.product.name}
                        </p>
                        {item.variant && (
                          <p className="text-xs text-muted-foreground">
                            {item.variant.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm tabular-nums">{money(originalPrice)}</span>
                  </div>
                )
              })}
            </div>

            {(() => {
              const original = detailCombo.items.reduce(
                (sum, i) => sum + getItemUnitPrice(i, i.product, i.variant) * i.quantity + i.extraPrice,
                0,
              )
              const savings = original - detailCombo.comboPrice
              return savings > 0 ? (
                <div className="rounded-xl bg-success/10 p-3 text-center">
                  <p className="text-sm text-success-ink">
                    Ahorro de {money(savings)} respecto al precio individual
                  </p>
                </div>
              ) : null
            })()}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDetailCombo(null)
                  setEditingCombo(detailCombo)
                  setFormOpen(true)
                }}
              >
                <Pencil className="mr-1 size-4" />
                Editar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  handleDelete(detailCombo.id)
                  setDetailCombo(null)
                }}
              >
                <Trash2 className="mr-1 size-4" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </DialogComponent>
    </div>
  )
}
