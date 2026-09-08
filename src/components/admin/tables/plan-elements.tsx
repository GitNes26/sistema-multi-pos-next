"use client";

import { cn } from "@/lib/utils";

// Elemento del plano de sala: mesa o nodo fijo (entrada/salida/baños/cocina…).
// Lo comparten el editor (admin) y los planos de lectura (monitoreo/POS).

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

export interface PlanNode {
  id: string;
  kind: string;
  label: string | null;
  roomId: string | null;
  posX: number;
  posY: number;
}

export const PLAN_NODE_META: Record<
  string,
  { label: string; icon: string; shape: string }
> = {
  entrance: { label: "Entrada", icon: "🚪", shape: "rounded-lg" },
  exit: { label: "Salida", icon: "🚪", shape: "rounded-lg" },
  restroom: { label: "Baños", icon: "🚻", shape: "rounded-lg" },
  kitchen: { label: "Cocina", icon: "🍽️", shape: "rounded-lg" },
  bar_station: { label: "Estación", icon: "🍸", shape: "rounded-lg" },
  cashier: { label: "Caja", icon: "🧾", shape: "rounded-lg" },
  other: { label: "Zona", icon: "📍", shape: "rounded-lg" },
};

export const NODE_KIND_OPTIONS = [
  { value: "entrance", label: "Entrada" },
  { value: "exit", label: "Salida" },
  { value: "restroom", label: "Baños" },
  { value: "kitchen", label: "Cocina" },
  { value: "bar_station", label: "Estación de servicio" },
  { value: "cashier", label: "Caja" },
  { value: "other", label: "Otra zona" },
];

export function shapeClass(shape: string) {
  if (shape === "round" || shape === "bar") return "rounded-full";
  if (shape === "booth") return "rounded-xl border-b-4";
  return "rounded-lg";
}

/** Tamaño por defecto según la forma (px del lienzo). */
export function defaultSize(shape: string): { width: number; height: number } {
  if (shape === "rectangle" || shape === "booth") return { width: 140, height: 76 };
  if (shape === "bar") return { width: 168, height: 56 };
  return { width: 84, height: 84 };
}

/** Mesa del plano (estado libre/ocupada/reservada/limpieza). */
export function PlanTableElement({
  table,
  x,
  y,
  label,
  badge,
  className,
  selected,
  onPointerDown,
  onClick,
  disabled,
}: {
  table: PlanTable;
  x: number;
  y: number;
  /** Texto secundario opcional bajo el número (p. ej. hora de llegada). */
  label?: string | null;
  badge?: string | null;
  className?: string;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const size = defaultSize(table.shape);
  const w = table.width ?? size.width;
  const h = table.height ?? size.height;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute flex touch-none select-none flex-col items-center justify-center border-2 text-center shadow-sm transition-[box-shadow]",
        shapeClass(table.shape),
        selected && "z-10 ring-2 ring-primary",
        className
      )}
      style={{ left: x, top: y, width: w, height: h, transform: "translate(-50%, -50%)" }}
      title={`Mesa ${table.number} · ${table.capacity} pers.${label ? ` · ${label}` : ""}`}
    >
      <span className="text-sm font-bold leading-none">{table.number}</span>
      {badge && (
        <span className="mt-0.5 whitespace-nowrap rounded-full bg-black/10 px-1.5 py-px text-[9px] font-semibold leading-tight">
          {badge}
        </span>
      )}
      {label && !badge && <span className="text-[9px] leading-tight opacity-80">{label}</span>}
    </button>
  );
}

/** Nodo fijo del plano (no es mesa): dibujo compacto con su icono. */
export function PlanNodeElement({
  node,
  x,
  y,
  className,
  selected,
  onPointerDown,
  onClick,
  disabled,
}: {
  node: PlanNode;
  x: number;
  y: number;
  className?: string;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const meta = PLAN_NODE_META[node.kind] ?? PLAN_NODE_META.other;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute flex touch-none select-none flex-col items-center justify-center border-2 border-dashed border-slate-400/80 bg-slate-200/80 text-slate-700 shadow-sm backdrop-blur-[1px] transition-[box-shadow] dark:border-slate-500/70 dark:bg-slate-700/60 dark:text-slate-200",
        meta.shape,
        selected && "z-10 ring-2 ring-primary",
        className
      )}
      style={{ left: x, top: y, width: 64, height: 48, transform: "translate(-50%, -50%)" }}
      title={node.label ? `${meta.label} · ${node.label}` : meta.label}
    >
      <span className="text-sm leading-none">{meta.icon}</span>
      <span className="max-w-full truncate px-1 text-[9px] font-semibold leading-tight">
        {node.label || meta.label}
      </span>
    </button>
  );
}
