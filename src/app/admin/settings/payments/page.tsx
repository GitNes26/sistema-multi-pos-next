import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentsForm } from "@/components/admin/settings/payments-form";

export const metadata: Metadata = { title: "Pasarelas de pago" };

// FASE 16.3/16.4 (15.8) — Configuración de pasarela de pago por empresa.

export default async function PaymentsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) {
    redirect("/admin");
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={<CreditCard className="size-5" />}
        title="Pasarelas de pago"
        description="Elige entre Stripe o MercadoPago para cobrar en línea."
      />
      <PaymentsForm />
    </div>
  );
}
