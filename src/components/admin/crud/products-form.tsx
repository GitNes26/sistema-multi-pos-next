"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  Barcode,
  Check,
  DollarSign,
  Hash,
  ImageIcon,
  Layers,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Tag,
  Trash2,
  Type,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { InputGroupField } from "@/components/base/input-group-field";
import { DialogComponent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { optionsApi, variantApi, type VariantRow, type ProductOption } from "@/lib/api";
import { money } from "@/lib/pos/money";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { OptionSelect } from "./option-select";
import { Attachment } from "@/components/base/attachment";
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads";
import type { CrudField } from "./crud-config";

interface ProductFormProps {
  initial: Record<string, unknown> | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onSavingChange?: (saving: boolean) => void;
}

function FieldRow({
  label,
  children,
  full,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2")}>
      <Label htmlFor={htmlFor} className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function InputField({
  label,
  icon,
  full,
  id,
  ...props
}: {
  label: string;
  icon?: React.ReactNode;
  full?: boolean;
} & React.ComponentProps<typeof Input>) {
  const autoId = useId();
  return (
    <InputGroupField
      id={id ?? autoId}
      label={label}
      leftIcon={icon}
      containerClassName={full ? "sm:col-span-2" : undefined}
      {...props}
    />
  );
}

function TypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: "standard" | "bulk";
  onChange: (v: "standard" | "bulk") => void;
  disabled?: boolean;
}) {
  const options = [
    { value: "standard" as const, label: "Estándar" },
    { value: "bulk" as const, label: "Granel / Medida" },
  ];
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
  );
}

function numOrEmpty(v: string): number | "" {
  return v === "" || v === undefined || v === null ? "" : Number(v);
}

