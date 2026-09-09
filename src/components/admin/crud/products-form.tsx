"use client"

import { useId, useMemo, useState } from "react"
import {
  Barcode,
  Check,
  DollarSign,
  Hash,
  Loader2,
  Percent,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { InputGroupField } from "@/components/base/input-group-field"
import { cn } from "@/lib/utils"
import { optionsApi, type ProductOption } from "@/lib/api"
import { swalError, swalToast } from "@/lib/swal"
import { OptionSelect } from "./option-select"
import { Attachment } from "@/components/base/attachment"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import type { CrudField } from "./crud-config"
import { InfoTooltip, SwitchField } from "@/components/base"
import { useBusinessMode } from "@/hooks/use-business-mode"

interface ProductFormProps {
  initial: Record<string, unknown> | null
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onSavingChange?: (saving: boolean) => void
}

function FieldRow({
  label,
  children,
  full,
  htmlFor,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
  htmlFor?: string
}) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2")}>
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
      </Label>
      {children}
    </div>
  )
}

function InputField({
  label,
  icon,
  full,
  id,
  ...props
}: {
  label: string
  icon?: React.ReactNode
  full?: boolean
} & React.ComponentProps<typeof Input>) {
  const autoId = useId()
  return (
    <InputGroupField
      id={id ?? autoId}
      label={label}
      leftIcon={icon}
      containerClassName={full ? "sm:col-span-2" : undefined}
      {...props}
    />
  )
}

