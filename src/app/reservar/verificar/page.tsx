import type { Metadata } from "next";
import { GuestReservationVerify } from "@/components/portal/guest-reservation-verify";

export const metadata: Metadata = { title: "Mi reservación" };

// Página PÚBLICA para que el invitado (sin cuenta) confirme o cancele su
// reservación con su teléfono + un código de corto plazo (el mismo que apareció
// al reservar y que también llega por WhatsApp/SMS). Vive fuera de /portal,
// igual que /reservar, para que el middleware no exija sesión.

export default function VerificarReservacionPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24 dark:from-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md dark:bg-slate-900/80">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-2xl font-bold text-transparent">
            Mi reservación
          </h1>
          <p className="text-sm text-muted-foreground">
            Confirma o cancela tu reservación sin cuenta: tu teléfono y el
            código que te dimos al reservar (también te lo enviamos por
            WhatsApp/SMS).
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-5">
        <GuestReservationVerify />
      </div>
    </main>
  );
}
