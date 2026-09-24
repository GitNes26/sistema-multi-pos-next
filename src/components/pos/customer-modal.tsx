"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Mail, Phone, Search, Trash2, UserPlus, UserRound } from "lucide-react";
import * as yup from "yup";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroupField } from "@/components/base/input-group-field";
import { usePosStore } from "@/stores/pos-store";
import { money } from "@/lib/pos/money";
import { pointsToMoney } from "@/lib/pos/pricing";
import { ApiError, crudApi } from "@/lib/api";
import { usePosRefresh } from "@/hooks/use-pos-refresh";

interface CustomerModalProps { open: boolean; onClose: () => void }
type Draft = { fullName: string; email: string; phone: string };
const blank: Draft = { fullName: "", email: "", phone: "" };
const schema = yup.object({
  fullName: yup.string().trim().required("Escribe el nombre del cliente"),
  email: yup.string().trim().email("Escribe un correo válido").required("El correo es necesario para enviar su acceso"),
  phone: yup.string().trim().matches(/^$|^[0-9+()\-\s]{7,20}$/, "Escribe un teléfono válido"),
});

export function CustomerModal({ open, onClose }: CustomerModalProps) {
  const customers = usePosStore((s) => s.customers);
  const customerId = usePosStore((s) => s.customerId);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const loyalty = usePosStore((s) => s.loyalty);
  const refresh = usePosRefresh();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft | "form", string>>>({});

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) => c.fullName.toLowerCase().includes(needle) || (c.phone ?? "").includes(needle) || (c.customerCode ?? "").toLowerCase().includes(needle));
  }, [customers, q]);

  const close = () => { setCreating(false); setDraft(blank); setErrors({}); onClose(); };
  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    try {
      await schema.validate(draft, { abortEarly: false });
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Partial<Record<keyof Draft, string>> = {};
        for (const issue of error.inner) if (issue.path && !next[issue.path as keyof Draft]) next[issue.path as keyof Draft] = issue.message;
        setErrors(next);
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
        return;
      }
    }
    setSaving(true);
    try {
      const result = await crudApi.create("customers", { ...draft, isActive: true });
      const id = String(result.row.id);
      await refresh();
      setCustomer(id);
      close();
    } catch (error) {
      const apiError = error as ApiError;
      setErrors(apiError.field && apiError.field in draft ? { [apiError.field]: apiError.message } : { form: apiError.message || "No se pudo registrar el cliente" });
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
    } finally { setSaving(false); }
  };

  return (
    <DialogComponent open={open} onOpenChange={(value) => !value && close()}
      icon={creating ? <UserPlus className="size-5 text-primary" /> : <UserRound className="size-5 text-primary" />}
      title={creating ? "Nuevo cliente" : "Asociar cliente"}
      description={creating ? "Regístralo sin salir del cobro. Recibirá un correo para crear su contraseña y entrar al portal." : "Busca un cliente existente o regístralo en pocos pasos."}
      className="sm:max-w-md" bodyClassName="space-y-3"
      footer={creating ? <>
        <Button type="button" variant="ghost" onClick={() => setCreating(false)}><ArrowLeft className="size-4" /> Volver</Button>
        <Button form="pos-customer-create" type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Registrar y asociar</Button>
      </> : <>
        {customerId && <Button variant="outline" onClick={() => setCustomer(null)} className="text-destructive"><Trash2 className="size-4" /> Quitar cliente</Button>}
        <Button variant="ghost" onClick={close}>Cancelar</Button>
      </>}>
      {creating ? <form id="pos-customer-create" className="space-y-4" onSubmit={createCustomer}>
        <InputGroupField autoFocus id="pos-customer-name" label="Nombre completo" required value={draft.fullName} onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))} error={errors.fullName} />
        <InputGroupField id="pos-customer-email" label="Correo de acceso" type="email" required leftIcon={<Mail className="size-4" />} value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} error={errors.email} hint="Aquí recibirá su enlace seguro para crear la contraseña." />
        <InputGroupField id="pos-customer-phone" label="Teléfono" type="tel" leftIcon={<Phone className="size-4" />} value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} error={errors.phone} />
        {errors.form && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p>}
      </form> : <>
        <Button type="button" className="w-full justify-start" variant="outline" onClick={() => setCreating(true)}><UserPlus className="size-4" /> Registrar cliente nuevo</Button>
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, teléfono o nº de cliente" className="pl-9 md:pl-9" /></div>
        <div className="space-y-1.5">{filtered.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Sin clientes que coincidan.</p> : filtered.map((c) =>
          <button key={c.id} type="button" onClick={() => { setCustomer(c.id); close(); }} className="flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left transition hover:border-primary/50">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{c.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.fullName}</span><span className="block truncate text-xs text-muted-foreground">{c.phone ?? c.email ?? c.customerCode ?? "—"}</span></span>
            <span className="flex shrink-0 flex-col items-end"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">{money(pointsToMoney(c.points, loyalty.pointValue))}</span><span className="mt-0.5 text-xs text-muted-foreground">{Math.floor(c.points)} pts</span></span>
          </button>)}</div>
      </>}
    </DialogComponent>
  );
}
