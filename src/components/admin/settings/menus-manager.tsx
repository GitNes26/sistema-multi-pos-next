"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Menu,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { menusApi } from "@/lib/menus/client";
import type { MenuNode, MenuInput } from "@/lib/menus/server";
import { MENU_ICON_NAMES, resolveMenuIcon } from "@/lib/menu-icons";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const BADGE_VARIANTS = [
  { value: "default", label: "Default" },
  { value: "destructive", label: "Destructive" },
  { value: "secondary", label: "Secondary" },
  { value: "outline", label: "Outline" },
];

const EMPTY_FORM: MenuInput & { id?: string } = {
  id: undefined,
  type: "item",
  label: "",
  icon: "Circle",
  href: "",
  badge: "",
  badgeVariant: "default",
  permissionKey: "",
  parentId: "",
  sortOrder: 0,
  isActive: true,
};

export function MenusManager() {
  const [menus, setMenus] = useState<MenuNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<(MenuInput & { id?: string }) | null>(null);

  const load = useCallback(() => {
    menusApi
      .adminList()
      .then((d) => setMenus(d.menus))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo(() => {
    if (!menus) return [];
    const byId = new Map(menus.map((m) => [m.id, { ...m, children: [] as MenuNode[] }]));
    const roots: MenuNode[] = [];
    for (const m of menus) {
      const node = byId.get(m.id)!;
      if (m.parentId && byId.has(m.parentId)) byId.get(m.parentId)!.children.push(node);
      else roots.push(node);
    }
    const sort = (arr: MenuNode[]) => {
      arr.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
      arr.forEach((n) => sort(n.children));
    };
    sort(roots);
    return roots;
  }, [menus]);

  const siblingsOf = (node: MenuNode): MenuNode[] => {
    if (!menus) return [];
    return menus
      .filter((m) => m.parentId === node.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const move = async (node: MenuNode, dir: -1 | 1) => {
    const siblings = siblingsOf(node);
    const idx = siblings.findIndex((s) => s.id === node.id);
    const target = siblings[idx + dir];
    if (!target) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[idx + dir]] = [reordered[idx + dir], reordered[idx]];
    await persistOrder(reordered);
  };

  const persistOrder = async (siblings: MenuNode[]) => {
    try {
      await menusApi.reorder(
        siblings.map((s, i) => ({ id: s.id, sortOrder: i + 1, parentId: s.parentId }))
      );
      load();
    } catch (err) {
      swalError("No se pudo reordenar", err instanceof Error ? err.message : undefined);
    }
  };

  const openCreate = (parentId: string | null) => {
    setForm({ ...EMPTY_FORM, id: undefined, parentId: parentId ?? "", type: parentId ? "item" : "section" });
  };

  const openEdit = (node: MenuNode) => {
    setForm({
      id: node.id,
      type: node.type,
      label: node.label,
      icon: node.icon ?? "Circle",
      href: node.href ?? "",
      badge: node.badge ?? "",
      badgeVariant: node.badgeVariant ?? "default",
      permissionKey: node.permissionKey ?? "",
      parentId: node.parentId ?? "",
      sortOrder: node.sortOrder,
      isActive: node.isActive,
    });
  };

  const submit = async () => {
    if (!form) return;
    if (!form.label?.trim()) {
      swalError("El label es obligatorio");
      return;
    }
    try {
      const payload: MenuInput = {
        type: form.type,
        label: form.label,
        icon: form.icon || null,
        href: form.type === "item" ? form.href || null : null,
        badge: form.badge || null,
        badgeVariant: form.badge || null,
        permissionKey: form.permissionKey || null,
        parentId: form.parentId || null,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      if (form.id) {
        await menusApi.update(form.id, payload);
        swalToast("Menú actualizado");
      } else {
        await menusApi.create(payload);
        swalToast("Menú creado");
      }
      setForm(null);
      load();
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    }
  };

  const remove = async (node: MenuNode) => {
    const ok = await swalConfirm(
      "Eliminar menú",
      `¿Eliminar "${node.label}"? Los sub-items quedarán en la raíz.`,
      { danger: true }
    );
    if (!ok) return;
    try {
      await menusApi.remove(node.id);
      swalToast("Menú eliminado", "info");
      load();
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  const parentOptions = useMemo(() => {
    if (!menus) return [];
    return menus
      .filter((m) => m.type === "section" || m.type === "item")
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [menus]);

  const renderNode = (node: MenuNode, depth: number) => {
    const Icon = resolveMenuIcon(node.icon);
    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border p-2",
            !node.isActive && "opacity-50"
          )}
          style={{ marginLeft: depth * 16 }}
        >
          <div className="flex flex-col">
            <Button variant="ghost" size="icon-xs" onClick={() => move(node, -1)} aria-label="Subir">
              <ChevronUp className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => move(node, 1)} aria-label="Bajar">
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{node.label}</span>
              {node.type === "section" ? (
                <Badge variant="outline">Sección</Badge>
              ) : (
                <span className="truncate text-xs text-muted-foreground">{node.href}</span>
              )}
              {node.badge && <Badge variant="secondary">{node.badge}</Badge>}
              {node.permissionKey && (
                <span className="truncate text-[0.65rem] text-muted-foreground">
                  {node.permissionKey}
                </span>
              )}
            </div>
          </div>
          {node.type === "item" && (
            <Button variant="ghost" size="icon-xs" onClick={() => openCreate(node.id)} aria-label="Agregar sub-item">
              <Plus className="size-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={() => openEdit(node)} aria-label="Editar">
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => remove(node)} aria-label="Eliminar">
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
        {node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {!menus ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map((node) => renderNode(node, 0))}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar menú" : "Nuevo menú"}</DialogTitle>
            <DialogDescription>Configura el elemento de navegación</DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <select
                    className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "section" | "item" })}
                  >
                    <option value="item">Item</option>
                    <option value="section">Sección</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Menú padre</Label>
                  <select
                    className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                    value={form.parentId ?? ""}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  >
                    <option value="">— Raíz —</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.type === "section" ? "▸ " : "· "}
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ícono</Label>
                  <select
                    className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                    value={form.icon ?? "Circle"}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  >
                    {MENU_ICON_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  {(() => {
                    const PIcon = resolveMenuIcon(form.icon);
                    return <PIcon className="mb-1.5 size-6 text-muted-foreground" />;
                  })()}
                  <span className="mb-1.5 text-xs text-muted-foreground">Preview</span>
                </div>
              </div>

              {form.type === "item" && (
                <div className="space-y-1.5">
                  <Label>Ruta (href)</Label>
                  <Input
                    placeholder="/admin/products"
                    value={form.href ?? ""}
                    onChange={(e) => setForm({ ...form, href: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Badge (opcional)</Label>
                  <Input
                    placeholder="NEW"
                    value={form.badge ?? ""}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Badge variante</Label>
                  <select
                    className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                    value={form.badgeVariant ?? "default"}
                    onChange={(e) => setForm({ ...form, badgeVariant: e.target.value })}
                  >
                    {BADGE_VARIANTS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Permiso requerido</Label>
                <select
                  className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                  value={form.permissionKey ?? ""}
                  onChange={(e) => setForm({ ...form, permissionKey: e.target.value })}
                >
                  <option value="">— Visible para todos —</option>
                  {PERMISSIONS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.key} — {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <div>
                  <p className="text-sm font-medium">Activo</p>
                  <p className="text-xs text-muted-foreground">Visible en el menú</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => openCreate(null)}>
          <FolderPlus className="size-4" /> Agregar sección
        </Button>
        <Button onClick={() => openCreate(null)}>
          <Menu className="size-4" /> Agregar item raíz
        </Button>
      </div>
    </div>
  );
}
