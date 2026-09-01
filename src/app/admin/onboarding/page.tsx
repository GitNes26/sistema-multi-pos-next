import type { Metadata } from "next"
import { OnboardingWizard } from "@/components/shared/wizards/onboarding-wizard"

export const metadata: Metadata = { title: "Configurar empresa — Onboarding" }

export default function OnboardingPage() {
  return <OnboardingWizard />
}
