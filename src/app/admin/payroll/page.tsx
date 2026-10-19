import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { HandCoins } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PayrollPage } from "@/components/admin/payroll/payroll-page";

export const metadata: Metadata = { title: "Nómina" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "payroll.manage")) return <AccessDenied permission="payroll.manage" />
  return <PayrollPage icon={<HandCoins className="size-5" />} />;
}
