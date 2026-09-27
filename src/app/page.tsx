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
  ChefHat,
  CalendarClock,
  CalendarRange,
  Hand,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/landing/reveal"
import { ProductShot } from "@/components/landing/product-shot"
import { SiteHeader, Brand } from "@/components/landing/site-header"
import { RotatingWord } from "@/components/landing/rotating-word"
import { BusinessSwitcher } from "@/components/landing/business-switcher"
import { BranchesDemo, ScaleDemo, TrackingDemo } from "@/components/landing/feature-demos"
import { Marquee } from "@/components/landing/marquee"
import { SmoothAnchors } from "@/components/landing/smooth-anchors"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
    demo: ScaleDemo,
  },
  {
    icon: Store,
    title: "Todas tus sucursales, un solo inventario",
    text: "Cada sucursal y CEDIS lleva su propio inventario, con transferencias entre ubicaciones y revisiones físicas. Tú lo ves todo consolidado.",
    points: ["Sucursales y CEDIS", "Transferencias entre ubicaciones", "Revisiones periódicas de inventario"],
    demo: BranchesDemo,
  },
  {
    icon: Smartphone,
    title: "Tus clientes compran desde su teléfono",
    text: "Un portal conectado al mismo catálogo y reglas del POS: pedidos para recoger o a domicilio, rastreo en vivo, favoritos, listas y puntos de lealtad.",
    points: ["Pedidos con rastreo GPS en vivo", "Entrega segura con QR o PIN", "Puntos de lealtad y promociones"],
    demo: TrackingDemo,
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

const TOUCH_SCREENS = [
  { icon: ScanBarcode, title: "Punto de venta", text: "Botones grandes, escáner y báscula. Cobra con una mano." },
  { icon: ChefHat, title: "Cocina (KDS)", text: "Comandas por estación con tiempos y avisos en vivo." },
  { icon: CalendarClock, title: "Agenda de citas", text: "Asigna personal, confirma y cobra desde la misma pantalla." },
  { icon: CalendarRange, title: "Reservaciones", text: "Disponibilidad por unidad y periodo, siempre a la vista." },
]

const FAQS = [
  {
    q: "¿Funciona en tablets y pantallas táctiles?",
    a: "Sí. El punto de venta, la cocina, la agenda y las reservaciones están diseñados primero para uso táctil, con botones amplios; en computadora de escritorio se adaptan a mouse y teclado.",
  },
  {
    q: "¿Mis clientes tienen que descargar una app?",
    a: "No. El portal de clientes se abre desde el navegador y se puede instalar en la pantalla de inicio del teléfono como una app (PWA), con notificaciones de sus pedidos.",
  },
  {
    q: "¿Puedo manejar varias sucursales y un almacén?",
    a: "Sí. Cada sucursal y CEDIS tiene su propio inventario, con transferencias entre ubicaciones, revisiones físicas y una vista consolidada para el administrador.",
  },
  {
    q: "¿Sirve para restaurante, servicios o renta, no solo tienda?",
    a: "Sí. Al configurar tu empresa eliges el tipo de negocio y el sistema activa las herramientas que corresponden: mesas y cocina, agenda de citas o reservaciones por periodo.",
  },
  {
    q: "¿Cómo contrato un plan?",
    a: "Elige el plan que se ajusta a tu operación y escríbenos por WhatsApp; te ayudamos a dar de alta tu empresa, sucursales y empleados.",
  },
]

const SECTIONS = [
  { id: "funciones", label: "Funciones" },
  { id: "negocios", label: "Tipos de negocio" },
  { id: "planes", label: "Planes" },
  { id: "preguntas", label: "Preguntas" },
]

export default async function LandingPage() {
  const plans = await prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }] })
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SmoothAnchors />
      <SiteHeader sections={plans.length > 0 ? SECTIONS : SECTIONS.filter((x) => x.id !== "planes")} />

      {/* ── Hero: el producto en uso ─────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 right-[-15%] size-[44rem] rounded-full opacity-70 blur-3xl motion-safe:animate-[pulse_8s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 22%, transparent), transparent 65%)" }}
        />
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
              <h1 className="font-heading text-5xl leading-[1.04] font-semibold tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                Tu{" "}
                <RotatingWord words={["tienda", "restaurante", "cafetería", "estética", "renta", "negocio"]} />
                <br />
                en un solo sistema.
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
            <Reveal delay={0.28}>
              <a
                href="#funciones"
                className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="grid size-8 place-items-center rounded-full border bg-card shadow-e1 transition-transform group-hover:translate-y-0.5">
                  <ChevronDown className="size-4 motion-safe:animate-bounce" />
                </span>
                Descubre cómo funciona
              </a>
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
                    <ul className="mt-6 space-y-3">
                      {d.points.map((p) => (
                        <li key={p} className="flex items-center gap-3 font-medium">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <d.demo />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funciones: lista densa, no rejilla de tarjetas ───── */}
      <section id="funciones" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
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
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 0.05}>
                <div className="group flex gap-4 rounded-2xl p-4 transition-colors duration-200 hover:bg-muted/60">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-[transform,background-color,color] duration-300 ease-out-quart group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="size-5" />
                  </span>
                  <div>
                    <dt className="font-semibold">{f.title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</dd>
                  </div>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>

      </section>

      <div className="border-y bg-surface-sunken py-6">
        <Marquee items={CAPABILITIES} />
      </div>

      {/* ── Pantallas táctiles ───────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm font-medium text-muted-foreground">
            <Hand className="size-4 text-primary" /> Hecho para tablets
          </p>
          <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Pantallas táctiles para cada puesto
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Caja, cocina, recepción y mostrador trabajan con la misma información, al mismo tiempo.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOUCH_SCREENS.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.06} className="h-full">
              <div className="group h-full rounded-3xl border bg-card p-6 shadow-e1 transition-[transform,box-shadow,border-color] duration-300 ease-out-quart hover:-translate-y-1 hover:border-primary/40 hover:shadow-e3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-foreground text-background transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <t.icon className="size-6" />
                </span>
                <h3 className="mt-5 font-semibold">{t.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Tipos de negocio (interactivo) ───────────────────── */}
      <section id="negocios" className="scroll-mt-20 border-t bg-surface-sunken">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Se adapta a tu tipo de negocio
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">Elige el tuyo y mira qué herramientas se activan.</p>
          </Reveal>
          <Reveal delay={0.08} className="mt-10">
            <BusinessSwitcher ctaHref={WHATSAPP_URL} />
          </Reveal>
        </div>
      </section>

      {/* ── Planes ───────────────────────────────────────────── */}
      {plans.length > 0 && (
        <section id="planes" className="scroll-mt-20 border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <Reveal className="max-w-2xl">
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Un plan para cada etapa</h2>
              <p className="mt-3 text-muted-foreground">
                Todos incluyen Punto de venta, Panel administrativo y Portal de
                clientes. La capacidad cambia según tu operación.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {plans.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 0.08} className="h-full">
                <div className="flex h-full flex-col rounded-3xl border bg-card p-7 shadow-e1 transition-[transform,box-shadow,border-color] duration-300 ease-out-quart hover:-translate-y-1 hover:border-primary/40 hover:shadow-e3">
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
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Preguntas frecuentes ─────────────────────────────── */}
      <section id="preguntas" className="scroll-mt-20 border-t bg-surface-sunken">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16 lg:py-28">
          <Reveal>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Preguntas frecuentes</h2>
            <p className="mt-3 text-muted-foreground">
              ¿Algo más?{" "}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                Escríbenos por WhatsApp
              </a>
              .
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <Accordion type="single" collapsible className="rounded-3xl border bg-card px-5 shadow-e1 sm:px-7">
              {FAQS.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`}>
                  <AccordionTrigger className="py-5 text-base font-semibold">{f.q}</AccordionTrigger>
                  <AccordionContent className="pb-5 text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* ── Llamado final ────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-foreground text-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 size-[36rem] rounded-full opacity-40 blur-3xl motion-safe:animate-[pulse_7s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-24">
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
            <Link href="/legal" className="hover:text-foreground">Centro legal</Link>
            <span className="tabular">© {new Date().getFullYear()} Multi-POS v{packageJson.version}</span>
          </nav>
        </div>
      </footer>
    </div>
  )
}
