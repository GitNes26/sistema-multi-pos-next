"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  FolderPlus,
  Link2,
  ListTree,
  Menu,
  Plus,
  Search,
  Tag,
  Trash2,
  Type,
  X,
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
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { TooltipButton } from "@/components/shared/tooltip-button";
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
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    menusApi
      .adminList()
      .then((d) => setMenus(d.menus))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const list = menus ?? [];
    return {
      total: list.length,
      sections: list.filter((m) => m.type === "section").length,
      items: list.filter((m) => m.type === "item").length,
      active: list.filter((m) => m.isActive).length,
    };
  }, [menus]);

  // Búsqueda: conserva la cadena de ancestros para mantener el contexto.
  const filteredList = useMemo(() => {
    const list = menus ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    const keep = new Set<string>();
    for (const m of list) {
      if (m.label.toLowerCase().includes(q) || (m.href ?? "").toLowerCase().includes(q)) keep.add(m.id);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of list) {
        if (m.parentId && keep.has(m.parentId) && !keep.has(m.id)) {
          keep.add(m.id);
          changed = true;
        }
      }
    }
    return list.filter((m) => keep.has(m.id));
  }, [menus, search]);

  const tree = useMemo(() => {
    if (filteredList.length === 0) return [];
    const byId = new Map(filteredList.map((m) => [m.id, { ...m, children: [] as MenuNode[] }]));
    const roots: MenuNode[] = [];
    for (const m of filteredList) {
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
  }, [filteredList]);

  const siblingsOf = (node: MenuNode): MenuNode[] => {
    if (!menus) return [];
    return menus
      .filter((m) => m.parentId === node.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const move = async (node: MenuNode, dir: -1 | 1) => {
    const siblings = siblingsOf(node);
    const idx = siblings.findIndex((s) => s.id === node.id);
    if (!siblings[idx + dir]) return;
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

  const openCreate = (parentId: string | null, type: "section" | "item") => {
    setForm({ ...EMPTY_FORM, id: undefined, parentId: parentId ?? "", type });
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
        badgeVariant: form.badgeVariant || null,
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
      if (form?.id === node.id) setForm(null);
      swalToast("Menú eliminado", "info");
      load();
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  const toggleActive = async (node: MenuNode) => {
    try {
      await menusApi.update(node.id, { isActive: !node.isActive, label: node.label });
      setForm((f) => (f && f.id === node.id ? { ...f, isActive: !node.isActive } : f));
      load();
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  // Padres válidos: se excluye el propio nodo y su subárbol (evita ciclos).
  const excludedIds = useMemo(() => {
    const list = menus ?? [];
    if (!form?.id) return new Set<string>();
    const set = new Set<string>();
    const walk = (id: string) => {
      if (set.has(id)) return;
      set.add(id);
      for (const m of list) if (m.parentId === id) walk(m.id);
    };
    walk(form.id);
    return set;
  }, [menus, form?.id]);

  const parentOptions = useMemo(() => {
    const list = menus ?? [];
    return list
      .filter((m) => !excludedIds.has(m.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [menus, excludedIds]);

  const toggleCollapse = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const renderNode = (node: MenuNode, depth: number) => {
    const Icon = resolveMenuIcon(node.icon);
    const selected = form?.id === node.id;
    const isCollapsed = !!collapsed[node.id];
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.id} className="space-y-1" style={{ marginLeft: depth * 14 }}>
        <div
          className={cn(
            "flex items-center gap-1 rounded-lg border bg-card p-1.5 transition-colors",
            selected ? "border-primary/70 ring-1 ring-primary/30" : "hover:bg-accent/50",
            !node.isActive && "opacity-60"
          )}
        >
          <button
            type="button"
            onClick={() => openEdit(node)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left"
          >
            {hasChildren ? (
              <span
                className="shrink-0 text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(node.id);
                }}
                aria-label={isCollapsed ? "Expandir" : "Colapsar"}
              >
                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
              </span>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{node.label}</span>
                {node.type === "section" && <Badge variant="outline">Sección</Badge>}
                {node.badge && <Badge>{node.badge}</Badge>}
              </span>
              {node.type === "item" && (
                <span className="block truncate text-xs text-muted-foreground">{node.href ?? "—"}</span>
              )}
              {node.permissionKey && (
                <span className="block truncate text-[0.65rem] text-muted-foreground/80">{node.permissionKey}</span>
              )}
            </span>
            {!node.isActive && <span className="size-1.5 shrink-0 rounded-full bg-destructive" title="Inactivo" />}
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            <TooltipButton label="Subir" variant="ghost" size="icon-xs" onClick={() => move(node, -1)}>
              <ChevronUp className="size-3.5" />
            </TooltipButton>
            <TooltipButton label="Bajar" variant="ghost" size="icon-xs" onClick={() => move(node, 1)}>
              <ChevronDown className="size-3.5" />
            </TooltipButton>
            {node.type === "item" && (
              <TooltipButton label="Agregar sub-item" variant="ghost" size="icon-xs" onClick={() => openCreate(node.id, "item")}>
                <Plus className="size-3.5" />
              </TooltipButton>
            )}
            <TooltipButton
              label={node.isActive ? "Desactivar" : "Activar"}
              variant="ghost"
              size="icon-xs"
              onClick={() => toggleActive(node)}
            >
              {node.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </TooltipButton>
            <TooltipButton label="Eliminar" variant="ghost" size="icon-xs" onClick={() => remove(node)}>
              <Trash2 className="size-3.5 text-destructive" />
            </TooltipButton>
          </div>
        </div>
        {hasChildren && !isCollapsed && (
          <div className="space-y-1">{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  const EditorPreviewIcon = resolveMenuIcon(form?.icon ?? "Circle");

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {/* Barra de acciones + búsqueda */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o ruta…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openCreate(null, "section")}>
            <FolderPlus className="size-4" /> Nueva sección
          </Button>
          <Button size="sm" onClick={() => openCreate(null, "item")}>
            <Plus className="size-4" /> Nuevo ítem
          </Button>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Elementos", value: stats.total },
          { label: "Secciones", value: stats.sections },
          { label: "Ítems", value: stats.items },
          { label: "Activos", value: stats.active },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Estructura + editor */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Estructura del menú</CardTitle>
            <CardAction>
              <Badge variant="secondary">{stats.total} elemento(s)</Badge>
            </CardAction>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {!menus ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : tree.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <ListTree className="size-8" />
                {search ? "Sin resultados para la búsqueda." : "Aún no hay elementos. Crea una sección o un ítem."}
              </div>
            ) : (
              <ScrollArea className="h-[560px] pr-3">
                <div className="space-y-2">{tree.map((node) => renderNode(node, 0))}</div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Panel de edición inline */}
        {form ? (
          <Card className="self-start lg:sticky lg:top-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <EditorPreviewIcon className="size-4 text-primary" />
                <CardTitle>{form.id ? "Editar elemento" : "Nuevo elemento"}</CardTitle>
              </div>
              <CardAction>
                <Button variant="ghost" size="icon-xs" onClick={() => setForm(null)} aria-label="Cerrar editor">
                  <X className="size-4" />
                </Button>
              </CardAction>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-3 pt-4">
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

              {/* Vista previa del elemento */}
              <div className="rounded-lg border bg-muted/40 p-2">
                <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                  Vista previa
                </p>
                <div className="flex items-center gap-2 rounded-md bg-card px-3 py-2 shadow-sm">
                  <EditorPreviewIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {form.label?.trim() || "Label"}
                  </span>
                  {form.badge && (
                    <Badge variant={(form.badgeVariant as "default") ?? "default"}>{form.badge}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
            <Separator />
            <div className="flex justify-end gap-2 px-4 py-3">
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button onClick={submit}>{form.id ? "Guardar cambios" : "Crear"}</Button>
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
            <Menu className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Selecciona un elemento del árbol para editarlo o crea uno nuevo.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openCreate(null, "section")}>
                <FolderPlus className="size-4" /> Nueva sección
              </Button>
              <Button size="sm" onClick={() => openCreate(null, "item")}>
                <Plus className="size-4" /> Nuevo ítem
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}