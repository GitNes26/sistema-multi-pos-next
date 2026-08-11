import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getAppSettings } from "@/lib/db/app-settings";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { Splash } from "@/components/appearance/splash";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScanBarcode } from "lucide-react";

export const metadata: Metadata = { title: "Punto de venta" };

export default async function PosPage() {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.organizationId ?? null;
  const tenant = organizationId ? await getAppSettings(organizationId) : null;

  return (
    <>
      <AppearanceSync tenant={tenant} />
      <Splash />
      <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ScanBarcode className="size-7" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Punto de venta</h1>
          <p className="text-sm text-muted-foreground">
            Bienvenido, {session?.user?.name ?? "cajero"}. El POS se implementa en la FASE 6.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">Panel admin</Link>
          </Button>
          <SignOutButton />
        </div>
      </main>
    </>
  );
}