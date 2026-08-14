"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { settingsApi, type CompanyProfileView } from "@/lib/settings/client";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

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
};

export function CompanyForm() {
  const [form, setForm] = useState<CompanyProfileView>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .company()
      .then((d) => d.profile && setForm(d.profile))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof CompanyProfileView, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
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
      });
      setForm(res.profile);
      swalToast("Datos de empresa guardados");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Razón social">
        <Input value={form.legalName ?? ""} onChange={(e) => set("legalName", e.target.value)} />
      </Field>
      <Field label="Nombre comercial">
        <Input value={form.tradeName ?? ""} onChange={(e) => set("tradeName", e.target.value)} />
      </Field>
      <Field label="RFC / Tax ID">
        <Input value={form.taxId ?? ""} onChange={(e) => set("taxId", e.target.value)} />
      </Field>
      <Field label="Logo URL">
        <Input value={form.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} />
      </Field>
      <Field label="Dirección" className="sm:col-span-2">
        <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="Ciudad">
        <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field label="Estado">
        <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
      </Field>
      <Field label="Código postal">
        <Input value={form.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} />
      </Field>
      <Field label="País">
        <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
      </Field>
      <Field label="Teléfono">
        <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Email">
        <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Sitio web">
        <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} />
      </Field>
      <Field label="Pie de ticket" className="sm:col-span-2">
        <Textarea
          value={form.ticketFooter ?? ""}
          onChange={(e) => set("ticketFooter", e.target.value)}
        />
      </Field>

      <div className="sm:col-span-2">
        <Button onClick={save} disabled={saving}>
          <Building2 className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
