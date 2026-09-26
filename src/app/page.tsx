import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  Gift,
  MessageCircle,
  Scale,
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
  ClipboardCheck,
  CreditCard,
  Building2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/logo"
import { Reveal } from "@/components/landing/reveal"
import { ProductShot } from "@/components/landing/product-shot"
import { cn } from "@/lib/utils"
import packageJson from "../../package.json"
import { prisma } from "@/lib/db"
import { planWhatsappUrl, whatsappUrl } from "@/lib/whatsapp"

// Los planes se administran en la base de datos. La portada debe resolverlos
// al atender la petición, cuando Dokploy ya inyectó DATABASE_URL al contenedor,
// y no durante la construcción de la imagen.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Bienvenido",
  description:
    "Multi-POS: punto de venta multi-sucursal, panel administrativo y portal de clientes. Ventas, inventario, pedidos en línea y lealtad en una sola plataforma.",
}

const WHATSAPP_URL = whatsappUrl()

const DIFFERENTIATORS = [
  {
    icon: Scale,
    title: "Venta a granel, sin trucos",
    text: "Vende por kilo, pieza, litro o monto con el precio calculado al instante en caja. No es un complemento: es un tipo de producto completo, del POS al inventario.",
    points: ["Kilos, piezas, litros o por monto", "Precio en tiempo real en la caja", "Existencias exactas por fracción"],
  },
  {
    icon: Store,
    title: "Todas tus sucursales, un solo inventario",
    text: "Cada sucursal y CEDIS lleva su propio inventario, con transferencias entre ubicaciones y revisiones físicas. Tú lo ves todo consolidado.",
    points: ["Sucursales y CEDIS", "Transferencias entre ubicaciones", "Revisiones periódicas de inventario"],
  },
  {
    icon: Smartphone,
    title: "Tus clientes compran desde su teléfono",
    text: "Un portal conectado al mismo catálogo y reglas del POS: pedidos para recoger o a domicilio, rastreo en vivo, favoritos, listas y puntos de lealtad.",
    points: ["Pedidos con rastreo GPS en vivo", "Entrega segura con QR o PIN", "Puntos de lealtad y promociones"],
  },
]

const FEATURES = [
  { icon: ScanBarcode, title: "Punto de venta", text: "Escáner, venta a granel, pagos divididos y cierre de caja con aprobación de supervisor." },
  { icon: Boxes, title: "Inventario inteligente", text: "Productos con variantes, revisiones periódicas y alertas automáticas de stock bajo." },
  { icon: Truck, title: "Pedidos en línea", text: "Para recoger o a domicilio, con rastreo GPS en vivo y confirmación segura con QR o PIN." },
  { icon: Gift, title: "Lealtad y promociones", text: "Programa de puntos y publicaciones programadas para fidelizar a tus clientes." },
  { icon: BarChart3, title: "Reportes y análisis", text: "Exporta ventas, inventario y reportes en PDF o Excel con un solo clic." },
  { icon: Bell, title: "Notificaciones en vivo", text: "Entérate al instante de ventas, nuevos pedidos y stock bajo, en tiempo real." },
  { icon: ClipboardCheck, title: "Proveedores y compras", text: "Vincula productos, solicita cotizaciones, aprueba órdenes y registra recepciones en inventario." },
  { icon: CreditCard, title: "Crédito para clientes", text: "Configura límites por cliente, registra ventas a crédito y consulta saldos y abonos." },
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
  { icon: ClipboardCheck, label: "Compras a proveedores" },
  { icon: CreditCard, label: "Crédito y abonos" },
]

function Brand() {
  return (
    <span className="flex items-center gap-2.5 font-semibold">
      <Logo size={20} className="rounded-lg" />
      <span className="text-lg tracking-tight whitespace-nowrap">Multi-POS</span>
    </span>
  )
}

