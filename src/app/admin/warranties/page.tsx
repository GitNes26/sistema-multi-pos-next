import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { WarrantyRulesClient } from "@/components/admin/warranty/warranty-rules-client";
import { NotAvailableForMode } from "@/components/shared/not-available-for-mode";
import { prisma } from "@/lib/db";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { WARRANTY_MODES } from "@/lib/vertical-modes";

export const metadata: Metadata = { title: "Garantías" };
export const dynamic = "force-dynamic";

// Garantías de servicio: política opcional que define el dueño (plazo, porcentaje, servicios y leyenda del ticket).
export default async function WarrantiesPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "warranties.view")) return <AccessDenied permission="warranties.view" />;
  const organizationId = effectiveOrgId(session);
  const org = organizationId ? await prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } }) : null;
  if (org && !WARRANTY_MODES.includes(org.businessMode)) {
    return <NotAvailableForMode icon={<ShieldCheck className="size-5" />} title="Garantías de servicio" what="Las garantías de servicio" mode={org.businessMode} modes={WARRANTY_MODES} />;
  }
  return (
    <div className="w-full space-y-4">
      <PageHeader icon={<ShieldCheck className="size-5" />} title="Garantías de servicio" glossary="garantia-servicio" description="Reglas opcionales para repetir un servicio, definidas por ti." />
      <WarrantyRulesClient canManage={hasPermission(session, "warranties.manage")} />
    </div>
  );
}
