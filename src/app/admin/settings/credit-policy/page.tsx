import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Landmark } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { CreditPolicyForm } from "@/components/admin/settings/credit-policy-form";

export const metadata: Metadata = { title: "Política de crédito" };

export default async function CreditPolicyPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) return <AccessDenied permission="settings.manage" />

  return (
    <div className="w-full">
      <PageHeader
        icon={<Landmark className="size-5" />}
        title="Política de crédito"
        description="Configura límites, plazos, intereses y aprobaciones para ventas a crédito."
      />
      <CreditPolicyForm />
    </div>
  );
}
