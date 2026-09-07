import { cn } from "@/lib/utils";
import { businessModeInfo } from "@/lib/business-modes";
import type { BusinessMode } from "@/lib/auth/options";

// Badge/modo de negocio compartido (encabezados, switcher, listas).
// Visual coherente con los ModeDot/ModeBadge del gestor de organizaciones:
// punto con el gradiente del modo + etiqueta, tooltip con la descripción.

export function BusinessModeDot({
  mode,
  className,
}: {
  mode: BusinessMode;
  className?: string;
}) {
  const info = businessModeInfo(mode);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full bg-gradient-to-br",
        info.gradient,
        className
      )}
    />
  );
}

export function BusinessModeBadge({
  mode,
  className,
  showLabel = true,
  labelClassName,
}: {
  mode: BusinessMode;
  className?: string;
  /** false = solo el punto (espacios reducidos). */
  showLabel?: boolean;
  /** Clases extra para la etiqueta (p. ej. ocultarla hasta cierto breakpoint). */
  labelClassName?: string;
}) {
  const info = businessModeInfo(mode);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted py-0.5 text-[11px] font-medium text-muted-foreground",
        showLabel ? "px-2" : "px-1.5",
        className
      )}
      title={`${info.label} — ${info.description}`}
    >
      <BusinessModeDot mode={mode} />
      {showLabel ? (
        <span className={cn("truncate", labelClassName)}>{info.label}</span>
      ) : null}
    </span>
  );
}
