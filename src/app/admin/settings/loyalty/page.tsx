import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Sparkles } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { LoyaltyForm } from "@/components/admin/settings/loyalty-form";

export const metadata: Metadata = { title: "Lealtad" };

// FASE 15.6 — Configuración de lealtad.

export default async function LoyaltySettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) return <AccessDenied permission="settings.manage" />

  return (
    <div className="w-full">
      <PageHeader
        icon={<Sparkles className="size-5" />}
        title="Lealtad y puntos"
        description="Puntos por compra y valor del punto."
      />
      <LoyaltyForm />
    </div>
  );
}
