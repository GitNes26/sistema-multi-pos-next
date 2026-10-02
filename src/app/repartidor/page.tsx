import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { DriverApp } from "@/components/driver/driver-app";

export const metadata: Metadata = { title: "Mis entregas" };

// Interfaz del repartidor: aceptar entregas, ver pedido y mapa, salir en camino y confirmar.

export default async function DriverPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope === "portal") redirect("/auth/login?callbackUrl=/repartidor");
  if (!hasPermission(session, "delivery.manage")) redirect("/admin");
  return (
    <>
      <AppearanceSync tenant={null} />
      <div className="min-h-dvh bg-background">
        <DriverApp />
      </div>
    </>
  );
}
