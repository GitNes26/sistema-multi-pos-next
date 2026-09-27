"use client"

import { ActiveStatusPill } from "@/components/shared/status-pills"
import { StatusPill } from "@/components/base/status-pill"
import { BusinessModeBadge } from "@/components/shared/business-mode-badge"
import * as React from "react"
import * as yup from "yup"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ArrowRight,
  Building2,
  KeyRound,
  LogIn,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Users,
  AlertCircle,
  Layers,
  Search,
} from "lucide-react"
import { EntityCell, RowActions, SegmentedFilter } from "@/components/base"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import {
  FormCombobox,
  type ComboboxOption,
} from "@/components/base/form-combobox"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { businessModeInfo } from "@/lib/business-modes"
import type { BusinessMode } from "@/lib/auth/options"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"

// FASE 15.9 — Gestión de organizaciones y asignación de admins (superAdmin).

type OrgRow = {
  id: string
  name: string
  businessMode: BusinessMode
  currency: string
  ownerName: string | null
  ownerEmail: string | null
  memberCount: number
  adminCount: number
  createdAt: string
  assignableRoles: {
    id: string
    name: string
    description: string | null
    permissionCount: number
  }[]
}

type MembershipRow = {
  membershipId: string
  organizationId: string
  organizationName: string
  businessMode: BusinessMode
  role: string
  roleId: string | null
  roleName: string | null
}

type UserRow = {
  id: string
  fullName: string
  email: string
  isActive: boolean
  isSuperadmin: boolean
  memberships: MembershipRow[]
}

// Las membresías legacy guardan solo el enum (owner/admin/manager/cashier);
// para el diálogo se normaliza al id del rol de sistema equivalente.
const ENUM_TO_SYSTEM: Record<string, string> = {
  owner: "system-owner",
  admin: "system-admin",
  manager: "system-manager",
  cashier: "system-cashier",
}

/** Valor del rol para el combobox: el roleId si existe, si no el id de sistema del enum. */
const roleValue = (m: MembershipRow) =>
  m.roleId ?? ENUM_TO_SYSTEM[m.role] ?? m.role

const displayRole = (m: MembershipRow) => m.roleName ?? m.role

