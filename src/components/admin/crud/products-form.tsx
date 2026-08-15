"use client";

import { useMemo, useState } from "react";
import {
  Barcode,
  Check,
  DollarSign,
  Hash,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Trash2,
  Type,
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
import { optionsApi, variantApi, type VariantRow, type ProductOption } from "@/lib/api";
import { money } from "@/lib/pos/money";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { OptionSelect } from "./option-select";
import { Attachment } from "@/components/base/attachment";
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads";
import type { CrudField } from "./crud-config";

interface ProductFormProps {
  initial: Record<string, unknown> | null;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

function FieldRow({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2")}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function InputField({
  label,
  icon,
  full,
  ...props
}: {
  label: string;
  icon?: React.ReactNode;
  full?: boolean;
} & React.ComponentProps<typeof Input>) {
  return (
    <InputGroupField
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
              ? "bg-background text-foreground shadow-sm"
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

export function ProductsForm({ initial, onCancel, onSubmit }: ProductFormProps) {
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

  const [variantName, setVariantName] = useState("Default");
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

  const [saving, setSaving] = useState(false);
  const [vBusy, setVBusy] = useState(false);
  const [editVariant, setEditVariant] = useState<VariantRow | null>(null);

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
      payload.initialVariant = {
        name: variantName.trim() || "Default",
        sku: variantSku.trim() || null,
        barcode: variantBarcode.trim() || null,
        price: numOrEmpty(variantPrice),
        cost: numOrEmpty(variantCost),
      };
    }

    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const refreshVariants = async () => {
    if (!initial?.id) return;
    const res = await variantApi.list(String(initial.id));
    setVariants(res.rows);
  };

  const createVariant = async () => {
    if (!initial?.id) return;
    setVBusy(true);
    try {
      await variantApi.create(String(initial.id), {
        name: "Nueva variante",
        price: 0,
        cost: 0,
        isActive: true,
      });
      await refreshVariants();
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined);
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

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
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

      <FieldRow label="Descripción" full>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
      </FieldRow>

      <FieldRow label="Categoría">
        <OptionSelect field={categoryField} value={categoryId} onChange={setCategoryId} />
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
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm">Activo</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={trackInventory} onCheckedChange={setTrackInventory} />
          <span className="text-sm">Controlar inventario</span>
        </div>
      </div>

      {productType === "bulk" ? (
        <>
          <FieldRow label="Unidad de medida">
            <OptionSelect field={unitField} value={bulkUnitId} onChange={setBulkUnitId} />
          </FieldRow>
          <InputField label="Precio por unidad ($)" icon={<DollarSign className="size-4" />} type="number" step="0.01" value={bulkPricePerUnit} onChange={(e) => setBulkPrice(e.target.value)} placeholder="0.00" />
          <InputField label="Cantidad mínima" icon={<Hash className="size-4" />} type="number" step="any" value={bulkMinQuantity} onChange={(e) => setBulkMin(e.target.value)} placeholder="0" />
          <InputField label="Cantidad máxima" icon={<Hash className="size-4" />} type="number" step="any" value={bulkMaxQuantity} onChange={(e) => setBulkMax(e.target.value)} placeholder="0" />
          <InputField label="Incremento sugerido" icon={<Hash className="size-4" />} type="number" step="any" value={bulkStep} onChange={(e) => setBulkStep(e.target.value)} placeholder="0.01" />
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={allowSplit} onCheckedChange={setAllowSplit} />
            <span className="text-sm">Permitir por pieza (venta dividida)</span>
          </div>
          {allowSplit && (
            <>
              <FieldRow label="Unidad por pieza">
                <OptionSelect field={unitField} value={splitUnitId} onChange={setSplitUnitId} />
              </FieldRow>
              <InputField label="Precio por pieza ($)" icon={<DollarSign className="size-4" />} type="number" step="0.01" value={splitPricePerUnit} onChange={(e) => setSplitPrice(e.target.value)} placeholder="0.00" />
            </>
          )}
        </>
      ) : !isEdit ? (
        <>
          <FieldRow label="Variante inicial" full>
            <p className="text-xs text-muted-foreground">
              Crea una variante base para que el producto aparezca en el POS.
            </p>
          </FieldRow>
          <InputField label="Nombre de variante" icon={<Type className="size-4" />} value={variantName} onChange={(e) => setVariantName(e.target.value)} />
          <InputField label="Precio de venta ($)" icon={<DollarSign className="size-4" />} type="number" step="0.01" value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} />
          <InputField label="Costo ($)" icon={<DollarSign className="size-4" />} type="number" step="0.01" value={variantCost} onChange={(e) => setVariantCost(e.target.value)} />
          <InputField label="SKU" icon={<Hash className="size-4" />} value={variantSku} onChange={(e) => setVariantSku(e.target.value)} />
          <InputField label="Código de barras" icon={<Barcode className="size-4" />} value={variantBarcode} onChange={(e) => setVariantBarcode(e.target.value)} />
        </>
      ) : (
        <>
          <FieldRow label={`Variantes (${variants.length})`} full>
            <div className="space-y-2">
              {variants.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{v.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {v.sku ?? v.barcode ?? "—"} · {money(v.price)}
                      {v.optionValues && v.optionValues.length > 0 && (
                        <span className="ml-1 text-xs">
                          · {v.optionValues.map((ov) => ov.value).join(", ")}
                        </span>
                      )}
                    </span>
                  </span>
                  <Badge variant={v.isActive ? "default" : "secondary"} className="hidden sm:inline-flex">
                    {v.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setEditVariant(v)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => removeVariant(v)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={vBusy} onClick={createVariant}>
                {vBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Agregar variante
              </Button>
            </div>
          </FieldRow>

          <FieldRow label="Opciones de variante (talla, color, contenido…)" full>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Define atributos como Talla o Color; luego asígnalos a cada variante.
                </p>
              )}
              {options.map((opt, i) => (
                <div key={i} className="space-y-1.5 rounded-md border bg-background/60 p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={opt.name}
                      onChange={(e) => updateOption(i, { name: e.target.value })}
                      placeholder="Ej. Talla"
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
                <Button type="button" size="sm" variant="default" onClick={saveOptions} disabled={optionsBusy}>
                  {optionsBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Guardar opciones
                </Button>
              </div>
            </div>
          </FieldRow>
        </>
      )}

      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>

      {editVariant && (
        <VariantEditDialog
          variant={editVariant}
          options={options}
          onClose={() => setEditVariant(null)}
          onSave={saveVariant}
        />
      )}
    </form>
  );
}

// ── Diálogo de edición de variante con asignación de opciones ───────────────

function VariantEditDialog({
  variant,
  options,
  onClose,
  onSave,
}: {
  variant: VariantRow;
  options: ProductOption[];
  onClose: () => void;
  onSave: (
    variantId: string,
    data: { name?: string; sku?: string; price?: number; cost?: number; optionValueIds?: string[] }
  ) => Promise<void>;
}) {
  const [name, setName] = useState(variant.name);
  const [sku, setSku] = useState(variant.sku ?? "");
  const [price, setPrice] = useState(String(variant.price));
  const [cost, setCost] = useState(String(variant.cost));
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const ov of variant.optionValues ?? []) map[ov.optionId] = ov.valueId;
    return map;
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const optionValueIds = options
        .filter((o) => o.id && selected[o.id as string])
        .map((o) => selected[o.id as string])
        .filter(Boolean);
      await onSave(variant.id, {
        name: name.trim() || "Default",
        sku: sku.trim() || undefined,
        price: Number(price) || 0,
        cost: Number(cost) || 0,
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
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Precio ($)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Costo ($)</Label>
            <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
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