"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Link2,
  Menu,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Type,
} from "lucide-react";
import { menusApi } from "@/lib/menus/client";
import type { MenuNode, MenuInput } from "@/lib/menus/server";
import { MENU_ICON_NAMES, resolveMenuIcon } from "@/lib/menu-icons";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { TooltipButton } from "@/components/shared/tooltip-button";
import { DialogComponent } from "@/components/ui/dialog";
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
            <TooltipButton label="Subir" variant="ghost" size="icon-xs" onClick={() => move(node, -1)}>
              <ChevronUp className="size-3.5" />
            </TooltipButton>
            <TooltipButton label="Bajar" variant="ghost" size="icon-xs" onClick={() => move(node, 1)}>
              <ChevronDown className="size-3.5" />
            </TooltipButton>
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
            <TooltipButton label="Agregar sub-item" variant="ghost" size="icon-xs" onClick={() => openCreate(node.id)}>
              <Plus className="size-3.5" />
            </TooltipButton>
          )}
          <TooltipButton label="Editar" variant="ghost" size="icon-xs" onClick={() => openEdit(node)}>
            <Pencil className="size-3.5" />
          </TooltipButton>
          <TooltipButton label="Eliminar" variant="ghost" size="icon-xs" onClick={() => remove(node)}>
            <Trash2 className="size-3.5 text-destructive" />
          </TooltipButton>
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

      <DialogComponent
        open={form !== null}
        onOpenChange={(o) => !o && setForm(null)}
        icon={<Menu className="size-4 text-primary" />}
        title={form?.id ? "Editar menú" : "Nuevo menú"}
        description="Configura el elemento de navegación"
        className="sm:max-w-md"
        bodyClassName="space-y-3"
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Guardar</Button>
          </>
        }
      >
          {form && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormCombobox
                  label="Tipo"
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v as "section" | "item" })}
                  options={[
                    { value: "item", label: "Item" },
                    { value: "section", label: "Sección" },
                  ]}
                  searchable={false}
                  clearable={false}
                />
                <FormCombobox
                  label="Menú padre"
                  value={form.parentId ?? ""}
                  onChange={(v) => setForm({ ...form, parentId: v || null })}
                  options={[
                    { value: "", label: "— Raíz —" },
                    ...parentOptions.map((p) => ({
                      value: p.id,
                      label: `${p.type === "section" ? "▸ " : "· "}${p.label}`,
                    })),
                  ]}
                  clearable={false}
                />
              </div>

              <InputGroupField
                label="Label"
                helper="Nombre visible en el menú."
                leftIcon={<Type className="size-4" />}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormCombobox
                  label="Ícono"
                  value={form.icon ?? "Circle"}
                  onChange={(v) => setForm({ ...form, icon: v })}
                  options={MENU_ICON_NAMES.map((name) => ({ value: name, label: name }))}
                  clearable={false}
                />
                <div className="flex items-end gap-2">
                  {(() => {
                    const PIcon = resolveMenuIcon(form.icon);
                    return <PIcon className="mb-1.5 size-6 text-muted-foreground" />;
                  })()}
                  <span className="mb-1.5 text-xs text-muted-foreground">Preview</span>
                </div>
              </div>

              {form.type === "item" && (
                <InputGroupField
                  label="Ruta (href)"
                  placeholder="/admin/products"
                  leftIcon={<Link2 className="size-4" />}
                  value={form.href ?? ""}
                  onChange={(e) => setForm({ ...form, href: e.target.value })}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <InputGroupField
                  label="Badge (opcional)"
                  placeholder="NEW"
                  leftIcon={<Tag className="size-4" />}
                  value={form.badge ?? ""}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                />
                <FormCombobox
                  label="Badge variante"
                  value={form.badgeVariant ?? "default"}
                  onChange={(v) => setForm({ ...form, badgeVariant: v })}
                  options={BADGE_VARIANTS.map((b) => ({ value: b.value, label: b.label }))}
                  searchable={false}
                  clearable={false}
                />
              </div>

              <FormCombobox
                label="Permiso requerido"
                value={form.permissionKey ?? ""}
                onChange={(v) => setForm({ ...form, permissionKey: v || null })}
                options={[
                  { value: "", label: "— Visible para todos —" },
                  ...PERMISSIONS.map((p) => ({
                    value: p.key,
                    label: p.key,
                    meta: p.label,
                  })),
                ]}
                clearable={false}
              />

              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <label htmlFor="menu-active" className="cursor-pointer">
                  <span className="block text-sm font-medium">Activo</span>
                  <span className="block text-xs text-muted-foreground">Visible en el menú</span>
                </label>
                <Switch id="menu-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
            </div>
          )}
      </DialogComponent>

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