function TypeToggle({
  value,
  onChange,
  disabled,
  showCustom,
}: {
  value: "standard" | "bulk" | "custom"
  onChange: (v: "standard" | "bulk" | "custom") => void
  disabled?: boolean
  showCustom?: boolean
}) {
  const options = [
    { value: "standard" as const, label: "Estándar" },
    { value: "bulk" as const, label: "Granel / Medida" },
    ...(showCustom
      ? [{ value: "custom" as const, label: "Personalizado" }]
      : []),
  ]
  return (
    <div className="flex rounded-lg border bg-muted/40 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition hover:cursor-pointer",
            value === opt.value
              ? "bg-primary text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function numOrEmpty(v: string): number | "" {
  return v === "" || v === undefined || v === null ? "" : Number(v)
}

export function ProductsForm({
  initial,
  onSubmit,
  onSavingChange,
}: ProductFormProps) {
  const isEdit = Boolean(initial)
  const businessMode = useBusinessMode()
  const isFoodService =
    businessMode === "food_service" || businessMode === "hybrid"
  const [productType, setProductType] = useState<
    "standard" | "bulk" | "custom"
  >(
    initial?.productType === "bulk"
      ? "bulk"
      : initial?.productType === "custom"
        ? "custom"
        : "standard"
  )

  const [name, setName] = useState((initial?.name as string) ?? "")
  const [description, setDescription] = useState(
    (initial?.description as string) ?? ""
  )
  const [categoryId, setCategoryId] = useState(
    (initial?.categoryId as string) ?? ""
  )
  const [imageUrl, setImageUrl] = useState((initial?.imageUrl as string) ?? "")
  const [taxRate, setTaxRate] = useState(
    String((initial?.taxRate as number) ?? "")
  )
  const [isActive, setIsActive] = useState(
    (initial?.isActive as boolean) ?? true
  )
  const [trackInventory, setTrackInventory] = useState(
    (initial?.trackInventory as boolean) ?? true
  )
  const [isNew, setIsNew] = useState(
    (initial?.isNew as boolean) ?? false
  )

  const [bulkUnitId, setBulkUnitId] = useState(
    (initial?.bulkUnitId as string) ?? ""
  )
  const [bulkPricePerUnit, setBulkPrice] = useState(
    String((initial?.bulkPricePerUnit as number) ?? "")
  )
  const [bulkMinQuantity, setBulkMin] = useState(
    String((initial?.bulkMinQuantity as number) ?? "")
  )
  const [bulkStep, setBulkStep] = useState(
    String((initial?.bulkStep as number) ?? "")
  )
  const [bulkMaxQuantity, setBulkMax] = useState(
    String((initial?.bulkMaxQuantity as number) ?? "")
  )
  const [allowSplit, setAllowSplit] = useState(
    (initial?.allowSplit as boolean) ?? false
  )
  const [splitUnitId, setSplitUnitId] = useState(
    (initial?.splitUnitId as string) ?? ""
  )
  const [splitPricePerUnit, setSplitPrice] = useState(
    String((initial?.splitPricePerUnit as number) ?? "")
  )

  const [variantSku, setVariantSku] = useState(
    (initial?.variants as { name?: string; sku?: string | null }[])?.find(
      (v) => v.name?.toLowerCase() === "default"
    )?.sku ??
      (initial?.variants as { name?: string; sku?: string | null }[])?.[0]
        ?.sku ??
      ""
  )
  const [variantBarcode, setVariantBarcode] = useState(
    (initial?.variants as { name?: string; barcode?: string | null }[])?.find(
      (v) => v.name?.toLowerCase() === "default"
    )?.barcode ??
      (initial?.variants as { name?: string; barcode?: string | null }[])?.[0]
        ?.barcode ??
      ""
  )
  const [variantPrice, setVariantPrice] = useState(
    String(
      (initial?.variants as { name?: string; price?: number }[])?.find(
        (v) => v.name?.toLowerCase() === "default"
      )?.price ??
        (initial?.variants as { name?: string; price?: number }[])?.[0]
          ?.price ??
        ""
    )
  )
  const [variantCost, setVariantCost] = useState(
    String(
      (initial?.variants as { name?: string; cost?: number }[])?.find(
        (v) => v.name?.toLowerCase() === "default"
      )?.cost ??
        (initial?.variants as { name?: string; cost?: number }[])?.[0]?.cost ??
        ""
    )
  )

  const [options, setOptions] = useState<ProductOption[]>(
    (initial?.options as ProductOption[]) ?? []
  )
  const [optionsBusy, setOptionsBusy] = useState(false)

  // Default variants del producto (para el botón "Variantes" en la tabla)
  const _defaultVariant = useMemo(() => {
    if (!isEdit) return null
    const variants =
      (initial?.variants as {
        name?: string
        sku?: string | null
        barcode?: string | null
        price?: number
        cost?: number
      }[]) ?? []
    return (
      variants.find((v) => v.name?.toLowerCase() === "default") ??
      variants[0] ??
      null
    )
  }, [isEdit, initial])

  const categoryField = useMemo<CrudField>(
    () => ({
      key: "categoryId",
      label: "Categoría",
      type: "select",
      optionsModule: "categories",
      optionValue: "id",
      optionLabel: "name",
    }),
    []
  )
  const unitField = useMemo<CrudField>(
    () => ({
      key: "unit",
      label: "Unidad de medida",
      type: "select",
      optionsModule: "units",
      optionValue: "id",
      optionLabel: "name",
    }),
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      swalError("Campo obligatorio", "El nombre del producto es obligatorio.")
      return
    }
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description,
      categoryId: categoryId || null,
      imageUrl: imageUrl || null,
      taxRate: numOrEmpty(taxRate),
      isActive,
      trackInventory,
      isNew,
      productType,
    }

    if (productType === "bulk") {
      Object.assign(payload, {
        bulkUnitId: bulkUnitId || null,
        bulkPricePerUnit: numOrEmpty(bulkPricePerUnit),
        bulkMinQuantity: numOrEmpty(bulkMinQuantity),
        bulkStep: numOrEmpty(bulkStep),
        bulkMaxQuantity: numOrEmpty(bulkMaxQuantity),
        allowSplit,
        splitUnitId: allowSplit ? splitUnitId || null : null,
        splitPricePerUnit: allowSplit ? numOrEmpty(splitPricePerUnit) : 0,
      })
    } else if (productType === "custom") {
      // Personalizado: la variante base (precio/costo) se crea aquí; los
      // tópicos se guardan con el botón «Guardar tópicos» y nunca generan
      // combinaciones de variantes (cada tamaño/sabor se agrega en Variantes).
      payload.initialVariant = {
        name: "Default",
        sku: variantSku.trim() || null,
        barcode: variantBarcode.trim() || null,
        price: numOrEmpty(variantPrice),
        cost: numOrEmpty(variantCost),
      }
    } else {
      const hasOptions = options.some(
        (o) => o.name.trim() && o.values.some((v) => v.value.trim())
      )
      if (hasOptions) {
        payload.options = options
          .filter((o) => o.name.trim() && o.values.some((v) => v.value.trim()))
          .map((o) => ({
            name: o.name.trim(),
            values: o.values.map((v) => v.value.trim()).filter(Boolean),
          }))
        payload.initialVariant = {
          price: numOrEmpty(variantPrice),
          cost: numOrEmpty(variantCost),
        }
      } else {
        payload.initialVariant = {
          name: "Default",
          sku: variantSku.trim() || null,
          barcode: variantBarcode.trim() || null,
          price: numOrEmpty(variantPrice),
          cost: numOrEmpty(variantCost),
        }
      }
    }

    onSavingChange?.(true)
    try {
      await onSubmit(payload)
    } catch (err) {
      swalError(
        "No se pudo guardar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      onSavingChange?.(false)
    }
  }

  const saveOptions = async () => {
    if (!initial?.id) return
    setOptionsBusy(true)
    try {
      const cleaned = options
        .filter((o) => o.name.trim())
        .map((o) => ({
          id: o.id,
          name: o.name.trim(),
          required: o.required !== false,
          minSelect: Math.max(0, Number(o.minSelect) || 0),
          maxSelect: Math.max(
            Math.max(0, Number(o.minSelect) || 0),
            Number(o.maxSelect) || 1
          ),
          values: o.values
            .filter((v) => v.value.trim())
            .map((v) => ({
              id: v.id,
              value: v.value.trim(),
              extraPrice: Math.max(0, Number(v.extraPrice) || 0),
              isActive: v.isActive !== false,
            })),
        }))
      const res = await optionsApi.save(String(initial.id), cleaned)
      setOptions(res.rows)
      swalToast("Tópicos guardados")
    } catch (err) {
      swalError(
        "No se pudieron guardar los tópicos",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setOptionsBusy(false)
    }
  }

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      {
        name: "",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        values: [],
      },
    ])
  }
  const updateOption = (i: number, patch: Partial<ProductOption>) => {
    setOptions((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o))
    )
  }
  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i))
  }
  const addOptionValue = (i: number) => {
    updateOption(i, {
      values: [...options[i].values, { value: "", extraPrice: 0 }],
    })
  }
  const updateValue = (i: number, vi: number, value: string) => {
    setOptions((prev) =>
      prev.map((o, idx) =>
        idx === i
          ? {
              ...o,
              values: o.values.map((v, vdx) =>
                vdx === vi ? { ...v, value } : v
              ),
            }
          : o
      )
    )
  }
  const updateValuePrice = (i: number, vi: number, extraPrice: string) => {
    setOptions((prev) =>
      prev.map((o, idx) =>
        idx === i
          ? {
              ...o,
              values: o.values.map((v, vdx) =>
                vdx === vi
                  ? { ...v, extraPrice: Math.max(0, Number(extraPrice) || 0) }
                  : v
              ),
            }
          : o
      )
    )
  }
  const removeValue = (i: number, vi: number) => {
    setOptions((prev) =>
      prev.map((o, idx) =>
        idx === i
          ? { ...o, values: o.values.filter((_, vdx) => vdx !== vi) }
          : o
      )
    )
  }

  const hasOptions = options.some(
    (o) => o.name.trim() && o.values.some((v) => v.value.trim())
  )

  return (
    <form
      id="product-form"
      onSubmit={handleSubmit}
      className="grid gap-4 sm:grid-cols-2"
    >
      <FieldRow label="Tipo de producto" full>
        <TypeToggle
          value={productType}
          onChange={setProductType}
          showCustom={isFoodService}
        />
        {!isFoodService && (
          <p className="text-xs text-muted-foreground">
            El tipo «Personalizado» (variantes + tópicos) está disponible en
            restaurantes y negocios híbridos.
          </p>
        )}
      </FieldRow>

      <InputField
        label="Nombre"
        full
        required
        icon={<Type className="size-4" />}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej. Arroz 1kg"
      />

      <FieldRow label="Descripción" full htmlFor="product-description">
        <Textarea
          id="product-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opcional"
        />
      </FieldRow>

      {/* <FieldRow label="Categoría" htmlFor="product-category"> */}
      <OptionSelect
        id="product-category"
        field={categoryField}
        value={categoryId}
        onChange={setCategoryId}
      />
      {/* </FieldRow> */}

      <InputField
        label="IVA / Impuesto (%)"
        icon={<Percent className="size-4" />}
        type="number"
        step="any"
        value={taxRate}
        onChange={(e) => setTaxRate(e.target.value)}
        placeholder="0.16"
      />

      <FieldRow label="Imagen" full>
        <Attachment
          value={imageUrl || null}
          onChange={(v) => setImageUrl(v ?? "")}
          upload={uploadFile}
          accept={UPLOAD_IMAGE_ACCEPT}
          label=""
          widthClass="w-24"
          heightClass="h-24"
        />
      </FieldRow>

      <div className="flex flex-wrap gap-6 sm:col-span-2">
        <SwitchField
          id="prod-active"
          label="Activo"
          description="Visible en el menú"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
        <SwitchField
          id="prod-track"
          label="Controlar inventario"
          description="Seguimiento de existencias"
          checked={trackInventory}
          onCheckedChange={setTrackInventory}
        />
        <SwitchField
          id="prod-new"
          label="Producto nuevo"
          description="Genera publicación automática"
          checked={isNew}
          onCheckedChange={setIsNew}
        />
        {/* <div className="flex items-center justify-between gap-2  border border-input rounded-md p-3">
          <Switch
            id="prod-active"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <label htmlFor="prod-active" className="cursor-pointer text-sm">
            Activo
          </label>
        </div> */}
        {/* <div className="flex items-center justify-between gap-2  border border-input rounded-md p-3">
          <Switch
            id="prod-track"
            checked={trackInventory}
            onCheckedChange={setTrackInventory}
          />
          <label htmlFor="prod-track" className="cursor-pointer text-sm">
            Controlar inventario
          </label>
        </div> */}
      </div>

      {productType === "bulk" ? (
        <>
          {/* <FieldRow label="Unidad de medida" htmlFor="product-unit"> */}
          <OptionSelect
            id="product-unit"
            field={unitField}
            value={bulkUnitId}
            onChange={setBulkUnitId}
          />
          <InfoTooltip text="UNIDAD DE MEDIDA - La unidad de medida es la unidad en la que se venderá el producto, por ejemplo, kg, L, m, etc." />
          {/* </FieldRow> */}
          <InputField
            label="Precio por unidad ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={bulkPricePerUnit}
            onChange={(e) => setBulkPrice(e.target.value)}
            placeholder="0.00"
          />
          <InputField
            label="Cantidad mínima"
            icon={<Hash className="size-4" />}
            type="number"
            step="any"
            value={bulkMinQuantity}
            onChange={(e) => setBulkMin(e.target.value)}
            placeholder="0"
          />
          <InputField
            label="Cantidad máxima"
            icon={<Hash className="size-4" />}
            type="number"
            step="any"
            value={bulkMaxQuantity}
            onChange={(e) => setBulkMax(e.target.value)}
            placeholder="0"
          />
          <InputField
            label="Incremento sugerido"
            icon={<Hash className="size-4" />}
            type="number"
            step="any"
            value={bulkStep}
            onChange={(e) => setBulkStep(e.target.value)}
            placeholder="0.01"
          />
          <SwitchField
            id="prod-split"
            label="Permitir por pieza (venta dividida)"
            description="Permite vender el producto en cantidades menores a la unidad de medida, por ejemplo, 0.5kg o 0.25L."
            checked={allowSplit}
            onCheckedChange={setAllowSplit}
          />
          {/* <div className="flex items-center justify-between gap-2 sm:col-span-2 border border-input rounded-md p-3">
            <Switch
              id="prod-split"
              checked={allowSplit}
              onCheckedChange={setAllowSplit}
            />
            <label htmlFor="prod-split" className="cursor-pointer text-sm">
              Permitir por pieza (venta dividida)
            </label>
          </div> */}
          {allowSplit && (
            <>
              {/* <FieldRow label="Unidad por pieza" htmlFor="product-split-unit"> */}
              <OptionSelect
                id="product-split-unit"
                field={unitField}
                value={splitUnitId}
                onChange={setSplitUnitId}
              />
              <InfoTooltip text="UNIDAD POR PIEZA - La unidad por pieza es la unidad de medida en la que se venderá el producto si se permite la venta dividida." />
              {/* </FieldRow> */}
              <InputField
                label="Precio por pieza ($)"
                icon={<DollarSign className="size-4" />}
                type="number"
                step="0.01"
                value={splitPricePerUnit}
                onChange={(e) => setSplitPrice(e.target.value)}
                placeholder="0.00"
              />
            </>
          )}
        </>
      ) : productType === "custom" ? (
        <>
          {/* Variante base — precio, costo, SKU, código de barras */}
          <FieldRow label="Precio y costo base" full>
            <p className="text-xs text-muted-foreground">
              Precio y costo del tamaño estándar. Agrega tamaños o sabores como
              variantes desde el botón «Variantes» de la tabla; el cliente
              elegirá cuál al pedir.
            </p>
          </FieldRow>
          <InputField
            label="Precio de venta ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={variantPrice}
            onChange={(e) => setVariantPrice(e.target.value)}
          />
          <InputField
            label="Costo ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={variantCost}
            onChange={(e) => setVariantCost(e.target.value)}
          />
          <InputField
            label="SKU"
            icon={<Hash className="size-4" />}
            value={variantSku}
            onChange={(e) => setVariantSku(e.target.value)}
          />
          <InputField
            label="Código de barras"
            icon={<Barcode className="size-4" />}
            value={variantBarcode}
            onChange={(e) => setVariantBarcode(e.target.value)}
          />

          {/* Tópicos — personalización del producto */}
          <FieldRow label="Personalízalo — tópicos" full>
            <p className="text-xs text-muted-foreground">
              Define lo que el cliente puede elegir: «Tipo de leche» (elige 1),
              «Toppings» (+$ por unidad), «Sabores» (combinables con mínimo y
              máximo)… Los tópicos aparecen en el constructor del POS y del
              portal.
            </p>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sin tópicos todavía. Agrega el primero para que el producto
                  abra su constructor al pedirse.
                </p>
              )}
              {options.map((opt, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-md border bg-background/60 p-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={opt.name}
                      onChange={(e) =>
                        updateOption(i, { name: e.target.value })
                      }
                      placeholder="Ej. Tipo de leche"
                      aria-label="Nombre del tópico"
                      className="h-7 flex-1 min-w-32"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-emerald-600"
                        checked={opt.required !== false}
                        onChange={(e) =>
                          updateOption(i, { required: e.target.checked })
                        }
                      />
                      Obligatorio
                    </label>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      Mín{" "}
                      <Input
                        type="number"
                        min={0}
                        value={String(opt.minSelect ?? 0)}
                        onChange={(e) =>
                          updateOption(i, {
                            minSelect: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        aria-label="Mínimo de selección"
                        className="h-7 w-14 text-xs"
                      />{" "}
                      Máx{" "}
                      <Input
                        type="number"
                        min={1}
                        value={String(opt.maxSelect ?? 1)}
                        onChange={(e) =>
                          updateOption(i, {
                            maxSelect: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        aria-label="Máximo de selección"
                        className="h-7 w-14 text-xs"
                      />
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => removeOption(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {opt.values.map((v, vi) => (
                      <div
                        key={vi}
                        className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-1"
                      >
                        <Input
                          value={v.value}
                          onChange={(e) => updateValue(i, vi, e.target.value)}
                          placeholder="Valor"
                          aria-label="Valor del tópico"
                          className="h-6 flex-1 border-0 bg-transparent px-1 text-xs focus-visible:ring-0"
                        />
                        <span className="text-[10px] text-muted-foreground">
                          +$
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={String(v.extraPrice ?? 0)}
                          onChange={(e) =>
                            updateValuePrice(i, vi, e.target.value)
                          }
                          aria-label="Precio extra"
                          className="h-6 w-16 border-0 bg-transparent px-1 text-xs tabular-nums focus-visible:ring-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 text-muted-foreground"
                          onClick={() => removeValue(i, vi)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => addOptionValue(i)}
                    >
                      <Plus className="size-3" /> Valor
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                >
                  <Plus className="size-4" /> Agregar tópico
                </Button>
                {isEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={saveOptions}
                    disabled={optionsBusy}
                  >
                    {optionsBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Guardar tópicos
                  </Button>
                )}
              </div>
            </div>
          </FieldRow>
        </>
      ) : (
        <>
          {/* Variante base — precio, costo, SKU, código de barras */}
          <FieldRow
            label={hasOptions ? "Precio y costo base" : "Variante inicial"}
            full
          >
            <p className="text-xs text-muted-foreground">
              {hasOptions
                ? "El precio y costo se aplican a todas las variantes generadas; luego podrás ajustarlos por variante."
                : isEdit
                  ? "Edita los datos de la variante base del producto."
                  : "Crea una variante base para que el producto aparezca en el POS."}
            </p>
          </FieldRow>
          <InputField
            label="Precio de venta ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={variantPrice}
            onChange={(e) => setVariantPrice(e.target.value)}
          />
          <InputField
            label="Costo ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={variantCost}
            onChange={(e) => setVariantCost(e.target.value)}
          />
          {!hasOptions && (
            <>
              <InputField
                label="SKU"
                icon={<Hash className="size-4" />}
                value={variantSku}
                onChange={(e) => setVariantSku(e.target.value)}
              />
              <InputField
                label="Código de barras"
                icon={<Barcode className="size-4" />}
                value={variantBarcode}
                onChange={(e) => setVariantBarcode(e.target.value)}
              />
            </>
          )}

          {/* Opciones y variantes */}
          <FieldRow label="Opciones y variantes" full>
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? "Edita los atributos y guarda. Luego asigna valores a cada variante desde el botón «Variantes» en la tabla."
                : "Ej: Tamaño (chico, mediano, grande), Sabor (fresa, limón). Se generarán las combinaciones automáticamente."}
            </p>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {isEdit
                    ? "Define atributos como Talla o Color; luego asígnalos a cada variante."
                    : "Añade opciones para generar variantes. Si no añades ninguna, el producto tendrá una sola variante."}
                </p>
              )}
              {options.map((opt, i) => (
                <div
                  key={i}
                  className="space-y-1.5 rounded-md border bg-background/60 p-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={opt.name}
                      onChange={(e) =>
                        updateOption(i, { name: e.target.value })
                      }
                      placeholder="Ej. Talla"
                      aria-label="Nombre de opción"
                      className="h-7"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => removeOption(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {opt.values.map((v, vi) => (
                      <div
                        key={vi}
                        className="flex items-center gap-1 rounded-md border bg-muted/40 px-1.5"
                      >
                        <Input
                          value={v.value}
                          onChange={(e) => updateValue(i, vi, e.target.value)}
                          placeholder="Valor"
                          aria-label="Valor de opción"
                          className="h-6 w-24 border-0 bg-transparent px-1 text-xs focus-visible:ring-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 text-muted-foreground"
                          onClick={() => removeValue(i, vi)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => addOptionValue(i)}
                    >
                      <Plus className="size-3" /> Valor
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                >
                  <Plus className="size-4" /> Agregar opción
                </Button>
                {isEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={saveOptions}
                    disabled={optionsBusy}
                  >
                    {optionsBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Guardar opciones
                  </Button>
                )}
              </div>
            </div>
          </FieldRow>
        </>
      )}
    </form>
  )
}
