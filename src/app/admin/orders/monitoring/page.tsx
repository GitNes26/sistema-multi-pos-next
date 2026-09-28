import { redirect } from "next/navigation";

// El monitoreo ahora es la vista "Tablero en vivo" de Pedidos.
export default function AdminOrdersMonitoringPage() {
  redirect("/admin/orders?vista=tablero");
}
