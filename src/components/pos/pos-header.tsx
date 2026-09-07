"use client";

import { ArrowLeft, CalendarDays, CalendarRange, ClipboardList, LogOut, Sparkles, Unlock, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePosStore } from "@/stores/pos-store";
import { logout } from "@/lib/auth/logout";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { BusinessModeBadge } from "@/components/shared/business-mode-badge";
import { RoleBadge } from "@/components/shared/role-badge";
import type { BusinessMode } from "@/lib/auth/options";
import packageJson from "../../../package.json";

interface PosHeaderProps {
  /** true si la sesión puede abrir/cerrar caja (cash.open/cash.close). */
  canOperateCash?: boolean;
  /** true si la sesión ve la agenda (appointments.view): enlace a /agenda. */
  canViewAgenda?: boolean;
  /** true si la sesión ve reservaciones (reservations.view): enlace a /reservaciones. */
  canViewReservations?: boolean;
  /** Reabre la guía de roles del POS (solo modos food_service/hybrid). */
  onOpenGuide?: () => void;
  onOpenCatalogs: () => void;
  onOpenCash: () => void;
}

export function PosHeader({
  canOperateCash = false,
  canViewAgenda = false,
  canViewReservations = false,
  onOpenGuide,
  onOpenCatalogs,
  onOpenCash,
}: PosHeaderProps) {
  const session = usePosStore((s) => s.session);
  const cashier = usePosStore((s) => s.cashier);
  const location = usePosStore((s) => s.location);
  const company = usePosStore((s) => s.company);
  const logoUrl = company?.logoUrl ?? null;

  // Contexto de la organización activa (misma fuente que el OrgSwitcher):
  // al cambiar de org la sesión se actualiza y el encabezado refleja el cambio.
  const sessionUser = useSession().data?.user as
    | {
        organizationName?: string | null;
        businessMode?: BusinessMode;
        roleName?: string | null;
        role?: string | null;
      }
    | undefined;
  const orgName = sessionUser?.organizationName ?? company?.name ?? null;
  const orgMode = sessionUser?.businessMode ?? null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/80 px-3 backdrop-blur lg:px-4">
      <Button variant="ghost" size="icon" asChild className="shrink-0" aria-label="Volver al panel">
        <Link href="/admin">
          <ArrowLeft className="size-5" />
        </Link>
      </Button>
      <Logo logoUrl={logoUrl} className="h-8 w-auto" />
      <div className="hidden min-w-0 sm:block">
        <p className="text-sm font-bold leading-tight">Punto de venta</p>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">
          {orgName ? `${orgName} · ` : ""}
          {location.name} · {cashier.name || "Cajero"}
        </p>
      </div>
      {orgMode ? (
        <BusinessModeBadge
          mode={orgMode}
          className="hidden shrink-0 sm:inline-flex"
          labelClassName="hidden lg:inline"
        />
      ) : null}
      <RoleBadge
        roleName={sessionUser?.roleName}
        role={sessionUser?.role}
        className="hidden sm:inline-flex"
      />
      <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">v{packageJson.version}</span>

      <div className="ml-auto flex items-center gap-1.5">
        {canOperateCash && (
        <button
          type="button"
          onClick={onOpenCash}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:bg-muted",
            session && session.status === "open"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          )}
          title="Abrir / cerrar caja"
        >
          {session && session.status === "open" ? (
            <>
              <Unlock className="size-3.5" />
              <span className="hidden md:inline">
                {session.registerName} · fondo {money(session.openingCash)}
              </span>
              <span className="md:hidden">Caja abierta</span>
            </>
          ) : (
            <>
              <LockKeyhole className="size-3.5" />
              <span className="hidden md:inline">Caja cerrada — abrir</span>
              <span className="md:hidden">Caja</span>
            </>
          )}
        </button>
        )}

        {canViewAgenda && (
          <Button variant="ghost" size="icon" asChild aria-label="Agenda de citas">
            <Link href="/agenda">
              <CalendarDays className="size-4" />
            </Link>
          </Button>
        )}
        {canViewReservations && (
          <Button variant="ghost" size="icon" asChild aria-label="Reservaciones">
            <Link href="/reservaciones">
              <CalendarRange className="size-4" />
            </Link>
          </Button>
        )}

        {onOpenGuide && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenGuide}
            title="Guía del POS"
            aria-label="Guía del POS"
            className="text-muted-foreground"
          >
            <Sparkles className="size-4" />
            <span className="hidden md:inline">Guía</span>
          </Button>
        )}

        <Button variant="ghost" size="icon" onClick={onOpenCatalogs} aria-label="Catálogos y pedidos">
          <ClipboardList className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          className="text-muted-foreground"
        >
          <LogOut className="size-4" />
          <span className="hidden md:inline">Salir</span>
        </Button>
      </div>
    </header>
  );
}