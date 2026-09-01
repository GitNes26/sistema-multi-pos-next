"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Package,
  Plus,
  Trash2,
  Pencil,
  ShoppingCart,
  DollarSign,
  GripVertical,
  Puzzle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/base/data-table"
import { Spinner } from "@/components/base/spinner"
import { EmptyState } from "@/components/shared/empty-state"
import { DialogComponent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { money } from "@/lib/pos/money"

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

// Helper: get price from combo item (variant price or first variant of product)
function getItemUnitPrice(item: { productId: string; variantId?: string | null; extraPrice: number }, product?: ComboProduct, variant?: ComboVariant | null): number {
  // Prefer variant price
  if (variant?.price) return variant.price
  // Fallback: first variant of product
  if (product?.variants?.[0]?.price) return product.variants[0].price
  return 0
}

/* ------------------------------------------------------------------ */
/*  Combo Form                                                         */
/* ------------------------------------------------------------------ */

function ComboForm({
  initial,
  products,
  onSave,
  onClose,
}: {
  initial?: Combo | null
  products: ProductOption[]
  onSave: (data: {
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
  }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "")
  const [comboPrice, setComboPrice] = useState(initial?.comboPrice ?? 0)
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [items, setItems] = useState<
    { productId: string; variantId: string; quantity: number; extraPrice: number }[]
  >(
    initial?.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? i.product?.variants?.[0]?.id ?? "",
      quantity: i.quantity,
      extraPrice: i.extraPrice,
    })) ?? [],
  )
  const [saving, setSaving] = useState(false)

  const suggestedPrice = useMemo(
    () =>
      items.reduce((sum, item) => {
        const product = products.find((p) => p.id === item.productId)
        const variant = product?.variants?.find((v) => v.id === item.variantId)
        const unitPrice = variant?.price ?? product?.variants?.[0]?.price ?? 0
        return sum + unitPrice * item.quantity
      }, 0),
    [items, products],
  )

  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", variantId: "", quantity: 1, extraPrice: 0 }])
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateItem = (
    idx: number,
    patch: Partial<{ productId: string; variantId: string; quantity: number; extraPrice: number }>,
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    )
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (items.length === 0) return
    if (items.some((i) => !i.productId)) return
    setSaving(true)
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        comboPrice,
        isActive,
        items,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Nombre *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Combo Desayuno"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Precio del combo *</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              min={0}
              step={0.5}
              value={comboPrice}
              onChange={(e) => setComboPrice(Number(e.target.value))}
              className="pl-9"
            />
          </div>
          {suggestedPrice > 0 && comboPrice !== suggestedPrice && (
            <p className="text-xs text-muted-foreground">
              Precio sugerido (suma de productos): {money(suggestedPrice)}
              {comboPrice < suggestedPrice && (
                <span className="ml-1 text-emerald-600">
                  (ahorro de {money(suggestedPrice - comboPrice)})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Descripción</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe el combo..."
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">URL de imagen</Label>
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://... o /uploads/..."
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label className="text-sm">{isActive ? "Activo" : "Inactivo"}</Label>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">
            Productos en el combo ({items.length})
          </Label>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 size-3" />
            Agregar producto
          </Button>
        </div>

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Agrega al menos un producto al combo
          </div>
        )}

        <div className="space-y-2">
          {items.map((item, idx) => {
            const product = products.find((p) => p.id === item.productId)
            const selectedVariant = product?.variants?.find((v) => v.id === item.variantId)
            const unitPrice = selectedVariant?.price ?? product?.variants?.[0]?.price ?? 0
            const hasMultipleVariants = (product?.variants?.length ?? 0) > 1
            return (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl border bg-muted/30 p-3"
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />

                {/* Product selector */}
                <select
                  value={item.productId}
                  onChange={(e) => {
                    const newProductId = e.target.value
                    const newProduct = products.find((p) => p.id === newProductId)
                    const firstVariant = newProduct?.variants?.[0]
                    updateItem(idx, {
                      productId: newProductId,
                      variantId: firstVariant?.id ?? "",
                    })
                  }}
                  className="rounded-lg border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">Producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* Variant selector (only if multiple variants) */}
                {hasMultipleVariants && (
                  <select
                    value={item.variantId}
                    onChange={(e) => updateItem(idx, { variantId: e.target.value })}
                    className="w-36 rounded-lg border bg-background px-2 py-1.5 text-sm"
                  >
                    {product?.variants?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {money(v.price)}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() =>
                      updateItem(idx, {
                        quantity: Math.max(0.1, item.quantity - 0.5),
                      })
                    }
                  >
                    −
                  </Button>
                  <span className="w-8 text-center text-sm font-bold tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() =>
                      updateItem(idx, { quantity: item.quantity + 0.5 })
                    }
                  >
                    +
                  </Button>
                </div>

                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    +
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={item.extraPrice}
                    onChange={(e) =>
                      updateItem(idx, { extraPrice: Number(e.target.value) })
                    }
                    className="h-8 pl-5 text-xs"
                  />
                </div>

                <span className="w-20 text-right text-xs font-semibold tabular-nums">
                  {product
                    ? money(unitPrice * item.quantity + item.extraPrice)
                    : "—"}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  onClick={() => removeItem(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || items.length === 0}
        >
          {saving ? "Guardando..." : initial ? "Actualizar" : "Crear combo"}
        </Button>
      </div>
    </div>
  )
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
      if (res.ok) setCombos(await res.json())
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
    if (!confirm("¿Eliminar este combo?")) return
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
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
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
                <Badge key={item.id} variant="secondary" className="text-[10px]">
                  {item.quantity}× {item.product.name}{item.variant?.name && item.variant.name !== "Default" ? ` (${item.variant.name})` : ""}
                </Badge>
              ))}
              {items.length > 3 && (
                <Badge variant="outline" className="text-[10px]">
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
                <span className="ml-1 text-xs text-emerald-600">
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
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Activo" : "Inactivo"}
          </Badge>
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
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
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
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
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
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
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
        <Button onClick={() => setFormOpen(true)}>
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
                  <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Package className="size-6" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold">{combo.name}</p>
                  <p className="text-sm font-bold tabular-nums">{money(combo.comboPrice)}</p>
                </div>
                <Badge variant={combo.isActive ? "default" : "secondary"}>
                  {combo.isActive ? "Activo" : "Off"}
                </Badge>
              </div>              <div className="flex flex-wrap gap-1">
                {combo.items.slice(0, 4).map((item) => (
                  <Badge key={item.id} variant="secondary" className="text-[10px]">
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

      {/* Create/Edit dialog */}
      <DialogComponent
        open={formOpen}
        onOpenChange={(o) => {
          if (!o) {
            setFormOpen(false)
            setEditingCombo(null)
          }
        }}
        title={editingCombo ? "Editar combo" : "Nuevo combo"}
        description="Agrupa productos con un precio especial"
        size="2xl"
      >
        <ScrollArea className="max-h-[70vh]">
          <ComboForm
            key={editingCombo?.id ?? "new"}
            initial={editingCombo}
            products={products}
            onSave={handleSave}
            onClose={() => {
              setFormOpen(false)
              setEditingCombo(null)
            }}
          />
        </ScrollArea>
      </DialogComponent>

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
                <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/30">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
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
