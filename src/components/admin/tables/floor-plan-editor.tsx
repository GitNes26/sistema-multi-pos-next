"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Loader2, MapPin, Minus, MousePointer2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";
import {
  NODE_KIND_OPTIONS,
  PLAN_NODE_META,
  PlanNodeElement,
  PlanTableElement,
  defaultSize,
  shapeClass,
  type PlanNode,
  type PlanTable,
} from "./plan-elements";

// Editor de plano estilo floorplan (imagen de referencia): lienzo con zoom,
// paleta de elementos para soltar mesas y nodos fijos (entrada/salida/baños/
// cocina…), arrastre con el puntero y edición de la mesa seleccionada. Cada
// acción guarda al momento (POST/PUT /api/tables y /api/tables/plan-nodes).

const CANVAS_W = 880;
const CANVAS_H = 560;
const STATUS_STYLE: Record<string, string> = {
  free: "border-emerald-400 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  occupied: "border-rose-400 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  reserved: "border-amber-400 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cleaning: "border-sky-400 bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

const SHAPES: { value: string; label: string }[] = [
  { value: "round", label: "Redonda" },
  { value: "square", label: "Cuadrada" },
  { value: "rectangle", label: "Rectangular" },
  { value: "booth", label: "Camarote" },
  { value: "bar", label: "Barra" },
];

type PaletteItem =
  | { type: "table"; shape: string; label: string }
  | { type: "node"; kind: string; label: string };

const PALETTE: PaletteItem[] = [
  { type: "table", shape: "round", label: "Mesa redonda" },
  { type: "table", shape: "square", label: "Mesa cuadrada" },
  { type: "table", shape: "rectangle", label: "Mesa rectangular" },
  { type: "table", shape: "booth", label: "Camarote" },
  { type: "table", shape: "bar", label: "Barra" },
  { type: "node", kind: "entrance", label: "Entrada" },
  { type: "node", kind: "exit", label: "Salida" },
  { type: "node", kind: "restroom", label: "Baños" },
  { type: "node", kind: "kitchen", label: "Cocina" },
  { type: "node", kind: "cashier", label: "Caja" },
];

interface FloorPlanEditorProps {
  tables: PlanTable[];
  nodes: PlanNode[];
  roomName: string | null;
  canManage: boolean;
  locationId: string | null;
  roomId: string | null;
  onChanged: () => void;
}

export function FloorPlanEditor({
  tables,
  nodes,
  roomName,
  canManage,
  locationId,
  roomId,
  onChanged,
}: FloorPlanEditorProps) {
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<{ kind: "table" | "node"; id: string } | null>(null);
  const [draft, setDraft] = useState<{ shape: string; capacity: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<{ kind: "table" | "node"; id: string; dx: number; dy: number } | null>(null);
  const dragRef = useRef<{ kind: "table" | "node"; id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedTable = selected?.kind === "table" ? tables.find((t) => t.id === selected.id) ?? null : null;
  const selectedNode = selected?.kind === "node" ? nodes.find((n) => n.id === selected.id) ?? null : null;

  const select = useCallback(
    (kind: "table" | "node", id: string) => {
      setSelected({ kind, id });
      if (kind === "table") {
        const t = tables.find((x) => x.id === id);
        if (t) setDraft({ shape: t.shape || "round", capacity: String(t.capacity), name: t.name ?? "" });
      } else {
        setDraft(null);
      }
    },
    [tables]
  );

  /** Coordenadas del lienzo a partir de un evento de puntero. */
  const canvasPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    return {
      x: Math.round((clientX - rect.left + (canvasRef.current?.scrollLeft ?? 0)) / zoom),
      y: Math.round((clientY - rect.top + (canvasRef.current?.scrollTop ?? 0)) / zoom),
    };
  };

  const patchTable = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/tables", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...data }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo guardar");
        onChanged();
      } catch (err) {
        swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
      }
    },
    [onChanged]
  );

  const createTable = useCallback(
    async (shape: string, x: number, y: number) => {
      // Número siguiente: máximo + 1 (el API rechaza duplicados).
      const nextNumber = tables.reduce((acc, t) => Math.max(acc, t.number), 0) + 1;
      const size = defaultSize(shape);
      try {
        const res = await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: nextNumber,
            capacity: shape === "bar" ? 3 : shape === "rectangle" || shape === "booth" ? 6 : 4,
            shape,
            width: size.width,
            height: size.height,
            posX: x,
            posY: y,
            locationId: locationId || undefined,
            roomId: roomId || undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo crear");
        swalToast(`Mesa #${nextNumber} agregada`);
        onChanged();
      } catch (err) {
        swalError("No se pudo crear la mesa", err instanceof Error ? err.message : undefined);
      }
    },
    [tables, locationId, roomId, onChanged]
  );

  const createNode = useCallback(
    async (kind: string, x: number, y: number) => {
      try {
        const res = await fetch("/api/tables/plan-nodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, posX: x, posY: y, locationId: locationId || null, roomId: roomId || null }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo crear");
        onChanged();
      } catch (err) {
        swalError("No se pudo crear el elemento", err instanceof Error ? err.message : undefined);
      }
    },
    [locationId, roomId, onChanged]
  );

  const saveSelected = async () => {
    if (!selectedTable || !draft || saving) return;
    setSaving(true);
    try {
      await patchTable(selectedTable.id, {
        shape: draft.shape,
        capacity: Number(draft.capacity) || 4,
        name: draft.name || null,
        width: defaultSize(draft.shape).width,
        height: defaultSize(draft.shape).height,
      });
      swalToast(`Mesa #${selectedTable.number} actualizada`);
      setSelected(null);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (selected.kind === "table") {
      if (!selectedTable) return;
      try {
        const res = await fetch(`/api/tables?id=${selectedTable.id}`, { method: "DELETE" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo eliminar");
        swalToast(`Mesa #${selectedTable.number} eliminada`);
        onChanged();
      } catch (err) {
        swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
      }
    } else {
      if (!selectedNode) return;
      try {
        const res = await fetch(`/api/tables/plan-nodes?id=${selectedNode.id}`, { method: "DELETE" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo eliminar");
        onChanged();
      } catch (err) {
        swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
      }
    }
    setSelected(null);
    setDraft(null);
  };

  const renameNode = async (node: PlanNode, label: string) => {
    try {
      const res = await fetch("/api/tables/plan-nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: node.id, label: label || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo guardar");
      onChanged();
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    }
  };

  // Arrastre con el puntero: mueve el elemento y guarda la posición al soltar.
  const onPointerDown = (e: React.PointerEvent, kind: "table" | "node", id: string) => {
    if (!canManage) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { kind, id, startX: e.clientX, startY: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    setDragging((prev) => ({
      kind: drag.kind,
      id: drag.id,
      dx: (prev?.id === drag.id ? prev.dx : 0) + dx,
      dy: (prev?.id === drag.id ? prev.dy : 0) + dy,
    }));
    drag.startX = e.clientX;
    drag.startY = e.clientY;
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !drag.moved) return;
    const offset = dragging;
    setDragging(null);
    if (!offset) return;
    const items = drag.kind === "table" ? tables : nodes;
    const item = items.find((i) => i.id === drag.id) as PlanTable | PlanNode | undefined;
    if (!item) return;
    const px = item.posX ?? 0;
    const py = item.posY ?? 0;
    const nx = Math.max(8, Math.min(CANVAS_W - 8, Math.round(px + offset.dx / zoom)));
    const ny = Math.max(8, Math.min(CANVAS_H - 8, Math.round(py + offset.dy / zoom)));
    if (drag.kind === "table") void patchTable(drag.id, { posX: nx, posY: ny });
    else
      void fetch("/api/tables/plan-nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: drag.id, posX: nx, posY: ny }),
      }).then(() => onChanged());
  };

  // Soltar un elemento de la paleta sobre el lienzo.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canManage) return;
    const payload = e.dataTransfer.getData("application/x-plan-item") as string;
    if (!payload) return;
    const { x, y } = canvasPoint(e.clientX, e.clientY);
    const item = PALETTE.find((p) => (p.type === "table" ? `table:${p.shape}` : `node:${p.kind}`) === payload);
    if (!item) return;
    if (item.type === "table") void createTable(item.shape, x, y);
    else void createNode(item.kind, x, y);
  };

  // Atajos: Supr elimina el elemento seleccionado.
  useEffect(() => {
    if (!canManage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selected && !draft) {
        e.preventDefault();
        void deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedTable, selectedNode, draft]);

  const posOf = (t: PlanTable, i: number) => {
    if (t.posX != null && t.posY != null) return { x: t.posX, y: t.posY };
    const { width } = defaultSize(t.shape);
    const col = i % 4;
    const row = Math.floor(i / 4);
    return { x: 60 + col * 180 - width / 2, y: 60 + row * 120 };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MapPin className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">{roomName ? `Plano · ${roomName}` : "Mesas sin sala"}</p>
        <Badge variant="outline" className="text-[10px]">
          {tables.length} {tables.length === 1 ? "mesa" : "mesas"} · {nodes.length} elementos
        </Badge>
        {tables.some((t) => t.status === "reserved") && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            <Clock className="size-3" /> con reservación
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} title="Alejar">
            <Minus className="size-3.5" />
          </Button>
          <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))} title="Acercar">
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border bg-muted/30 p-2">
          <span className="mr-1 inline-flex items-center gap-1 self-center text-[11px] font-semibold text-muted-foreground">
            <MousePointer2 className="size-3" /> Arrastra al plano:
          </span>
          {PALETTE.map((item) => {
            const key = item.type === "table" ? `table:${item.shape}` : `node:${item.kind}`;
            const meta = item.type === "node" ? PLAN_NODE_META[item.kind] : null;
            return (
              <div
                key={key}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("application/x-plan-item", key)}
                className="flex cursor-grab items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium shadow-sm transition hover:bg-primary/10 active:cursor-grabbing"
                title={`Arrastra «${item.label}» al plano`}
              >
                {item.type === "table" ? (
                  <span className={cn("inline-block size-2.5 border border-current", shapeClass(item.shape))} />
                ) : (
                  <span>{meta?.icon}</span>
                )}
                {item.label}
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={canvasRef}
        className={cn(
          "relative overflow-auto rounded-xl border bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)]",
          canManage && "drop-zone"
        )}
        style={{ height: CANVAS_H * 0.8 }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={(e) => canManage && e.preventDefault()}
        onDrop={onDrop}
      >
        <div
          className="relative origin-top-left"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${zoom})` }}
        >
          {tables.length === 0 && nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <p className="text-sm font-medium">Plano vacío</p>
              <p className="text-xs">
                {canManage ? "Arrastra mesas y elementos de la paleta para armar la sala." : "Aún no hay mesas en esta sala."}
              </p>
            </div>
          ) : (
            <>
              {tables.map((t, i) => {
                const { x, y } = posOf(t, i);
                const offset = dragging?.id === t.id ? { x: dragging.dx / zoom, y: dragging.dy / zoom } : { x: 0, y: 0 };
                return (
                  <PlanTableElement
                    key={t.id}
                    table={t}
                    x={x + offset.x}
                    y={y + offset.y}
                    className={STATUS_STYLE[t.status] ?? STATUS_STYLE.free}
                    label={`${t.capacity} pers.`}
                    selected={selected?.kind === "table" && selected.id === t.id}
                    disabled={!canManage}
                    onPointerDown={(e) => onPointerDown(e, "table", t.id)}
                    onClick={() => canManage && select("table", t.id)}
                  />
                );
              })}
              {nodes.map((n) => {
                const offset = dragging?.id === n.id ? { x: dragging.dx / zoom, y: dragging.dy / zoom } : { x: 0, y: 0 };
                return (
                  <PlanNodeElement
                    key={n.id}
                    node={n}
                    x={n.posX + offset.x}
                    y={n.posY + offset.y}
                    selected={selected?.kind === "node" && selected.id === n.id}
                    disabled={!canManage}
                    onPointerDown={(e) => onPointerDown(e, "node", n.id)}
                    onClick={() => canManage && select("node", n.id)}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Barra de edición del elemento seleccionado */}
      {selectedTable && draft && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Forma</label>
            <select
              value={draft.shape}
              onChange={(e) => setDraft({ ...draft, shape: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {SHAPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Capacidad</label>
            <input
              type="number"
              min={1}
              max={50}
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
              className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Nombre</label>
            <input
              value={draft.name}
              placeholder={`Mesa ${selectedTable.number}`}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={deleteSelected}>
              <Trash2 className="size-3.5" />
            </Button>
            <Button size="sm" onClick={saveSelected} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </div>
      )}

      {selectedNode && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Elemento</label>
            <p className="text-sm font-semibold">{PLAN_NODE_META[selectedNode.kind]?.label ?? "Zona"}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Etiqueta (opcional)</label>
            <input
              defaultValue={selectedNode.label ?? ""}
              placeholder={PLAN_NODE_META[selectedNode.kind]?.label}
              onBlur={(e) => e.target.value !== (selectedNode.label ?? "") && renameNode(selectedNode, e.target.value)}
              className="h-9 w-48 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={deleteSelected}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span>Arrastra para reubicar · clic para editar · Supr elimina el seleccionado.</span>
          <span className="ml-auto flex items-center gap-1">
            {NODE_KIND_OPTIONS.slice(0, 3).map((k) => (
              <span key={k.value}>{PLAN_NODE_META[k.value].icon} {k.label}</span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
