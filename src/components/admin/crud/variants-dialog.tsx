"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Barcode,
  Copy,
  CircleDollarSign,
  DollarSign,
  Hash,
  ImageIcon,
  Loader2,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DialogComponent } from "@/components/ui/dialog"
import { variantApi, type VariantRow } from "@/lib/api"
import { money } from "@/lib/pos/money"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"

// ── Thumbnail de imagen de variante ──────────────────────────────────────────

function VariantImageCell({
  variant,
  productId,
  onSaved,
}: {
  variant: VariantRow
  productId: string
  onSaved: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const change = async (file: File) => {
    setBusy(true)
    try {
      const url = await uploadFile(file)
      await variantApi.update(productId, variant.id, { imageUrl: url })
      onSaved()
    } catch (err) {
      swalError(
        "No se pudo actualizar la imagen",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await variantApi.update(productId, variant.id, { imageUrl: null })
      onSaved()
    } catch (err) {
      swalError(
        "No se pudo quitar la imagen",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative inline-block">
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void change(f)
          e.target.value = ""
        }}
      />
      <button
        type="button"
        title="Cambiar imagen"
        onClick={() => inputRef.current?.click()}
        className="group relative block size-10 overflow-hidden rounded-md border bg-muted"
      >
        {variant.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={variant.imageUrl}
            alt={variant.name}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <ImageIcon className="size-4" />
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-background/60">
            <Loader2 className="size-4 animate-spin" />
          </span>
        )}
      </button>
      {variant.imageUrl && (
        <button
          type="button"
          title="Quitar imagen"
          onClick={() => void remove()}
          className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-white shadow-sm"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

// ── Fila editable de variante ────────────────────────────────────────────────

function VariantRowEditor({
  variant,
  productId,
  defaultSku,
  defaultBarcode,
  onSaved,
  onRemove,
}: {
  variant: VariantRow
  productId: string
  defaultSku: string
  defaultBarcode: string
  onSaved: () => void
  onRemove: (v: VariantRow) => void
}) {
  const [busy, setBusy] = useState(false)

  const save = async (patch: Partial<VariantRow>) => {
    setBusy(true)
    try {
      await variantApi.update(productId, variant.id, patch)
      swalToast("Variante guardada")
      onSaved()
    } catch (err) {
      swalError(
        "No se pudo guardar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setBusy(false)
    }
  }

  const saveField = (field: string, value: string | number | null) => {
    void save({ [field]: value })
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="px-2 py-2">
        <VariantImageCell
          variant={variant}
          productId={productId}
          onSaved={onSaved}
        />
      </td>
      <td className="px-1 py-1.5">
        <Input
          defaultValue={variant.name}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && v !== variant.name) saveField("name", v)
          }}
          className="h-8 w-full min-w-[250px] text-sm"
          disabled={true}
        />
      </td>
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-1">
          <Input
            defaultValue={variant.sku ?? ""}
            onBlur={(e) => saveField("sku", e.target.value || null)}
            className="h-8 w-full min-w-[100px] font-mono text-xs"
          />
          {defaultSku && !variant.sku && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border bg-muted/50 p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title={`Pegar SKU: ${defaultSku}`}
                    onClick={async () => {
                      await save({ sku: defaultSku })
                    }}
                  >
                    <Copy className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Pegar SKU: {defaultSku}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </td>
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-1">
          <Input
            defaultValue={variant.barcode ?? ""}
            onBlur={(e) => saveField("barcode", e.target.value || null)}
            className="h-8 w-full min-w-[150px] font-mono text-xs"
          />
          {defaultBarcode && !variant.barcode && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border bg-muted/50 p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title={`Pegar código: ${defaultBarcode}`}
                    onClick={async () => {
                      await save({ barcode: defaultBarcode })
                    }}
                  >
                    <Copy className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Pegar código: {defaultBarcode}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </td>
      <td className="px-1 py-1.5">
        <Input
          type="number"
          step="0.01"
          defaultValue={variant.price}
          onBlur={(e) => saveField("price", Number(e.target.value) || 0)}
          className="h-8 w-full min-w-[100px] text-right tabular-nums text-sm"
        />
      </td>
      <td className="px-1 py-1.5">
        <Input
          type="number"
          step="0.01"
          defaultValue={variant.cost}
          onBlur={(e) => saveField("cost", Number(e.target.value) || 0)}
          className="h-8 w-full min-w-[100px] text-right tabular-nums text-sm"
        />
      </td>
      <td className="px-2 py-2">
        <Switch
          checked={variant.isActive}
          onCheckedChange={(v) => void save({ isActive: v })}
        />
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive"
          title="Eliminar variante"
          disabled={busy}
          onClick={() => void onRemove(variant)}
        >
          <Trash2 className="size-3.5" />
        </Button>
        {busy && (
          <Loader2 className="ml-1 inline size-3.5 animate-spin text-muted-foreground" />
        )}
      </td>
    </tr>
  )
}

// ── Diálogo principal de variantes ───────────────────────────────────────────

export function VariantsDialog({
  productId,
  productName,
  productImage,
  categoryName,
  defaults,
  onClose,
}: {
  productId: string
  productName: string
  productImage: string | null
  categoryName: string | null
  defaults: { sku: string; barcode: string; price: number; cost: number }
  onClose: () => void
}) {
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await variantApi.list(productId)
      setVariants(res.rows)
    } catch (err) {
      swalError(
        "No se pudieron cargar las variantes",
        err instanceof Error ? err.message : undefined
      )
    }
  }, [productId])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await variantApi.list(productId)
        if (active) setVariants(res.rows)
      } catch {
        if (active) swalError("Error al cargar variantes")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [productId, refresh])

  const createVariant = async () => {
    setCreating(true)
    try {
      await variantApi.create(productId, {
        name: "Nueva variante",
        price: defaults.price,
        cost: defaults.cost,
        isActive: true,
      })
      await refresh()
    } catch (err) {
      swalError(
        "No se pudo crear la variante",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setCreating(false)
    }
  }

  const removeVariant = async (v: VariantRow) => {
    const ok = await swalConfirm(
      "Eliminar variante",
      `¿Eliminar «${v.name}»?`,
      {
        confirmText: "Eliminar",
        danger: true,
      }
    )
    if (!ok) return
    try {
      await variantApi.remove(productId, v.id)
      await refresh()
    } catch (err) {
      swalError(
        "No se pudo eliminar",
        err instanceof Error ? err.message : undefined
      )
    }
  }

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Variantes"
      description={`${productName} · ${variants.length} variante(s) · Edición inline: modifica y sal del campo para guardar.`}
      className="w-[60vw]"
      size="full"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          {/* <Button size="sm" disabled={creating} onClick={() => void createVariant()}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Agregar variante
          </Button> */}
        </>
      }
    >
      {/* Cabecera del producto */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
        {productImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={productImage}
            alt={productName}
            className="size-12 rounded-md object-cover"
          />
        ) : (
          <span className="grid size-12 place-items-center rounded-md bg-muted text-muted-foreground">
            <ImageIcon className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{productName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/80">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="size-3.5 text-muted-foreground" />
                    {categoryName ?? "Sin categoría"}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Categoría</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {defaults.sku && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="inline-flex cursor-help items-center gap-1.5"
                    >
                      <Hash className="size-3.5 text-muted-foreground" />
                      <span className="tabular-nums">{defaults.sku}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">SKU por defecto</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {defaults.barcode && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="inline-flex cursor-help items-center gap-1.5"
                    >
                      <Barcode className="size-3.5 text-muted-foreground" />
                      <span className="tabular-nums">{defaults.barcode}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Código de barras por defecto
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                    <span className="tabular-nums">
                      {money(defaults.price)}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Precio de venta</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1.5">
                    <CircleDollarSign className="size-3.5 text-muted-foreground" />
                    <span className="tabular-nums">{money(defaults.cost)}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Costo de compra</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Tabla de variantes con edición inline */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="w-14 px-2 py-2">Imagen</th>
                <th className="px-2 py-2">Variante</th>
                <th className="px-2 py-2">SKU</th>
                <th className="px-2 py-2">Cód. barras</th>
                <th className="px-2 py-2 text-right">Precio</th>
                <th className="px-2 py-2 text-right">Costo</th>
                <th className="w-14 px-2 py-2">Activa</th>
                <th className="w-14 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Aún no hay variantes. Agrega la primera con el botón
                    inferior.
                  </td>
                </tr>
              )}
              {variants.map((v) => (
                <VariantRowEditor
                  key={v.id}
                  variant={v}
                  productId={productId}
                  defaultSku={defaults.sku}
                  defaultBarcode={defaults.barcode}
                  onSaved={refresh}
                  onRemove={removeVariant}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DialogComponent>
  )
}
