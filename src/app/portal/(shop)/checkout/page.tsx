import type { Metadata } from "next";
import { CheckoutClient } from "@/components/portal/checkout-client";

export const metadata: Metadata = { title: "Finalizar pedido — Portal" };

export default function PortalCheckoutPage() {
  return <CheckoutClient />;
}
