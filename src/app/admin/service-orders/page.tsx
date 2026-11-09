import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { ClipboardList, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { ServiceOrdersBoard } from "@/components/admin/service-orders/service-orders-board";
import { SERVICE_ORDER_MODES } from "@/lib/service-orders/server";

export const metadata: Metadata = { title: "Órdenes de servicio" };
export const dynamic = "force-dynamic";

export default async function ServiceOrdersPage() {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  if (!organizationId) redirect("/admin");

  // Solo los giros con servicios (autolavado, estética, taller…) usan órdenes de servicio.
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } });
  if (!org || !SERVICE_ORDER_MODES.includes(org.businessMode)) redirect("/admin");
  if (!hasPermission(session, "service_orders.view")) return <AccessDenied permission="service_orders.view" />;

  return (
    <div className="w-full">
      <PageHeader
        icon={<ClipboardList className="size-5" />}
        title="Órdenes de servicio"
        description="Recibe vehículos, asigna lugar y llavero, avanza cada etapa y cobra al entregar."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/turnos" target="_blank" rel="noopener">
              <MonitorPlay className="size-4" />
              Pantalla de turnos
            </Link>
          </Button>
        }
      />
      <ServiceOrdersBoard
        canManage={hasPermission(session, "service_orders.manage")}
        canConfigure={hasPermission(session, "service_flows.manage")}
        canManageAssets={hasPermission(session, "assets.manage")}
      />
    </div>
  );
}
