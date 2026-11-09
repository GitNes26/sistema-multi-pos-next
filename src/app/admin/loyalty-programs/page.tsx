import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Gift } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { LoyaltyProgramsClient } from "@/components/admin/loyalty/loyalty-programs-client";

export const metadata: Metadata = { title: "Fidelidad" };
export const dynamic = "force-dynamic";

// Programas de fidelidad (tarjeta de visitas y paquetes prepagados): opciones precargadas que el dueño configura.
export default async function LoyaltyProgramsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "loyalty.view")) return <AccessDenied permission="loyalty.view" />;
  return (
    <div className="w-full space-y-4">
      <PageHeader icon={<Gift className="size-5" />} title="Fidelidad" glossary="membresia" description="Tarjeta de visitas, paquetes prepagados y membresías para tus clientes frecuentes." />
      <LoyaltyProgramsClient canManage={hasPermission(session, "loyalty.manage")} />
    </div>
  );
}
