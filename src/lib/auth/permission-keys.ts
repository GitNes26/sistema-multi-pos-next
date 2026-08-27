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
  { key: "customers.view", module: "customers", action: "view", label: "Ver clientes" },
  { key: "customers.manage", module: "customers", action: "manage", label: "Crear/editar clientes y puntos" },
  { key: "employees.view", module: "employees", action: "view", label: "Ver empleados" },
  { key: "employees.manage", module: "employees", action: "manage", label: "Crear/editar empleados" },
  { key: "promotions.view", module: "promotions", action: "view", label: "Ver promociones" },
  { key: "promotions.manage", module: "promotions", action: "manage", label: "Crear/editar promociones" },
  { key: "sales.view", module: "sales", action: "view", label: "Ver historial de ventas" },
  { key: "sales.manage", module: "sales", action: "manage", label: "Gestionar devoluciones de ventas" },
  { key: "reports.view", module: "reports", action: "view", label: "Ver reportes" },
  { key: "reports.export", module: "reports", action: "export", label: "Exportar reportes" },
  { key: "cash.open", module: "cash", action: "open", label: "Abrir caja" },
  { key: "cash.close", module: "cash", action: "close", label: "Cerrar caja / cortes" },
  { key: "locations.view", module: "locations", action: "view", label: "Ver sucursales" },
  { key: "locations.manage", module: "locations", action: "manage", label: "Crear/editar sucursales" },
  { key: "cedis.manage", module: "cedis", action: "manage", label: "Gestionar CEDIS" },
  { key: "orders.view", module: "orders", action: "view", label: "Ver pedidos" },
  { key: "orders.manage", module: "orders", action: "manage", label: "Actualizar estatus de pedidos" },
  { key: "settings.manage", module: "settings", action: "manage", label: "Ajustes del sistema y empresa" },
  { key: "users.manage", module: "users", action: "manage", label: "Administrar usuarios, roles y permisos" },
  { key: "publications.manage", module: "publications", action: "manage", label: "Gestionar publicaciones" },
  { key: "supervisor.approve", module: "supervisor", action: "approve", label: "Aprobar acciones" },
  { key: "organizations.manage", module: "organizations", action: "manage", label: "Gestionar organizaciones y asignar admins", superAdminOnly: true },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];