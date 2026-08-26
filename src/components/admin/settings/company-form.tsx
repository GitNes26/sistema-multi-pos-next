"use client"

import { useEffect, useState } from "react"
import {
  Building2,
  Globe,
  Hash,
  Mail,
  MapPin,
  Phone,
  Store,
} from "lucide-react"
import { settingsApi, type CompanyProfileView } from "@/lib/settings/client"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { swalError, swalToast } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { InputGroupField } from "@/components/base/input-group-field"
import { Attachment } from "@/components/base/attachment"

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

  useEffect(() => {
    settingsApi
      .company()
      .then((d) => d.profile && setForm(d.profile))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  const set = (k: keyof CompanyProfileView, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
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
      swalError(
        "No se pudo guardar",
        err instanceof Error ? err.message : undefined
      )
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
    <div className="grid gap-4 sm:grid-cols-2">
      <InputGroupField
        label="Razón social"
        helper="Nombre legal/fiscal de la empresa."
        leftAddon={<Building2 className="size-4" />}
        value={form.legalName ?? ""}
        onChange={(e) => set("legalName", e.target.value)}
      />
      <InputGroupField
        label="Nombre comercial"
        helper="Nombre visible para tus clientes."
        leftAddon={<Store className="size-4" />}
        value={form.tradeName ?? ""}
        onChange={(e) => set("tradeName", e.target.value)}
      />
      <InputGroupField
        label="RFC / Tax ID"
        helper="Clave del RFC; se guarda en mayúsculas."
        leftAddon={<Hash className="size-4" />}
        value={form.taxId ?? ""}
        onChange={(e) => set("taxId", e.target.value.toUpperCase())}
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
        label="Dirección"
        helper="Calle y número."
        leftAddon={<MapPin className="size-4" />}
        containerClassName="sm:col-span-2"
        value={form.address ?? ""}
        onChange={(e) => set("address", e.target.value)}
      />
      <InputGroupField
        label="Ciudad"
        leftAddon={<MapPin className="size-4" />}
        value={form.city ?? ""}
        onChange={(e) => set("city", e.target.value)}
      />
      <InputGroupField
        label="Estado"
        leftAddon={<MapPin className="size-4" />}
        value={form.state ?? ""}
        onChange={(e) => set("state", e.target.value)}
      />
      <InputGroupField
        label="Código postal"
        leftAddon={<MapPin className="size-4" />}
        value={form.postalCode ?? ""}
        onChange={(e) =>
          set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))
        }
      />
      <InputGroupField
        label="País"
        leftAddon={<Globe className="size-4" />}
        value={form.country ?? ""}
        onChange={(e) => set("country", e.target.value)}
      />
      <InputGroupField
        label="Teléfono"
        helper="Solo 10 dígitos."
        leftAddon={<Phone className="size-4" />}
        inputMode="numeric"
        value={form.phone ?? ""}
        onChange={(e) =>
          set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
        }
      />
      <InputGroupField
        label="Email"
        helper="Se guarda en minúsculas."
        type="email"
        leftAddon={<Mail className="size-4" />}
        value={form.email ?? ""}
        onChange={(e) => set("email", e.target.value.toLowerCase())}
      />
      <InputGroupField
        label="Sitio web"
        leftAddon={<Globe className="size-4" />}
        value={form.website ?? ""}
        onChange={(e) => set("website", e.target.value)}
      />
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ticketFooter">Pie de ticket</Label>
        <Textarea
          id="ticketFooter"
          rows={3}
          value={form.ticketFooter ?? ""}
          onChange={(e) => set("ticketFooter", e.target.value)}
        />
      </div>

      <div className="sm:col-span-2">
        <Button onClick={save} disabled={saving}>
          <Building2 className="size-4" />{" "}
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  )
}
