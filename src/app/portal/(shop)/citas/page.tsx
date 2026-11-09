import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { AGENDA_MODES } from "@/lib/agenda/server";
import { AppointmentsClient } from "@/components/portal/appointments-client";

export const metadata: Metadata = { title: "Mis citas — Portal" };
export const dynamic = "force-dynamic";

// Solo los negocios con agenda (barbería, estética, servicios…) ofrecen reservar citas.
export default async function PortalAppointmentsPage() {
  const session = await getServerSession(authOptions);
  const organization = session?.user?.organizationId
    ? await prisma.organization.findUnique({ where: { id: session.user.organizationId }, select: { businessMode: true } })
    : null;
  if (!organization || !AGENDA_MODES.includes(organization.businessMode)) redirect("/portal/profile");
  return <AppointmentsClient />;
}
