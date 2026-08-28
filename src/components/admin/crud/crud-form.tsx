import { useId, useMemo, useRef, useState } from "react"
import * as yup from "yup"
import { icons, AlertCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  onSavingChange?: (selling: boolean) => void
  formId?: string
  /** Componente renderizado después de los campos, recibe los valores actuales del formulario. */
  afterFields?: React.ComponentType<{ values: Record<string, unknown> }>
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
  if (field.defaultValue !== undefined) return field.defaultValue
  if (field.type === "boolean") return false
  if (field.type === "multiselect") return [] as string[]
  return ""
}

function buildYupSchema(fields: CrudField[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape: Record<string, yup.Schema<any>> = {}
  for (const f of fields) {
    if (f.type === "gps" || f.type === "image" || f.type === "schedule" || f.type === "address") continue

    if (f.type === "number" || f.type === "money" || f.type === "percent") {
      let schema = yup
        .number()
        .transform((v, orig) => (orig === "" || orig === undefined ? undefined : v))
      if (f.min !== undefined) schema = schema.min(f.min, `Mínimo ${f.min}`)
      if (f.max !== undefined) schema = schema.max(f.max, `Máximo ${f.max}`)
      if (f.required) {
        schema = schema.required(f.requiredMessage || `${f.label} es obligatorio`)
      }
      shape[f.key] = schema
      continue
    }

    if (f.type === "multiselect") {
      shape[f.key] = f.required
        ? yup.array().of(yup.string()).min(1, `${f.label} es obligatorio`).required()
        : yup.array().of(yup.string()).optional()
      continue
    }
    if (f.type === "boolean") {
      shape[f.key] = f.required
        ? yup.boolean().isTrue(`${f.label} es obligatorio`)
        : yup.boolean().optional()
      continue
    }

    // text / textarea / select
    let schema = yup.string()
    if (f.maxLength !== undefined) schema = schema.max(f.maxLength, `Máximo ${f.maxLength} caracteres`)
    if (f.minLength !== undefined) schema = schema.min(f.minLength, `Mínimo ${f.minLength} caracteres`)
    if (f.yup) {
      for (const [method, def] of Object.entries(f.yup)) {
        if (method === "email" && typeof def === "object" && "message" in def) {
          schema = schema.email(def.message)
        } else if (method === "url" && typeof def === "object" && "message" in def) {
          schema = schema.url(def.message)
        } else if (method === "matches" && Array.isArray(def)) {
          schema = schema.matches(def[0] as RegExp, def[1])
        } else if (method === "max" && Array.isArray(def)) {
          schema = schema.max(def[0] as number, def[1])
        } else if (method === "min" && Array.isArray(def)) {
          schema = schema.min(def[0] as number, def[1])
        } else if (method === "trim" && typeof def === "object" && "message" in def) {
          schema = schema.trim(def.message)
        } else if (typeof def === "object" && "message" in def) {
          // Generic: call method by name with message
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = schema as any
          if (typeof s[method] === "function") schema = s[method](def.message)
        }
      }
    }
    if (f.required) {
      schema = schema.required(f.requiredMessage || `${f.label} es obligatorio`)
    }
    shape[f.key] = schema
  }
  return yup.object().shape(shape)
}

function applyTransform(value: unknown, field: CrudField): unknown {
  if (typeof value !== "string") return value
  if (field.transform === "uppercase") return value.toUpperCase()
  if (field.transform === "lowercase") return value.toLowerCase()
  if (field.transform === "trim") return value.trim()
  return value
}

const getIcon = (name: string): LucideIcon | undefined =>
  icons[name as keyof typeof icons]

function fieldIcon(type: string, iconKey?: string): React.ReactNode {
  if (iconKey) {
    const Ico = getIcon(iconKey)
    if (Ico) return <Ico className="size-4" />
  }
  const fallback: Record<string, string> = {
    number: "Hash",
    money: "DollarSign",
    percent: "Percent",
    date: "CalendarDays",
    time: "Clock",
    textarea: "FileText",
    password: "Key",
  }
  const FallbackIcon = getIcon(fallback[type] ?? "Type")
  if (!FallbackIcon) return null
  return <FallbackIcon className="size-4" />
}

function FieldWrapper({
  field,
  id,
  error,
  children,
}: {
  field: CrudField
  id: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(field.full ? "sm:col-span-2" : "")}>
      <div className="space-y-1.5">
        {children}
        {error && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3 shrink-0" />
            {error}
          </p>
        )}
        {!error && field.help && (
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
  afterFields: AfterFields,
}: CrudFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {}
    for (const f of config.fields) v[f.key] = defaultValue(f, initial)
    return v
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const schema = useMemo(() => buildYupSchema(config.fields), [config.fields])
  const visibleFields = useMemo(() => config.fields, [config.fields])

  const uid = useId().replace(/[:]/g, "")
  const fieldId = (key: string) => `${uid}-f-${key}`

  const set = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validateForm = async (): Promise<boolean> => {
    try {
      await schema.validate(values, { abortEarly: false })
      setErrors({})
      return true
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        const newErrors: Record<string, string> = {}
        for (const e of err.inner) {
          if (e.path && !newErrors[e.path]) newErrors[e.path] = e.message
        }
        setErrors(newErrors)
        const firstErrorField = err.inner[0]?.path
        if (firstErrorField) {
          const el = fieldRefs.current[firstErrorField]
          if (el) {
            el.focus()
            el.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }
      }
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valid = await validateForm()
    if (!valid) return

    const payload: Record<string, unknown> = {}
    for (const field of visibleFields) {
      if (field.showIf && !field.showIf(values)) continue
      if (field.type === "gps") continue
      let v = values[field.key]
      v = applyTransform(v, field)
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
      // Error handled by parent (swalError)
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
        const error = errors[field.key]

        const errorClass = error ? "border-destructive focus-visible:ring-destructive/20" : ""

        const setRef = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
          fieldRefs.current[field.key] = el
        }

        // ── boolean → SwitchField ──
        if (field.type === "boolean") {
          return (
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
              <SwitchField
                id={id}
                label={field.label}
                description={field.description}
                icon={fieldIcon(field.type, field.icon)}
                checked={Boolean(value)}
                onCheckedChange={(c) => set(field.key, c)}
              />
            </FieldWrapper>
          )
        }

        // ── textarea → Textarea + Label ──
        if (field.type === "textarea") {
          return (
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
              <Label htmlFor={id}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              <Textarea
                ref={setRef}
                id={id}
                value={String(value ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                aria-invalid={!!error || undefined}
                className={cn(error && "border-destructive focus-visible:ring-destructive/20")}
              />
            </FieldWrapper>
          )
        }

        // ── select → FormCombobox (via OptionSelect) ──
        if (field.type === "select") {
          return (
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
              <OptionSelect
                id={id}
                field={field}
                value={String(value ?? "")}
                onChange={(v) => set(field.key, v)}
                error={error}
              />
            </FieldWrapper>
          )
        }

        // ── multiselect → MultiSelect + Label ──
        if (field.type === "multiselect") {
          return (
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
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
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
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
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
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
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
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
            <FieldWrapper key={field.key} field={field} id={id} error={error}>
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
          <FieldWrapper key={field.key} field={field} id={id} error={error}>
            <InputGroupField
              id={id}
              ref={setRef}
              label={field.label}
              required={field.required}
              error={error}
              helper={error ? undefined : field.help}
              leftIcon={fieldIcon(field.type, field.icon)}
              type={
                field.type === "password"
                  ? "password"
                  : field.type === "date"
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
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              value={String(value ?? "")}
              onChange={(e) => set(field.key, e.target.value)}
              className={errorClass}
            />
          </FieldWrapper>
        )
      })}
      {AfterFields && (
        <div className="sm:col-span-2">
          <AfterFields values={values} />
        </div>
      )}
    </form>
  )
}
