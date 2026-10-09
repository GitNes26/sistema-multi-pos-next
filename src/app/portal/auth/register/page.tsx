import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { AuthShell } from "@/components/auth/auth-shell"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Regístrate para hacer pedidos, acumular puntos y seguir tus compras.",
}

export default async function PortalRegisterPage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect(session.user.scope === "portal" ? "/portal" : "/pos")
  return (
    <AuthShell mode="portal" backHref="/portal/auth/login">
      <RegisterForm />
    </AuthShell>
  )
}
