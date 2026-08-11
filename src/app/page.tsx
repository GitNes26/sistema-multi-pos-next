import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle, Package, ScanBarcode, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Bienvenido",
  description: "Multi-POS: punto de venta multi-sucursal, panel administrativo y portal de clientes.",
};

const WHATSAPP_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=${process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ?? ""}`;

const FEATURES = [
  { icon: ScanBarcode, title: "Punto de venta", text: "Escáner, granel, split payments y cierre de caja." },
  { icon: Package, title: "Multi-sucursal", text: "Sucursales, CEDIS, inventario y transferencias." },
  { icon: ShoppingCart, title: "Portal de clientes", text: "Pedidos, promociones y programa de lealtad." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 9.5 12 4l9 5.5-9 5.5-9-5.5Z"
                fill="currentColor"
                opacity="0.9"
              />
              <path d="M6 12v4.5l6 3.5 6-3.5V12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          Multi-POS
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/login">Acceso panel</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/portal/auth/login">Portal de clientes</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-4 py-14 text-center sm:px-6">
        <div className="space-y-4">
          <h1 className="mx-auto max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Tu negocio, un solo sistema.
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-muted-foreground">
            Ventas, inventario, promociones, pedidos y lealtad en una plataforma diseñada
            para tiendas, restaurantes y cadenas pequeñas.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/portal/auth/login">
                Crear mi pedido <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> ¿Te interesa? Escríbenos
              </a>
            </Button>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-center shadow-sm"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </span>
              <h2 className="font-semibold">{f.title}</h2>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t px-4 py-4 text-xs text-muted-foreground">
        <Link href="/auth/login" className="hover:text-foreground hover:underline">
          Acceso panel POS
        </Link>
        <Link href="/portal/auth/login" className="hover:text-foreground hover:underline">
          Portal de clientes
        </Link>
        <span>© {new Date().getFullYear()} Multi-POS</span>
      </footer>
    </div>
  );
}