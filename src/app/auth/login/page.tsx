import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import packageJson from "../../../../package.json"

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso al sistema Multi-POS.",
}

export default async function PosLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string | string[]
    error?: string | string[]
  }>
}) {
  const params = await searchParams
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : null
  const error = typeof params.error === "string" ? params.error : null

  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect(
      session.user.scope === "portal"
        ? "/portal"
        : session.user.scope === "superadmin" ||
            session.user.role === "manager" ||
            session.user.role === "owner"
          ? "/admin"
          : "/pos"
    )
  }

  return (
    <AuthShell
      mode="pos"
      footerLinks={
        <>
          <Link
            href="/portal/auth/login"
            className="hover:text-foreground hover:underline"
          >
            Portal de clientes
          </Link>
          <Link
            href="/auth/forgot"
            className="hover:text-foreground hover:underline"
          >
            Recuperar contraseña
          </Link>
          <span>
            © {new Date().getFullYear()} Multi-POS v{packageJson.version}
          </span>
        </>
      }
    >
      <LoginForm mode="pos" callbackUrl={callbackUrl} error={error} />
    </AuthShell>
  )
}