export default async function LandingPage() {
  const plans = await prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }] })
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ── Encabezado ───────────────────────────────────────── */}
      <header className="safe-area-top sticky top-0 z-40 border-b bg-background/92 supports-backdrop-filter:bg-background/75 supports-backdrop-filter:backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Multi-POS, inicio">
            <Brand />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
            {plans.length > 0 && (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <a href="#planes">Planes</a>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">
                <span className="sm:hidden">Panel</span>
                <span className="hidden sm:inline">Acceso panel</span>
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/portal/auth/login">
                <span className="sm:hidden">Portal</span>
                <span className="hidden sm:inline">Portal de clientes</span>
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero: el producto en uso ─────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in oklab, var(--primary) 9%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--primary) 9%, transparent) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 70% 60% at 70% 40%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 70% 40%, black, transparent 75%)",
          }}
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pt-14 pb-24 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:pt-20 lg:pb-28">
          <div className="max-w-xl">
            <Reveal>
              <h1 className="font-heading text-5xl leading-[1.02] font-semibold tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
                Tu negocio, un solo sistema.
              </h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mt-6 text-lg text-pretty text-muted-foreground sm:text-xl">
                Vende, gestiona inventario y compras, recibe pedidos en línea y
                atiende a tus clientes desde un solo lugar. Adaptado a retail,
                restaurantes, servicios, rentas y negocios híbridos.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-12 rounded-xl px-5 text-base shadow-e2 desk:h-11">
                  <Link href="/portal/auth/login">
                    Empieza ahora <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-5 text-base desk:h-11">
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Escríbenos por WhatsApp
                  </a>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={0.22}>
              <p className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {["Punto de venta", "Panel administrativo", "Portal de clientes"].map((label) => (
                  <span key={label} className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-primary" /> {label}
                  </span>
                ))}
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="sm:pl-12 lg:pl-8">
            <ProductShot />
          </Reveal>
        </div>
      </section>

      {/* ── Diferenciadores: filas alternadas ────────────────── */}
      <section className="border-t bg-surface-sunken">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Tres cosas que rara vez vienen juntas
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              La mayoría de los sistemas resuelve una. Multi-POS une las tres
              con el mismo catálogo y las mismas reglas de negocio.
            </p>
          </Reveal>

          <div className="mt-14 space-y-14 lg:space-y-20">
            {DIFFERENTIATORS.map((d, i) => (
              <Reveal key={d.title}>
                <div className={cn("grid items-center gap-8 lg:grid-cols-2 lg:gap-16", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
                  <div>
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-e1">
                      <d.icon className="size-6" />
                    </span>
                    <h3 className="mt-5 font-heading text-2xl font-semibold tracking-tight">{d.title}</h3>
                    <p className="mt-3 max-w-lg text-pretty text-muted-foreground">{d.text}</p>
                  </div>
                  <ul className="divide-y rounded-2xl border bg-card">
                    {d.points.map((p) => (
                      <li key={p} className="flex items-center gap-3 px-5 py-4 font-medium">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funciones: lista densa, no rejilla de tarjetas ───── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
          <Reveal>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Todo lo que tu negocio necesita
            </h2>
            <p className="mt-3 text-muted-foreground">
              Una plataforma completa que une tus ventas, tu inventario y tus
              clientes en un solo lugar.
            </p>
          </Reveal>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 0.05}>
                <div className="flex gap-4">
                  <f.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <dt className="font-semibold">{f.title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</dd>
                  </div>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>

        <Reveal delay={0.1}>
          <ul className="mt-16 flex flex-wrap gap-2.5" aria-label="Capacidades incluidas">
            {CAPABILITIES.map((c) => (
              <li
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium"
              >
                <c.icon className="size-4 text-primary" />
                {c.label}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ── Planes ───────────────────────────────────────────── */}
      {plans.length > 0 && (
        <section id="planes" className="scroll-mt-20 border-t bg-surface-sunken">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <Reveal className="max-w-2xl">
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Un plan para cada etapa</h2>
              <p className="mt-3 text-muted-foreground">
                Todos incluyen Punto de venta, Panel administrativo y Portal de
                clientes. La capacidad cambia según tu operación.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="flex flex-col rounded-3xl border bg-card p-7">
                  <h3 className="font-heading text-xl font-semibold tracking-tight">{plan.name}</h3>
                  <p className="mt-1.5 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-6 flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-semibold tracking-tight tabular">
                      ${Number(plan.monthlyPrice).toLocaleString("es-MX")}
                    </span>
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </p>
                  <div className="mt-6 space-y-2.5 border-t pt-6 text-sm">
                    <p className="flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" />{plan.includedLocations} sucursal(es) incluida(s)</p>
                    <p className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" />{plan.includedEmployees} empleados incluidos</p>
                    <p className="text-muted-foreground tabular">Sucursal extra: ${Number(plan.extraLocationPrice).toLocaleString("es-MX")}/mes</p>
                    <p className="text-muted-foreground tabular">{plan.extraEmployeePackSize} empleados extra: ${Number(plan.extraEmployeePackPrice).toLocaleString("es-MX")}/mes</p>
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    {(plan.features as string[]).map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-7 h-12 w-full rounded-xl desk:h-10">
                    <a href={planWhatsappUrl(plan)} target="_blank" rel="noopener noreferrer">Solicitar este plan</a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Llamado final ────────────────────────────────────── */}
      <section className="bg-foreground text-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-24">
          <Reveal className="max-w-2xl">
            <h2 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Empieza a vender mejor hoy
            </h2>
            <p className="mt-4 text-lg text-background/70">
              Opera tus ventas, pedidos y clientes en una sola plataforma.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-xl px-5 text-base desk:h-11">
                <Link href="/portal/auth/login">
                  Crear mi pedido <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-background/25 bg-transparent px-5 text-base text-background hover:bg-background/10 hover:text-background desk:h-11 dark:bg-transparent"
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Escríbenos por WhatsApp
                </a>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pie ──────────────────────────────────────────────── */}
      <footer className="safe-area-bottom border-t bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Brand />
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Pie de página">
            <Link href="/auth/login" className="hover:text-foreground">Acceso panel POS</Link>
            <Link href="/portal/auth/login" className="hover:text-foreground">Portal de clientes</Link>
            <Link href="/legal/terminos" className="hover:text-foreground">Términos</Link>
            <Link href="/legal/privacidad" className="hover:text-foreground">Privacidad</Link>
            <Link href="/legal/comercio" className="hover:text-foreground">Condiciones de compra</Link>
            <span className="tabular">© {new Date().getFullYear()} Multi-POS v{packageJson.version}</span>
          </nav>
        </div>
      </footer>
    </div>
  )
}
