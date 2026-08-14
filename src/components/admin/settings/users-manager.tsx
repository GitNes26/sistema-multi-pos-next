"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
} from "lucide-react";
import { settingsApi } from "@/lib/settings/client";
import type { InvitationRow, OrgUserRow, RoleRow } from "@/lib/settings/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { swalConfirm, swalError, swalPrompt, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { TooltipButton } from "@/components/shared/tooltip-button";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "owner", label: "Propietario" },
  { value: "manager", label: "Gerente" },
  { value: "cashier", label: "Cajero" },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  manager: "Gerente",
  cashier: "Cajero",
};

type PermItem = (typeof PERMISSIONS)[number];

const MODULES_BY_GROUP = PERMISSIONS.reduce<Record<string, PermItem[]>>((acc, p) => {
  (acc[p.module] ??= []).push(p);
  return acc;
}, {});

export function UsersManager() {
  const [tab, setTab] = useState("users");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="users">Usuarios</TabsTrigger>
        <TabsTrigger value="roles">Roles y permisos</TabsTrigger>
        <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        <UsersTab />
      </TabsContent>
      <TabsContent value="roles">
        <RolesTab />
      </TabsContent>
      <TabsContent value="invitations">
        <InvitationsTab />
      </TabsContent>
    </Tabs>
  );
}

