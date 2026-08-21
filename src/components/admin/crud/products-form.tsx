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
import { Switch } from "@/components/ui/switch"
import { InputGroupField } from "@/components/base/input-group-field"
import { cn } from "@/lib/utils"
import { optionsApi, type ProductOption } from "@/lib/api"
import { swalError, swalToast } from "@/lib/swal"
import { OptionSelect } from "./option-select"
import { Attachment } from "@/components/base/attachment"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import type { CrudField } from "./crud-config"

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
}: {
  value: "standard" | "bulk"
  onChange: (v: "standard" | "bulk") => void
  disabled?: boolean
}) {
  const options = [
    { value: "standard" as const, label: "Estándar" },
    { value: "bulk" as const, label: "Granel / Medida" },
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
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
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
  const [productType, setProductType] = useState<"standard" | "bulk">(
    initial?.productType === "bulk" ? "bulk" : "standard"
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

  const [variantSku, setVariantSku] = useState("")
  const [variantBarcode, setVariantBarcode] = useState("")
  const [variantPrice, setVariantPrice] = useState("")
  const [variantCost, setVariantCost] = useState("")

  const [options, setOptions] = useState<ProductOption[]>(
    (initial?.options as ProductOption[]) ?? []
  )
  const [optionsBusy, setOptionsBusy] = useState(false)

  // Default variants del producto (para el botón "Variantes" en la tabla)
  const defaultVariant = useMemo(() => {
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
      label: "Unidad",
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
    } else if (!isEdit) {
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
          values: o.values
            .filter((v) => v.value.trim())
            .map((v) => ({ id: v.id, value: v.value.trim() })),
        }))
      const res = await optionsApi.save(String(initial.id), cleaned)
      setOptions(res.rows)
      swalToast("Opciones guardadas")
    } catch (err) {
      swalError(
        "No se pudieron guardar las opciones",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setOptionsBusy(false)
    }
  }

  const addOption = () => {
    setOptions((prev) => [...prev, { name: "", values: [] }])
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
    updateOption(i, { values: [...options[i].values, { value: "" }] })
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
          disabled={isEdit}
        />
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

      <FieldRow label="Categoría" htmlFor="product-category">
        <OptionSelect
          id="product-category"
          field={categoryField}
          value={categoryId}
          onChange={setCategoryId}
        />
      </FieldRow>

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
        <div className="flex items-center justify-between gap-2  border border-input rounded-md p-3">
          <Switch
            id="prod-active"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <label htmlFor="prod-active" className="cursor-pointer text-sm">
            Activo
          </label>
        </div>
        <div className="flex items-center justify-between gap-2  border border-input rounded-md p-3">
          <Switch
            id="prod-track"
            checked={trackInventory}
            onCheckedChange={setTrackInventory}
          />
          <label htmlFor="prod-track" className="cursor-pointer text-sm">
            Controlar inventario
          </label>
        </div>
      </div>

      {productType === "bulk" ? (
        <>
          <FieldRow label="Unidad de medida" htmlFor="product-unit">
            <OptionSelect
              id="product-unit"
              field={unitField}
              value={bulkUnitId}
              onChange={setBulkUnitId}
            />
          </FieldRow>
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
          <div className="flex items-center justify-between gap-2 sm:col-span-2 border border-input rounded-md p-3">
            <Switch
              id="prod-split"
              checked={allowSplit}
              onCheckedChange={setAllowSplit}
            />
            <label htmlFor="prod-split" className="cursor-pointer text-sm">
              Permitir por pieza (venta dividida)
            </label>
          </div>
          {allowSplit && (
            <>
              <FieldRow label="Unidad por pieza" htmlFor="product-split-unit">
                <OptionSelect
                  id="product-split-unit"
                  field={unitField}
                  value={splitUnitId}
                  onChange={setSplitUnitId}
                />
              </FieldRow>
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
      ) : (
        <>
          {/* Variante inicial (solo creación) */}
          {!isEdit && (
            <>
              <FieldRow
                label={hasOptions ? "Precio y costo base" : "Variante inicial"}
                full
              >
                <p className="text-xs text-muted-foreground">
                  {hasOptions
                    ? "El precio y costo se aplican a todas las variantes generadas; luego podrás ajustarlos por variante."
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
            </>
          )}

          {/* SKU / Código de barras en edición (solo lectura) */}
          {isEdit && defaultVariant && (
            <>
              <FieldRow label="SKU (variante base)" full>
                <p className="text-xs text-muted-foreground">
                  El SKU de la variante base. Para editar SKU de cada variante,
                  usa el botón «Variantes» en la tabla.
                </p>
              </FieldRow>
              <InputField
                label="SKU"
                icon={<Hash className="size-4" />}
                value={defaultVariant.sku ?? ""}
                disabled
              />
              <InputField
                label="Código de barras"
                icon={<Barcode className="size-4" />}
                value={defaultVariant.barcode ?? ""}
                disabled
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
