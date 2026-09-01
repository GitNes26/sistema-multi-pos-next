import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { KitchenDisplay } from "@/components/kds/kitchen-display";

export const metadata: Metadata = { title: "KDS - Cocina" };

export default function KDSPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <KitchenDisplay />
    </div>
  );
}