export function ProductsForm({ initial, onSubmit, onSavingChange }: ProductFormProps) {
  const isEdit = Boolean(initial);
  const [productType, setProductType] = useState<"standard" | "bulk">(
    initial?.productType === "bulk" ? "bulk" : "standard"
  );

  const [name, setName] = useState((initial?.name as string) ?? "");
  const [description, setDescription] = useState((initial?.description as string) ?? "");
  const [categoryId, setCategoryId] = useState((initial?.categoryId as string) ?? "");
  const [imageUrl, setImageUrl] = useState((initial?.imageUrl as string) ?? "");
  const [taxRate, setTaxRate] = useState(String((initial?.taxRate as number) ?? ""));
  const [isActive, setIsActive] = useState((initial?.isActive as boolean) ?? true);
  const [trackInventory, setTrackInventory] = useState((initial?.trackInventory as boolean) ?? true);

  const [bulkUnitId, setBulkUnitId] = useState((initial?.bulkUnitId as string) ?? "");
  const [bulkPricePerUnit, setBulkPrice] = useState(String((initial?.bulkPricePerUnit as number) ?? ""));
  const [bulkMinQuantity, setBulkMin] = useState(String((initial?.bulkMinQuantity as number) ?? ""));
  const [bulkStep, setBulkStep] = useState(String((initial?.bulkStep as number) ?? ""));
  const [bulkMaxQuantity, setBulkMax] = useState(String((initial?.bulkMaxQuantity as number) ?? ""));
  const [allowSplit, setAllowSplit] = useState((initial?.allowSplit as boolean) ?? false);
  const [splitUnitId, setSplitUnitId] = useState((initial?.splitUnitId as string) ?? "");
  const [splitPricePerUnit, setSplitPrice] = useState(String((initial?.splitPricePerUnit as number) ?? ""));

  const [variantSku, setVariantSku] = useState("");
  const [variantBarcode, setVariantBarcode] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantCost, setVariantCost] = useState("");

  const [variants, setVariants] = useState<VariantRow[]>(
    (initial?.variants as VariantRow[]) ?? []
  );

  const [options, setOptions] = useState<ProductOption[]>(
    (initial?.options as ProductOption[]) ?? []
  );
  const [optionsBusy, setOptionsBusy] = useState(false);

  const [vBusy, setVBusy] = useState(false);
  const [editVariant, setEditVariant] = useState<VariantRow | null>(null);
  const [variantsOpen, setVariantsOpen] = useState(false);

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
  );
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
  );

  // Valores por defecto de SKU / precios: en edición vienen de la variante
  // "Default" (o la primera); en creación, de los campos de la variante inicial.
  const productDefaults = useMemo(
    () => {
      if (!isEdit) {
        return { sku: variantSku, barcode: variantBarcode, price: variantPrice, cost: variantCost };
      }
      const v = variants.find((x) => x.name.toLowerCase() === "default") ?? variants[0];
      return {
        sku: v?.sku ?? "",
        barcode: v?.barcode ?? "",
        price: v ? String(v.price) : "",
        cost: v ? String(v.cost) : "",
      };
    },
    [isEdit, variants, variantSku, variantBarcode, variantPrice, variantCost]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      swalError("Campo obligatorio", "El nombre del producto es obligatorio.");
      return;
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
    };

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
      });
    } else if (!isEdit) {
      const hasOptions = options.some((o) => o.name.trim() && o.values.some((v) => v.value.trim()));
      if (hasOptions) {
        payload.options = options
          .filter((o) => o.name.trim() && o.values.some((v) => v.value.trim()))
          .map((o) => ({
            name: o.name.trim(),
            values: o.values.map((v) => v.value.trim()).filter(Boolean),
          }));
        payload.initialVariant = { price: numOrEmpty(variantPrice), cost: numOrEmpty(variantCost) };
      } else {
        payload.initialVariant = {
          name: "Default",
          sku: variantSku.trim() || null,
          barcode: variantBarcode.trim() || null,
          price: numOrEmpty(variantPrice),
          cost: numOrEmpty(variantCost),
        };
      }
    }

    onSavingChange?.(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      onSavingChange?.(false);
    }
  };

  const refreshVariants = async () => {
    if (!initial?.id) return;
    const res = await variantApi.list(String(initial.id));
    setVariants(res.rows);
  };

  const createVariant = async (): Promise<VariantRow | null> => {
    if (!initial?.id) return null;
    setVBusy(true);
    try {
      const res = await variantApi.create(String(initial.id), {
        name: "Nueva variante",
        sku: productDefaults.sku || null,
        barcode: productDefaults.barcode || null,
        price: Number(productDefaults.price) || 0,
        cost: Number(productDefaults.cost) || 0,
        isActive: true,
      });
      await refreshVariants();
      return res.row;
    } catch (err) {
      swalError("No se pudo crear la variante", err instanceof Error ? err.message : undefined);
      return null;
    } finally {
      setVBusy(false);
    }
  };

  const removeVariant = async (variant: VariantRow) => {
    if (!initial?.id) return;
    const ok = await swalConfirm("Eliminar variante", `¿Eliminar «${variant.name}»?`, {
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await variantApi.remove(String(initial.id), variant.id);
      await refreshVariants();
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  const saveVariant = async (variantId: string, data: {
    name?: string;
    sku?: string;
    barcode?: string;
    price?: number;
    cost?: number;
    imageUrl?: string | null;
    optionValueIds?: string[];
  }) => {
    if (!initial?.id) return;
    try {
      await variantApi.update(String(initial.id), variantId, data);
      await refreshVariants();
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
      throw err;
    }
  };

  const saveOptions = async () => {
    if (!initial?.id) return;
    setOptionsBusy(true);
    try {
      const cleaned = options
        .filter((o) => o.name.trim())
        .map((o) => ({
          id: o.id,
          name: o.name.trim(),
          values: o.values.filter((v) => v.value.trim()).map((v) => ({ id: v.id, value: v.value.trim() })),
        }));
      const res = await optionsApi.save(String(initial.id), cleaned);
      setOptions(res.rows);
      swalToast("Opciones guardadas");
    } catch (err) {
      swalError("No se pudieron guardar las opciones", err instanceof Error ? err.message : undefined);
    } finally {
      setOptionsBusy(false);
    }
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { name: "", values: [] }]);
  };
  const updateOption = (i: number, patch: Partial<ProductOption>) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  };
  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addOptionValue = (i: number) => {
    updateOption(i, { values: [...options[i].values, { value: "" }] });
  };
  const updateValue = (i: number, vi: number, value: string) => {
    setOptions((prev) =>
      prev.map((o, idx) =>
        idx === i ? { ...o, values: o.values.map((v, vdx) => (vdx === vi ? { ...v, value } : v)) } : o
      )
    );
  };
  const removeValue = (i: number, vi: number) => {
    setOptions((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, values: o.values.filter((_, vdx) => vdx !== vi) } : o))
    );
  };

  const hasOptions = options.some((o) => o.name.trim() && o.values.some((v) => v.value.trim()));

  return (
    <form id="product-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <FieldRow label="Tipo de producto" full>
        <TypeToggle value={productType} onChange={setProductType} disabled={isEdit} />
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
        <Textarea id="product-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
      </FieldRow>

      <FieldRow label="Categoría" htmlFor="product-category">
        <OptionSelect id="product-category" field={categoryField} value={categoryId} onChange={setCategoryId} />
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
        <div className="flex items-center gap-2">
          <Switch id="prod-active" checked={isActive} onCheckedChange={setIsActive} />
          <label htmlFor="prod-active" className="cursor-pointer text-sm">Activo</label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="prod-track" checked={trackInventory} onCheckedChange={setTrackInventory} />
          <label htmlFor="prod-track" className="cursor-pointer text-sm">Controlar inventario</label>
        </div>
      </div>

      {productType === "bulk" ? (
        <>
          <FieldRow label="Unidad de medida" htmlFor="product-unit">
            <OptionSelect id="product-unit" field={unitField} value={bulkUnitId} onChange={setBulkUnitId} />
          </FieldRow>
          <InputField label="Precio por unidad ($)" icon={<DollarSign className="size-4" />} type="number" step="0.01" value={bulkPricePerUnit} onChange={(e) => setBulkPrice(e.target.value)} placeholder="0.00" />
          <InputField label="Cantidad mínima" icon={<Hash className="size-4" />} type="number" step="any" value={bulkMinQuantity} onChange={(e) => setBulkMin(e.target.value)} placeholder="0" />
          <InputField label="Cantidad máxima" icon={<Hash className="size-4" />} type="number" step="any" value={bulkMaxQuantity} onChange={(e) => setBulkMax(e.target.value)} placeholder="0" />
          <InputField label="Incremento sugerido" icon={<Hash className="size-4" />} type="number" step="any" value={bulkStep} onChange={(e) => setBulkStep(e.target.value)} placeholder="0.01" />
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch id="prod-split" checked={allowSplit} onCheckedChange={setAllowSplit} />
            <label htmlFor="prod-split" className="cursor-pointer text-sm">Permitir por pieza (venta dividida)</label>
          </div>
          {allowSplit && (
            <>
              <FieldRow label="Unidad por pieza" htmlFor="product-split-unit">
                <OptionSelect id="product-split-unit" field={unitField} value={splitUnitId} onChange={setSplitUnitId} />
              </FieldRow>
              <InputField label="Precio por pieza ($)" icon={<DollarSign className="size-4" />} type="number" step="0.01" value={splitPricePerUnit} onChange={(e) => setSplitPrice(e.target.value)} placeholder="0.00" />
            </>
          )}
        </>
      ) : (
        <>
          {!isEdit && (
            <>
              <FieldRow label={hasOptions ? "Precio y costo base" : "Variante inicial"} full>
                <p className="text-xs text-muted-foreground">
                  {hasOptions
                    ? "El precio y costo se aplican a todas las variantes generadas; luego podrás ajustarlos por variante."
                    : "Crea una variante base para que el producto aparezca en el POS."}
                </p>
              </FieldRow>
              <InputField label="Precio de venta ($)" icon={<DollarSign className="size-4" />} type="number" step="0.01" value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} />
              <InputField label="Costo ($)" icon={<DollarSign className="size-4" />} type="number" step="0.01" value={variantCost} onChange={(e) => setVariantCost(e.target.value)} />
              {!hasOptions && (
                <>
                  <InputField label="SKU" icon={<Hash className="size-4" />} value={variantSku} onChange={(e) => setVariantSku(e.target.value)} />
                  <InputField label="Código de barras" icon={<Barcode className="size-4" />} value={variantBarcode} onChange={(e) => setVariantBarcode(e.target.value)} />
                </>
              )}
            </>
          )}

          <FieldRow label="Opciones y variantes" full>
            <p className="text-xs text-muted-foreground">
              Ej: Tamaño (chico, mediano, grande), Sabor (fresa, limón). Se generarán las combinaciones automáticamente.
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
                <div key={i} className="space-y-1.5 rounded-md border bg-background/60 p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={opt.name}
                      onChange={(e) => updateOption(i, { name: e.target.value })}
                      placeholder="Ej. Talla"
                      aria-label="Nombre de opción"
                      className="h-7"
                    />
                    <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeOption(i)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {opt.values.map((v, vi) => (
                      <div key={vi} className="flex items-center gap-1 rounded-md border bg-muted/40 px-1.5">
                        <Input
                          value={v.value}
                          onChange={(e) => updateValue(i, vi, e.target.value)}
                          placeholder="Valor"
                          aria-label="Valor de opción"
                          className="h-6 w-24 border-0 bg-transparent px-1 text-xs focus-visible:ring-0"
                        />
                        <Button type="button" variant="ghost" size="icon" className="size-5 text-muted-foreground" onClick={() => removeValue(i, vi)}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addOptionValue(i)}>
                      <Plus className="size-3" /> Valor
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="size-4" /> Agregar opción
                </Button>
                {isEdit && (
                  <Button type="button" size="sm" variant="default" onClick={saveOptions} disabled={optionsBusy}>
                    {optionsBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Guardar opciones
                  </Button>
                )}
              </div>
            </div>
          </FieldRow>

          {isEdit && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 sm:col-span-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">Variantes</p>
                <p className="truncate text-xs text-muted-foreground">
                  {variants.length === 0
                    ? "Aún no hay variantes."
                    : `${variants.length} variante(s) · imagen, SKU, código de barras y precios propios.`}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setVariantsOpen(true)}>
                <Layers className="size-4" />
                Gestionar variantes
              </Button>
            </div>
          )}
        </>
      )}

      {isEdit && variantsOpen && (
        <VariantsDialog
          product={{
            name: name.trim() || "Producto",
            imageUrl: imageUrl || null,
            categoryName: (initial?.categoryName as string | null) ?? null,
          }}
          variants={variants}
          defaults={productDefaults}
          busy={vBusy}
          onClose={() => setVariantsOpen(false)}
          onCreate={async () => {
            const row = await createVariant();
            if (row) setEditVariant(row);
          }}
          onEdit={setEditVariant}
          onRemove={removeVariant}
          onImage={(variant, imageUrl) => saveVariant(variant.id, { imageUrl })}
        />
      )}

      {editVariant && (
        <VariantEditDialog
          variant={editVariant}
          options={options}
          siblings={variants}
          onClose={() => setEditVariant(null)}
          onSave={saveVariant}
        />
      )}
    </form>
  );
}

