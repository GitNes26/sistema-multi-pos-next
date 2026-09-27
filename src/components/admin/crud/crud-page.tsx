"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  ImagePlus,
  Layers3,
  Loader2,
  MailCheck,
  Plus,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useBusinessMode } from "@/hooks/use-business-mode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DialogComponent } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { DataTable } from "@/components/base/data-table"
import {
  crudApi,
  exportExcel,
  exportTemplate,
  importExcel,
  previewExcel,
  getCustomerActivity,
  type CustomerActivityData,
  type ExcelPreviewResult,
} from "@/lib/api"
import { BulkImagesDialog } from "./bulk-images-dialog"
import { money } from "@/lib/pos/money"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { CrudForm } from "./crud-form"
import { ProductsForm } from "./products-form"
import { VariantsDialog } from "./variants-dialog"
import { RecipeDialog, type RecipeProduct } from "./recipe-dialog"
import { TooltipButton } from "@/components/shared/tooltip-button"
import {
  getCrudUi,
  CRUD_PRODUCTS_TITLE,
  type CrudColumn,
  type CrudUiConfig,
} from "./crud-config"
import { Switch } from "@/components/ui/switch"
import { BulkCategoriesDialog } from "./bulk-categories-dialog"
import {
  EMPTY_PRODUCT_FILTERS,
  ProductFilters,
  ProductNameCell,
  ProductPriceCell,
  ProductRowActions,
  ProductStatusPill,
  ProductTypeBadge,
  type ProductFilterState,
} from "./products-list-parts"
import { cn } from "@/lib/utils"
import { EntityCell, RowActions, StatusPill } from "@/components/base"

interface CrudPageProps {
  moduleKey: string
  canManage: boolean
  canDelete: boolean
  icon?: React.ReactNode
}

function isProducts(moduleKey: string) {
  return moduleKey === "products"
}

const EXCEL_MODULES = ["products", "categories", "customers"]
const isExcelModule = (m: string) => EXCEL_MODULES.includes(m)

