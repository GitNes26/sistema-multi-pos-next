"use client"

import { CookingPot, Layers, Package, PackagePlus, Pencil, Scale, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EntityCell, RowActions, SegmentedFilter, StatusPill } from "@/components/base"
import { categoryAccent } from "@/lib/catalog/placeholder"
import { money } from "@/lib/pos/money"
import { cn } from "@/lib/utils"

// Lo específico del listado de Productos: filtros propios (tipo, categoría,
// "agotado") y cómo se leen precio/variantes. La presentación usa los
// componentes compartidos de @/components/base.

export type ProductStatusFilter = "" | "active" | "unavailable" | "inactive"
export type ProductTypeFilter = "" | "standard" | "bulk" | "custom"

export interface ProductFilterState {
  status: ProductStatusFilter
  productType: ProductTypeFilter
  categoryId: string
}

export const EMPTY_PRODUCT_FILTERS: ProductFilterState = { status: "", productType: "", categoryId: "" }

type Row = Record<string, unknown>

const TYPE_OPTIONS: { value: ProductTypeFilter; label: string }[] = [
  { value: "", label: "Todos los tipos" },
  { value: "standard", label: "Estándar" },
  { value: "bulk", label: "Granel" },
  { value: "custom", label: "Personalizado" },
]

/* ─── Filtros ─── */
export function ProductFilters({
  value,
  onChange,
  categories,
}: {
  value: ProductFilterState
  onChange: (next: ProductFilterState) => void
  categories: { id: string; name: string }[]
}) {
  const hasFilters = value.status || value.productType || value.categoryId
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedFilter
        ariaLabel="Estado"
        value={value.status}
        onChange={(status) => onChange({ ...value, status })}
        options={[
          { value: "", label: "Todos" },
          { value: "active", label: "En venta" },
          { value: "unavailable", label: "Agotados" },
          { value: "inactive", label: "Inactivos" },
        ]}
      />

      <Select
        value={value.productType || "all"}
        onValueChange={(v) => onChange({ ...value, productType: (v === "all" ? "" : v) as ProductTypeFilter })}
      >
        <SelectTrigger className="w-auto min-w-40" aria-label="Tipo de producto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value || "all"} value={opt.value || "all"}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {categories.length > 0 && (
        <Select
          value={value.categoryId || "all"}
          onValueChange={(v) => onChange({ ...value, categoryId: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-auto min-w-44" aria-label="Categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_PRODUCT_FILTERS)} className="text-muted-foreground">
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}

/* ─── Celdas ─── */
function productSubtitle(row: Row) {
  const variants = (row.variants as { sku?: string | null }[] | undefined) ?? []
  const sku = variants[0]?.sku
  return [
    row.categoryName ? String(row.categoryName) : "Sin categoría",
    variants.length > 1 ? `${variants.length} variantes` : sku ? `SKU ${sku}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function ProductNameCell({ row, size }: { row: Row; size?: "md" | "lg" }) {
  const category = row.categoryName ? String(row.categoryName) : null
  return (
    <EntityCell
      title={String(row.name ?? "")}
      subtitle={productSubtitle(row)}
      image={typeof row.imageUrl === "string" && row.imageUrl ? row.imageUrl : null}
      icon={<Package className="size-4" />}
      accent={categoryAccent(category)}
      muted={row.isActive === false}
      size={size}
    />
  )
}

const TYPE_META: Record<string, { label: string; icon?: typeof Scale; className: string }> = {
  bulk: { label: "Granel", icon: Scale, className: "bg-foreground/85 text-background" },
  custom: { label: "Personalizado", icon: Sparkles, className: "bg-primary/12 text-primary" },
  standard: { label: "Estándar", className: "bg-muted text-muted-foreground" },
}

export function ProductTypeBadge({ type }: { type: unknown }) {
  const meta = TYPE_META[String(type)] ?? TYPE_META.standard
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", meta.className)}>
      {Icon && <Icon className="size-3" />}
      {meta.label}
    </span>
  )
}

export function productPrice(row: Row): number | undefined {
  const variants = (row.variants as { price: number }[] | undefined) ?? []
  const prices = variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n))
  return prices.length ? Math.min(...prices) : undefined
}

export function ProductPriceCell({ row }: { row: Row }) {
  const variants = (row.variants as { price: number }[] | undefined) ?? []
  const price = productPrice(row)
  if (price === undefined) return <span className="text-muted-foreground">—</span>
  const prices = variants.map((v) => Number(v.price))
  const ranged = prices.length > 1 && Math.max(...prices) !== price
  return (
    <span className="font-medium tabular-nums whitespace-nowrap">
      {ranged && <span className="mr-1 text-xs font-normal text-muted-foreground">desde</span>}
      {money(price)}
    </span>
  )
}

/** Estado legible en una sola etiqueta (tarjetas móviles). */
export function ProductStatusPill({ row }: { row: Row }) {
  if (row.isActive === false) return <StatusPill tone="neutral">Inactivo</StatusPill>
  if (row.isAvailable === false) return <StatusPill tone="warning">Agotado</StatusPill>
  return <StatusPill tone="success">En venta</StatusPill>
}

/* ─── Acciones de fila ─── */
export function ProductRowActions({
  row,
  canDelete,
  deleting,
  onEdit,
  onVariants,
  onInventory,
  onRecipe,
  onDelete,
}: {
  row: Row
  canDelete: boolean
  deleting: boolean
  onEdit: () => void
  onVariants: () => void
  onInventory: () => void
  onRecipe: () => void
  onDelete: () => void
}) {
  const type = row.productType
  return (
    <RowActions
      name={String(row.name ?? "producto")}
      busy={deleting}
      primary={{ label: "Editar", icon: Pencil, onSelect: onEdit }}
      items={[
        {
          label: "Variantes y precios",
          icon: Layers,
          hidden: !(type === "standard" || type === "custom"),
          onSelect: onVariants,
          "data-guide": "variants-btn",
        },
        { label: "Ver y llenar inventario", icon: PackagePlus, onSelect: onInventory },
        { label: "Receta e insumos", icon: CookingPot, hidden: type !== "custom", onSelect: onRecipe },
        { label: "Eliminar", icon: Trash2, destructive: true, hidden: !canDelete, disabled: deleting, onSelect: onDelete },
      ]}
    />
  )
}
