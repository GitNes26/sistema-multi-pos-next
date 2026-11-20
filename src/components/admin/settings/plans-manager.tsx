"use client"

import { useEffect, useState } from "react"
import { Building2, Check, CreditCard, Loader2, Lock, Plus, Save, ShieldCheck, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { PageHeader } from "@/components/layout/page-header"
import { PERMISSION_MODULE_LABELS } from "@/lib/auth/permission-keys"
import { PLAN_PERMISSION_KEYS, planDeniedKeys } from "@/lib/billing/plan-permissions"
import { cn } from "@/lib/utils"
import { PlanPermissionsPicker, PLAN_MODULES } from "@/components/admin/settings/plan-permissions-picker"
import { PlanCarousel } from "@/components/shared/plan-carousel"

// Planes del sistema (superAdmin): precio, capacidad, beneficios comerciales y
// los permisos que incluye. Lo que un plan no incluye queda fuera para toda la
// empresa, aunque sus roles lo tengan marcado.

type Plan = {
  id: string
  name: string
  description: string | null
  monthlyPrice: string
  includedLocations: number
  includedEmployees: number
  extraLocationPrice: string
  extraEmployeePackSize: number
  extraEmployeePackPrice: string
  features: string[]
  permissions: string[] | null
  isActive: boolean
}

type Form = {
  id?: string
  name: string
  description: string
  monthlyPrice: string
  includedLocations: string
  includedEmployees: string
  extraLocationPrice: string
  extraEmployeePackSize: string
  extraEmployeePackPrice: string
  features: string
  permissions: Set<string>
}

const empty = (): Form => ({
  name: "",
  description: "",
  monthlyPrice: "0",
  includedLocations: "1",
  includedEmployees: "1",
  extraLocationPrice: "0",
  extraEmployeePackSize: "1",
  extraEmployeePackPrice: "0",
  features: "Punto de venta\nPanel administrativo\nPortal de clientes",
  permissions: new Set(PLAN_PERMISSION_KEYS),
})

/** Módulos que el plan deja completamente fuera. */
function excludedModules(permissions: string[] | null) {
  const denied = new Set<string>(planDeniedKeys(permissions))
  return PLAN_MODULES.filter(([, perms]) => perms.every((p) => denied.has(p.key))).map(([m]) => PERMISSION_MODULE_LABELS[m] ?? m)
}

export function PlansManager() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const load = () =>
    fetch("/api/settings/plans")
      .then((r) => r.json())
      .then((j) => setPlans(j.plans ?? []))
  useEffect(() => {
    void load()
  }, [])

  const edit = (p: Plan) =>
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      monthlyPrice: String(p.monthlyPrice),
      includedLocations: String(p.includedLocations),
      includedEmployees: String(p.includedEmployees),
      extraLocationPrice: String(p.extraLocationPrice),
      extraEmployeePackSize: String(p.extraEmployeePackSize),
      extraEmployeePackPrice: String(p.extraEmployeePackPrice),
      features: (p.features ?? []).join("\n"),
      permissions: new Set(Array.isArray(p.permissions) ? p.permissions : PLAN_PERMISSION_KEYS),
    })

  const save = async () => {
    if (!form) return
    setError("")
    setSaving(true)
    try {
      const all = PLAN_PERMISSION_KEYS.every((k) => form.permissions.has(k))
      const r = await fetch("/api/settings/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          features: form.features.split("\n").map((x) => x.trim()).filter(Boolean),
          // Todo marcado = sin restricción.
          permissions: all ? null : [...form.permissions],
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j.error ?? "No se pudo guardar")
        return
      }
      toast.success("Plan guardado. Las sesiones de las empresas lo reflejan en un minuto.")
      setForm(null)
      void load()
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof Omit<Form, "permissions" | "id">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f))

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<CreditCard className="size-5" />}
        title="Planes del sistema"
        description="Precio, capacidad, beneficios y qué módulos incluye cada plan. Los roles de cada empresa solo pueden usar lo que su plan incluye."
        actions={
          <Button onClick={() => setForm(empty())}>
            <Plus className="size-4" /> Nuevo plan
          </Button>
        }
      />

      <PlanCarousel label="Planes">
        {plans.map((p) => {
          const excluded = excludedModules(p.permissions)
          return (
            <div key={p.id} className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-e1", !p.isActive && "opacity-60")}>
              <div className="flex justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl font-semibold">{p.name}</h2>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
                <Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Activo" : "Inactivo"}</Badge>
              </div>
              <p className="text-3xl font-semibold tabular-nums">
                ${Number(p.monthlyPrice).toLocaleString("es-MX")}
                <span className="text-sm font-normal text-muted-foreground">/mes</span>
              </p>
              <div className="space-y-1.5 text-sm">
                <p className="flex gap-2">
                  <Building2 className="size-4 shrink-0" />
                  {p.includedLocations} sucursal(es) · extra ${Number(p.extraLocationPrice).toLocaleString("es-MX")}/mes
                </p>
                <p className="flex gap-2">
                  <Users className="size-4 shrink-0" />
                  {p.includedEmployees} empleados · paquete de {p.extraEmployeePackSize} por ${Number(p.extraEmployeePackPrice).toLocaleString("es-MX")}/mes
                </p>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {(p.features ?? []).map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-muted/50 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="size-3.5" /> Módulos
                </p>
                {excluded.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">Incluye todos los módulos.</p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    <Lock className="mr-1 inline size-3" />
                    No incluye: {excluded.join(", ")}
                  </p>
                )}
              </div>
              <Button variant="outline" className="mt-auto w-full" onClick={() => edit(p)}>
                Editar plan
              </Button>
            </div>
          )
        })}
      </PlanCarousel>

      <DialogComponent
        open={form !== null}
        onOpenChange={(o) => !o && setForm(null)}
        title={form?.id ? "Editar plan" : "Nuevo plan"}
        description="Capacidad, precio, beneficios comerciales y permisos incluidos."
        icon={<CreditCard className="size-5" />}
        size="3xl"
        bodyClassName="space-y-5"
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
            </Button>
          </>
        }
      >
        {form && (
          <>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <section className="grid gap-4 sm:grid-cols-2">
              <InputGroupField label="Nombre" required leftIcon={<CreditCard className="size-4" />} value={form.name} onChange={set("name")} />
              <InputGroupField required label="Precio mensual" type="number" leftIcon={<CreditCard className="size-4" />} value={form.monthlyPrice} onChange={set("monthlyPrice")} />
              <InputGroupField label="Descripción" leftIcon={<CreditCard className="size-4" />} value={form.description} onChange={set("description")} className="sm:col-span-2" />
              <InputGroupField required label="Sucursales incluidas" type="number" leftIcon={<Building2 className="size-4" />} value={form.includedLocations} onChange={set("includedLocations")} />
              <InputGroupField label="Precio por sucursal extra" type="number" leftIcon={<Building2 className="size-4" />} value={form.extraLocationPrice} onChange={set("extraLocationPrice")} />
              <InputGroupField required label="Empleados incluidos" type="number" leftIcon={<Users className="size-4" />} value={form.includedEmployees} onChange={set("includedEmployees")} />
              <InputGroupField label="Empleados por paquete extra" type="number" leftIcon={<Users className="size-4" />} value={form.extraEmployeePackSize} onChange={set("extraEmployeePackSize")} />
              <InputGroupField label="Precio del paquete de empleados" type="number" leftIcon={<Users className="size-4" />} value={form.extraEmployeePackPrice} onChange={set("extraEmployeePackPrice")} />
              <label className="space-y-2 text-sm font-medium sm:col-span-2">
                Beneficios que se muestran al cliente (uno por línea)
                <textarea className="min-h-24 w-full rounded-xl border bg-background p-3 font-normal" value={form.features} onChange={set("features")} />
              </label>
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Permisos incluidos</h3>
                  <p className="text-xs text-muted-foreground">Lo que no marques queda fuera para toda la empresa (propietario incluido), aunque sus roles lo tengan.</p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {form.permissions.size} de {PLAN_PERMISSION_KEYS.length}
                </span>
              </div>
              <PlanPermissionsPicker value={form.permissions} onChange={(permissions) => setForm((f) => (f ? { ...f, permissions } : f))} />
            </section>
          </>
        )}
      </DialogComponent>
    </div>
  )
}
