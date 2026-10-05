// FASE 2.8 — Catálogo de permisos (fuente única, sin dependencias de runtime).
// Lo usa el seeder de producción y los helpers de RBAC (client y server).

export const PERMISSIONS = [
  { key: "pos.use", module: "pos", action: "use", label: "Usar punto de venta" },
  { key: "pos.void", module: "pos", action: "void", label: "Cancelar ventas" },
  { key: "pos.discount", module: "pos", action: "discount", label: "Aplicar descuentos manuales" },
  { key: "products.view", module: "products", action: "view", label: "Ver productos" },
  { key: "products.manage", module: "products", action: "manage", label: "Crear/editar productos" },
  { key: "products.delete", module: "products", action: "delete", label: "Eliminar productos" },
  { key: "categories.manage", module: "categories", action: "manage", label: "Gestionar categorías" },
  { key: "inventory.view", module: "inventory", action: "view", label: "Ver inventario" },
  { key: "inventory.manage", module: "inventory", action: "manage", label: "Registrar movimientos y mínimos" },
  { key: "inventory.revision", module: "inventory", action: "revision", label: "Realizar revisiones de inventario" },
  { key: "transfers.view", module: "transfers", action: "view", label: "Ver traslados entre sucursales y CEDIS" },
  { key: "transfers.request", module: "transfers", action: "request", label: "Solicitar traslados" },
  { key: "transfers.dispatch", module: "transfers", action: "dispatch", label: "Preparar y despachar traslados (chofer)" },
  { key: "transfers.receive", module: "transfers", action: "receive", label: "Recibir traslados en destino" },
  { key: "transfers.cancel", module: "transfers", action: "cancel", label: "Cancelar traslados" },
  { key: "purchasing.view", module: "purchasing", action: "view", label: "Ver proveedores y compras" },
  { key: "purchasing.manage", module: "purchasing", action: "manage", label: "Gestionar proveedores, cotizaciones y compras" },
  { key: "purchasing.approve", module: "purchasing", action: "approve", label: "Aprobar órdenes de compra" },
  { key: "purchasing.receive", module: "purchasing", action: "receive", label: "Recibir compras e ingresar inventario" },
  { key: "customers.view", module: "customers", action: "view", label: "Ver clientes" },
  { key: "customers.manage", module: "customers", action: "manage", label: "Crear/editar clientes y puntos" },
  { key: "employees.view", module: "employees", action: "view", label: "Ver empleados" },
  { key: "employees.manage", module: "employees", action: "manage", label: "Crear/editar empleados" },
  { key: "payroll.manage", module: "employees", action: "payroll", label: "Gestionar nómina (periodos, percepciones y deducciones)" },
  { key: "promotions.view", module: "promotions", action: "view", label: "Ver promociones" },
  { key: "promotions.manage", module: "promotions", action: "manage", label: "Crear/editar promociones" },
  { key: "sales.view", module: "sales", action: "view", label: "Ver historial de ventas" },
  { key: "sales.manage", module: "sales", action: "manage", label: "Gestionar devoluciones de ventas" },
  { key: "panel.stats", module: "panel", action: "stats", label: "Ver estadísticos del Panel (ventas, margen, gráficas)" },
  { key: "reports.view", module: "reports", action: "view", label: "Ver reportes" },
  { key: "reports.export", module: "reports", action: "export", label: "Exportar reportes" },
  { key: "cash.open", module: "cash", action: "open", label: "Abrir caja" },
  { key: "cash.close", module: "cash", action: "close", label: "Cerrar caja / cortes" },
  { key: "locations.view", module: "locations", action: "view", label: "Ver sucursales" },
  { key: "locations.manage", module: "locations", action: "manage", label: "Crear/editar sucursales" },
  { key: "cedis.manage", module: "cedis", action: "manage", label: "Gestionar CEDIS" },
  { key: "orders.view", module: "orders", action: "view", label: "Ver pedidos" },
  { key: "orders.manage", module: "orders", action: "manage", label: "Gestionar pedidos (confirmar, cobrar en tienda, preparación)" },
  { key: "kds.operate", module: "kds", action: "operate", label: "Operar la pantalla de cocina (KDS)" },
  { key: "delivery.manage", module: "delivery", action: "manage", label: "Gestionar entregas a domicilio" },
  { key: "appointments.view", module: "appointments", action: "view", label: "Ver agenda y citas" },
  { key: "appointments.manage", module: "appointments", action: "manage", label: "Crear/editar citas, asignar personal y cobrar" },
  { key: "reservations.view", module: "reservations", action: "view", label: "Ver reservaciones y disponibilidad" },
  { key: "reservations.manage", module: "reservations", action: "manage", label: "Crear/editar reservaciones, apartar unidades y cobrar" },
  { key: "settings.manage", module: "settings", action: "manage", label: "Ajustes del sistema y empresa" },
  { key: "users.manage", module: "users", action: "manage", label: "Administrar usuarios, roles y permisos" },
  { key: "publications.manage", module: "publications", action: "manage", label: "Gestionar publicaciones" },
  { key: "supervisor.approve", module: "supervisor", action: "approve", label: "Aprobar acciones" },
  { key: "organizations.manage", module: "organizations", action: "manage", label: "Gestionar organizaciones y asignar admins", superAdminOnly: true },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

/** Nombre legible de cada módulo de permisos (editores de roles y planes). */
export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  pos: "Punto de venta",
  products: "Productos",
  categories: "Categorías",
  inventory: "Inventario",
  transfers: "Traslados",
  purchasing: "Proveedores y compras",
  customers: "Clientes",
  employees: "Empleados y nómina",
  promotions: "Promociones",
  sales: "Ventas",
  panel: "Panel",
  reports: "Reportes",
  cash: "Caja",
  locations: "Sucursales",
  cedis: "CEDIS y traslados",
  orders: "Pedidos",
  kds: "Cocina (KDS)",
  delivery: "Entregas a domicilio",
  appointments: "Agenda de citas",
  reservations: "Reservaciones",
  settings: "Ajustes",
  users: "Usuarios y roles",
  publications: "Publicaciones",
  supervisor: "Supervisor",
  organizations: "Organizaciones",
};

/** Permisos agrupados por módulo, en el orden del catálogo. */
export function permissionsByModule() {
  const groups: Record<string, (typeof PERMISSIONS)[number][]> = {};
  for (const p of PERMISSIONS) (groups[p.module] ??= []).push(p);
  return groups;
}
