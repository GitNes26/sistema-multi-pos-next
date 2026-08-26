import { useId, useMemo, useState } from "react"
import {
  CalendarDays,
  Clock,
  DollarSign,
  Hash,
  Percent,
  Type,
  FileText,
  CheckSquare,
  List,
  Image as ImageIcon,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { swalError } from "@/lib/swal"
import { OptionSelect } from "./option-select"
import { MultiSelect } from "./multi-select"
import { Attachment } from "@/components/base/attachment"
import { GpsPicker } from "@/components/base/gps-picker"
import { AddressField } from "@/components/base/address-field"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { ScheduleEditor } from "@/components/base/schedule-editor"
import { parseSchedule, emptySchedule } from "@/lib/schedule"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import type { CrudField, CrudUiConfig } from "./crud-config"
import { cn } from "@/lib/utils"

interface CrudFormProps {
  config: CrudUiConfig
  initial: Record<string, unknown> | null
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onSavingChange?: (saving: boolean) => void
  formId?: string
}

function defaultValue(
  field: CrudField,
  initial: Record<string, unknown> | null
) {
  if (field.type === "gps") return undefined
  if (field.type === "schedule") {
    if (initial && initial[field.key] != null) return parseSchedule(initial[field.key])
    return emptySchedule()
  }
  if (
    initial &&
    initial[field.key] !== undefined &&
    initial[field.key] !== null
  ) {
    return initial[field.key]
  }
  if (field.type === "boolean") return false
  if (field.type === "multiselect") return [] as string[]
  return ""
}

const INPUT_TYPES = ["text", "number", "money", "percent", "date", "time"]

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Hash, DollarSign, Percent, CalendarDays, Clock, Type, FileText,
  CheckSquare, List, ImageIcon,
}

function fieldIcon(type: string, iconKey?: string): React.ReactNode {
  if (iconKey) {
    const Ico = ICON_MAP[iconKey]
    if (Ico) return <Ico className="size-4" />
  }
  switch (type) {
    case "number":
      return <Hash className="size-4" />
    case "money":
      return <DollarSign className="size-4" />
    case "percent":
      return <Percent className="size-4" />
    case "date":
      return <CalendarDays className="size-4" />
    case "time":
      return <Clock className="size-4" />
    case "textarea":
      return <FileText className="size-4" />
    default:
      return <Type className="size-4" />
  }
}

function FieldWrapper({
  field,
  id,
  children,
}: {
  field: CrudField
  id: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(field.full ? "sm:col-span-2" : "")}>
      <div className="space-y-1.5">
        {children}
        {field.help && (
          <p className="text-xs text-muted-foreground">{field.help}</p>
        )}
      </div>
    </div>
  )
}

