import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { DeliveryPolicyForm } from "@/components/admin/settings/delivery-policy-form";

export const metadata: Metadata = { title: "Politica de entrega" };

export default async function DeliveryPolicyPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) {
    redirect("/admin");
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={<Truck className="size-5" />}
        title="Politica de entrega"
        description="Configura horarios, montos minimos y costos para recoger y domicilio."
      />
      <DeliveryPolicyForm />
    </div>
  );
}