// ── Diálogo de variantes con imagen, cabecera del producto y valores por defecto ─

function HeaderStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex cursor-help items-center gap-1.5 text-sm text-foreground/80">
            <span className="text-muted-foreground">{icon}</span>
            <span className="tabular-nums">{value ?? "—"}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function VariantImageCell({
  variant,
  onImage,
}: {
  variant: VariantRow;
  onImage: (variant: VariantRow, imageUrl: string | null) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const change = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadFile(file);
      await onImage(variant, url);
    } catch (err) {
      swalError("No se pudo actualizar la imagen", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block">
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void change(f);
          e.target.value = "";
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
          <img src={variant.imageUrl} alt={variant.name} className="size-full object-cover" />
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
          onClick={() => void onImage(variant, null)}
          className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-white shadow-sm"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

function VariantsDialog({
  product,
  variants,
  defaults,
  busy,
  onClose,
  onCreate,
  onEdit,
  onRemove,
  onImage,
}: {
  product: { name: string; imageUrl: string | null; categoryName: string | null };
  variants: VariantRow[];
  defaults: { sku: string; barcode: string; price: string; cost: string };
  busy: boolean;
  onClose: () => void;
  onCreate: () => Promise<void>;
  onEdit: (variant: VariantRow) => void;
  onRemove: (variant: VariantRow) => Promise<void>;
  onImage: (variant: VariantRow, imageUrl: string | null) => Promise<void>;
}) {
  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Variantes"
      description={`${product.name} · ${variants.length} variante(s)`}
      className="sm:max-w-3xl"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void onCreate()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Agregar variante
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="size-12 rounded-md object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-md bg-muted text-muted-foreground">
            <ImageIcon className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{product.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <HeaderStat icon={<Tag className="size-3.5" />} label="Categoría" value={product.categoryName ?? "Sin categoría"} />
            <HeaderStat icon={<Hash className="size-3.5" />} label="SKU por defecto de nuevas variantes" value={defaults.sku} />
            <HeaderStat icon={<Barcode className="size-3.5" />} label="Código de barras por defecto" value={defaults.barcode} />
            <HeaderStat
              icon={<DollarSign className="size-3.5" />}
              label="Precio de venta por defecto de nuevas variantes"
              value={defaults.price ? money(Number(defaults.price)) : null}
            />
            <HeaderStat
              icon={<Wallet className="size-3.5" />}
              label="Precio de compra / costo por defecto de nuevas variantes"
              value={defaults.cost ? money(Number(defaults.cost)) : null}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Imagen</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Cód. barras</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  Aún no hay variantes. Agrega la primera con el botón inferior.
                </TableCell>
              </TableRow>
            )}
            {variants.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <VariantImageCell variant={v} onImage={onImage} />
                </TableCell>
                <TableCell>
                  <span className="block max-w-44 truncate font-medium">{v.name}</span>
                  {v.optionValues && v.optionValues.length > 0 && (
                    <span className="block max-w-44 truncate text-xs text-muted-foreground">
                      {v.optionValues.map((ov) => ov.value).join(", ")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{v.sku ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{v.barcode ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{money(v.price)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(v.cost)}</TableCell>
                <TableCell>
                  <Badge variant={v.isActive ? "default" : "secondary"}>{v.isActive ? "Activa" : "Inactiva"}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button type="button" variant="ghost" size="icon" className="size-7" title="Editar" onClick={() => onEdit(v)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    title="Eliminar"
                    onClick={() => void onRemove(v)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DialogComponent>
  );
}

// ── Diálogo de edición de variante con asignación de opciones ───────────────

function VariantEditDialog({
  variant,
  options,
  siblings,
  onClose,
  onSave,
}: {
  variant: VariantRow;
  options: ProductOption[];
  siblings: VariantRow[];
  onClose: () => void;
  onSave: (
    variantId: string,
    data: { name?: string; sku?: string; barcode?: string; price?: number; cost?: number; imageUrl?: string | null; optionValueIds?: string[] }
  ) => Promise<void>;
}) {
  const [name, setName] = useState(variant.name);
  const [sku, setSku] = useState(variant.sku ?? "");
  const [barcode, setBarcode] = useState(variant.barcode ?? "");
  const [price, setPrice] = useState(String(variant.price));
  const [cost, setCost] = useState(String(variant.cost));
  const [imageUrl, setImageUrl] = useState(variant.imageUrl ?? "");
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const ov of variant.optionValues ?? []) map[ov.optionId] = ov.valueId;
    return map;
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedSku = sku.trim();
    const trimmedBarcode = barcode.trim();
    const others = siblings.filter((s) => s.id !== variant.id);
    if (trimmedSku && others.some((s) => s.sku === trimmedSku)) {
      swalError("SKU duplicado", `Otra variante ya usa el SKU «${trimmedSku}».`);
      return;
    }
    if (trimmedBarcode && others.some((s) => s.barcode === trimmedBarcode)) {
      swalError("Código duplicado", `Otra variante ya usa el código de barras «${trimmedBarcode}».`);
      return;
    }
    setSaving(true);
    try {
      const optionValueIds = options
        .filter((o) => o.id && selected[o.id as string])
        .map((o) => selected[o.id as string])
        .filter(Boolean);
      await onSave(variant.id, {
        name: trimmedName || "Default",
        sku: trimmedSku || undefined,
        barcode: trimmedBarcode || undefined,
        price: Number(price) || 0,
        cost: Number(cost) || 0,
        imageUrl: imageUrl || null,
        optionValueIds,
      });
      onClose();
      swalToast("Variante actualizada");
    } catch {
      // el error ya se muestra en saveVariant
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Editar variante"
      description={variant.name}
      className="sm:max-w-md"
      footerClassName="gap-2"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Guardar
          </Button>
        </>
      }
    >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="v-name">Nombre</Label>
            <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-sku">SKU</Label>
            <Input id="v-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-barcode">Código de barras</Label>
            <Input id="v-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-price">Precio ($)</Label>
            <Input id="v-price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-cost">Costo ($)</Label>
            <Input id="v-cost" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Imagen de la variante</Label>
            <Attachment
              value={imageUrl || null}
              onChange={(v) => setImageUrl(v ?? "")}
              upload={uploadFile}
              accept={UPLOAD_IMAGE_ACCEPT}
              label=""
              widthClass="w-24"
              heightClass="h-24"
            />
          </div>
          {options.filter((o) => o.id && o.values.length > 0).length > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Opciones</Label>
              {options
                .filter((o) => o.id && o.values.length > 0)
                .map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <span className="w-24 text-sm">{o.name}:</span>
                    <Select value={selected[o.id as string] ?? ""} onValueChange={(v) => setSelected((s) => ({ ...s, [o.id as string]: v }))}>
                      <SelectTrigger size="sm" className="flex-1">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin asignar</SelectItem>
                        {o.values.map((v) => (
                          <SelectItem key={v.id} value={v.id ?? ""}>
                            {v.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
            </div>
          )}
        </div>
    </DialogComponent>
  );
}