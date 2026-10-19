import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Megaphone } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { PublicationsManager } from "@/components/admin/publications/publications-manager";

export const metadata: Metadata = { title: "Publicaciones" };

// FASE 18.5 — Gestión de publicaciones desde admin.

export default async function AdminPublicationsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "publications.manage")) return <AccessDenied permission="publications.manage" />

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={<Megaphone className="size-5" />}
        title="Publicaciones"
        description="Avisos, promociones y novedades que ven tus clientes en el portal."
      />
      <PublicationsManager />
    </div>
  );
}
