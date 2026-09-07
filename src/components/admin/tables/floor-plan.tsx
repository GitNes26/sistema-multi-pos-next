"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

// Editor visual del plano de una sala: cada mesa se dibuja con su forma y
// tamaño reales (round/square/rectangle/booth/bar), se arrastra con el puntero
// para reposicionarla (PATCH posX/posY) y al seleccionarla se editan forma,
// capacidad y nombre. Mismo modelo que el POS: lo que se ve aquí es lo que
// ven meseros y clientes al elegir mesa.

export interface PlanTable {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  shape: string;
  width: number | null;
  height: number | null;
  posX: number | null;
  posY: number | null;
  status: string;
}

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

/** Tamaño por defecto según la forma (px del lienzo). */
function defaultSize(shape: string): { width: number; height: number } {
  if (shape === "rectangle" || shape === "booth") return { width: 140, height: 76 };
  if (shape === "bar") return { width: 168, height: 56 };
  if (shape === "square") return { width: 84, height: 84 };
  return { width: 84, height: 84 }; // round
}

const CANVAS_W = 880;
const CANVAS_H = 560;

function shapeClass(shape: string) {
  if (shape === "round") return "rounded-full";
  if (shape === "bar") return "rounded-full";
  if (shape === "booth") return "rounded-xl border-b-4";
  return "rounded-lg";
}

export function FloorPlan({
  tables,
  roomName,
  canManage,
  onChanged,
}: {
  tables: PlanTable[];
  roomName: string | null;
  canManage: boolean;
  /** Se llama tras cualquier PATCH para que el padre refresque. */
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<PlanTable | null>(null);
  const [draft, setDraft] = useState<{ shape: string; capacity: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);

  /** Posición efectiva: la sembrada o un acomodo automático si no existe. */
  const posOf = (t: PlanTable, i: number) => {
    if (t.posX != null && t.posY != null) return { x: t.posX, y: t.posY };
    const { width, height } = defaultSize(t.shape);
    const cols = 4;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { x: 40 + col * ((CANVAS_W - 80) / Math.max(1, cols - 1)) - width / 2, y: 40 + row * 110 };
  };

  const select = (t: PlanTable) => {
    setSelected(t);
    setDraft({ shape: t.shape || "round", capacity: String(t.capacity), name: t.name ?? "" });
  };

  const patch = useCallback(
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

  // Guardar forma/capacidad/nombre de la mesa seleccionada.
  const saveSelected = async () => {
    if (!selected || !draft || saving) return;
    setSaving(true);
    try {
      await patch(selected.id, {
        shape: draft.shape,
        capacity: Number(draft.capacity) || 4,
        name: draft.name || null,
        width: defaultSize(draft.shape).width,
        height: defaultSize(draft.shape).height,
      });
      swalToast(`Mesa #${selected.number} actualizada`);
      setSelected(null);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  // Arrastre con el puntero: mueve la mesa en el lienzo y guarda al soltar.
  const onPointerDown = (e: React.PointerEvent, t: PlanTable) => {
    if (!canManage) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: t.id, startX: e.clientX, startY: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    setDragging((prev) => ({
      id: drag.id,
      dx: (prev?.id === drag.id ? prev.dx : 0) + dx,
      dy: (prev?.id === drag.id ? prev.dy : 0) + dy,
    }));
    drag.startX = e.clientX;
    drag.startY = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !drag.moved) return;
    const t = tables.find((x) => x.id === drag.id);
    if (!t) return;
    const { x, y } = posOf(t, 0);
    const nx = Math.max(8, Math.min(CANVAS_W - 8, Math.round(x + (dragging?.dx ?? 0))));
    const ny = Math.max(8, Math.min(CANVAS_H - 8, Math.round(y + (dragging?.dy ?? 0))));
    setDragging(null);
    void patch(drag.id, { posX: nx, posY: ny });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">
          {roomName ? `Plano · ${roomName}` : "Mesas sin sala"}
        </p>
        <Badge variant="outline" className="text-[10px]">
          {tables.length} {tables.length === 1 ? "mesa" : "mesas"}
        </Badge>
        {canManage && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Arrastra para reubicar · clic para editar
          </span>
        )}
      </div>

      <div
        className="relative overflow-auto rounded-xl border bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px]"
        style={{ height: CANVAS_H }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {tables.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin mesas en esta sala — asígnalas desde la vista de lista.
          </p>
        ) : (
          tables.map((t, i) => {
            const { x, y } = posOf(t, i);
            const size = defaultSize(t.shape);
            const w = t.width ?? size.width;
            const h = t.height ?? size.height;
            const offset = dragging?.id === t.id ? { x: dragging.dx, y: dragging.dy } : { x: 0, y: 0 };
            const isSelected = selected?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!canManage}
                onClick={() => canManage && select(t)}
                onPointerDown={(e) => onPointerDown(e, t)}
                className={cn(
                  "absolute flex touch-none select-none flex-col items-center justify-center border-2 text-center shadow-sm transition-[box-shadow]",
                  shapeClass(t.shape),
                  STATUS_STYLE[t.status] ?? STATUS_STYLE.free,
                  isSelected && "z-10 ring-2 ring-primary",
                  dragging?.id === t.id && "cursor-grabbing shadow-lg"
                )}
                style={{
                  left: x + offset.x,
                  top: y + offset.y,
                  width: w,
                  height: h,
                  transform: `translate(-50%, -50%)`,
                }}
                title={`Mesa ${t.number} · ${t.capacity} pers. · ${t.status}`}
              >
                <span className="text-sm font-bold leading-none">{t.number}</span>
                <span className="text-[9px] leading-tight opacity-80">{t.capacity} pers.</span>
              </button>
            );
          })
        )}
      </div>

      {/* Barra de edición de la mesa seleccionada */}
      {selected && draft && (
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
              placeholder={`Mesa ${selected.number}`}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={saveSelected} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}