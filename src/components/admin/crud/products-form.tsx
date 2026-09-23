"use client"

import { useEffect, useId, useMemo, useState } from "react"
import * as yup from "yup"
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
  AlertCircle,
  Boxes,
  FileText,
  ImageIcon,
  ListTree,
  MessageSquareText,
  SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { InputGroupField } from "@/components/base/input-group-field"
import { FormCombobox } from "@/components/base/form-combobox"
import { cn } from "@/lib/utils"
import { optionsApi, type ProductOption, type ProductOptionVariantRule } from "@/lib/api"
import { swalToast } from "@/lib/swal"
import { OptionSelect } from "./option-select"
import { Attachment } from "@/components/base/attachment"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import type { CrudField } from "./crud-config"
import { SwitchField } from "@/components/base"
import { Switch } from "@/components/ui/switch"
import { useBusinessMode } from "@/hooks/use-business-mode"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"

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
  icon,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
  htmlFor?: string
  icon?: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2")}>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">
          {icon ?? <Type className="size-4" />}
        </span>
        <Label htmlFor={htmlFor} className="cursor-pointer text-sm">
          {label}
        </Label>
      </div>
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
  error?: string
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
  id,
  value,
  onChange,
  disabled,
  showCustom,
}: {
  id?: string
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
          id={opt.value === options[0]?.value ? id : undefined}
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
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

const optionalNumber = () =>
  yup
    .number()
    .transform((value, original) => (original === "" ? undefined : value))
    .typeError("Ingresa un número válido")

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
  const [isAvailable, setIsAvailable] = useState(
    (initial?.isAvailable as boolean) ?? true
  )
  const [availabilityNote, setAvailabilityNote] = useState(
    (initial?.availabilityNote as string) ?? ""
  )
  const [trackInventory, setTrackInventory] = useState(
    (initial?.trackInventory as boolean) ?? true
  )
  const [isNew, setIsNew] = useState((initial?.isNew as boolean) ?? false)

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

  const initialOptions = (initial?.options as ProductOption[]) ?? []
  const [options, setOptions] = useState<ProductOption[]>(
    initial?.productType === "custom"
      ? initialOptions.filter((option) => option.kind !== "variant")
      : initialOptions
  )
  const [variantOptions, setVariantOptions] = useState<ProductOption[]>(
    initialOptions.filter((option) => option.kind === "variant")
  )
  const saleVariants = ((initial?.variants as { id?: string; name?: string }[]) ?? [])
    .filter((variant): variant is { id: string; name?: string } => Boolean(variant.id))
  const [optionsBusy, setOptionsBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string>()
  const [optionsError, setOptionsError] = useState<string>()
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      focusFirstEnabled("product-form")
    )
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled])

  const schema = useMemo(() => {
    const shape: Record<string, yup.AnySchema> = {
      name: yup
        .string()
        .trim()
        .required("El nombre del producto es obligatorio")
        .max(255, "Máximo 255 caracteres"),
      taxRate: optionalNumber().min(0, "El impuesto no puede ser negativo"),
      variantPrice: optionalNumber().min(0, "El precio no puede ser negativo"),
      variantCost: optionalNumber().min(0, "El costo no puede ser negativo"),
    }
    if (productType === "bulk") {
      shape.bulkUnitId = yup.string().required("Selecciona la unidad de medida")
      shape.bulkPricePerUnit = optionalNumber()
        .required("El precio por unidad es obligatorio")
        .moreThan(0, "El precio debe ser mayor que cero")
      shape.bulkMinQuantity = optionalNumber().min(
        0,
        "La cantidad mínima no puede ser negativa"
      )
      shape.bulkStep = optionalNumber().moreThan(
        0,
        "El incremento debe ser mayor que cero"
      )
      shape.bulkMaxQuantity = optionalNumber().min(
        0,
        "La cantidad máxima no puede ser negativa"
      )
      if (allowSplit) {
        shape.splitUnitId = yup
          .string()
          .required("Selecciona la unidad por pieza")
        shape.splitPricePerUnit = optionalNumber()
          .required("El precio por pieza es obligatorio")
          .moreThan(0, "El precio debe ser mayor que cero")
      }
    }
    return yup.object(shape)
  }, [allowSplit, productType])

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
    // Aísla este formulario de los diálogos CRUD abiertos desde sus selectores.
    e.stopPropagation()
    const validationValues = {
      name,
      taxRate,
      variantPrice,
      variantCost,
      bulkUnitId,
      bulkPricePerUnit,
      bulkMinQuantity,
      bulkStep,
      bulkMaxQuantity,
      splitUnitId,
      splitPricePerUnit,
    }
    try {
      await schema.validate(validationValues, { abortEarly: false })
      if (
        productType === "bulk" &&
        bulkMaxQuantity !== "" &&
        bulkMinQuantity !== "" &&
        Number(bulkMaxQuantity) < Number(bulkMinQuantity)
      ) {
        throw new yup.ValidationError(
          "La cantidad máxima debe ser igual o mayor que la mínima",
          bulkMaxQuantity,
          "bulkMaxQuantity"
        )
      }
      setErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        const failures = error.inner.length ? error.inner : [error]
        for (const failure of failures) {
          if (failure.path && !next[failure.path])
            next[failure.path] = failure.message
        }
        setErrors(next)
        const focusErrors = Object.fromEntries(
          Object.entries(next).map(([key, message]) => [
            `product-${key}`,
            message,
          ])
        )
        window.requestAnimationFrame(() =>
          focusFirstInvalid(focusErrors, "product-form")
        )
      }
      return
    }
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description,
      categoryId: categoryId || null,
      imageUrl: imageUrl || null,
      taxRate: numOrEmpty(taxRate),
      isActive,
      isAvailable,
      availabilityNote: availabilityNote.trim() || null,
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
      payload.variantOptions = variantOptions
        .filter((o) => o.name.trim() && o.values.some((v) => v.value.trim()))
        .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.value.trim()).filter(Boolean) }))
      payload.topicOptions = options
        .filter((o) => o.name.trim() && o.values.some((v) => v.value.trim()))
        .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.value.trim()).filter(Boolean) }))
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
    setServerError(undefined)
    setOptionsError(undefined)
    try {
      await onSubmit(payload)
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "No se pudo guardar el producto"
      )
    } finally {
      onSavingChange?.(false)
    }
  }

  const saveOptions = async () => {
    if (!initial?.id) return
    setOptionsBusy(true)
    setOptionsError(undefined)
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
          variantRules: o.variantRules ?? [],
          values: o.values
            .filter((v) => v.value.trim())
            .map((v) => ({
              id: v.id,
              value: v.value.trim(),
              extraPrice: Math.max(0, Number(v.extraPrice) || 0),
              isActive: v.isActive !== false,
            })),
        }))
      const res = await optionsApi.save(String(initial.id), cleaned, "topic")
      setOptions(res.rows.filter((option) => option.kind === "topic"))
      swalToast("Tópicos guardados")
    } catch (err) {
      setOptionsError(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar los tópicos"
      )
    } finally {
      setOptionsBusy(false)
    }
  }

  const saveVariantOptions = async () => {
    if (!initial?.id) return
    setOptionsBusy(true)
    setOptionsError(undefined)
    try {
      const cleaned = variantOptions
        .filter((o) => o.name.trim())
        .map((o) => ({
          id: o.id,
          name: o.name.trim(),
          values: o.values.filter((v) => v.value.trim()).map((v) => ({ id: v.id, value: v.value.trim() })),
        }))
      const res = await optionsApi.save(String(initial.id), cleaned, "variant")
      setVariantOptions(res.rows.filter((option) => option.kind === "variant"))
      swalToast("Opciones y variantes guardadas")
    } catch (err) {
      setOptionsError(err instanceof Error ? err.message : "No se pudieron guardar las variantes")
    } finally {
      setOptionsBusy(false)
    }
  }

  const addVariantOption = () =>
    setVariantOptions((prev) => [
      ...prev,
      { name: "", kind: "variant", values: [{ value: "" }] },
    ])
  const updateVariantOption = (index: number, patch: Partial<ProductOption>) =>
    setVariantOptions((prev) => prev.map((option, current) => current === index ? { ...option, ...patch } : option))
  const addVariantValue = (index: number) =>
    setVariantOptions((prev) => prev.map((option, current) => current === index
      ? { ...option, values: [...option.values, { value: "" }] }
      : option))
  const updateVariantValue = (index: number, valueIndex: number, value: string) =>
    setVariantOptions((prev) => prev.map((option, current) => current === index
      ? { ...option, values: option.values.map((item, itemIndex) => itemIndex === valueIndex ? { ...item, value } : item) }
      : option))

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
  const enableVariantRules = (i: number) => {
    const option = options[i]
    const maximum = Math.max(1, Number(option.maxSelect) || 1)
    updateOption(i, {
      variantRules: saleVariants.map((variant) => ({
        variantId: variant.id,
        included: maximum,
        maxSelect: maximum,
        overageMode: "blocked",
        overagePrice: 0,
      })),
    })
  }
  const updateVariantRule = (i: number, variantId: string, patch: Partial<ProductOptionVariantRule>) => {
    const current = options[i].variantRules ?? []
    updateOption(i, {
      variantRules: current.map((rule) => rule.variantId === variantId ? { ...rule, ...patch } : rule),
    })
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
  const updateValueAvailability = (
    i: number,
    vi: number,
    isActive: boolean
  ) => {
    setOptions((prev) =>
      prev.map((option, optionIndex) =>
        optionIndex === i
          ? {
              ...option,
              values: option.values.map((value, valueIndex) =>
                valueIndex === vi ? { ...value, isActive } : value
              ),
            }
          : option
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
      noValidate
      className="grid gap-4 sm:grid-cols-2"
    >
      {(serverError || optionsError) && (
        <div
          role="alert"
          className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{serverError ?? optionsError}</span>
        </div>
      )}
      <FieldRow
        label="Tipo de producto"
        htmlFor="product-productType"
        icon={<Boxes className="size-4" />}
        full
      >
        <TypeToggle
          id="product-productType"
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
        id="product-name"
        label="Nombre"
        full
        required
        icon={<Type className="size-4" />}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej. Arroz 1kg"
        error={errors.name}
      />

      <FieldRow
        label="Descripción"
        icon={<FileText className="size-4" />}
        full
        htmlFor="product-description"
      >
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
        icon={<ListTree className="size-4" />}
      />
      {/* </FieldRow> */}

      <InputField
        id="product-taxRate"
        label="IVA / Impuesto (%)"
        icon={<Percent className="size-4" />}
        type="number"
        step="any"
        value={taxRate}
        onChange={(e) => setTaxRate(e.target.value)}
        placeholder="0.16"
        error={errors.taxRate}
      />

      <FieldRow label="Imagen" icon={<ImageIcon className="size-4" />} full>
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
          id="prod-available"
          label="Disponible para venta"
          description={
            isAvailable
              ? "Puede agregarse en POS y portal"
              : "Se muestra como Ya no hay y no puede venderse"
          }
          checked={isAvailable}
          onCheckedChange={setIsAvailable}
          infoTooltip="Úsalo como pausa operativa cuando se termine un producto o preparación. No modifica el inventario contable."
        />
        {!isAvailable && (
          <InputField
            id="product-availabilityNote"
            label="Motivo de no disponibilidad"
            icon={<MessageSquareText className="size-4" />}
            value={availabilityNote}
            onChange={(event) => setAvailabilityNote(event.target.value)}
            placeholder="Ej. Se terminó el guiso de hoy"
          />
        )}
        <SwitchField
          id="prod-new"
          label="Producto nuevo"
          description="Genera publicación automática"
          checked={isNew}
          onCheckedChange={setIsNew}
          className="w-full"
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
            id="product-bulkUnitId"
            field={unitField}
            value={bulkUnitId}
            onChange={setBulkUnitId}
            error={errors.bulkUnitId}
            infoTooltip="Unidad en la que se controla y vende este producto, por ejemplo kg, L o m."
          />
          {/* </FieldRow> */}
          <InputField
            id="product-bulkPricePerUnit"
            label="Precio por unidad ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={bulkPricePerUnit}
            onChange={(e) => setBulkPrice(e.target.value)}
            placeholder="0.00"
            error={errors.bulkPricePerUnit}
          />
          <InputField
            id="product-bulkMinQuantity"
            label="Cantidad mínima"
            icon={<Hash className="size-4" />}
            type="number"
            step="any"
            value={bulkMinQuantity}
            onChange={(e) => setBulkMin(e.target.value)}
            placeholder="0"
            error={errors.bulkMinQuantity}
          />
          <InputField
            id="product-bulkMaxQuantity"
            label="Cantidad máxima"
            icon={<Hash className="size-4" />}
            type="number"
            step="any"
            value={bulkMaxQuantity}
            onChange={(e) => setBulkMax(e.target.value)}
            placeholder="0"
            error={errors.bulkMaxQuantity}
          />
          <InputField
            id="product-bulkStep"
            label="Incremento sugerido"
            icon={<Hash className="size-4" />}
            type="number"
            step="any"
            value={bulkStep}
            onChange={(e) => setBulkStep(e.target.value)}
            placeholder="0.01"
            error={errors.bulkStep}
          />
          <SwitchField
            id="prod-split"
            label="Permitir por pieza (venta dividida)"
            description="Permite vender el producto en cantidades menores a la unidad de medida, por ejemplo, 0.5kg o 0.25L."
            checked={allowSplit}
            onCheckedChange={setAllowSplit}
            infoTooltip="Actívalo para vender fracciones de la unidad principal, por ejemplo 0.5 kg o 0.25 L."
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
                id="product-splitUnitId"
                field={unitField}
                value={splitUnitId}
                onChange={setSplitUnitId}
                error={errors.splitUnitId}
                infoTooltip="Unidad usada para cada pieza o fracción cuando la venta dividida está activa."
              />
              {/* </FieldRow> */}
              <InputField
                id="product-splitPricePerUnit"
                label="Precio por pieza ($)"
                icon={<DollarSign className="size-4" />}
                type="number"
                step="0.01"
                value={splitPricePerUnit}
                onChange={(e) => setSplitPrice(e.target.value)}
                placeholder="0.00"
                error={errors.splitPricePerUnit}
              />
            </>
          )}
        </>
      ) : productType === "custom" ? (
        <>
          <FieldRow label="Variantes y opciones" full>
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Una variante puede cambiar el servicio y sus consumos.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ejemplo: «Aplicación de pestañas» y «Aplicación + juego de pestañas».
                Guarda primero el producto, crea ambas desde el botón «Variantes» de la tabla
                y, en «Receta e insumos», asigna el juego de pestañas solo a la variante que
                lo incluye, con cantidad y merma. Así el inventario se descuenta únicamente
                cuando se vende esa opción.
              </p>
            </div>
          </FieldRow>
          {/* Variante base — precio, costo, SKU, código de barras */}
          <FieldRow label="Precio y costo base" full>
            <p className="text-xs text-muted-foreground">
              Precio y costo del tamaño estándar. Agrega tamaños o sabores como
              variantes desde el botón «Variantes» de la tabla; el cliente
              elegirá cuál al pedir.
            </p>
          </FieldRow>
          <InputField
            id="product-variantPrice"
            label="Precio de venta ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={variantPrice}
            onChange={(e) => setVariantPrice(e.target.value)}
            error={errors.variantPrice}
          />
          <InputField
            id="product-variantCost"
            label="Costo ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={variantCost}
            onChange={(e) => setVariantCost(e.target.value)}
            error={errors.variantCost}
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

          <FieldRow label="Opciones y variantes" full icon={<ListTree className="size-4" />}>
            <p className="text-xs text-muted-foreground">
              Crea las versiones vendibles del servicio o producto. Ejemplo: Tamaño
              (clásico, completo) o Presentación (servicio, servicio + producto). Cada
              combinación tendrá su propio precio, disponibilidad y receta de insumos.
            </p>
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              {variantOptions.length === 0 && (
                <div className="rounded-lg border border-dashed bg-background/60 p-3">
                  <p className="text-sm font-medium">Aún hay una sola variante base</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Agrega una opción cuando el cliente deba elegir entre versiones del servicio.
                  </p>
                </div>
              )}
              {variantOptions.map((option, index) => (
                <div key={option.id ?? index} className="space-y-2 rounded-lg border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <InputGroupField
                      label={`Opción ${index + 1}`}
                      leftIcon={<ListTree className="size-4" />}
                      value={option.name}
                      onChange={(event) => updateVariantOption(index, { name: event.target.value })}
                      placeholder="Ej. Presentación"
                      containerClassName="flex-1"
                    />
                    <Button type="button" variant="ghost" size="icon" className="mt-6 text-destructive" aria-label="Eliminar opción" onClick={() => setVariantOptions((prev) => prev.filter((_, current) => current !== index))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {option.values.map((item, valueIndex) => (
                      <div key={item.id ?? valueIndex} className="flex items-center gap-1.5">
                        <InputGroupField
                          label={`Valor ${valueIndex + 1}`}
                          leftIcon={<Type className="size-4" />}
                          value={item.value}
                          onChange={(event) => updateVariantValue(index, valueIndex, event.target.value)}
                          placeholder="Ej. Servicio + producto"
                          containerClassName="flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon" className="mt-6" aria-label="Eliminar valor" onClick={() => updateVariantOption(index, { values: option.values.filter((_, current) => current !== valueIndex) })}>
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => addVariantValue(index)}>
                    <Plus className="size-3.5" /> Agregar valor
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addVariantOption}>
                  <Plus className="size-4" /> Agregar opción
                </Button>
                {isEdit && (
                  <Button type="button" size="sm" onClick={saveVariantOptions} disabled={optionsBusy}>
                    {optionsBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Guardar y generar variantes
                  </Button>
                )}
              </div>
            </div>
          </FieldRow>

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
                        <span className="text-xs text-muted-foreground">
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
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Switch
                            checked={v.isActive !== false}
                            onCheckedChange={(checked) =>
                              updateValueAvailability(i, vi, checked)
                            }
                            aria-label={`${v.isActive !== false ? "Marcar ya no hay" : "Marcar disponible"} ${v.value || "opción"}`}
                          />
                          {v.isActive !== false ? "Disponible" : "Ya no hay"}
                        </label>
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
                  {saleVariants.length > 0 && (
                    <div className="space-y-2 rounded-lg border bg-muted/20 p-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            <SlidersHorizontal className="size-4 text-muted-foreground" />
                            Reglas por tamaño o presentación
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Define cuántas elecciones incluye cada variante y cómo cobrar las adicionales.
                          </p>
                        </div>
                        {(opt.variantRules?.length ?? 0) === 0 ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => enableVariantRules(i)}>
                            Configurar por variante
                          </Button>
                        ) : (
                          <Button type="button" variant="ghost" size="sm" onClick={() => updateOption(i, { variantRules: [] })}>
                            Usar una regla general
                          </Button>
                        )}
                      </div>
                      {(opt.variantRules?.length ?? 0) > 0 && (
                        <div className="space-y-2">
                          {saleVariants.map((variant) => {
                            const rule = opt.variantRules?.find((item) => item.variantId === variant.id)
                            if (!rule) return null
                            return (
                              <div key={variant.id} className="grid gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[minmax(7rem,1fr)_7rem_7rem_minmax(10rem,1.3fr)] sm:items-end">
                                <div className="pb-2 text-sm font-medium">{variant.name || "Presentación"}</div>
                                <InputGroupField
                                  id={`topic-${i}-${variant.id}-included`}
                                  label="Incluidas"
                                  leftIcon={<Check className="size-4" />}
                                  type="number"
                                  min={0}
                                  value={String(rule.included)}
                                  onChange={(event) => {
                                    const included = Math.max(0, Number(event.target.value) || 0)
                                    updateVariantRule(i, variant.id, { included, maxSelect: Math.max(included, rule.maxSelect) })
                                  }}
                                />
                                <InputGroupField
                                  id={`topic-${i}-${variant.id}-maximum`}
                                  label="Máximo"
                                  leftIcon={<Hash className="size-4" />}
                                  type="number"
                                  min={rule.included}
                                  disabled={rule.overageMode === "blocked"}
                                  value={String(rule.overageMode === "blocked" ? rule.included : rule.maxSelect)}
                                  onChange={(event) => updateVariantRule(i, variant.id, { maxSelect: Math.max(rule.included, Number(event.target.value) || 0) })}
                                />
                                <FormCombobox
                                    id={`topic-${i}-${variant.id}-charge`}
                                    label="Al superar lo incluido"
                                    icon={<DollarSign className="size-4" />}
                                    value={rule.overageMode}
                                    options={[
                                      { value: "blocked", label: "No permitir adicionales" },
                                      { value: "value_price", label: "Cobrar precio de cada opción" },
                                      { value: "fixed", label: "Cobrar tarifa fija por adicional" },
                                    ]}
                                    onChange={(value) => updateVariantRule(i, variant.id, { overageMode: value as ProductOptionVariantRule["overageMode"] })}
                                  />
                                {rule.overageMode === "fixed" && (
                                  <InputGroupField
                                    id={`topic-${i}-${variant.id}-overagePrice`}
                                    label="Tarifa por adicional"
                                    leftIcon={<DollarSign className="size-4" />}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={String(rule.overagePrice)}
                                    onChange={(event) => updateVariantRule(i, variant.id, { overagePrice: Math.max(0, Number(event.target.value) || 0) })}
                                  />
                                )}
                              </div>
                            )
                          })}
                          <p className="text-xs text-muted-foreground">
                            Ejemplo: Ch incluye 1 sabor; Md incluye 2; Gr incluye 3. Puedes permitir un sabor extra con tarifa fija o con el precio asignado a ese sabor.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
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
            id="product-variantPrice"
            label="Precio de venta ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={variantPrice}
            onChange={(e) => setVariantPrice(e.target.value)}
            error={errors.variantPrice}
          />
          <InputField
            id="product-variantCost"
            label="Costo ($)"
            icon={<DollarSign className="size-4" />}
            type="number"
            step="0.01"
            value={variantCost}
            onChange={(e) => setVariantCost(e.target.value)}
            error={errors.variantCost}
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