// ── Usuarios (15.4) ──────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<OrgUserRow[] | null>(null);

  const load = useCallback(() => {
    settingsApi.users().then((d) => setUsers(d.users)).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (u: OrgUserRow, role: string) => {
    try {
      await settingsApi.updateUser(u.membershipId, { role });
      load();
      swalToast("Rol actualizado");
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  const toggleActive = async (u: OrgUserRow, isActive: boolean) => {
    try {
      await settingsApi.updateUser(u.membershipId, { isActive });
      load();
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  const remove = async (u: OrgUserRow) => {
    const ok = await swalConfirm(
      "Quitar usuario",
      `¿Quitar a ${u.fullName} de la organización?`,
      { danger: true }
    );
    if (!ok) return;
    try {
      await settingsApi.removeUser(u.membershipId);
      load();
      swalToast("Usuario quitado", "info");
    } catch (err) {
      swalError("No se pudo quitar", err instanceof Error ? err.message : undefined);
    }
  };

  if (!users) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay usuarios. Invítalos desde la pestaña &quot;Invitaciones&quot;.
        </p>
      )}
      {users.map((u) => (
        <div key={u.membershipId} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{u.fullName}</span>
              {u.isEmployee && <Badge variant="secondary">Empleado</Badge>}
              {!u.isActive && <Badge variant="outline">Inactivo</Badge>}
            </div>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
          <FormCombobox
            className="w-36"
            value={u.role}
            onChange={(v) => changeRole(u, v)}
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
            searchable={false}
            clearable={false}
          />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Activo
            <Switch checked={u.isActive} onCheckedChange={(v) => toggleActive(u, v)} />
          </div>
          <TooltipButton label="Quitar" variant="ghost" size="icon-xs" onClick={() => remove(u)}>
            <UserX className="size-3.5 text-destructive" />
          </TooltipButton>
        </div>
      ))}
    </div>
  );
}

// ── Roles y permisos (14.x / 15.4) ───────────────────────────────────────────

function RolesTab() {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(() => {
    settingsApi.roles().then((d) => setRoles(d.roles)).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (!selectedId) {
      setPerms(new Set());
      return;
    }
    let active = true;
    setPerms(new Set());
    settingsApi
      .rolePermissions(selectedId)
      .then((d) => {
        if (active) setPerms(new Set(d.permissions));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = roles?.find((r) => r.id === selectedId);

  const toggle = (key: string) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModule = (keys: string[]) => {
    setPerms((prev) => {
      const next = new Set(prev);
      const all = keys.every((k) => next.has(k));
      keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const savePerms = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await settingsApi.setRolePermissions(selectedId, Array.from(perms));
      loadRoles();
      swalToast("Permisos guardados");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const create = async (copyRoleId?: string) => {
    const name = await swalPrompt("Nuevo rol", "Nombre del rol…", undefined, "Ej. Supervisor de piso");
    if (!name) return;
    try {
      await settingsApi.createRole({ name, copyRoleId: copyRoleId ?? null });
      loadRoles();
      swalToast("Rol creado");
    } catch (err) {
      swalError("No se pudo crear", err instanceof Error ? err.message : undefined);
    }
  };

  const remove = async (role: RoleRow) => {
    const ok = await swalConfirm("Eliminar rol", `¿Eliminar el rol "${role.name}"?`, { danger: true });
    if (!ok) return;
    try {
      await settingsApi.deleteRole(role.id);
      if (selectedId === role.id) setSelectedId("");
      loadRoles();
      swalToast("Rol eliminado", "info");
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-1.5">
        {!roles ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  selectedId === r.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
                <span className="truncate font-medium">{r.name}</span>
                <span className="flex items-center gap-1.5">
                  {r.isSystem && <Badge variant="outline">Sistema</Badge>}
                  <span className="text-xs text-muted-foreground">{r.permissionCount}</span>
                </span>
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => create()} className="flex-1">
                <Plus className="size-3.5" /> Nuevo
              </Button>
              {selected && !selected.isSystem && (
                <Button size="sm" variant="outline" onClick={() => create(selected.id)}>
                  <Copy className="size-3.5" /> Duplicar
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border p-4">
        {!selected ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Selecciona un rol para editar sus permisos
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selected.name}</p>
                {selected.description && (
                  <p className="text-xs text-muted-foreground">{selected.description}</p>
                )}
              </div>
              {!selected.isSystem && (
                <TooltipButton label="Eliminar rol" variant="ghost" size="icon-xs" onClick={() => remove(selected)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </TooltipButton>
              )}
            </div>

            <div className="space-y-3">
              {Object.entries(MODULES_BY_GROUP).map(([module, modulePerms]) => {
                const all = modulePerms.every((p) => perms.has(p.key));
                return (
                  <div key={module} className="rounded-lg border p-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <Checkbox checked={all} onCheckedChange={() => toggleModule(modulePerms.map((p) => p.key))} />
                      <span className="text-sm font-medium capitalize">{module}</span>
                      <span className="ml-auto text-xs text-muted-foreground">Todos</span>
                    </label>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {modulePerms.map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox checked={perms.has(p.key)} onCheckedChange={() => toggle(p.key)} />
                          <span className="text-muted-foreground">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={savePerms} disabled={saving}>
              <ShieldCheck className="size-4" /> {saving ? "Guardando…" : "Guardar permisos"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Invitaciones (15.5) ──────────────────────────────────────────────────────

function InvitationsTab() {
  const [invitations, setInvitations] = useState<InvitationRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("cashier");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    settingsApi.invitations().then((d) => setInvitations(d.invitations)).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    setSending(true);
    try {
      await settingsApi.createInvitation({ email, role });
      setEmail("");
      load();
      swalToast("Invitación enviada");
    } catch (err) {
      swalError("No se pudo invitar", err instanceof Error ? err.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const revoke = async (id: string) => {
    const ok = await swalConfirm("Revocar invitación", "¿Revocar esta invitación?", { danger: true });
    if (!ok) return;
    try {
      await settingsApi.revokeInvitation(id);
      load();
      swalToast("Invitación revocada", "info");
    } catch (err) {
      swalError("No se pudo revocar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <div className="min-w-48 flex-1">
          <InputGroupField
            label="Email"
            type="email"
            placeholder="persona@correo.com"
            leftIcon={<Mail className="size-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase())}
          />
        </div>
        <div className="space-y-1.5">
          <FormCombobox
            label="Rol"
            value={role}
            onChange={setRole}
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
            searchable={false}
            clearable={false}
          />
        </div>
        <Button onClick={send} disabled={sending}>
          <UserPlus className="size-4" /> {sending ? "Enviando…" : "Invitar"}
        </Button>
      </div>

      {!invitations ? (
        <Skeleton className="h-20 w-full" />
      ) : invitations.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay invitaciones pendientes</p>
      ) : (
        <div className="space-y-2">
          {invitations.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.email}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[i.role] ?? i.role} · {i.status === "pending" ? "Pendiente" : i.status}
                </p>
              </div>
              {i.status === "pending" && (
                <Button variant="ghost" size="icon-xs" onClick={() => revoke(i.id)} aria-label="Revocar">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
