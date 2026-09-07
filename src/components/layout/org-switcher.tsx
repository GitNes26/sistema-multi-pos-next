"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { swalError } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { businessModeInfo } from "@/lib/business-modes";
import { BusinessModeBadge, BusinessModeDot } from "@/components/shared/business-mode-badge";
import type { BusinessMode } from "@/lib/auth/options";

// FASE 15.9 — Selector de organización activa.
// SuperAdmin: siempre visible (elige empresa o indica "Sin organización").
// Resto de sesiones de app (owner/manager/admin con membresías en varias
// organizaciones): solo se muestra cuando hay más de una organización para
// cambiar, y cambia `activeOrganizationId` vía update() de next-auth.
// El disparador muestra el nombre + badge del modo de la org activa y cada
// fila lleva el punto del color de su modo, para que el usuario multi-org
// sepa siempre dónde está (también en el POS, que lee la misma sesión).

type OrgOption = {
  id: string;
  name: string;
  businessMode?: BusinessMode;
  role?: string;
  currency?: string;
};

export interface OrgSwitcherProps {
  activeOrganizationId?: string | null;
  scope?: string | null;
  /** "header" = fila superior (nombre oculto en pantallas < sm).
   *  "sidebar" = dentro del drawer/sidebar: ocupa el ancho y muestra siempre
   *  nombre + chevron (ya es una superficie ancha). */
  variant?: "header" | "sidebar";
  /** Aviso tras cambiar la org activa con éxito (p. ej. cerrar el drawer). */
  onSwitched?: () => void;
}

export function OrgSwitcher({
  activeOrganizationId,
  scope,
  variant = "header",
  onSwitched,
}: OrgSwitcherProps) {
  const router = useRouter();
  const { data: sessionData, update } = useSession();
  const [orgs, setOrgs] = React.useState<OrgOption[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);

  const isSuperadmin = scope === "superadmin";

  React.useEffect(() => {
    let active = true;
    fetch("/api/settings/organizations/mine", {
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { organizations?: OrgOption[] } | null) => {
        if (active) setOrgs(data?.organizations ?? []);
      })
      .catch(() => {
        if (active) setOrgs([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeOption = React.useMemo(
    () => orgs?.find((o) => o.id === activeOrganizationId) ?? null,
    [orgs, activeOrganizationId]
  );
  const activeName = activeOption?.name ?? null;
  const activeCurrency = activeOption?.currency ?? null;
  // Modo de la org activa: preferir el dato fresco de la lista; si aún no
  // cargó, el de la sesión (que el servidor refresca al cambiar de org).
  const sessionMode = (sessionData?.user as { businessMode?: BusinessMode } | undefined)
    ?.businessMode;
  const activeOrgMode: BusinessMode | null =
    activeOption?.businessMode ??
    (activeOrganizationId ? (sessionMode ?? null) : null);

  // Sin datos todavía (orgs === null): los usuarios de app esperan a saber si
  // tienen más de una organización; el superAdmin siempre ve el selector.
  const hasMultipleOrgs = orgs !== null && orgs.length > 1;
  if (!isSuperadmin && !hasMultipleOrgs) return null;

  const switchOrg = async (orgId: string) => {
    if (orgId === activeOrganizationId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await update({ activeOrganizationId: orgId });
      setOpen(false);
      // Cerrar antes del refresh: el contexto de navegación cambia debajo
      // (secciones por modo) y el drawer no debe quedarse abierto encima.
      onSwitched?.();
      router.refresh();
    } catch {
      swalError("No se pudo cambiar de organización");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-9 gap-2 px-2 text-sm font-medium data-[state=open]:bg-accent",
            variant === "sidebar" && "w-full justify-between"
          )}
          aria-label="Cambiar de organización"
          title={
            activeName
              ? `${activeName}${activeOrgMode ? ` · ${businessModeInfo(activeOrgMode).label}` : ""}${activeCurrency ? ` · ${activeCurrency}` : ""}`
              : "Cambiar de organización"
          }
        >
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span
            className={
              variant === "sidebar"
                ? "block min-w-0 flex-1 truncate text-left"
                : "hidden min-w-0 max-w-40 truncate sm:block"
            }
          >
            {activeName ?? (isSuperadmin ? "Sin organización" : "Organización")}
          </span>
          {activeOrgMode ? (
            <BusinessModeBadge
              mode={activeOrgMode}
              className={
                variant === "sidebar"
                  ? "inline-flex shrink-0"
                  : "hidden shrink-0 sm:inline-flex"
              }
              labelClassName="hidden max-w-28 lg:inline"
            />
          ) : null}
          {switching ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown
              className={
                variant === "sidebar"
                  ? "size-3.5 shrink-0 text-muted-foreground"
                  : "hidden size-3.5 shrink-0 text-muted-foreground sm:block"
              }
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="w-64">
        <DropdownMenuLabel>
          {isSuperadmin ? "Empresas registradas" : "Mis organizaciones"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!orgs ? (
          <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Cargando…
          </div>
        ) : orgs.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            No hay organizaciones disponibles.
          </div>
        ) : (
          <DropdownMenuGroup className="max-h-72 overflow-y-auto">
            {orgs.map((o) => (
              <DropdownMenuItem
                key={o.id}
                onSelect={() => void switchOrg(o.id)}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {o.businessMode ? (
                    <BusinessModeDot mode={o.businessMode} className="shrink-0" />
                  ) : null}
                  <span className="truncate">
                    {o.name}
                    {o.role ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        · {o.role}
                      </span>
                    ) : null}
                  </span>
                  {o.currency ? (
                    <Badge
                      variant="secondary"
                      className="shrink-0 px-1.5 py-0 text-[10px] font-semibold"
                    >
                      {o.currency}
                    </Badge>
                  ) : null}
                </span>
                {o.id === activeOrganizationId && <Check className="size-4 shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}