import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Cookie, FileCheck2, Scale, ShieldCheck } from "lucide-react";
import { LEGAL_DOCUMENTS } from "@/components/legal/legal-document";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "Centro legal", description: "Políticas y condiciones de Multi-POS." };

const entries = [
  { key: "terminos", href: "/legal/terminos", icon: FileCheck2 },
  { key: "privacidad", href: "/legal/privacidad", icon: ShieldCheck },
  { key: "comercio", href: "/legal/comercio", icon: Scale },
  { key: "cookies", href: "/legal/cookies", icon: Cookie },
] as const;

export default function LegalPage() {
  return (
    <LegalShell backHref="/">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">Multi-POS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance">Centro legal</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Consulta las reglas de uso, privacidad y compra aplicables a la plataforma y al portal.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map(({ key, href, icon: Icon }, i) => {
            const document = LEGAL_DOCUMENTS[key];
            return (
              <Link
                key={key}
                href={href}
                style={{ animationDelay: `${i * 60}ms` }}
                className="press group flex animate-rise-in flex-col rounded-2xl border bg-background p-5 shadow-e1 transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-e2"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-4 flex items-center gap-1 font-semibold group-hover:text-primary">
                  {document.title}
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{document.summary}</p>
              </Link>
            );
          })}
        </div>
        <p className="mt-8 rounded-2xl border bg-background p-4 text-xs leading-5 text-muted-foreground">
          Base operativa para México. Debe completarse con razón social, domicilio, contactos y políticas
          comerciales reales, y someterse a revisión profesional cuando la actividad, jurisdicción o contrato
          lo requiera.
        </p>
      </div>
    </LegalShell>
  );
}
