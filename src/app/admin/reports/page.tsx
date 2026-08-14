import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { BarChart3 } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { ReportsPage } from "@/components/admin/reports/reports-page";

export const metadata: Metadata = { title: "Reportes" };

// FASE 10.2 — Reportes con filtros avanzados, gráficas y exportación.

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions);
  const canView = hasPermission(session, "reports.view");
  const canExport = hasPermission(session, "reports.export");

  return (
    <ReportsPage
      canView={canView}
      canExport={canExport}
      icon={<BarChart3 className="size-5" />}
    />
  );
}