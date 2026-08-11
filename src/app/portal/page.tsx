import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getAppSettings } from "@/lib/db/app-settings";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { Splash } from "@/components/appearance/splash";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Store } from "lucide-react";

export const metadata: Metadata = { title: "Portal de clientes" };

export default async function PortalPage() {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.organizationId ?? null;
  const tenant = organizationId ? await getAppSettings(organizationId) : null;

  return (
    <>
      <AppearanceSync tenant={tenant} />
      <Splash />
      <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Store className="size-7" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Hola, {session?.user?.name ?? "cliente"}</h1>
          <p className="text-sm text-muted-foreground">
            Tu portal de pedidos estará listo en la FASE 13.
          </p>
        </div>
        <SignOutButton />
      </main>
    </>
  );
}