import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Recuperar acceso o activar cuenta" };

export default function PortalForgotPasswordPage() {
  return (
    <AuthShell mode="portal">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
