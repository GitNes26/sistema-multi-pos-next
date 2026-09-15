"use client"

import { useEffect, useState } from "react"
import * as yup from "yup"
import {
  Building2,
  Globe,
  Hash,
  Mail,
  MapPin,
  Phone,
  Store,
  AlertCircle,
  FileText,
} from "lucide-react"
import { settingsApi, type CompanyProfileView } from "@/lib/settings/client"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { swalToast } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { InputGroupField } from "@/components/base/input-group-field"
import { Attachment } from "@/components/base/attachment"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"

const EMPTY: CompanyProfileView = {
  id: "",
  legalName: "",
  tradeName: "",
  taxId: "",
  logoUrl: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
  email: "",
  website: "",
  ticketFooter: "",
}

export function CompanyForm() {
  const [form, setForm] = useState<CompanyProfileView>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  useEffect(() => {
    settingsApi
      .company()
      .then((d) => d.profile && setForm(d.profile))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading) return
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("company-form"))
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, loading])

  const set = (k: keyof CompanyProfileView, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setFormError(undefined)
    setErrors((current) => {
      if (!current[k]) return current
      const next = { ...current }
      delete next[k]
      return next
    })
  }

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault()
    try {
      await yup.object({
        taxId: yup.string().max(13, "El RFC admite hasta 13 caracteres"),
        postalCode: yup.string().test("postal-code", "El código postal debe tener 5 dígitos", (value) => !value || /^\d{5}$/.test(value)),
        phone: yup.string().test("phone", "El teléfono debe tener 10 dígitos", (value) => !value || /^\d{10}$/.test(value)),
        email: yup.string().email("Ingresa un correo válido"),
        website: yup.string().url("Ingresa una URL completa, por ejemplo https://ejemplo.com"),
      }).validate(form, { abortEarly: false })
      setErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message
        setErrors(next)
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`company-${key}`, message]))
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "company-form"))
      }
      return
    }
    setSaving(true)
    setFormError(undefined)
    try {
      const res = await settingsApi.updateCompany({
        legalName: form.legalName || null,
        tradeName: form.tradeName || null,
        taxId: form.taxId || null,
        logoUrl: form.logoUrl || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        postalCode: form.postalCode || null,
        country: form.country || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        ticketFooter: form.ticketFooter || null,
      })
      setForm(res.profile)
      swalToast("Datos de empresa guardados")
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la información de la empresa")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <form id="company-form" noValidate onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      {formError && (
        <div role="alert" className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {formError}
        </div>
      )}
      <InputGroupField
        id="company-legalName"
        label="Razón social"
        helper="Nombre legal/fiscal de la empresa."
        leftAddon={<Building2 className="size-4" />}
        value={form.legalName ?? ""}
        onChange={(e) => set("legalName", e.target.value)}
      />
      <InputGroupField
        id="company-tradeName"
        label="Nombre comercial"
        helper="Nombre visible para tus clientes."
        leftAddon={<Store className="size-4" />}
        value={form.tradeName ?? ""}
        onChange={(e) => set("tradeName", e.target.value)}
      />
      <InputGroupField
        id="company-taxId"
        label="RFC / Tax ID"
        helper="Clave del RFC; se guarda en mayúsculas."
        leftAddon={<Hash className="size-4" />}
        value={form.taxId ?? ""}
        onChange={(e) => set("taxId", e.target.value.toUpperCase())}
        error={errors.taxId}
      />
      <Attachment
        label="Logo"
        helper="Imagen del logo de la empresa."
        value={form.logoUrl ?? ""}
        onChange={(url) => set("logoUrl", url ?? "")}
        upload={uploadFile}
        accept={UPLOAD_IMAGE_ACCEPT}
      />
      <InputGroupField
        id="company-address"
        label="Dirección"
        helper="Calle y número."
        leftAddon={<MapPin className="size-4" />}
        containerClassName="sm:col-span-2"
        value={form.address ?? ""}
        onChange={(e) => set("address", e.target.value)}
      />
      <InputGroupField
        id="company-city"
        label="Ciudad"
        leftAddon={<MapPin className="size-4" />}
        value={form.city ?? ""}
        onChange={(e) => set("city", e.target.value)}
      />
      <InputGroupField
        id="company-state"
        label="Estado"
        leftAddon={<MapPin className="size-4" />}
        value={form.state ?? ""}
        onChange={(e) => set("state", e.target.value)}
      />
      <InputGroupField
        id="company-postalCode"
        label="Código postal"
        leftAddon={<MapPin className="size-4" />}
        value={form.postalCode ?? ""}
        onChange={(e) =>
          set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))
        }
        error={errors.postalCode}
      />
      <InputGroupField
        id="company-country"
        label="País"
        leftAddon={<Globe className="size-4" />}
        value={form.country ?? ""}
        onChange={(e) => set("country", e.target.value)}
      />
      <InputGroupField
        id="company-phone"
        label="Teléfono"
        helper="Solo 10 dígitos."
        leftAddon={<Phone className="size-4" />}
        inputMode="numeric"
        value={form.phone ?? ""}
        onChange={(e) =>
          set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
        }
        error={errors.phone}
      />
      <InputGroupField
        id="company-email"
        label="Email"
        helper="Se guarda en minúsculas."
        type="email"
        leftAddon={<Mail className="size-4" />}
        value={form.email ?? ""}
        onChange={(e) => set("email", e.target.value.toLowerCase())}
        error={errors.email}
      />
      <InputGroupField
        id="company-website"
        label="Sitio web"
        leftAddon={<Globe className="size-4" />}
        value={form.website ?? ""}
        onChange={(e) => set("website", e.target.value)}
        error={errors.website}
      />
      <div className="space-y-1.5 sm:col-span-2">
        <div className="flex items-center gap-1.5">
          <FileText className="size-4 text-muted-foreground" />
          <Label htmlFor="company-ticketFooter" className="cursor-pointer">Pie de ticket</Label>
        </div>
        <Textarea
          id="company-ticketFooter"
          rows={3}
          value={form.ticketFooter ?? ""}
          onChange={(e) => set("ticketFooter", e.target.value)}
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving} data-guide="company-save">
          <Building2 className="size-4" />{" "}
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  )
}
