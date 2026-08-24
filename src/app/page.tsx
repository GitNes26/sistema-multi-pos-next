import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  Gift,
  MessageCircle,
  ScanBarcode,
  Smartphone,
  Store,
  Truck,
  Check,
  Zap,
  Layers,
  FileSpreadsheet,
  MapPin,
  QrCode,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeroBackground } from "@/components/landing/hero-background"
import { Reveal } from "@/components/landing/reveal"
import packageJson from "../../package.json"

export const metadata: Metadata = {
  title: "Bienvenido",
  description:
    "Multi-POS: punto de venta multi-sucursal, panel administrativo y portal de clientes. Ventas, inventario, pedidos en línea y lealtad en una sola plataforma.",
}

const WHATSAPP_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=${process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ?? ""}`

const FEATURES = [
  {
    icon: ScanBarcode,
    color: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15",
    title: "Punto de venta",
    text: "Escáner, venta a granel, pagos divididos y cierre de caja con aprobación de supervisor.",
  },
  {
    icon: Store,
    color: "text-sky-600 bg-sky-500/10 dark:text-sky-400 dark:bg-sky-500/15",
    title: "Multi-sucursal",
    text: "Sucursales y CEDIS con inventario centralizado y transferencias entre ubicaciones.",
  },
  {
    icon: Boxes,
    color: "text-violet-600 bg-violet-500/10 dark:text-violet-400 dark:bg-violet-500/15",
    title: "Inventario inteligente",
    text: "Productos con variantes, revisiones periódicas y alertas automáticas de stock bajo.",
  },
  {
    icon: Truck,
    color: "text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/15",
    title: "Pedidos en línea",
    text: "Para recoger o a domicilio, con rastreo GPS en vivo y confirmación segura con QR o PIN.",
  },
  {
    icon: Smartphone,
    color: "text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/15",
    title: "Portal de clientes",
    text: "Tienda, carrito, listas de compras, favoritos y seguimiento de pedidos en tiempo real.",
  },
  {
    icon: Gift,
    color: "text-fuchsia-600 bg-fuchsia-500/10 dark:text-fuchsia-400 dark:bg-fuchsia-500/15",
    title: "Lealtad y promociones",
    text: "Programa de puntos y publicaciones programadas para fidelizar a tus clientes.",
  },
  {
    icon: BarChart3,
    color: "text-teal-600 bg-teal-500/10 dark:text-teal-400 dark:bg-teal-500/15",
    title: "Reportes y análisis",
    text: "Exporta ventas, inventario y reportes en PDF o Excel con un solo clic.",
  },
  {
    icon: Bell,
    color: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400 dark:bg-indigo-500/15",
    title: "Notificaciones en vivo",
    text: "Entérate al instante de ventas, nuevos pedidos y stock bajo, en tiempo real.",
  },
]

const CAPABILITIES = [
  { icon: Zap, label: "Escáner de código" },
  { icon: Layers, label: "Venta a granel" },
  { icon: QrCode, label: "Confirmación QR / PIN" },
  { icon: MapPin, label: "Rastreo GPS en vivo" },
  { icon: FileSpreadsheet, label: "Exportar PDF / Excel" },
  { icon: Gift, label: "Puntos de lealtad" },
  { icon: Smartphone, label: "PWA instalable" },
  { icon: Bell, label: "Alertas de stock" },
]

const STATS = [
  { value: "3 en 1", label: "POS · Panel · Portal" },
  { value: "Real-time", label: "Datos al instante" },
  { value: "Multi", label: "Sucursales + CEDIS" },
  { value: "QR/PIN", label: "Entregas seguras" },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 font-semibold">
      <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 9.5 12 4l9 5.5-9 5.5-9-5.5Z" fill="currentColor" opacity="0.9" />
          <path d="M6 12v4.5l6 3.5 6-3.5V12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-lg tracking-tight">
        Multi<span className="text-emerald-500">-POS</span>
      </span>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">Acceso panel</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/auth/login">Portal de clientes</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 text-slate-50">
        <HeroBackground />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 py-20 text-center sm:px-6 sm:py-28">
          <div className="space-y-6">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Punto de venta · Panel administrativo · Portal de clientes
              </span>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
                Tu negocio,{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 bg-clip-text text-transparent">
                  un solo sistema.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mx-auto max-w-2xl text-pretty text-base text-slate-300 sm:text-lg">
                Vende, gestiona inventario, recibe pedidos en línea y fideliza a
                tus clientes — todo en tiempo real, diseñado para tiendas,
                restaurantes y cadenas pequeñas.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:opacity-90">
                  <Link href="/portal/auth/login">
                    Empieza ahora <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white dark:bg-white/5"
                >
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> ¿Te interesa? Escríbenos
                  </a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.32}>
              <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
                {STATS.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="text-lg font-bold text-white">{s.value}</p>
                    <p className="text-xs text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        {/* Degradado de transición al fondo claro */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-background" />
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que tu negocio necesita
          </h2>
          <p className="mt-3 text-muted-foreground">
            Una plataforma completa que une tus ventas, tu inventario y tus
            clientes en un solo lugar.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.06}>
              <div className="group h-full rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5">
                <span className={`flex size-11 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Capacidades "todo en uno" ─────────────────────────── */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Mucho más que una caja registradora
            </h2>
            <p className="mt-3 text-muted-foreground">
              Cada detalle pensado para que operes más rápido y vendas más.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {CAPABILITIES.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-emerald-500/40"
                >
                  <c.icon className="size-4 text-emerald-500" />
                  {c.label}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
              {[
                "Split payments y cierre de caja",
                "Transferencias entre sucursales",
                "Variantes y venta a granel",
                "Pedidos con seguimiento en vivo",
                "Programa de puntos de lealtad",
                "Reportes exportables en PDF/Excel",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 text-slate-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <Reveal>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Empieza a vender mejor hoy
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto max-w-xl text-slate-300">
              Únete a negocios que ya operan sus ventas, pedidos y clientes en
              una sola plataforma.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:opacity-90">
                <Link href="/portal/auth/login">
                  Crear mi pedido <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white dark:bg-white/5"
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Escríbenos por WhatsApp
                </a>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:px-6 sm:flex-row sm:justify-between sm:text-left">
          <Logo />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link href="/auth/login" className="hover:text-foreground hover:underline">
              Acceso panel POS
            </Link>
            <Link href="/portal/auth/login" className="hover:text-foreground hover:underline">
              Portal de clientes
            </Link>
            <span>© {new Date().getFullYear()} Multi-POS v{packageJson.version}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
