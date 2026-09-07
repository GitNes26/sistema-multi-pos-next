import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ReservationBooking } from "@/components/portal/reservation-booking";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = { title: "Reservar mesa" };

export default async function PortalReservationsPage() {
  const session = await getServerSession(authOptions);
  const orgId = session?.user?.organizationId ?? null;

  return (
    <div className="pb-24">
      <div className="p-4 pb-2">
        <h1 className="text-lg font-bold">Reservar mesa</h1>
        <p className="text-sm text-muted-foreground">
          Elige fecha, hora y comensales, y pide tu mesa desde el plano del local.
        </p>
        {orgId && (
          <Link
            href={`/reservar?org=${orgId}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/10"
          >
            <ExternalLink className="size-3.5" />
            ¿Alguien más viene? Comparte el enlace de invitado (solo nombre y teléfono)
          </Link>
        )}
      </div>
      <ReservationBooking />
    </div>
  );
}