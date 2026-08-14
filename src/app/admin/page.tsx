import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AdminDashboard } from "@/components/admin/dashboard/dashboard";

export const metadata: Metadata = { title: "Panel" };

// FASE 10.1 — Dashboard con métricas reales y gráficas.

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="size-5" />}
        title="Panel"
        description="Resumen de tu negocio en tiempo real."
      />
      <AdminDashboard />
    </>
  );
}