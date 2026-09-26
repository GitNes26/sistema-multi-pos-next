import type { Metadata } from "next";
import { Suspense } from "react";
import { GuestReservation } from "@/components/portal/guest-reservation";
import { Spinner } from "@/components/base/spinner";

export const metadata: Metadata = { title: "Reservar mesa" };

// Página PÚBLICA de reservación sin cuenta: nombre y teléfono bastan. La
// organización se resuelve desde ?org= (id de la empresa) o desde el QR de
// mesa (?table=&token=), igual que el menú digital. Vive fuera de /portal
// para que el middleware no exija sesión de cliente.

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; table?: string; token?: string }>;
}) {
  const params = await searchParams;
  const orgId = typeof params.org === "string" ? params.org : undefined;
  const tableId = typeof params.table === "string" ? params.table : undefined;
  const tableToken = typeof params.token === "string" ? params.token : undefined;

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-background/85 supports-backdrop-filter:backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Reservar mesa
          </h1>
          <p className="text-sm text-muted-foreground">
            Sin cuenta: solo necesitas tu nombre y teléfono. Elige fecha, hora y
            comensales, y pide tu mesa desde el plano del local.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-5">
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          }
        >
          <GuestReservation orgId={orgId} tableId={tableId} tableToken={tableToken} />
        </Suspense>
      </div>
    </main>
  );
}