function renderCell(column: CrudColumn, row: Record<string, unknown>) {
  const value = row[column.key]
  const type = column.type ?? "text"
  if (value === undefined || value === null || value === "")
    return <span className="text-muted-foreground">—</span>

  switch (type) {
    case "boolean":
      return value ? (
        <StatusPill tone="success" dot={false}>Sí</StatusPill>
      ) : (
        <StatusPill tone="neutral" dot={false}>No</StatusPill>
      )
    case "money":
      return <span className="tabular-nums">{money(Number(value))}</span>
    case "percent":
      return (
        <span className="tabular-nums">
          {(Number(value) * 100).toFixed(2)}%
        </span>
      )
    case "count":
      return (
        <span className="tabular-nums text-muted-foreground">
          {Number(value)}
        </span>
      )
    case "points":
      // Los puntos se acumulan con fracciones; se muestran completos, como en el portal.
      return (
        <span className="font-medium tabular-nums">
          {Math.floor(Number(value)).toLocaleString("es-MX")}
          <span className="ml-1 text-xs font-normal text-muted-foreground">pts</span>
        </span>
      )
    case "code":
      return (
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
          {String(value)}
        </code>
      )
    case "badge": {
      const label = column.displayMap?.[String(value)] ?? String(value)
      const tone = column.tones?.[String(value)]
      return (
        <StatusPill tone={tone ?? "neutral"} dot={Boolean(tone)}>
          {label}
        </StatusPill>
      )
    }
    case "datetime":
      return (
        <span className="tabular-nums text-muted-foreground">
          {new Date(String(value)).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      )
    case "text":
    default:
      return (
        <span className="block max-w-72 truncate">
          {column.displayMap?.[String(value)] ?? String(value)}
        </span>
      )
  }
}

function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function CrudPage({
  moduleKey,
  canManage,
  canDelete,
  icon,
}: CrudPageProps) {
  const router = useRouter()
  const businessMode = useBusinessMode()
  const config = useMemo<CrudUiConfig | null>(
    () => (isProducts(moduleKey) ? null : (getCrudUi(moduleKey) ?? null)),
    [moduleKey]
  )
  const meta = isProducts(moduleKey)
    ? CRUD_PRODUCTS_TITLE
    : (config ?? { module: moduleKey, title: "Módulo", description: "" })
  const searchPlaceholder = isProducts(moduleKey)
    ? CRUD_PRODUCTS_TITLE.searchPlaceholder
    : (config?.searchPlaceholder ?? "Buscar…")

  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [q, setQ] = useState("")
  const debouncedQ = useDebounce(q)
  const [productFilters, setProductFilters] = useState<ProductFilterState>(EMPTY_PRODUCT_FILTERS)
  const [productCategories, setProductCategories] = useState<{ id: string; name: string }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [excelBusy, setExcelBusy] = useState<"export" | "import" | null>(null)
  const [preview, setPreview] = useState<ExcelPreviewResult | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [activity, setActivity] = useState<CustomerActivityData | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityCustomer, setActivityCustomer] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [variantsProduct, setVariantsProduct] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [recipeProduct, setRecipeProduct] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [bulkImagesOpen, setBulkImagesOpen] = useState(false)
  const [bulkCategoriesOpen, setBulkCategoriesOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      try {
        const filters = isProducts(moduleKey)
          ? Object.fromEntries(Object.entries(productFilters).filter(([, v]) => v))
          : {}
        const res = await crudApi.list(moduleKey, {
          page,
          pageSize,
          q: debouncedQ,
          ...filters,
        })
        if (signal?.aborted) return
        setRows(res.rows)
        setTotal(res.total)
      } catch (err) {
        if (signal?.aborted) return
        swalError(
          "Error al cargar",
          err instanceof Error ? err.message : undefined
        )
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [moduleKey, page, pageSize, debouncedQ, productFilters]
  )

  useEffect(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, productFilters])

  // Categorías para el filtro del listado de productos.
  useEffect(() => {
    if (!isProducts(moduleKey)) return
    crudApi
      .list("categories", { page: 1, pageSize: 200 })
      .then((res) =>
        setProductCategories(
          res.rows
            .filter((r) => r.isActive !== false)
            .map((r) => ({ id: String(r.id), name: String(r.name ?? "") }))
        )
      )
      .catch(() => setProductCategories([]))
  }, [moduleKey])

  const isDebouncing = q !== debouncedQ

  const toggleActive = useCallback(
    async (row: Record<string, unknown>, checked: boolean) => {
      if (!canManage) return
      const id = String(row.id)
      setRows((current) =>
        current.map((item) =>
          String(item.id) === id
            ? { ...item, isActive: checked, active: checked }
            : item
        )
      )
      try {
        await crudApi.update(moduleKey, id, { isActive: checked })
      } catch (error) {
        setRows((current) =>
          current.map((item) =>
            String(item.id) === id
              ? { ...item, isActive: row.isActive, active: row.active }
              : item
          )
        )
        swalError(
          "No se pudo cambiar el estado",
          error instanceof Error ? error.message : undefined
        )
      }
    },
    [canManage, moduleKey]
  )

  const toggleProductAvailability = useCallback(
    async (row: Record<string, unknown>, checked: boolean) => {
      if (!canManage) return
      const id = String(row.id)
      setRows((current) =>
        current.map((item) =>
          String(item.id) === id ? { ...item, isAvailable: checked } : item
        )
      )
      try {
        await crudApi.update("products", id, {
          isAvailable: checked,
          availabilityNote: checked
            ? null
            : (row.availabilityNote ?? "Agotado temporalmente"),
        })
      } catch (error) {
        setRows((current) =>
          current.map((item) =>
            String(item.id) === id
              ? { ...item, isAvailable: row.isAvailable }
              : item
          )
        )
        swalError(
          "No se pudo cambiar la disponibilidad",
          error instanceof Error ? error.message : undefined
        )
      }
    },
    [canManage]
  )

  const columns = useMemo(() => {
    if (!config) return []
    const subtitleKeys = new Set(config.subtitleKeys ?? [])
    const visible = config.columns.filter((col) => !subtitleKeys.has(col.key))
    return visible.map<ColumnDef<Record<string, unknown>, unknown>>(
      (col, index) => ({
        id: col.key,
        header: col.key === "isActive" || col.key === "active" ? "Activo" : col.label,
        accessorKey: col.key,
        cell: ({ row }) => {
          const r = row.original
          // Primera columna: la entidad (imagen/inicial + nombre + línea de apoyo).
          if (index === 0) {
            const subtitle = (config.subtitleKeys ?? [])
              .map((k) => r[k])
              .filter((v) => v !== undefined && v !== null && v !== "")
              .map(String)
              .join(" · ")
            return (
              <EntityCell
                title={String(r[col.key] ?? "—")}
                subtitle={subtitle || undefined}
                image={typeof r.imageUrl === "string" ? r.imageUrl : null}
                muted={r.isActive === false}
              />
            )
          }
          if (col.key === "isActive" || col.key === "active") {
            return (
              <div onClick={(event) => event.stopPropagation()}>
                <Switch
                  checked={Boolean(r[col.key])}
                  disabled={!canManage}
                  onCheckedChange={(checked) => void toggleActive(r, checked)}
                  aria-label={`${Boolean(r[col.key]) ? "Desactivar" : "Activar"} ${String(r.name ?? r.fullName ?? "registro")}`}
                />
              </div>
            )
          }
          return renderCell(col, r)
        },
      })
    )
  }, [canManage, config, toggleActive])

  const productsColumns = useMemo<
    ColumnDef<Record<string, unknown>, unknown>[]
  >(
    () => [
      {
        id: "name",
        header: "Producto",
        accessorKey: "name",
        cell: ({ row }) => <ProductNameCell row={row.original} />,
      },
      {
        id: "productType",
        header: "Tipo",
        accessorKey: "productType",
        cell: ({ row }) => <ProductTypeBadge type={row.original.productType} trackInventory={row.original.trackInventory} />,
      },
      {
        id: "price",
        header: () => <span className="ml-auto">Precio</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <ProductPriceCell row={row.original} />
          </div>
        ),
      },
      {
        id: "isAvailable",
        header: "En venta",
        accessorKey: "isAvailable",
        cell: ({ row }) => (
          <div onClick={(event) => event.stopPropagation()}>
            <Switch
              checked={row.original.isAvailable !== false && row.original.isActive !== false}
              disabled={!canManage || row.original.isActive === false}
              onCheckedChange={(checked) =>
                void toggleProductAvailability(row.original, checked)
              }
              aria-label={`${row.original.isAvailable !== false ? "Marcar agotado" : "Marcar disponible"} ${String(row.original.name ?? "producto")}`}
            />
          </div>
        ),
      },
      {
        id: "isActive",
        header: "Activo",
        accessorKey: "isActive",
        cell: ({ row }) => (
          <div onClick={(event) => event.stopPropagation()}>
            <Switch
              checked={Boolean(row.original.isActive)}
              disabled={!canManage}
              onCheckedChange={(checked) =>
                void toggleActive(row.original, checked)
              }
              aria-label={`${Boolean(row.original.isActive) ? "Desactivar" : "Activar"} ${String(row.original.name ?? "producto")}`}
            />
          </div>
        ),
      },
    ],
    [canManage, toggleActive, toggleProductAvailability]
  )

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row)
    setDialogOpen(true)
  }

  const openActivity = async (row: Record<string, unknown>) => {
    setActivityCustomer(row)
    setActivity(null)
    setActivityLoading(true)
    try {
      const data = await getCustomerActivity(String(row.id))
      setActivity(data)
    } catch (err) {
      swalError(
        "No se pudo cargar el historial",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setActivityLoading(false)
    }
  }

  const handleDelete = async (row: Record<string, unknown>) => {
    const ok = await swalConfirm(
      "Eliminar",
      "Esta acción no se puede deshacer.",
      {
        confirmText: "Eliminar",
        danger: true,
      }
    )
    if (!ok) return
    setDeletingId(String(row.id))
    try {
      await crudApi.remove(moduleKey, String(row.id))
      swalToast("Eliminado")
      load()
    } catch (err) {
      swalError(
        "No se pudo eliminar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editing) {
      await crudApi.update(moduleKey, String(editing.id), values)
      swalToast("Cambios guardados")
    } else {
      await crudApi.create(moduleKey, values)
      swalToast("Registro creado")
    }
    setDialogOpen(false)
    await load()
  }

  const handleExport = async () => {
    if (excelBusy) return
    setExcelBusy("export")
    try {
      await exportExcel(moduleKey)
      swalToast("Archivo exportado")
    } catch (err) {
      swalError(
        "No se pudo exportar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setExcelBusy(null)
    }
  }

  const handleTemplate = async () => {
    if (excelBusy) return
    setExcelBusy("export")
    try {
      await exportTemplate(moduleKey)
      swalToast("Plantilla descargada")
    } catch (err) {
      swalError(
        "No se pudo descargar la plantilla",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setExcelBusy(null)
    }
  }

  const handleImportFile = async (file: File) => {
    setExcelBusy("import")
    try {
      const result = await previewExcel(moduleKey, file)
      setPendingFile(file)
      setPreview(result)
    } catch (err) {
      swalError(
        "No se pudo analizar el archivo",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setExcelBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const confirmImport = async () => {
    if (!pendingFile) return
    setExcelBusy("import")
    try {
      const result = await importExcel(moduleKey, pendingFile)
      const errors = result.errors
      if (errors.length > 0) {
        const first = errors
          .slice(0, 5)
          .map((e) => `Fila ${e.row}: ${e.message}`)
          .join("  |  ")
        const extra = errors.length > 5 ? `  (+${errors.length - 5} más)` : ""
        swalError(
          "Importación con errores",
          `Se importaron ${result.imported} de ${result.imported + errors.length}. ${first}${extra}`
        )
      } else {
        swalToast(`${result.imported} registros importados`)
      }
      setPreview(null)
      setPendingFile(null)
      await load()
    } catch (err) {
      swalError(
        "No se pudo importar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setExcelBusy(null)
    }
  }

  const [restoringId, setRestoringId] = useState<string | null>(null)

  const handleRestore = async (row: Record<string, unknown>) => {
    const ok = await swalConfirm(
      "Restaurar",
      "¿Reactivar este registro? Aparecerá de nuevo en la lista.",
      {
        confirmText: "Restaurar",
      }
    )
    if (!ok) return
    setRestoringId(String(row.id))
    try {
      await crudApi.restore(moduleKey, String(row.id))
      swalToast("Registro restaurado")
      load()
    } catch (err) {
      swalError(
        "No se pudo restaurar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setRestoringId(null)
    }
  }

  const actionColumns = useMemo<
    ColumnDef<Record<string, unknown>, unknown>[]
  >(() => {
    if (!canManage) return []
    if (isProducts(moduleKey)) {
      return [
        {
          id: "actions",
          header: "",
          enableSorting: false,
          enableHiding: false,
          cell: ({ row }) => (
            <ProductRowActions
              row={row.original}
              canDelete={canDelete}
              deleting={deletingId === String(row.original.id)}
              onEdit={() => openEdit(row.original)}
              onVariants={() => setVariantsProduct(row.original)}
              onInventory={() =>
                router.push(
                  `/admin/inventory?q=${encodeURIComponent(String(row.original.name ?? ""))}`
                )
              }
              onRecipe={() => setRecipeProduct(row.original)}
              onDelete={() => void handleDelete(row.original)}
            />
          ),
        },
      ]
    }
    return [
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original
          const id = String(r.id)
          const name = String(r.name ?? r.fullName ?? "registro")
          if (r.isActive === false) {
            return (
              <RowActions
                name={name}
                busy={restoringId === id}
                primary={{ label: "Restaurar", icon: RotateCcw, onSelect: () => void handleRestore(r), disabled: restoringId === id }}
              />
            )
          }
          return (
            <RowActions
              name={name}
              busy={deletingId === id || resendingId === id}
              primary={{ label: "Editar", icon: Pencil, onSelect: () => openEdit(r) }}
              items={[
                {
                  label: "Ver actividad",
                  icon: Eye,
                  hidden: moduleKey !== "customers",
                  onSelect: () => void openActivity(r),
                },
                {
                  label: "Reenviar activación",
                  icon: MailCheck,
                  hint: "Envía otra vez el correo de acceso",
                  hidden: !(moduleKey === "customers" && r.accessStatus === "pending"),
                  disabled: resendingId === id,
                  onSelect: async () => {
                    setResendingId(id)
                    try {
                      await crudApi.resendActivation("customers", id)
                      swalToast("Correo de activación reenviado")
                    } catch (error) {
                      swalError("No se pudo reenviar", error instanceof Error ? error.message : undefined)
                    } finally {
                      setResendingId(null)
                    }
                  },
                },
                {
                  label: "Eliminar",
                  icon: Trash2,
                  destructive: true,
                  hidden: !canDelete,
                  disabled: deletingId === id,
                  onSelect: () => void handleDelete(r),
                },
              ]}
            />
          )
        },
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, canDelete, moduleKey, restoringId, resendingId, deletingId])

  const activeColumns = isProducts(moduleKey) ? productsColumns : columns
  const tableColumns = canManage
    ? [...activeColumns, ...actionColumns]
    : activeColumns

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <>
      <PageHeader
        icon={icon}
        title={
          // Mismo nombre que el menú: en servicios e híbrido el catálogo incluye servicios.
          isProducts(moduleKey) && (businessMode === "services" || businessMode === "hybrid")
            ? "Productos y servicios"
            : meta.title
        }
        description={meta.description}
        actions={
          canManage && (
            <div className="flex flex-wrap items-center gap-2">
              {isProducts(moduleKey) && (
                <TooltipButton
                  label="Arrastra o elige una foto para cada producto y aplícalas todas de una vez"
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkImagesOpen(true)}
                >
                  <ImagePlus className="size-4" />
                  Imágenes
                </TooltipButton>
              )}
              {moduleKey === "categories" && (
                <Button variant="outline" size="sm" onClick={() => setBulkCategoriesOpen(true)}><Layers3 className="size-4" />Agregar varias</Button>
              )}
              {isExcelModule(moduleKey) && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={excelBusy !== null}
                  >
                    {excelBusy === "export" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    {excelBusy === "export" ? "Exportando…" : "Exportar"}
                  </Button>
                  <TooltipButton
                    label="Plantilla vacía con instrucciones y catálogos (descárgala cada vez que vayas a importar)"
                    variant="outline"
                    size="sm"
                    onClick={handleTemplate}
                    disabled={excelBusy !== null}
                  >
                    <FileSpreadsheet className="size-4" />
                    {excelBusy === "export" ? "Descargando…" : "Plantilla"}
                  </TooltipButton>
                  <TooltipButton
                    label="1) Descarga la plantilla · 2) llena las filas · 3) sube el archivo para ver la vista previa · 4) confirma. Descarga la plantilla cada vez, por si se agregaron valores nuevos a los catálogos."
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={excelBusy !== null}
                    side="bottom"
                  >
                    {excelBusy === "import" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {excelBusy === "import" ? "Importando…" : "Importar"}
                  </TooltipButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleImportFile(f)
                    }}
                  />
                </>
              )}
              <Button onClick={openCreate} data-guide="crud-new">
                <Plus className="size-4" />
                {isProducts(moduleKey) ? "Nuevo producto" : (config?.newLabel ?? "Nuevo")}
              </Button>
            </div>
          )
        }
      />

      <Card data-guide="crud-table">
        <CardContent className="space-y-3 pt-5">
          {isProducts(moduleKey) && (
            <ProductFilters
              value={productFilters}
              onChange={setProductFilters}
              categories={productCategories}
            />
          )}
          <DataTable
            columns={tableColumns}
            data={rows}
            searchable={false}
            showColumnVisibility={false}
            showPagination={false}
            loading={loading}
            emptyMessage={
              isProducts(moduleKey) && (productFilters.status || productFilters.productType || productFilters.categoryId || q)
                ? "Ningún producto coincide con los filtros"
                : "Sin resultados"
            }
            rowKey={(r) => String(r.id)}
            onRowClick={canManage ? openEdit : undefined}
            renderCard={
              isProducts(moduleKey)
                ? (row) => (
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <ProductNameCell row={row} />
                        <ProductPriceCell row={row} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ProductStatusPill row={row} />
                        <ProductTypeBadge type={row.productType} trackInventory={row.trackInventory} />
                      </div>
                    </div>
                  )
                : undefined
            }
            onRefresh={() => load()}
            refreshing={loading}
            toolbarSlot={
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="relative w-full sm:w-80 sm:flex-none">
                  <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="pl-9 md:pl-9 desk:pl-9 pr-8 md:pr-8 desk:pr-8"
                    data-guide="crud-search"
                  />
                  {(isDebouncing || loading) && (
                    <Loader2 className="pointer-events-none absolute inset-y-0 right-2.5 my-auto size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular">
                  {total} {total === 1 ? "registro" : "registros"}
                </span>
              </div>
            }
          />

          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                {from}–{to} de {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-1.5 text-xs tabular-nums text-muted-foreground">
                  {page} / {pageCount}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= pageCount || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogComponent
        open={dialogOpen}
        onOpenChange={(o) => !o && setDialogOpen(false)}
        title={
          isProducts(moduleKey)
            ? editing ? "Editar producto" : "Nuevo producto"
            : editing
              ? `Editar ${config?.singular ?? "registro"}`
              : (config?.newLabel ?? "Nuevo registro")
        }
        description={
          isProducts(moduleKey)
            ? editing ? String(editing.name ?? "") : "Completa los datos básicos; podrás agregar variantes después."
            : editing
              ? String(editing.name ?? editing.fullName ?? meta.title)
              : meta.description
        }
        className="max-w-[90vw]"
        footerClassName="gap-2"
        dataGuide={`${moduleKey}-dialog`}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={formSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              data-guide="crud-submit"
              form={isProducts(moduleKey) ? "product-form" : "crud-form"}
              disabled={formSaving}
            >
              {formSaving && <Loader2 className="size-4 animate-spin" />}
              {editing
                ? formSaving
                  ? "Guardando…"
                  : "Guardar cambios"
                : isProducts(moduleKey)
                  ? formSaving
                    ? "Creando…"
                    : "Crear producto"
                  : formSaving
                    ? "Creando…"
                    : "Crear"}
            </Button>
          </>
        }
      >
        {isProducts(moduleKey) ? (
          <ProductsForm
            key={editing ? String(editing.id) : "new"}
            initial={editing}
            onSubmit={handleSubmit}
            onSavingChange={setFormSaving}
          />
        ) : config ? (
          <CrudForm
            key={editing ? String(editing.id) : "new"}
            config={config}
            initial={editing}
            onSubmit={handleSubmit}
            onSavingChange={setFormSaving}
            afterFields={config.afterFields}
          />
        ) : null}
        {loading && (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        )}
      </DialogComponent>

      <CustomerActivityDialog
        open={Boolean(activityCustomer)}
        customer={activityCustomer}
        activity={activity}
        loading={activityLoading}
        onClose={() => setActivityCustomer(null)}
      />

      {isProducts(moduleKey) && (
        <BulkImagesDialog
          open={bulkImagesOpen}
          onOpenChange={setBulkImagesOpen}
          onApplied={() => load()}
        />
      )}

      {variantsProduct && (
        <VariantsDialog
          productId={String(variantsProduct.id)}
          productName={String(variantsProduct.name ?? "Producto")}
          productImage={String(variantsProduct.imageUrl ?? "") || null}
          categoryName={String(variantsProduct.categoryName ?? "") || null}
          defaults={{
            sku: String(
              (variantsProduct.variants as { sku?: string }[])?.[0]?.sku ?? ""
            ),
            barcode: String(
              (variantsProduct.variants as { barcode?: string }[])?.[0]
                ?.barcode ?? ""
            ),
            price: Number(
              (variantsProduct.variants as { price?: number }[])?.[0]?.price ??
                0
            ),
            cost: Number(
              (variantsProduct.variants as { cost?: number }[])?.[0]?.cost ?? 0
            ),
          }}
          onClose={() => setVariantsProduct(null)}
        />
      )}

      <RecipeDialog
        product={recipeProduct as RecipeProduct | null}
        open={Boolean(recipeProduct)}
        onOpenChange={(next) => {
          if (!next) setRecipeProduct(null)
        }}
      />
      <BulkCategoriesDialog open={bulkCategoriesOpen} onOpenChange={setBulkCategoriesOpen} onComplete={() => void load()} />

      <DialogComponent
        open={preview !== null}
        onOpenChange={(o) => !o && (setPreview(null), setPendingFile(null))}
        title="Vista previa de importación"
        description={preview ? `${preview.valid} listas para importar · ${preview.invalid} requieren corrección.` : ""}
        className="max-w-[90vw]"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => (setPreview(null), setPendingFile(null))}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmImport}
              disabled={
                excelBusy !== null || (preview?.missingColumns.length ?? 0) > 0 || (preview?.invalid ?? 0) > 0 || (preview?.valid ?? 0) === 0
              }
            >
              {excelBusy === "import" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Confirmar importación
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-ink">
          Descarga la plantilla cada vez que vayas a importar: los catálogos
          (categorías, unidades, etc.) pueden tener valores nuevos que no están
          en una plantilla descargada anteriormente.
        </div>

        {preview && preview.missingColumns.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Faltan columnas requeridas: {preview.missingColumns.join(", ")}
          </div>
        )}

        {preview && preview.total === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No se detectaron filas de datos en el archivo.
          </p>
        )}

        {preview && preview.invalid > 0 && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Corrige las {preview.invalid} filas marcadas y vuelve a seleccionar el archivo. Ningún registro se importará mientras la vista previa tenga errores.
          </div>
        )}

        {preview && preview.sample.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Fila</th>
                  <th className="px-2 py-1.5 font-medium">Validación</th>
                  {preview.headers.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-2 py-1.5 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r) => (
                  <tr key={r.line} className={cn("border-t", r.errors.length > 0 && "bg-destructive/5")}>
                    <td className="px-2 py-1 text-muted-foreground">
                      {r.line}
                    </td>
                    <td className="min-w-52 px-2 py-1">
                      {r.errors.length ? <span className="text-xs text-destructive">{r.errors.join(" · ")}</span> : <span className="text-xs text-success-ink">Lista</span>}
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={i} className="max-w-40 truncate px-2 py-1">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogComponent>
    </>
  )
}

function CustomerActivityDialog({
  open,
  customer,
  activity,
  loading,
  onClose,
}: {
  open: boolean
  customer: Record<string, unknown> | null
  activity: CustomerActivityData | null
  loading: boolean
  onClose: () => void
}) {
  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={customer ? String(customer.fullName) : "Cliente"}
      description={
        <>
          {customer?.customerCode ? (
            <code className="text-xs">{String(customer.customerCode)}</code>
          ) : null}
          <span className="ml-2">
            {customer?.phone ? String(customer.phone) : ""}
          </span>
          {activity && (
            <span className="ml-2 font-medium text-foreground">
              · {activity.points.toFixed(2)} puntos
            </span>
          )}
        </>
      }
      className="max-w-[90vw]"
    >
      {loading ? (
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      ) : !activity ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sin historial.
        </p>
      ) : (
        <Tabs defaultValue="loyalty">
          <TabsList>
            <TabsTrigger value="loyalty">
              Puntos ({activity.loyalty.length})
            </TabsTrigger>
            <TabsTrigger value="sales">
              Compras ({activity.sales.length})
            </TabsTrigger>
            <TabsTrigger value="orders">
              Pedidos ({activity.orders.length})
            </TabsTrigger>
            <TabsTrigger value="favorites">
              Favoritos ({activity.favorites.length})
            </TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
          </TabsList>

          <TabsContent value="loyalty">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Fecha</th>
                  <th className="py-1.5 pr-3 font-medium">Tipo</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Puntos</th>
                  <th className="py-1.5 font-medium">Nota</th>
                </tr>
              </thead>
              <tbody>
                {activity.loyalty.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 pr-3 uppercase text-xs">{l.kind}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      <span
                        className={
                          l.points >= 0
                            ? "text-success-ink"
                            : "text-destructive"
                        }
                      >
                        {l.points > 0 ? `+${l.points}` : l.points}
                      </span>
                    </td>
                    <td className="py-1.5">{l.note ?? "—"}</td>
                  </tr>
                ))}
                {activity.loyalty.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-muted-foreground"
                    >
                      Sin movimientos de puntos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="sales">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Folio</th>
                  <th className="py-1.5 pr-3 font-medium">Fecha</th>
                  <th className="py-1.5 pr-3 text-right font-medium">
                    Artículos
                  </th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {activity.sales.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 tabular-nums">
                      #{s.saleNumber}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {s.itemCount}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {money(s.total)}
                    </td>
                  </tr>
                ))}
                {activity.sales.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-muted-foreground"
                    >
                      Sin compras.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="orders">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Pedido</th>
                  <th className="py-1.5 pr-3 font-medium">Fecha</th>
                  <th className="py-1.5 pr-3 font-medium">Estatus</th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {activity.orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 tabular-nums">
                      #{o.orderNumber}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Badge variant="secondary">{o.status}</Badge>
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {money(o.total)}
                    </td>
                  </tr>
                ))}
                {activity.orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-muted-foreground"
                    >
                      Sin pedidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="favorites">
            <ul className="space-y-1.5">
              {activity.favorites.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
                >
                  <span>
                    {f.productName}
                    {f.variantName && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {f.variantName}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
              {activity.favorites.length === 0 && (
                <li className="py-4 text-center text-sm text-muted-foreground">
                  Sin favoritos.
                </li>
              )}
            </ul>
          </TabsContent>

          <TabsContent value="payments">
            <ul className="space-y-1.5">
              {activity.paymentMethods.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
                >
                  <span>
                    {p.brand ?? "Tarjeta"}{" "}
                    {p.last4 ? (
                      <span className="font-medium">···· {p.last4}</span>
                    ) : null}
                    {p.expMonth && p.expYear ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · vence {String(p.expMonth).padStart(2, "0")}/
                        {p.expYear}
                      </span>
                    ) : null}
                  </span>
                  {p.isDefault && <Badge>Principal</Badge>}
                </li>
              ))}
              {activity.paymentMethods.length === 0 && (
                <li className="py-4 text-center text-sm text-muted-foreground">
                  Sin métodos de pago guardados.
                </li>
              )}
            </ul>
          </TabsContent>
        </Tabs>
      )}
    </DialogComponent>
  )
}
