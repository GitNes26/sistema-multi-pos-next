import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PayrollPeriodView } from "@/components/admin/payroll/payroll-period";

export const metadata: Metadata = { title: "Nómina" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "employees.manage")) redirect("/admin");
  const { id } = await params;
  return <PayrollPeriodView id={id} />;
}
