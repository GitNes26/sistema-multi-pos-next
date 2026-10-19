import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Building2 } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { CompanyForm } from "@/components/admin/settings/company-form";

export const metadata: Metadata = { title: "Datos de empresa" };

// FASE 15.2 — Datos de empresa.

export default async function CompanySettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) return <AccessDenied permission="settings.manage" />

  return (
    <div className="w-full">
      <PageHeader
        icon={<Building2 className="size-5" />}
        title="Datos de empresa"
        description="Razón social, RFC, contacto y datos para tickets."
      />
      <CompanyForm />
    </div>
  );
}
