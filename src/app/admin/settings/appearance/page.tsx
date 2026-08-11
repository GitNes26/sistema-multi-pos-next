import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { getAppSettings } from "@/lib/db/app-settings";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { Splash } from "@/components/appearance/splash";
import { AppearanceSettingsForm } from "@/components/appearance/appearance-settings-form";

export const metadata: Metadata = { title: "Apariencia" };

export default async function AppearanceSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");
  const organizationId = session.user.organizationId;

  const tenant = organizationId ? await getAppSettings(organizationId) : null;

  return (
    <>
      <AppearanceSync tenant={tenant} />
      <Splash />
      <AppearanceSettingsForm />
    </>
  );
}