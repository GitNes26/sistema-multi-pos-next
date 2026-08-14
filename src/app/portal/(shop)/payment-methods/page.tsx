import type { Metadata } from "next";
import { PaymentMethodsClient } from "@/components/portal/payment-methods-client";

export const metadata: Metadata = { title: "Métodos de pago — Portal" };

export default function PortalPaymentMethodsPage() {
  return <PaymentMethodsClient />;
}