/** Opción del combobox con tooltip de resumen de permisos al pasar el mouse. */
function RoleOption({ option }: { option: ComboboxOption }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate">{option.label}</span>
            {typeof option.permissionCount === "number" && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {option.permissionCount}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1 py-0.5">
            <p className="font-medium">{option.label}</p>
            {option.description && <p>{option.description}</p>}
            <p className="text-muted-foreground">
              {option.permissionCount ?? 0}{" "}
              {option.permissionCount === 1 ? "permiso" : "permisos"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Punto de color con el gradiente del modo (para badges y listas). */
function ModeDot({
  mode,
  className,
}: {
  mode: BusinessMode
  className?: string
}) {
  const info = businessModeInfo(mode)
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full bg-gradient-to-br ${info.gradient} ${className ?? ""}`}
    />
  )
}


async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Error del servidor")
  }
  return data as T
}

export function OrganizationsManager() {
  return (
    <Tabs defaultValue="orgs">
      <TabsList>
        <TabsTrigger value="orgs"><Building2 className="size-4" /> Organizaciones</TabsTrigger>
        <TabsTrigger value="users"><Users className="size-4" /> Usuarios y admins</TabsTrigger>
      </TabsList>
      <TabsContent value="orgs" className="mt-4">
        <OrganizationsTab />
      </TabsContent>
      <TabsContent value="users" className="mt-4">
        <UsersTab />
      </TabsContent>
    </Tabs>
  )
}

// ── Tab: Organizaciones ──────────────────────────────────────────────────────

function OrganizationsTab() {
  const router = useRouter()
  const { update } = useSession()
  const [orgs, setOrgs] = React.useState<OrgRow[] | null>(null)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OrgRow | null>(null)
  const [modeFilter, setModeFilter] = React.useState<string>("all")
  const [query, setQuery] = React.useState("")

  const load = React.useCallback(() => {
    api<{ organizations: OrgRow[] }>("/api/settings/organizations")
      .then((d) => setOrgs(d.organizations))
      .catch(() => undefined)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const enter = async (org: OrgRow) => {
    try {
      await update({ activeOrganizationId: org.id })
      router.push("/admin")
      router.refresh()
    } catch {
      swalError("No se pudo entrar a la organización")
    }
  }

  const remove = async (org: OrgRow) => {
    const ok = await swalConfirm(
      "Eliminar organización",
      `¿Eliminar "${org.name}" y todos sus datos? Esta acción no se puede deshacer.`,
      { danger: true, confirmText: "Eliminar" }
    )
    if (!ok) return
    try {
      await api(`/api/settings/organizations/${org.id}`, { method: "DELETE" })
      load()
      swalToast("Organización eliminada")
    } catch (err) {
      swalError(
        "No se pudo eliminar",
        err instanceof Error ? err.message : undefined
      )
    }
  }

  if (!orgs) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  const modes = [...new Set(orgs.map((o) => o.businessMode))]
  const visible = orgs.filter(
    (o) =>
      (modeFilter === "all" || o.businessMode === modeFilter) &&
      (!query || `${o.name} ${o.ownerName ?? ""} ${o.ownerEmail ?? ""}`.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Empresas", value: orgs.length, icon: Building2 },
          { label: "Miembros en total", value: orgs.reduce((s, o) => s + o.memberCount, 0), icon: Users },
          { label: "Con administradores", value: orgs.filter((o) => o.adminCount > 0).length, icon: KeyRound },
          { label: "Tipos de negocio", value: modes.length, icon: Layers },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-4 shadow-e1">
            <k.icon className="size-5 text-primary" />
            <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter
          ariaLabel="Tipo de negocio"
          value={modeFilter}
          onChange={setModeFilter}
          options={[
            { value: "all", label: "Todas", count: orgs.length },
            ...modes.map((m) => ({ value: m, label: businessModeInfo(m).label.split(" /")[0], count: orgs.filter((o) => o.businessMode === m).length })),
          ]}
        />
        <InputGroupField
          placeholder="Empresa, dueño o correo…"
          leftIcon={<Search className="size-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-64"
        />
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Nueva organización
        </Button>
      </div>

      {visible.length === 0 && (
        <p className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {orgs.length === 0 ? "No hay organizaciones registradas. Crea la primera." : "Ninguna empresa coincide con el filtro."}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((org) => {
          const info = businessModeInfo(org.businessMode)
          return (
            <div key={org.id} className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-e1 transition-shadow hover:shadow-e2">
              <div className={`h-1.5 bg-gradient-to-r ${info.gradient}`} />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg font-bold text-white ${info.gradient}`}>
                    {org.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{org.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{info.label}</p>
                  </div>
                  <RowActions
                    name={org.name}
                    items={[
                      { label: "Entrar a la empresa", icon: LogIn, onSelect: () => void enter(org) },
                      { label: "Editar", icon: Pencil, onSelect: () => setEditing(org) },
                      { label: "Eliminar", icon: Trash2, destructive: true, onSelect: () => void remove(org) },
                    ]}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  <UserRound className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{org.ownerName ?? "Sin dueño asignado"}</p>
                    {org.ownerEmail && <p className="truncate text-xs text-muted-foreground">{org.ownerEmail}</p>}
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="size-3.5" /> {org.memberCount} miembros</span>
                  <span className="flex items-center gap-1"><KeyRound className="size-3.5" /> {org.adminCount} admins</span>
                  <span>{org.currency}</span>
                  <span className="ml-auto">Alta {new Date(org.createdAt).toLocaleDateString("es-MX", { month: "short", year: "numeric" })}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => void enter(org)}>
                  <LogIn className="size-4" /> Entrar
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <CreateOrgDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
      <EditOrgDialog
        org={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </div>
  )
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = React.useState("")
  const [currency, setCurrency] = React.useState("MXN")
  const [ownerName, setOwnerName] = React.useState("")
  const [ownerEmail, setOwnerEmail] = React.useState("")
  const [ownerPassword, setOwnerPassword] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string>()
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  React.useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() =>
      focusFirstEnabled("create-org-form")
    )
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, open])

  const reset = () => {
    setName("")
    setCurrency("MXN")
    setOwnerName("")
    setOwnerEmail("")
    setOwnerPassword("")
    setErrors({})
    setFormError(undefined)
  }

  const save = async () => {
    try {
      await yup
        .object({
          name: yup
            .string()
            .trim()
            .required("El nombre es obligatorio")
            .max(160, "Máximo 160 caracteres"),
          currency: yup
            .string()
            .trim()
            .uppercase()
            .matches(
              /^[A-Z]{3}$/,
              "Usa el código ISO de 3 letras, por ejemplo MXN"
            )
            .required("La moneda es obligatoria"),
          ownerName: yup.string().trim().max(160, "Máximo 160 caracteres"),
          ownerEmail: yup
            .string()
            .trim()
            .lowercase()
            .email("Ingresa un correo válido")
            .required("El correo es obligatorio"),
          ownerPassword: yup
            .string()
            .min(8, "La contraseña debe tener al menos 8 caracteres")
            .required("La contraseña es obligatoria"),
        })
        .validate(
          { name, currency, ownerName, ownerEmail, ownerPassword },
          { abortEarly: false }
        )
      setErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        for (const failure of error.inner)
          if (failure.path && !next[failure.path])
            next[failure.path] = failure.message
        setErrors(next)
        const focusErrors = Object.fromEntries(
          Object.entries(next).map(([key, message]) => [
            `create-org-${key}`,
            message,
          ])
        )
        window.requestAnimationFrame(() =>
          focusFirstInvalid(focusErrors, "create-org-form")
        )
      }
      return
    }
    setSaving(true)
    setFormError(undefined)
    try {
      await api("/api/settings/organizations", {
        method: "POST",
        body: JSON.stringify({
          name,
          currency,
          ownerName,
          ownerEmail,
          ownerPassword,
        }),
      })
      reset()
      onOpenChange(false)
      onCreated()
      swalToast("Organización creada")
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "No se pudo crear la organización"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva organización"
      description="Crea la empresa con la cuenta owner, la sucursal Matriz y la Caja 1 iniciales."
      icon={<Building2 className="size-4" />}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="create-org-form" disabled={saving}>
            {saving ? "Creando…" : "Crear organización"}
          </Button>
        </>
      }
    >
      <form
        id="create-org-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        className="space-y-3"
      >
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </div>
        )}
        <InputGroupField
          id="create-org-name"
          label="Nombre de la organización"
          required
          placeholder="Ej. Supermercado Mi Tienda"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <InputGroupField
          id="create-org-currency"
          label="Moneda"
          placeholder="MXN"
          value={currency}
          onChange={(e) =>
            setCurrency(e.target.value.toUpperCase().slice(0, 3))
          }
          required
          error={errors.currency}
        />
        <p className="text-xs font-semibold text-muted-foreground">
          Cuenta del owner
        </p>
        <InputGroupField
          id="create-org-ownerName"
          label="Nombre"
          placeholder="Nombre completo"
          leftIcon={<UserRound className="size-4" />}
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          error={errors.ownerName}
        />
        <InputGroupField
          id="create-org-ownerEmail"
          label="Email"
          type="email"
          required
          placeholder="owner@empresa.com"
          leftIcon={<UserRound className="size-4" />}
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value.toLowerCase())}
          error={errors.ownerEmail}
        />
        <InputGroupField
          id="create-org-ownerPassword"
          label="Contraseña"
          type="password"
          required
          placeholder="Mínimo 8 caracteres"
          leftIcon={<KeyRound className="size-4" />}
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
          error={errors.ownerPassword}
        />
      </form>
    </DialogComponent>
  )
}

