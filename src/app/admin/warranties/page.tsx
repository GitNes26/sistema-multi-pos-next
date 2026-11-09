import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { WarrantyRulesClient } from "@/components/admin/warranty/warranty-rules-client";

export const metadata: Metadata = { title: "Garantías" };
export const dynamic = "force-dynamic";

// Garantías de servicio: política opcional que define el dueño (plazo, porcentaje, servicios y leyenda del ticket).
export default async function WarrantiesPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "warranties.view")) return <AccessDenied permission="warranties.view" />;
  return (
    <div className="w-full space-y-4">
      <PageHeader icon={<ShieldCheck className="size-5" />} title="Garantías de servicio" glossary="garantia-servicio" description="Reglas opcionales para repetir un servicio, definidas por ti." />
      <WarrantyRulesClient canManage={hasPermission(session, "warranties.manage")} />
    </div>
  );
}
