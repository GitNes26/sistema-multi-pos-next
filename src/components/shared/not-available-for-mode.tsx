import { Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notForModeMessage } from "@/lib/vertical-modes";
import type { BusinessMode } from "@/lib/auth/options";

/** Aviso de página: esta sección no aplica al tipo de negocio de la empresa (con a dónde ir en su lugar). */
export function NotAvailableForMode({
  icon,
  title,
  what,
  mode,
  modes,
}: {
  icon: React.ReactNode;
  title: string;
  what: string;
  mode: BusinessMode | string | null | undefined;
  modes: readonly BusinessMode[];
}) {
  return (
    <div className="w-full space-y-4">
      <PageHeader icon={icon} title={title} />
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed bg-card p-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Info className="size-5" />
        </span>
        <p className="max-w-xl text-sm text-muted-foreground">{notForModeMessage(what, mode, modes)}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Volver al panel</Link>
        </Button>
      </div>
    </div>
  );
}