function EditOrgDialog({
  org,
  onClose,
  onSaved,
}: {
  org: OrgRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState("")
  const [currency, setCurrency] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string>()
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  React.useEffect(() => {
    if (org) {
      setName(org.name)
      setCurrency(org.currency)
      setErrors({})
      setFormError(undefined)
      const frame = window.requestAnimationFrame(() =>
        focusFirstEnabled("edit-org-form")
      )
      return () => window.cancelAnimationFrame(frame)
    }
  }, [focusFirstEnabled, org])

  const save = async () => {
    if (!org) return
    try {
      await yup
        .object({
          name: yup
            .string()
            .trim()
            .required("El nombre es obligatorio")
            .max(160, "Máximo 160 caracteres"),
          currency: yup
            .string()
            .trim()
            .uppercase()
            .matches(/^[A-Z]{3}$/, "Usa un código ISO de 3 letras")
            .required("La moneda es obligatoria"),
        })
        .validate({ name, currency }, { abortEarly: false })
      setErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        for (const failure of error.inner)
          if (failure.path && !next[failure.path])
            next[failure.path] = failure.message
        setErrors(next)
        const focusErrors = Object.fromEntries(
          Object.entries(next).map(([key, message]) => [
            `edit-org-${key}`,
            message,
          ])
        )
        window.requestAnimationFrame(() =>
          focusFirstInvalid(focusErrors, "edit-org-form")
        )
      }
      return
    }
    setSaving(true)
    setFormError(undefined)
    try {
      await api(`/api/settings/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, currency }),
      })
      onClose()
      onSaved()
      swalToast("Organización actualizada")
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la organización"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={Boolean(org)}
      onOpenChange={(v) => !v && onClose()}
      title="Editar organización"
      icon={<Building2 className="size-4" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-org-form" disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form
        id="edit-org-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        className="space-y-3"
      >
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </div>
        )}
        <InputGroupField
          id="edit-org-name"
          label="Nombre"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <InputGroupField
          id="edit-org-currency"
          label="Moneda"
          value={currency}
          onChange={(e) =>
            setCurrency(e.target.value.toUpperCase().slice(0, 3))
          }
          required
          error={errors.currency}
        />
      </form>
    </DialogComponent>
  )
}

// ── Tab: Usuarios y admins ───────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = React.useState<UserRow[] | null>(null)
  const [orgs, setOrgs] = React.useState<OrgRow[]>([])
  const [createOpen, setCreateOpen] = React.useState(false)
  const [assigning, setAssigning] = React.useState<UserRow | null>(null)
  const [userFilter, setUserFilter] = React.useState<"all" | "unassigned" | "superadmin" | "inactive">("all")
  const [query, setQuery] = React.useState("")

  const load = React.useCallback(() => {
    api<{ users: UserRow[] }>("/api/settings/organizations/users")
      .then((d) => setUsers(d.users))
      .catch(() => undefined)
    api<{ organizations: OrgRow[] }>("/api/settings/organizations")
      .then((d) => setOrgs(d.organizations))
      .catch(() => undefined)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  if (!users) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  const counts = {
    all: users.length,
    unassigned: users.filter((u) => !u.isSuperadmin && u.memberships.length === 0).length,
    superadmin: users.filter((u) => u.isSuperadmin).length,
    inactive: users.filter((u) => !u.isActive).length,
  }
  const visible = users.filter(
    (u) =>
      (userFilter === "all" ||
        (userFilter === "unassigned" && !u.isSuperadmin && u.memberships.length === 0) ||
        (userFilter === "superadmin" && u.isSuperadmin) ||
        (userFilter === "inactive" && !u.isActive)) &&
      (!query || `${u.fullName} ${u.email} ${u.memberships.map((m) => m.organizationName).join(" ")}`.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter
          ariaLabel="Usuarios"
          value={userFilter}
          onChange={setUserFilter}
          options={[
            { value: "all", label: "Todos", count: counts.all },
            { value: "unassigned", label: "Sin empresa", count: counts.unassigned, countTone: counts.unassigned ? "warning" : undefined },
            { value: "superadmin", label: "Super admins", count: counts.superadmin },
            { value: "inactive", label: "Inactivos", count: counts.inactive },
          ]}
        />
        <InputGroupField
          placeholder="Nombre, correo o empresa…"
          leftIcon={<Search className="size-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-64"
        />
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Crear usuario
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {visible.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Ningún usuario en esta vista.</p>}
        <div className="divide-y">
          {visible.map((u) => (
            <div key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${u.isActive ? "" : "opacity-60"}`}>
              <EntityCell
                title={u.fullName}
                subtitle={u.email}
                icon={u.isSuperadmin ? <KeyRound className="size-4" /> : undefined}
                className="min-w-56 flex-1"
              />
              <div className="flex min-w-0 flex-[2] flex-wrap items-center gap-1.5">
                {u.isSuperadmin && <StatusPill tone="primary" dot={false}>Super admin</StatusPill>}
                {!u.isActive && <ActiveStatusPill active={false} />}
                {!u.isSuperadmin && u.memberships.length === 0 && <StatusPill tone="warning">Sin empresa asignada</StatusPill>}
                {u.memberships.map((m) => (
                  <span
                    key={m.membershipId}
                    title={`${m.organizationName} (${businessModeInfo(m.businessMode).label})`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs"
                  >
                    <ModeDot mode={m.businessMode} />
                    <span className="font-medium">{m.organizationName}</span>
                    <span className="text-muted-foreground">· {displayRole(m)}</span>
                  </span>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setAssigning(u)}>
                <Users className="size-4" /> Asignar empresa y rol
              </Button>
            </div>
          ))}
        </div>
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
      <AssignOrgDialog
        user={assigning}
        orgs={orgs}
        onClose={() => setAssigning(null)}
        onSaved={load}
      />
    </div>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string>()
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  React.useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() =>
      focusFirstEnabled("create-user-form")
    )
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, open])

  const save = async () => {
    try {
      await yup
        .object({
          fullName: yup
            .string()
            .trim()
            .required("El nombre es obligatorio")
            .max(160, "Máximo 160 caracteres"),
          email: yup
            .string()
            .trim()
            .lowercase()
            .email("Ingresa un correo válido")
            .required("El correo es obligatorio"),
          password: yup
            .string()
            .min(8, "La contraseña debe tener al menos 8 caracteres")
            .required("La contraseña es obligatoria"),
        })
        .validate({ fullName, email, password }, { abortEarly: false })
      setErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        for (const failure of error.inner)
          if (failure.path && !next[failure.path])
            next[failure.path] = failure.message
        setErrors(next)
        const focusErrors = Object.fromEntries(
          Object.entries(next).map(([key, message]) => [
            `create-user-${key}`,
            message,
          ])
        )
        window.requestAnimationFrame(() =>
          focusFirstInvalid(focusErrors, "create-user-form")
        )
      }
      return
    }
    setSaving(true)
    setFormError(undefined)
    try {
      await api("/api/settings/organizations/users", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
      })
      onOpenChange(false)
      onCreated()
      setFullName("")
      setEmail("")
      setPassword("")
      setErrors({})
      swalToast("Usuario creado")
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "No se pudo crear el usuario"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      title="Crear usuario"
      description="Crea la cuenta. Después asígnale organizaciones con el rol deseado (admin, owner, etc.)."
      icon={<UserRound className="size-4" />}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="create-user-form" disabled={saving}>
            {saving ? "Creando…" : "Crear usuario"}
          </Button>
        </>
      }
    >
      <form
        id="create-user-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        className="space-y-3"
      >
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </div>
        )}
        <InputGroupField
          id="create-user-fullName"
          label="Nombre completo"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />
        <InputGroupField
          id="create-user-email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
          error={errors.email}
        />
        <InputGroupField
          id="create-user-password"
          label="Contraseña"
          type="password"
          required
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
      </form>
    </DialogComponent>
  )
}

