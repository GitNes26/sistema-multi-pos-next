import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { LayoutDashboard } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { AdminDashboard } from "@/components/admin/dashboard/dashboard";
import { LiveStrip, PanelBackdrop, QuickAccess } from "@/components/admin/dashboard/panel-home";

export const metadata: Metadata = { title: "Panel" };

// Panel: pulso operativo + métricas para quien puede ver reportes; accesos
// directos del rol para quien no. El logo de la empresa va de fondo tenue.

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.activeOrganizationId ?? session?.user?.organizationId ?? null;
  const logoUrl = organizationId
    ? (await prisma.companyProfile.findUnique({ where: { organizationId }, select: { logoUrl: true } }))?.logoUrl ?? null
    : null;
  const canReports = hasPermission(session, "reports.view");

  return (
    <div className="relative isolate min-h-[70dvh]">
      <PanelBackdrop logoUrl={logoUrl} />
      <PageHeader
        icon={<LayoutDashboard className="size-5" />}
        title="Panel"
        description={canReports ? "Lo que pasa en tu negocio, ahora y en los últimos 30 días." : "Tus accesos directos."}
      />
      {canReports ? (
        <div className="space-y-4">
          <LiveStrip />
          <AdminDashboard />
        </div>
      ) : (
        <div className="space-y-4">
          <LiveStrip />
          <QuickAccess roleName={session?.user?.roleName ?? null} />
        </div>
      )}
    </div>
  );
}
