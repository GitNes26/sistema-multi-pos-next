"use client"

import { useEffect, useMemo, useState } from "react"
import { CookingPot, Plus, Save, Scale, Trash2 } from "lucide-react"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { crudApi } from "@/lib/api"
import { swalError, swalToast } from "@/lib/swal"
import { GlossaryHint } from "@/components/shared/glossary"

export type RecipeProduct = Record<string, unknown> & {
  id: string
  name: string
  productType?: "standard" | "bulk" | "custom"
  trackInventory?: boolean
  variants?: { id: string; name: string; optionValues?: { optionId: string; optionName: string; valueId: string; value: string }[] }[]
  options?: { name: string; kind?: "variant" | "topic"; values: { id: string; value: string }[] }[]
}
type Row = {
  id: string
  source: string
  ingredient: string
  quantity: string
  wastePercent: string
}
type Saved = {
  variantId?: string | null
  optionValueId?: string | null
  ingredientProductId?: string | null
  ingredientVariantId?: string | null
  quantity: number
  wastePercent: number
}

const blank = (): Row => ({
  id: crypto.randomUUID(),
  source: "base",
  ingredient: "",
  quantity: "1",
  wastePercent: "0",
})

export function RecipeDialog({
  product,
  open,
  onOpenChange,
}: {
  product: RecipeProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [catalog, setCatalog] = useState<RecipeProduct[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!open || !product) return
    setLoading(true)
    Promise.all([
      crudApi.list("products", { page: 1, pageSize: 100, q: "" }),
      fetch(`/api/inventory/recipes/${product.id}`).then(async (response) => {
        const payload = await response.json()
        if (!response.ok)
          throw new Error(payload.error ?? "No se pudo cargar la receta")
        return payload as { items: Saved[] }
      }),
    ])
      .then(([result, recipe]) => {
        setCatalog(result.rows.filter((row) => row.isActive !== false && row.active !== false) as RecipeProduct[])
        setRows(
          recipe.items.map((item) => ({
            id: crypto.randomUUID(),
            source: item.variantId
              ? `variant:${item.variantId}`
              : item.optionValueId
                ? (() => {
                    const variant = product.variants?.find((candidate) =>
                      candidate.optionValues?.some((value) => value.valueId === item.optionValueId)
                    )
                    return variant ? `variant:${variant.id}` : "base"
                  })()
                : "base",
            ingredient: item.ingredientVariantId
              ? `variant:${item.ingredientVariantId}`
              : `product:${item.ingredientProductId}`,
            quantity: String(item.quantity),
            wastePercent: String(item.wastePercent),
          }))
        )
      })
      .catch((error) =>
        swalError(
          "No se pudo cargar la receta",
          error instanceof Error ? error.message : undefined
        )
      )
      .finally(() => setLoading(false))
  }, [open, product])

  const sourceOptions = useMemo(() => {
    if (!product) return []
    const variants = product.variants ?? []
    return [
      { value: "base", label: "Siempre que se venda" },
      ...variants.map((v) => ({
        value: `variant:${v.id}`,
        label: v.optionValues?.length
          ? v.optionValues.map((value) => `${value.optionName} · ${value.value}`).join(" + ")
          : v.name === "Default" ? "Presentación estándar" : v.name,
      })),
    ]
  }, [product])
  // Presentaciones del propio producto como insumo: el pastel «Rebanada» se descuenta del «Completo».
  const ownVariantLabel = (v: NonNullable<RecipeProduct["variants"]>[number]) =>
    v.optionValues?.length ? v.optionValues.map((value) => value.value).join(" + ") : v.name === "Default" ? "Presentación estándar" : v.name
  const ownOptions = useMemo(
    () =>
      product?.trackInventory
        ? (product.variants ?? []).map((v) => ({
            value: `variant:${v.id}`,
            label: `${product.name} · ${ownVariantLabel(v)} (este mismo producto)`,
            meta: "Se descuenta de la existencia de esa presentación",
          }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product]
  )
  const ownChoices = useMemo(
    () => (product?.trackInventory ? (product.variants ?? []).map((v) => ({ value: v.id, label: ownVariantLabel(v) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product]
  )
  const ingredientOptions = useMemo(
    () => [
      ...ownOptions,
      ...catalog
        .filter((item) => item.id !== product?.id && item.trackInventory)
        .flatMap((item) => {
          const variants = item.variants ?? []
          return variants.length > 1
            ? [
                {
                  value: `product:${item.id}`,
                  label: `${item.name} · elegir variante al vender`,
                  meta: "El POS preguntará cuál presentación se consumió",
                },
                ...variants.map((v) => ({
                value: `variant:${v.id}`,
                label: `${item.name} · ${v.name}`,
                })),
              ]
            : variants.length === 1
              ? [{ value: `variant:${variants[0].id}`, label: `${item.name} · ${variants[0].name}` }]
              : [{ value: `product:${item.id}`, label: item.name }]
        }),
    ],
    [catalog, product, ownOptions]
  )
  // Atajo «entero y porciones»: una sola existencia (la presentación entera) y la porción gasta 1/N de ella.
  const [portion, setPortion] = useState({ whole: "", slice: "", count: "10" })
  const portionCount = Number(portion.count)
  const portionExact = Number.isInteger(portionCount) && portionCount >= 2 && Number.isInteger(1000 / portionCount)
  const canBuildPortions = portion.whole && portion.slice && portion.whole !== portion.slice && Number.isInteger(portionCount) && portionCount >= 2
  const buildPortions = () => {
    if (!canBuildPortions) return
    const ingredient = `variant:${portion.whole}`
    setRows((current) => [
      ...current.filter((row) => !(row.ingredient === ingredient && (row.source === `variant:${portion.whole}` || row.source === `variant:${portion.slice}`))),
      { id: crypto.randomUUID(), source: `variant:${portion.whole}`, ingredient, quantity: "1", wastePercent: "0" },
      { id: crypto.randomUUID(), source: `variant:${portion.slice}`, ingredient, quantity: String(Math.round(1000 / portionCount) / 1000), wastePercent: "0" },
    ])
  }
  const update = (id: string, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )

  const save = async () => {
    if (!product) return
    const invalid = rows.find(
      (row) =>
        !row.ingredient ||
        !Number.isFinite(Number(row.quantity)) ||
        Number(row.quantity) <= 0
    )
    if (invalid) {
      setFormError(
        "Cada renglón necesita un insumo y una cantidad mayor a cero."
      )
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `#recipe-ingredient-${rows.indexOf(invalid)}, #recipe-quantity-${rows.indexOf(invalid)}`
          )
          ?.focus()
      )
      return
    }
    setFormError("")
    setSaving(true)
    try {
      const items = rows.map((row) => ({
        variantId: row.source.startsWith("variant:")
          ? row.source.slice(8)
          : null,
        optionValueId: row.source.startsWith("option:")
          ? row.source.slice(7)
          : null,
        ingredientProductId: row.ingredient.startsWith("product:")
          ? row.ingredient.slice(8)
          : null,
        ingredientVariantId: row.ingredient.startsWith("variant:")
          ? row.ingredient.slice(8)
          : null,
        quantity: Number(row.quantity),
        wastePercent: Number(row.wastePercent || 0),
      }))
      const response = await fetch(`/api/inventory/recipes/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      const payload = await response.json()
      if (!response.ok)
        throw new Error(payload.error ?? "No se pudo guardar la receta")
      swalToast("Receta guardada")
      onOpenChange(false)
    } catch (error) {
      swalError(
        "No se pudo guardar",
        error instanceof Error ? error.message : undefined
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      size="4xl"
      icon={<CookingPot className="size-5" />}
      title={`Receta e insumos · ${product?.name ?? "Producto"}`}
      description="Define qué insumos se descuentan del inventario cada vez que vendes este producto: ingredientes en alimentos o materiales (shampoo, cera, refacciones) en servicios."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            <Save className="size-4" />
            {saving ? "Guardando…" : "Guardar receta"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">¿Cómo se llena?</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <b className="text-foreground">Se aplica cuando:</b> elige «Siempre que se venda» si el gasto es el mismo
              en cualquier presentación, o una presentación concreta (por ejemplo, «Rebanada») si solo se gasta con esa.
            </li>
            <li>
              <b className="text-foreground">Insumo:</b> lo que se descuenta del inventario. Debe ser un producto que
              controle inventario y ya tenga existencias en la sucursal.
            </li>
            <li>
              <b className="text-foreground">Cantidad:</b> cuánto del insumo se gasta por <u>cada unidad vendida</u>, en
              la misma unidad en que lo llevas en inventario (piezas, kg, litros…).
            </li>
            <li>
              <b className="text-foreground">Merma %:</b> porcentaje extra que se desperdicia al preparar. Ejemplo: 0.12 kg
              con 5% descuentan 0.126 kg. Déjalo en 0 si no aplica.
            </li>
          </ol>
          <p>
            Si falta un insumo, la venta se detiene y el sistema dice cuál falta, para no dejar existencias negativas.
            Con un insumo que tiene variantes, elige «elegir variante al vender» para que el POS pregunte cuál se usó.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <GlossaryHint term="receta">¿Qué es la receta?</GlossaryHint>
            <GlossaryHint term="insumo">¿Qué es un insumo?</GlossaryHint>
            <GlossaryHint term="merma">¿Qué es la merma?</GlossaryHint>
            <GlossaryHint term="porciones">¿Vendo entero y por rebanadas?</GlossaryHint>
          </div>
        </div>
        {ownOptions.length >= 2 && (
          <div className="space-y-3 rounded-xl border border-dashed p-3">
            <div>
              <p className="text-sm font-medium">Atajo: vender entero y por porciones</p>
              <p className="text-xs text-muted-foreground">
                Una sola existencia para todas las presentaciones: la entera gasta 1 y cada porción gasta 1/N de la entera. Se descuentan
                decimales (0.1 de pastel) y el POS y el portal muestran cuántas piezas alcanzan.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormCombobox
                id="recipe-portion-whole"
                label="Presentación entera"
                value={portion.whole}
                onChange={(value) => setPortion((p) => ({ ...p, whole: value }))}
                options={ownChoices}
                placeholder="Ej. Completo"
              />
              <FormCombobox
                id="recipe-portion-slice"
                label="Presentación en porciones"
                value={portion.slice}
                onChange={(value) => setPortion((p) => ({ ...p, slice: value }))}
                options={ownChoices}
                placeholder="Ej. Rebanada"
              />
              <InputGroupField
                id="recipe-portion-count"
                label="Porciones por entero"
                type="number"
                min="2"
                step="1"
                value={portion.count}
                onChange={(event) => setPortion((p) => ({ ...p, count: event.target.value }))}
                helper="Si un entero rinde 10 rebanadas, cada rebanada gasta 0.1. Se guarda con 3 decimales: 2, 4, 5, 8, 10, 20… quedan exactos."
              />
            </div>
            {canBuildPortions && !portionExact && (
              <p className="text-xs text-warning-ink">
                Con {portionCount} porciones cada una gasta {Math.round(1000 / portionCount) / 1000} (se guarda con 3 decimales), por lo que al
                venderse todas puede quedar un sobrante mínimo. Con 2, 4, 5, 8, 10, 20 o 25 es exacto.
              </p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={buildPortions} disabled={!canBuildPortions}>
              Crear los dos renglones
            </Button>
          </div>
        )}
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            Aún no hay consumos configurados. El producto o servicio puede
            venderse sin descontar materias primas.
          </div>
        )}
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="grid min-w-0 gap-3 rounded-xl p-3 ring-1 ring-foreground/10 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(15rem,1.3fr)_minmax(8rem,.55fr)_minmax(7rem,.45fr)_auto]"
          >
            <FormCombobox
              id={`recipe-source-${index}`}
              label="Se aplica cuando"
              helper="¿En qué venta se gasta este insumo? «Siempre» = en toda venta de este producto. Elige una presentación si solo se gasta al vender esa (ej. solo la rebanada)."
              icon={<CookingPot className="size-4" />}
              value={row.source}
              onChange={(value) => update(row.id, { source: value })}
              options={sourceOptions}
              clearable={false}
              className="min-w-0"
              contentClassName="max-w-[min(34rem,calc(100vw-2rem))]"
            />
            <FormCombobox
              id={`recipe-ingredient-${index}`}
              label="Insumo"
              required
              helper="La materia prima o material que se descuenta del inventario. Solo aparecen productos que controlan inventario."
              icon={<Scale className="size-4" />}
              value={row.ingredient}
              onChange={(value) => update(row.id, { ingredient: value })}
              options={ingredientOptions}
              placeholder="Selecciona materia prima"
              className="min-w-0"
              contentClassName="max-w-[min(38rem,calc(100vw-2rem))]"
            />
            <InputGroupField
              id={`recipe-quantity-${index}`}
              label="Cantidad"
              required
              helper="Cuánto de este insumo se gasta por CADA unidad que vendes, en la unidad del insumo (pieza, kg, L). Ej.: 0.018 kg de café por taza, o 1 vaso."
              type="number"
              min="0.001"
              step="0.001"
              value={row.quantity}
              onChange={(event) =>
                update(row.id, { quantity: event.target.value })
              }
              leftIcon={<Scale className="size-4" />}
            />
            <InputGroupField
              id={`recipe-waste-${index}`}
              label="Merma %"
              helper="Porcentaje extra por desperdicio al preparar. 0 = se descuenta exactamente la cantidad anotada. Con 5%, 0.12 kg descuentan 0.126 kg."
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={row.wastePercent}
              onChange={(event) =>
                update(row.id, { wastePercent: event.target.value })
              }
            />
            <Button
              className="self-end justify-self-end md:col-span-2 xl:col-span-1"
              variant="ghost"
              size="icon"
              aria-label="Quitar insumo"
              onClick={() =>
                setRows((current) =>
                  current.filter((item) => item.id !== row.id)
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => setRows((current) => [...current, blank()])}
        >
          <Plus className="size-4" />
          Agregar insumo
        </Button>
      </div>
    </DialogComponent>
  )
}