function AssignOrgDialog({
  user,
  orgs,
  onClose,
  onSaved,
}: {
  user: UserRow | null
  orgs: OrgRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const [roles, setRoles] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string>()
  const { focusFirstEnabled } = useFocusInvalid()

  React.useEffect(() => {
    if (!user) return
    const next: Record<string, string> = {}
    for (const o of orgs) {
      const current = user.memberships.find((m) => m.organizationId === o.id)
      next[o.id] = current ? roleValue(current) : ""
    }
    setRoles(next)
    setFormError(undefined)
    const frame = window.requestAnimationFrame(() =>
      focusFirstEnabled("assign-org-form")
    )
    return () => window.cancelAnimationFrame(frame)
  }, [focusFirstEnabled, user, orgs])

  if (!user) return null

  const save = async () => {
    setSaving(true)
    setFormError(undefined)
    try {
      for (const o of orgs) {
        const value = roles[o.id] ?? ""
        const current = user.memberships.find((m) => m.organizationId === o.id)
        const currentValue = current ? roleValue(current) : ""
        if (!value && current) {
          await api(
            `/api/settings/organizations/${o.id}/members/${current.membershipId}`,
            {
              method: "DELETE",
            }
          )
        } else if (value && value !== currentValue) {
          await api(`/api/settings/organizations/${o.id}/members`, {
            method: "POST",
            body: JSON.stringify({ userId: user.id, roleId: value }),
          })
        }
      }
      onClose()
      onSaved()
      swalToast("Asignaciones actualizadas")
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar las asignaciones"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={Boolean(user)}
      onOpenChange={(v) => !v && onClose()}
      title={`Asignar organizaciones — ${user.fullName}`}
      description="Selecciona el rol por organización. Deja vacío para quitar el acceso."
      icon={<ArrowRight className="size-4" />}
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="assign-org-form" disabled={saving}>
            {saving ? "Guardando…" : "Guardar asignaciones"}
          </Button>
        </>
      }
    >
      <form
        id="assign-org-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        className="space-y-3"
      >
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </div>
        )}
        {orgs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay organizaciones registradas. Crea una primero.
          </p>
        )}
        {orgs.map((o) => {
          const options: ComboboxOption[] = o.assignableRoles.map((r) => ({
            value: r.id,
            label: r.name,
            description: r.description,
            permissionCount: r.permissionCount,
          }))
          return (
            <div
              key={o.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{o.name}</span>
                  <ModeDot mode={o.businessMode} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {businessModeInfo(o.businessMode).label} · {o.currency}
                </p>
                {options.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Roles disponibles: {options.map((r) => r.label).join(" · ")}
                  </p>
                )}
              </div>
              <FormCombobox
                id={`assign-org-${o.id}`}
                ariaLabel={`Rol en ${o.name}`}
                className="w-44"
                value={roles[o.id] ?? ""}
                onChange={(v) => setRoles((prev) => ({ ...prev, [o.id]: v }))}
                onClear={() => setRoles((prev) => ({ ...prev, [o.id]: "" }))}
                options={options}
                searchable
                clearable
                placeholder="— Sin rol —"
                renderOption={(opt) => <RoleOption option={opt} />}
              />
            </div>
          )
        })}
      </form>
    </DialogComponent>
  )
}
