import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { MapPin } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
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

  return (
    <>
      <AppearanceSync tenant={tenant} />
      <Splash />
      <PosApp catalog={catalog} />
    </>
  );
}
