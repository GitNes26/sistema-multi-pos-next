// FASE 7 — Metadatos de UI para el CRUD genérico del admin (solo lado cliente).
// No importa nada del servidor para poder usarse en componentes "use client".

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "percent"
  | "boolean"
  | "select"
  | "code"
  | "date"
  | "time"
  | "multiselect"
  | "image"
  | "gps"
  | "schedule";

export interface SelectOption {
  value: string;
  label: string;
}

export interface CrudField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  full?: boolean;
  options?: SelectOption[];
  /** Módulo CRUD del que se cargan las opciones (p. ej. "categories"). */
  optionsModule?: string;
  /** Campo del listado que se usa como valor de la opción. */
  optionValue?: string;
  /** Campo del listado que se usa como etiqueta de la opción. */
  optionLabel?: string;
  /** Clave de un sub-arreglo dentro de cada fila (p. ej. "variants") para aplanar opciones anidadas. */
  optionNested?: string;
  /** Campo del formulario donde se guarda la latitud (para tipo "gps"). */
  latKey?: string;
  /** Campo del formulario donde se guarda la longitud (para tipo "gps"). */
  lonKey?: string;
  /** Mostrar el campo solo si se cumple la condición. */
  showIf?: (values: Record<string, unknown>) => boolean;
}

export interface CrudColumn {
  key: string;
  label: string;
  type?: "text" | "money" | "percent" | "boolean" | "badge" | "count" | "code";
  /** Convierte el valor crudo a una etiqueta para los tipos badge/text. */
  displayMap?: Record<string, string>;
}

export interface CrudUiConfig {
  module: string;
  title: string;
  description: string;
  canDelete?: boolean;
  searchPlaceholder?: string;
  columns: CrudColumn[];
  fields: CrudField[];
}

const UNIT_TYPES: SelectOption[] = [
  { value: "unit", label: "Unidad / Pieza" },
  { value: "weight", label: "Peso" },
  { value: "volume", label: "Volumen" },
  { value: "length", label: "Longitud" },
  { value: "custom", label: "Personalizada" },
];

const BENEFIT_TYPES: SelectOption[] = [
  { value: "percent_off", label: "% de descuento" },
  { value: "amount_off", label: "Descuento en $", },
  { value: "fixed_price", label: "Precio fijo" },
  { value: "buy_x_get_y", label: "Lleva X y paga Y (2x1…)" },
  { value: "free_item", label: "Producto gratis" },
  { value: "next_purchase_coupon", label: "Cupón para próxima compra" },
];

const PROMO_SCOPES: SelectOption[] = [
  { value: "order", label: "Todo el pedido" },
  { value: "category", label: "Categoría" },
  { value: "product", label: "Producto" },
  { value: "variant", label: "Variante" },
];

export const WEEKDAY_OPTIONS: SelectOption[] = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Lun" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Mié" },
  { value: "4", label: "Jue" },
  { value: "5", label: "Vie" },
  { value: "6", label: "Sáb" },
];