export function CrudForm({
  config,
  initial,
  onSubmit,
  onSavingChange,
  formId = "crud-form",
}: CrudFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {}
    for (const f of config.fields) v[f.key] = defaultValue(f, initial)
    return v
  })

  const visibleFields = useMemo(() => config.fields, [config.fields])

  const uid = useId().replace(/[:]/g, "")
  const fieldId = (key: string) => `${uid}-f-${key}`

  const set = (key: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    for (const field of visibleFields) {
      if (field.showIf && !field.showIf(values)) continue
      if (!field.required) continue
      const v = values[field.key]
      if (v === "" || v === undefined || v === null) {
        swalError("Campo obligatorio", `Completa el campo «${field.label}».`)
        return
      }
    }

    const payload: Record<string, unknown> = {}
    for (const field of visibleFields) {
      if (field.showIf && !field.showIf(values)) continue
      if (field.type === "gps") continue
      let v = values[field.key]
      if (
        field.type === "number" ||
        field.type === "money" ||
        field.type === "percent"
      ) {
        v = v === "" || v === undefined || v === null ? "" : Number(v)
      }
      if (field.type === "schedule") {
        v = JSON.stringify(v ?? emptySchedule())
      }
      payload[field.key] = v
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

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="grid gap-4 sm:grid-cols-2"
    >
      {visibleFields.map((field) => {
        if (field.showIf && !field.showIf(values)) return null
        const value = values[field.key]
        const id = fieldId(field.key)

        // ── boolean → SwitchField ──
        if (field.type === "boolean") {
          return (
            <FieldWrapper key={field.key} field={field} id={id}>
              <SwitchField
                id={id}
                label={field.label}
                description={field.description}
                icon={field.icon ? fieldIcon(field.type, field.icon) : undefined}
                checked={Boolean(value)}
                onCheckedChange={(c) => set(field.key, c)}
              />
            </FieldWrapper>
          )
        }

        // ── textarea → Textarea + Label ──
        if (field.type === "textarea") {
          return (
            <FieldWrapper key={field.key} field={field} id={id}>
              <Label htmlFor={id}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              <Textarea
                id={id}
                value={String(value ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
              />
            </FieldWrapper>
          )
        }

        // ── select → FormCombobox (via OptionSelect) ──
        if (field.type === "select") {
          return (
            <FieldWrapper key={field.key} field={field} id={id}>
              <OptionSelect
                id={id}
                field={field}
                value={String(value ?? "")}
                onChange={(v) => set(field.key, v)}
              />
            </FieldWrapper>
          )
        }

        // ── multiselect → MultiSelect + Label ──
        if (field.type === "multiselect") {
          return (
            <FieldWrapper key={field.key} field={field} id={id}>
              <Label>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              <MultiSelect
                field={field}
                value={value}
                onChange={(v) => set(field.key, v)}
              />
            </FieldWrapper>
          )
        }

        // ── image → Attachment + Label ──
        if (field.type === "image") {
          return (
            <FieldWrapper key={field.key} field={field} id={id}>
              <Label>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              <Attachment
                value={value ? String(value) : null}
                onChange={(v) => set(field.key, v)}
                upload={uploadFile}
                accept={UPLOAD_IMAGE_ACCEPT}
                label=""
                widthClass="w-24"
                heightClass="h-24"
              />
            </FieldWrapper>
          )
        }

        // ── gps → GpsPicker (maneja su propio label) ──
        if (field.type === "gps") {
          const latRaw = field.latKey ? values[field.latKey] : undefined
          const lonRaw = field.lonKey ? values[field.lonKey] : undefined
          const lat = Number(latRaw)
          const lon = Number(lonRaw)
          const gpsValue =
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            String(latRaw) !== "" &&
            String(lonRaw) !== ""
              ? { lat, lon }
              : undefined
          return (
            <FieldWrapper key={field.key} field={field} id={id}>
              <GpsPicker
                value={gpsValue}
                label={field.label}
                helper={field.help}
                onChange={(g) => {
                  if (field.latKey && g) set(field.latKey, g.lat)
                  if (field.lonKey && g) set(field.lonKey, g.lon)
                }}
              />
            </FieldWrapper>
          )
        }

        // ── schedule → ScheduleEditor + Label ──
        if (field.type === "schedule") {
          return (
            <FieldWrapper key={field.key} field={field} id={id}>
              <Label>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              <div className="rounded-lg border bg-muted/30 p-3">
                <ScheduleEditor
                  schedule={(value as ReturnType<typeof parseSchedule>) ?? emptySchedule()}
                  onChange={(s) => set(field.key, s)}
                />
              </div>
            </FieldWrapper>
          )
        }

        // ── address → AddressField (maneja su propio label) ──
        if (field.type === "address") {
          const latRaw = field.latKey ? values[field.latKey] : undefined
          const lonRaw = field.lonKey ? values[field.lonKey] : undefined
          const lat = Number(latRaw)
          const lon = Number(lonRaw)
          return (
            <FieldWrapper key={field.key} field={field} id={id}>
              <AddressField
                address={String(value ?? "")}
                onAddressChange={(v) => set(field.key, v)}
                latitude={Number.isFinite(lat) && String(latRaw) !== "" ? lat : null}
                longitude={Number.isFinite(lon) && String(lonRaw) !== "" ? lon : null}
                onGpsChange={(g) => {
                  if (field.latKey && g) set(field.latKey, g.lat)
                  if (field.lonKey && g) set(field.lonKey, g.lon)
                }}
                label={field.label}
                required={field.required}
                placeholder={field.placeholder}
              />
            </FieldWrapper>
          )
        }

        // ── text/number/money/percent/date/time → InputGroupField ──
        return (
          <FieldWrapper key={field.key} field={field} id={id}>
            <InputGroupField
              id={id}
              label={field.label}
              required={field.required}
              helper={field.help}
              leftIcon={fieldIcon(field.type, field.icon)}
              type={
                field.type === "date"
                  ? "date"
                  : field.type === "time"
                    ? "time"
                    : field.type === "number" ||
                        field.type === "money" ||
                        field.type === "percent"
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
          </FieldWrapper>
        )
      })}
    </form>
  )
}
