import type { Metadata } from "next";
import { LayoutDashboard, TrendingUp, Users, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Panel" };

const metrics = [
  { label: "Ventas de hoy", value: "$0.00", icon: ShoppingCart, hint: "Sin movimientos" },
  { label: "Ticket promedio", value: "$0.00", icon: TrendingUp, hint: "—" },
  { label: "Clientes activos", value: "0", icon: Users, hint: "En tu organización" },
];

export default async function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="size-5" />}
        title="Panel"
        description="Resumen de tu negocio en tiempo real."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {m.label}
              </CardTitle>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <m.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Módulos próximos</CardTitle>
          <CardDescription>
            Las secciones de catálogos, inventario, ventas y reportes se habilitan en las
            FASEs 7 a 10.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            "Productos",
            "Inventario",
            "Ventas",
            "Reportes",
            "Clientes",
            "Promociones",
            "Pedidos",
          ].map((m) => (
            <Badge key={m} variant="outline">
              {m}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </>
  );
}