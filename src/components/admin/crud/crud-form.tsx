import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  DollarSign,
  Hash,
  Percent,
  Type,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { swalError } from "@/lib/swal";
import { OptionSelect } from "./option-select";
import { MultiSelect } from "./multi-select";
import { Attachment } from "@/components/base/attachment";
import { GpsPicker } from "@/components/base/gps-picker";
import { InputGroupField } from "@/components/base/input-group-field";
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads";
import type { CrudField, CrudUiConfig } from "./crud-config";

interface CrudFormProps {
  config: CrudUiConfig;
  initial: Record<string, unknown> | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onSavingChange?: (saving: boolean) => void;
  formId?: string;
}

function defaultValue(field: CrudField, initial: Record<string, unknown> | null) {
  if (field.type === "gps") return undefined;
  if (initial && initial[field.key] !== undefined && initial[field.key] !== null) {
    return initial[field.key];
  }
  if (field.type === "boolean") return false;
  if (field.type === "multiselect") return [] as string[];
  return "";
}

const INPUT_TYPES = ["text", "number", "money", "percent", "date", "time"];

function fieldIcon(type: string): React.ReactNode {
  switch (type) {
    case "number":
      return <Hash className="size-4" />;
    case "money":
      return <DollarSign className="size-4" />;
    case "percent":
      return <Percent className="size-4" />;
    case "date":
      return <CalendarDays className="size-4" />;
    case "time":
      return <Clock className="size-4" />;
    default:
      return <Type className="size-4" />;
  }
}

export function CrudForm({
  config,
  initial,
  onSubmit,
  onSavingChange,
  formId = "crud-form",
}: CrudFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of config.fields) v[f.key] = defaultValue(f, initial);
    return v;
  });

  const visibleFields = useMemo(() => config.fields, [config.fields]);

  const set = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const field of visibleFields) {
      if (field.showIf && !field.showIf(values)) continue;
      if (!field.required) continue;
      const v = values[field.key];
      if (v === "" || v === undefined || v === null) {
        swalError("Campo obligatorio", `Completa el campo «${field.label}».`);
        return;
      }
    }

    const payload: Record<string, unknown> = {};
    for (const field of visibleFields) {
      if (field.showIf && !field.showIf(values)) continue;
      if (field.type === "gps") continue;
      let v = values[field.key];
      if (field.type === "number" || field.type === "money" || field.type === "percent") {
        v = v === "" || v === undefined || v === null ? "" : Number(v);
      }
      payload[field.key] = v;
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

  return (
    <form id={formId} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      {visibleFields.map((field) => {
        if (field.showIf && !field.showIf(values)) return null;
        const value = values[field.key];
        const control = ({ className, id }: { className?: string; id?: string }) => {
          switch (field.type) {
            case "boolean":
              return (
                <div className={className}>
                  <div className="flex h-9 items-center gap-2">
                    <Switch
                      id={id}
                      checked={Boolean(value)}
                      onCheckedChange={(c) => set(field.key, c)}
                    />
                    <label htmlFor={id} className="cursor-pointer text-sm text-muted-foreground">
                      {value ? "Sí" : "No"}
                    </label>
                  </div>
                </div>
              );
            case "textarea":
              return (
                <Textarea
                  id={id}
                  value={String(value ?? "")}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={className}
                />
              );
            case "select":
              return (
                <div className={className}>
                  <OptionSelect field={field} value={String(value ?? "")} onChange={(v) => set(field.key, v)} />
                </div>
              );
            case "multiselect":
              return (
                <div className={className}>
                  <MultiSelect field={field} value={value} onChange={(v) => set(field.key, v)} />
                </div>
              );
            case "image":
              return (
                <div className={className}>
                  <Attachment
                    value={value ? String(value) : null}
                    onChange={(v) => set(field.key, v)}
                    upload={uploadFile}
                    accept={UPLOAD_IMAGE_ACCEPT}
                    label=""
                    widthClass="w-24"
                    heightClass="h-24"
                  />
                </div>
              );
            case "gps": {
              const latRaw = field.latKey ? values[field.latKey] : undefined;
              const lonRaw = field.lonKey ? values[field.lonKey] : undefined;
              const lat = Number(latRaw);
              const lon = Number(lonRaw);
              const gpsValue =
                Number.isFinite(lat) && Number.isFinite(lon) && String(latRaw) !== "" && String(lonRaw) !== ""
                  ? { lat, lon }
                  : undefined;
              return (
                <div className={className}>
                  <GpsPicker
                    value={gpsValue}
                    label={field.label}
                    helper={field.help}
                    onChange={(g) => {
                      if (field.latKey && g) set(field.latKey, g.lat);
                      if (field.lonKey && g) set(field.lonKey, g.lon);
                    }}
                  />
                </div>
              );
            }
            default:
              return (
                <Input
                  id={id}
                  type={
                    field.type === "date"
                      ? "date"
                      : field.type === "time"
                        ? "time"
                        : field.type === "number" || field.type === "money" || field.type === "percent"
                          ? "number"
                          : "text"
                  }
                  step={
                    field.type === "percent" || field.type === "number"
                      ? "any"
                      : field.type === "money"
                        ? "0.01"
                        : undefined
                  }
                  value={String(value ?? "")}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={className}
                />
              );
          }
        };

        if (INPUT_TYPES.includes(field.type)) {
          return (
            <div key={field.key} className={field.full ? "sm:col-span-2" : ""}>
              <InputGroupField
                id={`f-${field.key}`}
                label={field.label}
                required={field.required}
                helper={field.help}
                leftIcon={fieldIcon(field.type)}
                type={
                  field.type === "date"
                    ? "date"
                    : field.type === "time"
                      ? "time"
                      : field.type === "number" || field.type === "money" || field.type === "percent"
                        ? "number"
                        : "text"
                }
                step={
                  field.type === "percent" || field.type === "number"
                    ? "any"
                    : field.type === "money"
                      ? "0.01"
                      : undefined
                }
                placeholder={field.placeholder}
                value={String(value ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
              />
            </div>
          );
        }

        return (
          <div key={field.key} className={field.full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
            {field.type === "gps" ? (
              control({ className: "w-full" })
            ) : (
              <>
                <Label htmlFor={`f-${field.key}`}>
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
                {control({ className: "w-full", id: `f-${field.key}` })}
                {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
              </>
            )}
          </div>
        );
      })}

    </form>
  );
}