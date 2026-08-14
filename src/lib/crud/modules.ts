import type { PermissionKey } from "@/lib/auth/permission-keys";
import type { CrudModule } from "./types";
import { unitsModule } from "./modules/units";
import { categoriesModule } from "./modules/categories";
import { customersModule } from "./modules/customers";
import { locationsModule } from "./modules/locations";
import { productsModule } from "./modules/products";
import { positionsModule } from "./modules/positions";
import { employeesModule } from "./modules/employees";
import { cashRegistersModule } from "./modules/cash-registers";
import { cedisModule } from "./modules/cedis";
import { promotionsModule } from "./modules/promotions";

// FASE 7 — Registro central de módulos CRUD del admin.
// El metadata de UI vive en components/admin/crud/crud-config.ts (lado cliente).
// Este registro viaja solo del lado servidor: API + páginas.

export interface CrudRegistryEntry {
  module: CrudModule<unknown>;
  title: string;
  description: string;
  permissionView: PermissionKey;
  permissionManage: PermissionKey;
  permissionDelete?: PermissionKey;
}

export const CRUD_MODULES: Record<string, CrudRegistryEntry> = {
  products: {
    module: productsModule as CrudModule<unknown>,
    title: "Productos",
    description: "Catálogo de productos del POS.",
    permissionView: "products.view",
    permissionManage: "products.manage",
    permissionDelete: "products.delete",
  },
  categories: {
    module: categoriesModule as CrudModule<unknown>,
    title: "Categorías",
    description: "Organiza tus productos por categorías.",
    permissionView: "categories.manage",
    permissionManage: "categories.manage",
  },
  customers: {
    module: customersModule as CrudModule<unknown>,
    title: "Clientes",
    description: "Gestiona clientes y puntos de lealtad.",
    permissionView: "customers.view",
    permissionManage: "customers.manage",
  },
  locations: {
    module: locationsModule as CrudModule<unknown>,
    title: "Sucursales",
    description: "Ubicaciones y CEDIS del negocio.",
    permissionView: "locations.view",
    permissionManage: "locations.manage",
  },
  units: {
    module: unitsModule as CrudModule<unknown>,
    title: "Unidades de medida",
    description: "Unidades para peso, volumen y piezas.",
    permissionView: "products.manage",
    permissionManage: "products.manage",
  },
  positions: {
    module: positionsModule as CrudModule<unknown>,
    title: "Puestos",
    description: "Puestos de empleado (cajero, supervisor…).",
    permissionView: "employees.view",
    permissionManage: "employees.manage",
  },
  employees: {
    module: employeesModule as CrudModule<unknown>,
    title: "Empleados",
    description: "Equipo y accesos de la organización.",
    permissionView: "employees.view",
    permissionManage: "employees.manage",
  },
  cashRegisters: {
    module: cashRegistersModule as CrudModule<unknown>,
    title: "Cajas",
    description: "Cajas registradoras por sucursal.",
    permissionView: "locations.view",
    permissionManage: "locations.manage",
  },
  cedis: {
    module: cedisModule as CrudModule<unknown>,
    title: "CEDIS",
    description: "Centros de distribución.",
    permissionView: "cedis.manage",
    permissionManage: "cedis.manage",
  },
  promotions: {
    module: promotionsModule as CrudModule<unknown>,
    title: "Promociones",
    description: "Ofertas, descuentos y cupones.",
    permissionView: "promotions.view",
    permissionManage: "promotions.manage",
  },
};

export const CRUD_KEYS = Object.keys(CRUD_MODULES);

export function getCrudEntry(key: string): CrudRegistryEntry | undefined {
  return CRUD_MODULES[key];
}