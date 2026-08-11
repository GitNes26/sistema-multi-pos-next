import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Portal de clientes",
  description: "Inicia sesión para hacer pedidos y ver promociones.",
};

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null;
  const error = typeof params.error === "string" ? params.error : null;

  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(session.user.scope === "portal" ? "/portal" : "/pos");
  }

  return (
    <AuthShell mode="portal">
      <LoginForm mode="portal" callbackUrl={callbackUrl} error={error} />
    </AuthShell>
  );
}