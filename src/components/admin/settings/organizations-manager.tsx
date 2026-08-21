"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogComponent } from "@/components/ui/dialog";
import { InputGroupField } from "@/components/base/input-group-field";
import { FormCombobox } from "@/components/base/form-combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";

// FASE 15.9 — Gestión de organizaciones y asignación de admins (superAdmin).

type OrgRow = {
  id: string;
  name: string;
  currency: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
  adminCount: number;
  createdAt: string;
};

type MembershipRow = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  role: string;
};

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isSuperadmin: boolean;
  memberships: MembershipRow[];
};

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cajero" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Error del servidor");
  }
  return data as T;
}

export function OrganizationsManager() {
  return (
    <Tabs defaultValue="orgs">
      <TabsList>
        <TabsTrigger value="orgs">Organizaciones</TabsTrigger>
        <TabsTrigger value="users">Usuarios y admins</TabsTrigger>
      </TabsList>
      <TabsContent value="orgs" className="mt-4">
        <OrganizationsTab />
      </TabsContent>
      <TabsContent value="users" className="mt-4">
        <UsersTab />
      </TabsContent>
    </Tabs>
  );
}

// ── Tab: Organizaciones ──────────────────────────────────────────────────────

function OrganizationsTab() {
  const router = useRouter();
  const { update } = useSession();
  const [orgs, setOrgs] = React.useState<OrgRow[] | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<OrgRow | null>(null);

  const load = React.useCallback(() => {
    api<{ organizations: OrgRow[] }>("/api/settings/organizations")
      .then((d) => setOrgs(d.organizations))
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const enter = async (org: OrgRow) => {
    try {
      await update({ activeOrganizationId: org.id });
      router.push("/admin");
      router.refresh();
    } catch {
      swalError("No se pudo entrar a la organización");
    }
  };

  const remove = async (org: OrgRow) => {
    const ok = await swalConfirm(
      "Eliminar organización",
      `¿Eliminar "${org.name}" y todos sus datos? Esta acción no se puede deshacer.`,
      { danger: true, confirmText: "Eliminar" }
    );
    if (!ok) return;
    try {
      await api(`/api/settings/organizations/${org.id}`, { method: "DELETE" });
      load();
      swalToast("Organización eliminada");
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  if (!orgs) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Nueva organización
        </Button>
      </div>

      {orgs.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay organizaciones registradas. Crea la primera.
        </p>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {orgs.map((org) => (
          <div key={org.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold">{org.name}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {org.ownerName ?? "—"} · {org.ownerEmail ?? ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{org.currency}</Badge>
                  <Badge variant="outline">{org.memberCount} miembros</Badge>
                  {org.adminCount > 0 && (
                    <Badge variant="outline">{org.adminCount} admins</Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Entrar" onClick={() => enter(org)}>
                  <LogIn className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(org)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={() => void remove(org)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <EditOrgDialog org={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [currency, setCurrency] = React.useState("MXN");
  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerPassword, setOwnerPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const reset = () => {
    setName("");
    setCurrency("MXN");
    setOwnerName("");
    setOwnerEmail("");
    setOwnerPassword("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/settings/organizations", {
        method: "POST",
        body: JSON.stringify({ name, currency, ownerName, ownerEmail, ownerPassword }),
      });
      reset();
      onOpenChange(false);
      onCreated();
      swalToast("Organización creada");
    } catch (err) {
      swalError("No se pudo crear", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva organización"
      description="Crea la empresa con la cuenta owner, la sucursal Matriz y la Caja 1 iniciales."
      icon={<Building2 className="size-4" />}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim() || !ownerEmail.trim() || !ownerPassword}>
            {saving ? "Creando…" : "Crear organización"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <InputGroupField
          id="org-name"
          label="Nombre de la organización"
          required
          placeholder="Ej. Supermercado Mi Tienda"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <InputGroupField
          id="org-currency"
          label="Moneda"
          placeholder="MXN"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        />
        <p className="text-xs font-semibold text-muted-foreground">Cuenta del owner</p>
        <InputGroupField
          id="owner-name"
          label="Nombre"
          placeholder="Nombre completo"
          leftIcon={<UserRound className="size-4" />}
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
        />
        <InputGroupField
          id="owner-email"
          label="Email"
          type="email"
          required
          placeholder="owner@empresa.com"
          leftIcon={<UserRound className="size-4" />}
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
        />
        <InputGroupField
          id="owner-password"
          label="Contraseña"
          type="password"
          required
          placeholder="Mínimo 6 caracteres"
          leftIcon={<KeyRound className="size-4" />}
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
        />
      </div>
    </DialogComponent>
  );
}

function EditOrgDialog({
  org,
  onClose,
  onSaved,
}: {
  org: OrgRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [currency, setCurrency] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (org) {
      setName(org.name);
      setCurrency(org.currency);
    }
  }, [org]);

  const save = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await api(`/api/settings/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, currency }),
      });
      onClose();
      onSaved();
      swalToast("Organización actualizada");
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={Boolean(org)}
      onOpenChange={(v) => !v && onClose()}
      title="Editar organización"
      icon={<Building2 className="size-4" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <InputGroupField
          id="edit-org-name"
          label="Nombre"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <InputGroupField
          id="edit-org-currency"
          label="Moneda"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        />
      </div>
    </DialogComponent>
  );
}

// ── Tab: Usuarios y admins ───────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = React.useState<UserRow[] | null>(null);
  const [orgs, setOrgs] = React.useState<OrgRow[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [assigning, setAssigning] = React.useState<UserRow | null>(null);

  const load = React.useCallback(() => {
    api<{ users: UserRow[] }>("/api/settings/organizations/users")
      .then((d) => setUsers(d.users))
      .catch(() => undefined);
    api<{ organizations: OrgRow[] }>("/api/settings/organizations")
      .then((d) => setOrgs(d.organizations))
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (!users) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Crear usuario
        </Button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{u.fullName}</span>
                {u.isSuperadmin && <Badge variant="secondary">Super admin</Badge>}
                {!u.isActive && <Badge variant="outline">Inactivo</Badge>}
              </div>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {u.memberships.length === 0 && (
                  <span className="text-xs text-muted-foreground">Sin organizaciones asignadas</span>
                )}
                {u.memberships.map((m) => (
                  <Badge key={m.membershipId} variant="outline">
                    {m.organizationName} · {m.role}
                  </Badge>
                ))}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAssigning(u)}>
              <Users className="size-4" /> Asignar
            </Button>
          </div>
        ))}
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <AssignOrgDialog user={assigning} orgs={orgs} onClose={() => setAssigning(null)} onSaved={load} />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/settings/organizations/users", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
      });
      onOpenChange(false);
      onCreated();
      setFullName("");
      setEmail("");
      setPassword("");
      swalToast("Usuario creado");
    } catch (err) {
      swalError("No se pudo crear", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      title="Crear usuario"
      description="Crea la cuenta. Después asígnale organizaciones con el rol deseado (admin, owner, etc.)."
      icon={<UserRound className="size-4" />}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving || !fullName.trim() || !email.trim() || !password}>
            {saving ? "Creando…" : "Crear usuario"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <InputGroupField
          id="user-fullname"
          label="Nombre completo"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <InputGroupField
          id="user-email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <InputGroupField
          id="user-password"
          label="Contraseña"
          type="password"
          required
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </DialogComponent>
  );
}

function AssignOrgDialog({
  user,
  orgs,
  onClose,
  onSaved,
}: {
  user: UserRow | null;
  orgs: OrgRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roles, setRoles] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    const next: Record<string, string> = {};
    for (const o of orgs) {
      const current = user.memberships.find((m) => m.organizationId === o.id);
      next[o.id] = current?.role ?? "";
    }
    setRoles(next);
  }, [user, orgs]);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    try {
      for (const o of orgs) {
        const role = roles[o.id] ?? "";
        const current = user.memberships.find((m) => m.organizationId === o.id);
        if (!role && current) {
          await api(`/api/settings/organizations/${o.id}/members/${current.membershipId}`, {
            method: "DELETE",
          });
        } else if (role && (!current || current.role !== role)) {
          await api(`/api/settings/organizations/${o.id}/members`, {
            method: "POST",
            body: JSON.stringify({ userId: user.id, role }),
          });
        }
      }
      onClose();
      onSaved();
      swalToast("Asignaciones actualizadas");
    } catch (err) {
      swalError("No se pudieron guardar las asignaciones", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

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
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar asignaciones"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {orgs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay organizaciones registradas. Crea una primero.
          </p>
        )}
        {orgs.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{o.name}</p>
              <p className="text-xs text-muted-foreground">{o.currency}</p>
            </div>
            <FormCombobox
              className="w-32"
              value={roles[o.id] ?? ""}
              onChange={(v) => setRoles((prev) => ({ ...prev, [o.id]: v }))}
              onClear={() => setRoles((prev) => ({ ...prev, [o.id]: "" }))}
              options={ROLE_OPTIONS}
              searchable={false}
              clearable
              placeholder="— Sin rol —"
            />
          </div>
        ))}
      </div>
    </DialogComponent>
  );
}