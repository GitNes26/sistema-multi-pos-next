import type { Metadata } from "next";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// FASE 5 — Placeholder para módulos aún no implementados (FASEs 7-10).
export const metadata: Metadata = { title: "Módulo" };

const TITLES: Record<string, { title: string; description: string }> = {
  products: { title: "Productos", description: "Catálogo de productos del POS." },
  categories: { title: "Categorías", description: "Organiza tus productos por categorías." },
  customers: { title: "Clientes", description: "Gestiona clientes y puntos de lealtad." },
  employees: { title: "Empleados", description: "Equipo y accesos de la sucursal." },
  promotions: { title: "Promociones", description: "Ofertas y códigos de descuento." },
  inventory: { title: "Inventario", description: "Existencias, movimientos y revisiones." },
  locations: { title: "Sucursales", description: "Ubicaciones y CEDIS del negocio." },
  orders: { title: "Pedidos", description: "Pedidos en línea y su preparación." },
  cedis: { title: "CEDIS", description: "Centros de distribución." },
  sales: { title: "Ventas", description: "Historial de ventas del POS." },
  reports: { title: "Reportes", description: "Analítica y reportes exportables." },
  profile: { title: "Mi perfil", description: "Tu información y preferencias." },
};

const DEFAULT = { title: "Sección", description: "Módulo en desarrollo." };

export default async function AdminModulePlaceholder({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const meta = TITLES[module] ?? DEFAULT;

  return (
    <>
      <PageHeader
        icon={<Construction className="size-5" />}
        title={meta.title}
        description={meta.description}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">En construcción</CardTitle>
          <CardDescription>
            Este módulo se implementará en las próximas fases del plan maestro.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">Próximamente</Badge>
        </CardContent>
      </Card>
    </>
  );
}