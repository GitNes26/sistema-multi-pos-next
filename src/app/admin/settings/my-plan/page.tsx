import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { BadgeDollarSign, Building2, Check, MessageCircle, Users } from "lucide-react"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { subscriptionUsage } from "@/lib/billing/subscriptions"
import { prisma } from "@/lib/db"
import { planWhatsappUrl } from "@/lib/whatsapp"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function Page() {
  const session = await getServerSession(authOptions)
  const organizationId = effectiveOrgId(session)
  if (!organizationId) redirect("/admin")
  const [usage, plans] = await Promise.all([
    subscriptionUsage(organizationId),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } }),
  ])
  const subscription = usage.subscription
  return <div className="space-y-5">
    <PageHeader icon={<BadgeDollarSign />} title="Mi plan" description="Consulta tu capacidad actual y pide ayuda por WhatsApp para elegir o actualizar tu plan." />
    <Card><CardContent className="grid gap-4 p-5 md:grid-cols-3">
      <div><p className="text-sm text-muted-foreground">Plan actual</p><p className="text-2xl font-semibold">{subscription?.plan.name ?? "Sin plan asignado"}</p><p className="text-sm text-muted-foreground">{subscription ? `Vence ${new Date(subscription.periodEndsAt).toLocaleDateString("es-MX")}` : "Contacta al administrador del sistema"}</p></div>
      <div><p className="flex gap-2 font-medium"><Building2 className="size-5" />Sucursales</p><p className="text-2xl font-semibold">{usage.locations} / {usage.locationLimit ?? "—"}</p></div>
      <div><p className="flex gap-2 font-medium"><Users className="size-5" />Empleados</p><p className="text-2xl font-semibold">{usage.employees} / {usage.employeeLimit ?? "—"}</p></div>
    </CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-3">{plans.map((plan) => {
      const isCurrent = subscription?.planId === plan.id
      return <Card key={plan.id}><CardContent className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">{plan.name}</h2>
        <p className="text-3xl font-semibold">${Number(plan.monthlyPrice).toLocaleString("es-MX")}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
        <p className="text-sm">{plan.includedLocations} sucursal(es) · {plan.includedEmployees} empleados</p>
        <ul className="space-y-2 text-sm">{(plan.features as string[]).map((feature) => <li key={feature} className="flex gap-2"><Check className="size-4 text-primary" />{feature}</li>)}</ul>
        <Button asChild variant={isCurrent ? "secondary" : "default"} className="w-full"><a href={planWhatsappUrl(plan)} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />{isCurrent ? "Consultar mi plan" : "Solicitar actualización"}</a></Button>
      </CardContent></Card>
    })}</div>
  </div>
}
