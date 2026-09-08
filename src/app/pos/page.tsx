import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { MapPin } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/db/app-settings";
import { getPosCatalog, PosError } from "@/lib/pos/server";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { Splash } from "@/components/appearance/splash";
import { PosApp } from "@/components/pos/pos-app";

export const metadata: Metadata = { title: "Punto de venta" };

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.activeOrganizationId ?? session?.user?.organizationId ?? null;
  const tenant = organizationId ? await getAppSettings(organizationId) : null;

  if (!organizationId) {
    // SuperAdmin sin organización → ir a seleccionar org
    if (session?.user?.scope === "superadmin") {
      redirect("/admin/settings/organizations");
    }
    redirect("/auth/login?callbackUrl=/pos");
  }

  // Roles sin pos.use (cocina, repartidor) no operan el punto de venta;
  // se redirige a su superficie natural (KDS) — mismo criterio que el API.
  if (!hasPermission(session, "pos.use")) {
    redirect("/kds");
  }

  let catalog: Awaited<ReturnType<typeof getPosCatalog>>;
  try {
    catalog = await getPosCatalog(organizationId, session!.user.id);
  } catch (err) {
    if (err instanceof PosError) {
      return (
        <>
          <AppearanceSync tenant={tenant} />
          <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="size-7" />
            </span>
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{err.message}</h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Tu organización aún no tiene sucursales activas. Crea una para poder operar el
                punto de venta.
              </p>
            </div>
            <Link
              href="/admin/locations"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <MapPin className="size-4" /> Ir a sucursales
            </Link>
          </div>
        </>
      );
    }
    throw err;
  }

  // RBAC cliente: solo quien puede abrir/cerrar caja ve el control de caja
  // (el servidor sigue exigiendo cash.open/cash.close en /api/pos/cash).
  const canOperateCash =
    !!session?.user &&
    (hasPermission(session, "cash.open") || hasPermission(session, "cash.close"));
  // La agenda (services/hybrid) y las reservaciones (rental/hybrid) se enlazan
  // solo si el modo aplica y la sesión tiene el permiso correspondiente.
  const orgMode = organizationId
    ? await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { businessMode: true, name: true, companyProfile: { select: { tradeName: true } } },
      })
    : null;
  const canViewAgenda =
    !!session?.user &&
    hasPermission(session, "appointments.view") &&
    (orgMode?.businessMode === "services" || orgMode?.businessMode === "hybrid");
  const canViewReservations =
    !!session?.user &&
    hasPermission(session, "reservations.view") &&
    (orgMode?.businessMode === "rental" || orgMode?.businessMode === "hybrid");

  return (
    <>
      <AppearanceSync tenant={tenant} />
      <Splash
        orgName={orgMode?.companyProfile?.tradeName ?? orgMode?.name ?? null}
      />
      <PosApp
        catalog={catalog}
        canOperateCash={canOperateCash}
        canViewAgenda={canViewAgenda}
        canViewReservations={canViewReservations}
        orgMode={orgMode?.businessMode}
      />
    </>
  );
}
