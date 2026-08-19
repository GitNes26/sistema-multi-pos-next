"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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

// FASE 15.9 — Selector de organización activa (superAdmin y admins multi-empresa).
// Cambia `activeOrganizationId` vía update() de next-auth y refresca la sesión.

type OrgOption = { id: string; name: string; role?: string };

export interface OrgSwitcherProps {
  activeOrganizationId?: string | null;
  scope?: string | null;
}

export function OrgSwitcher({ activeOrganizationId, scope }: OrgSwitcherProps) {
  const router = useRouter();
  const { update } = useSession();
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

  const activeName = React.useMemo(() => {
    if (!orgs) return null;
    return orgs.find((o) => o.id === activeOrganizationId)?.name ?? null;
  }, [orgs, activeOrganizationId]);

  const switchOrg = async (orgId: string) => {
    if (orgId === activeOrganizationId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await update({ activeOrganizationId: orgId });
      setOpen(false);
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
          className="h-9 gap-2 px-2 text-sm font-medium data-[state=open]:bg-accent"
          aria-label="Cambiar de organización"
        >
          <Building2 className="size-4 text-muted-foreground" />
          <span className="hidden max-w-40 truncate sm:block">
            {activeName ?? (isSuperadmin ? "Sin organización" : "Organización")}
          </span>
          {switching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
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
                <span className="truncate">
                  {o.name}
                  {o.role ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      · {o.role}
                    </span>
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