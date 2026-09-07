import {
  Bike,
  BriefcaseBusiness,
  Calculator,
  ChefHat,
  Crown,
  Headset,
  Shield,
  ShieldCheck,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Etiquetas por rol efectivo (fallback cuando la membresía no apunta a un rol
// concreto). Coinciden con el rol efectivo de la app (superadmin/owner/admin…).
export const COARSE_ROLE_LABELS: Record<string, string> = {
  superadmin: "Super admin",
  admin: "Admin",
  owner: "Propietario",
  manager: "Gerente",
  cashier: "Cajero",
  customer: "Cliente",
};

type RoleVisual = {
  icon: typeof UserRound;
  /** Fondo/color del icono (círculo tintado). */
  accent: string;
};

const ROLE_VISUALS: Record<string, RoleVisual> = {
  // Roles de sistema por modo de negocio (Role.name) — claves en español,
  // porque es el nombre legible que llega desde la BD.
  Propietario: { icon: Crown, accent: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  Gerente: { icon: BriefcaseBusiness, accent: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  Cajero: { icon: Calculator, accent: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
  Mesero: { icon: UtensilsCrossed, accent: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  "Cocina (KDS)": { icon: ChefHat, accent: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  Cocina: { icon: ChefHat, accent: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  Repartidor: { icon: Bike, accent: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  "Agente de atención": { icon: Headset, accent: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  "Agente de renta": { icon: Headset, accent: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  Admin: { icon: Shield, accent: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  "Super admin": { icon: ShieldCheck, accent: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
};

// Fallback por rol efectivo (cuando no hay Role.name resuelto).
const COARSE_VISUALS: Record<string, RoleVisual> = {
  owner: { icon: Crown, accent: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  manager: { icon: BriefcaseBusiness, accent: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  cashier: { icon: Calculator, accent: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
  superadmin: { icon: ShieldCheck, accent: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  admin: { icon: Shield, accent: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  customer: { icon: UserRound, accent: "bg-muted text-muted-foreground" },
};

function roleVisual(key: string | null | undefined): RoleVisual {
  if (key) return ROLE_VISUALS[key] ?? COARSE_VISUALS[key] ?? COARSE_VISUALS.customer;
  return COARSE_VISUALS.customer;
}

/**
 * Píldora del rol resuelto para encabezados: icono tintado + nombre del rol de
 * sistema ("Mesero", "Cocina (KDS)", "Repartidor"…) con su etiqueta completa en
 * el tooltip. Sin Role.name (roleName), cae al nombre del rol efectivo.
 */
export function RoleBadge({
  roleName,
  role,
  className,
}: {
  /** Nombre legible del rol resuelto (Role.name de la membresía). */
  roleName?: string | null;
  /** Rol efectivo (AppRole | "superadmin") para icono/fallback. */
  role?: string | null;
  className?: string;
}) {
  const label =
    roleName?.trim() ||
    COARSE_ROLE_LABELS[role ?? ""] ||
    role ||
    null;
  if (!label) return null;
  const visual = roleVisual(roleName ?? role);
  const Icon = visual.icon;
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-muted py-0.5 pl-1 pr-2 text-[11px] font-medium text-muted-foreground",
        className
      )}
      title={label}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full",
          visual.accent
        )}
      >
        <Icon className="size-2.5" strokeWidth={3} />
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
