import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Wand2 } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { TemplatesClient } from "@/components/admin/settings/templates-client";

export const metadata: Metadata = { title: "Plantillas de arranque" };
export const dynamic = "force-dynamic";

// Plantillas por tipo de negocio: dejan lo básico listo (servicios, lugares, flujo, fidelidad, política de renta).
export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) return <AccessDenied permission="settings.manage" />;
  return (
    <div className="w-full space-y-4">
      <PageHeader icon={<Wand2 className="size-5" />} title="Plantillas de arranque" description="Deja listo lo básico de tu tipo de negocio y ajústalo después a tu gusto." />
      <TemplatesClient />
    </div>
  );
}
