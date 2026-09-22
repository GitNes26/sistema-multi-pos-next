import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = { title: "Cambiar contraseña — Portal" };

export default function PortalChangePasswordPage() {
  return <div className="flex justify-center p-4"><ChangePasswordForm returnHref="/portal/profile" /></div>;
}