export const CRUD_UI: Record<string, CrudUiConfig> = {
  categories: {
    module: "categories",
    title: "Categorías",
    description: "Organiza tus productos por categorías.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "parentName", label: "Categoría padre", type: "badge" },
      { key: "productCount", label: "Productos", type: "count" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true, placeholder: "Ej. Bebidas" },
      {
        key: "parentId",
        label: "Categoría padre",
        type: "select",
        optionsModule: "categories",
        optionValue: "id",
        optionLabel: "name",
      },
      { key: "imageUrl", label: "Imagen", type: "image", full: true, placeholder: "https://…" },
      { key: "isActive", label: "Activa", type: "boolean" },
    ],
  },

  units: {
    module: "units",
    title: "Unidades de medida",
    description: "Unidades para peso, volumen y piezas.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre o abreviatura…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "abbreviation", label: "Abreviatura", type: "badge" },
      { key: "type", label: "Tipo", type: "badge" },
      { key: "isSystem", label: "Sistema", type: "boolean" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true, placeholder: "Ej. Kilogramo" },
      { key: "abbreviation", label: "Abreviatura", type: "text", required: true, placeholder: "kg" },
      { key: "type", label: "Tipo", type: "select", options: UNIT_TYPES, required: true },
      { key: "baseUnit", label: "Unidad base", type: "text", placeholder: "Ej. g" },
      { key: "conversionFactor", label: "Factor de conversión", type: "number", placeholder: "1" },
      { key: "isActive", label: "Activa", type: "boolean" },
    ],
  },

  customers: {
    module: "customers",
    title: "Clientes",
    description: "Gestiona clientes y puntos de lealtad.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre, teléfono o nº de cliente…",
    columns: [
      { key: "fullName", label: "Nombre" },
      { key: "customerCode", label: "Nº cliente", type: "badge" },
      { key: "phone", label: "Teléfono" },
      { key: "email", label: "Correo" },
      { key: "points", label: "Puntos" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "fullName", label: "Nombre completo", type: "text", required: true },
      { key: "customerCode", label: "Nº de cliente", type: "text", placeholder: "CLI-0001 (auto)" },
      { key: "phone", label: "Teléfono", type: "text", placeholder: "55 1234 5678" },
      {
        key: "email",
        label: "Correo",
        type: "text",
        placeholder: "cliente@correo.com",
        help: "Se asocia a una cuenta de usuario del portal. Contraseña inicial: la misma dirección (el cliente la cambia en su primer acceso).",
      },
      { key: "points", label: "Puntos", type: "number" },
      { key: "address", label: "Dirección", type: "textarea", full: true },
      { key: "imageUrl", label: "Foto", type: "image", full: true },
      { key: "isActive", label: "Activo", type: "boolean" },
    ],
  },

  locations: {
    module: "locations",
    title: "Sucursales",
    description: "Ubicaciones del negocio.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre, encargado o dirección…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "code", label: "Código", type: "code" },
      { key: "address", label: "Dirección" },
      { key: "phone", label: "Teléfono" },
      { key: "allowsPickup", label: "Recoge", type: "boolean" },
      { key: "allowsDelivery", label: "Entrega", type: "boolean" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true, placeholder: "Ej. Sucursal Centro" },
      { key: "code", label: "Código", type: "text", placeholder: "CTR" },
      { key: "address", label: "Dirección", type: "textarea", full: true },
      { key: "managerName", label: "Encargado", type: "text" },
      { key: "phone", label: "Teléfono", type: "text" },
      { key: "email", label: "Correo", type: "text" },
      { key: "openingHours", label: "Horario (texto)", type: "text", placeholder: "Lun–Sáb 8:00–20:00", showIf: () => false },
      { key: "openingScheduleJson", label: "Horario", type: "schedule", full: true },
      {
        key: "gps",
        label: "Ubicación (GPS)",
        type: "gps",
        latKey: "latitude",
        lonKey: "longitude",
        full: true,
        help: "Busca una dirección, usa tu ubicación o teclea lat/lon manualmente.",
      },
      { key: "timezone", label: "Zona horaria", type: "text", placeholder: "America/Mexico_City" },
      { key: "notes", label: "Notas", type: "textarea", full: true },
      { key: "imageUrl", label: "Imagen", type: "image", full: true },
      { key: "allowsPickup", label: "Permite recoger en tienda", type: "boolean" },
      { key: "allowsDelivery", label: "Permite delivery", type: "boolean" },
      { key: "isActive", label: "Activa", type: "boolean" },
    ],
  },

  positions: {
    module: "positions",
    title: "Puestos",
    description: "Puestos de empleado (cajero, supervisor…).",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "description", label: "Descripción" },
      { key: "employeeCount", label: "Empleados", type: "count" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true, placeholder: "Ej. Cajero" },
      { key: "description", label: "Descripción", type: "textarea", full: true },
      { key: "isActive", label: "Activo", type: "boolean" },
    ],
  },

  employees: {
    module: "employees",
    title: "Empleados",
    description: "Equipo y accesos de la organización.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre, nómina, teléfono o correo…",
    columns: [
      { key: "fullName", label: "Nombre" },
      { key: "employeeCode", label: "Nómina", type: "code" },
      {
        key: "role",
        label: "Rol",
        type: "badge",
        displayMap: { owner: "Propietario", admin: "Admin", manager: "Gerente", cashier: "Cajero" },
      },
      { key: "positionName", label: "Puesto", type: "badge" },
      { key: "locationName", label: "Sucursal", type: "badge" },
      { key: "phone", label: "Teléfono" },
      { key: "email", label: "Correo" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "fullName", label: "Nombre completo", type: "text", required: true },
      { key: "employeeCode", label: "Nº de nómina", type: "text", required: true, placeholder: "EMP-001" },
      {
        key: "role",
        label: "Rol",
        type: "select",
        required: true,
        options: [
          { value: "cashier", label: "Cajero" },
          { value: "manager", label: "Gerente" },
          { value: "admin", label: "Admin" },
          { value: "owner", label: "Propietario" },
        ],
        help: "Se crea una cuenta de usuario para el empleado con este rol de acceso.",
      },
      {
        key: "positionId",
        label: "Puesto",
        type: "select",
        optionsModule: "positions",
        optionValue: "id",
        optionLabel: "name",
      },
      {
        key: "locationId",
        label: "Sucursal base",
        type: "select",
        optionsModule: "locations",
        optionValue: "id",
        optionLabel: "name",
        help: "Sucursal donde trabaja normalmente el empleado.",
      },
      { key: "phone", label: "Teléfono", type: "text" },
      {
        key: "email",
        label: "Correo",
        type: "text",
        placeholder: "empleado@correo.com",
        help: "Correo de acceso y contraseña inicial: es la misma dirección. Si se deja vacío se genera uno automático y ese será también su contraseña. Indícalo al empleado para que lo cambie en su primer acceso.",
      },
      { key: "imageUrl", label: "Foto", type: "image", full: true },
      { key: "isActive", label: "Activo", type: "boolean" },
    ],
  },

  cashRegisters: {
    module: "cashRegisters",
    title: "Cajas",
    description: "Cajas registradoras por sucursal.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "locationName", label: "Sucursal", type: "badge" },
      { key: "folioPrefix", label: "Prefijo", type: "code" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true, placeholder: "Ej. Caja 1" },
      {
        key: "locationId",
        label: "Sucursal",
        type: "select",
        optionsModule: "locations",
        optionValue: "id",
        optionLabel: "name",
        required: true,
      },
      { key: "folioPrefix", label: "Prefijo de folio", type: "text", placeholder: "C1" },
      { key: "isActive", label: "Activa", type: "boolean" },
    ],
  },

  cedis: {
    module: "cedis",
    title: "CEDIS",
    description: "Centros de distribución.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre, encargado o dirección…",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "code", label: "Código", type: "code" },
      { key: "address", label: "Dirección" },
      { key: "managerName", label: "Encargado" },
      { key: "phone", label: "Teléfono" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true, placeholder: "Ej. CEDIS Norte" },
      { key: "code", label: "Código", type: "text", placeholder: "CDN" },
      { key: "address", label: "Dirección", type: "textarea", full: true },
      { key: "managerName", label: "Encargado", type: "text" },
      { key: "phone", label: "Teléfono", type: "text" },
      { key: "email", label: "Correo", type: "text" },
      { key: "openingHours", label: "Horario (texto)", type: "text", placeholder: "Lun-Sab 8:00-20:00", showIf: () => false },
      { key: "openingScheduleJson", label: "Horario", type: "schedule", full: true },
      { key: "latitude", label: "Latitud", type: "number" },
      { key: "longitude", label: "Longitud", type: "number" },
      { key: "timezone", label: "Zona horaria", type: "text", placeholder: "America/Mexico_City" },
      { key: "notes", label: "Notas", type: "textarea", full: true },
      { key: "imageUrl", label: "Imagen", type: "image", full: true },
      { key: "isActive", label: "Activo", type: "boolean" },
    ],
  },

  promotions: {
    module: "promotions",
    title: "Promociones",
    description: "Ofertas, descuentos y cupones.",
    canDelete: true,
    searchPlaceholder: "Buscar por nombre o código de cupón…",
    columns: [
      { key: "name", label: "Nombre" },
      {
        key: "benefit",
        label: "Beneficio",
        type: "badge",
        displayMap: {
          percent_off: "% de descuento",
          amount_off: "Descuento en $",
          fixed_price: "Precio fijo",
          buy_x_get_y: "Lleva X paga Y",
          free_item: "Producto gratis",
          next_purchase_coupon: "Cupón próxima compra",
        },
      },
      {
        key: "scope",
        label: "Alcance",
        type: "badge",
        displayMap: { order: "Pedido", category: "Categoría", product: "Producto", variant: "Variante" },
      },
      { key: "couponCode", label: "Cupón", type: "code" },
      { key: "usesCount", label: "Usos", type: "count" },
      { key: "isActive", label: "Estado", type: "boolean" },
    ],
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true, placeholder: "Ej. 2x1 en bebidas" },
      { key: "description", label: "Descripción", type: "textarea", full: true },
      { key: "benefit", label: "Tipo de beneficio", type: "select", options: BENEFIT_TYPES, required: true },
      { key: "scope", label: "Alcance", type: "select", options: PROMO_SCOPES, required: true },
      {
        key: "value",
        label: "Valor del beneficio",
        type: "number",
        full: true,
        help: "Porcentaje (0–100), cantidad en $ o precio fijo según el tipo de beneficio.",
      },
      {
        key: "buyQuantity",
        label: "Lleva (cantidad)",
        type: "number",
        showIf: (v) => v.benefit === "buy_x_get_y",
      },
      {
        key: "getQuantity",
        label: "Paga / regala (cantidad)",
        type: "number",
        showIf: (v) => v.benefit === "buy_x_get_y",
      },
      { key: "minAmount", label: "Mínimo de compra ($)", type: "money" },
      { key: "minQuantity", label: "Mínimo de piezas", type: "number" },
      { key: "couponCode", label: "Código de cupón", type: "text", full: true, help: "Si aplicas, el cajero lo teclea; no se aplica automáticamente." },
      { key: "requiresCustomer", label: "Requiere cliente registrado", type: "boolean" },
      { key: "priority", label: "Prioridad", type: "number", help: "Menor número = mayor prioridad." },
      { key: "exclusive", label: "Exclusiva", type: "boolean", help: "Si aplica, bloquea las demás promociones." },
      { key: "maxUses", label: "Uso máximo (total)", type: "number" },
      { key: "maxUsesPerCustomer", label: "Uso máximo por cliente", type: "number" },
      { key: "startsAt", label: "Inicio", type: "date", full: false },
      { key: "endsAt", label: "Fin", type: "date", full: false },
      { key: "weekdays", label: "Días de la semana", type: "multiselect", options: WEEKDAY_OPTIONS, full: true },
      { key: "startTime", label: "Desde (hora)", type: "time" },
      { key: "endTime", label: "Hasta (hora)", type: "time" },
      {
        key: "targetLocations",
        label: "Sucursales",
        type: "multiselect",
        optionsModule: "locations",
        optionValue: "id",
        optionLabel: "name",
        full: true,
        help: "Vacío = todas.",
      },
      {
        key: "targetCategories",
        label: "Categorías",
        type: "multiselect",
        optionsModule: "categories",
        optionValue: "id",
        optionLabel: "name",
        full: true,
        showIf: (v) => v.scope === "category",
      },
      {
        key: "targetProducts",
        label: "Productos",
        type: "multiselect",
        optionsModule: "products",
        optionValue: "id",
        optionLabel: "name",
        full: true,
        showIf: (v) => v.scope === "product",
      },
      {
        key: "targetVariants",
        label: "Variantes",
        type: "multiselect",
        optionsModule: "products",
        optionNested: "variants",
        optionValue: "id",
        optionLabel: "name",
        full: true,
        showIf: (v) => v.scope === "variant",
      },
      {
        key: "rewardVariants",
        label: "Variante que se regala",
        type: "multiselect",
        optionsModule: "products",
        optionNested: "variants",
        optionValue: "id",
        optionLabel: "name",
        full: true,
        showIf: (v) => v.benefit === "free_item",
      },
      { key: "imageUrl", label: "Imagen", type: "image", full: true },
      { key: "isActive", label: "Activa", type: "boolean" },
    ],
  },
};

export function getCrudUi(module: string): CrudUiConfig | undefined {
  return CRUD_UI[module];
}

export const CRUD_PRODUCTS_TITLE = {
  module: "products",
  title: "Productos",
  description: "Catálogo de productos del POS.",
  searchPlaceholder: "Buscar por nombre o SKU…",
} as const;