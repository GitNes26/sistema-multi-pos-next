import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Gift } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { LoyaltyProgramsClient } from "@/components/admin/loyalty/loyalty-programs-client";
import { NotAvailableForMode } from "@/components/shared/not-available-for-mode";
import { prisma } from "@/lib/db";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { LOYALTY_MODES } from "@/lib/vertical-modes";

export const metadata: Metadata = { title: "Fidelidad" };
export const dynamic = "force-dynamic";

// Programas de fidelidad (tarjeta de visitas y paquetes prepagados): opciones precargadas que el dueño configura.
export default async function LoyaltyProgramsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "loyalty.view")) return <AccessDenied permission="loyalty.view" />;
  const organizationId = effectiveOrgId(session);
  const org = organizationId ? await prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } }) : null;
  if (org && !LOYALTY_MODES.includes(org.businessMode)) {
    return <NotAvailableForMode icon={<Gift className="size-5" />} title="Fidelidad" what="Los programas de fidelidad" mode={org.businessMode} modes={LOYALTY_MODES} />;
  }
  return (
    <div className="w-full space-y-4">
      <PageHeader icon={<Gift className="size-5" />} title="Fidelidad" glossary="membresia" description="Tarjeta de visitas, paquetes prepagados y membresías para tus clientes frecuentes." />
      <LoyaltyProgramsClient canManage={hasPermission(session, "loyalty.manage")} />
    </div>
  );
}
