"use client";

import { ArrowLeft, ClipboardList, LogOut, Unlock, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { usePosStore } from "@/stores/pos-store";
import { logout } from "@/lib/auth/logout";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import packageJson from "../../../package.json";

interface PosHeaderProps {
  onOpenCatalogs: () => void;
  onOpenCash: () => void;
}

export function PosHeader({ onOpenCatalogs, onOpenCash }: PosHeaderProps) {
  const session = usePosStore((s) => s.session);
  const cashier = usePosStore((s) => s.cashier);
  const location = usePosStore((s) => s.location);
  const logoUrl = usePosStore((s) => s.company?.logoUrl ?? null);

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
          {location.name} · {cashier.name || "Cajero"}
        </p>
      </div>
      <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">v{packageJson.version}</span>

      <div className="ml-auto flex items-center gap-1.5">
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