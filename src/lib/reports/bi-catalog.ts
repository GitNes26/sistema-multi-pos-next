import type { BusinessMode } from "@prisma/client"

export const BUSINESS_MODES: BusinessMode[] = ["retail", "food_service", "services", "rental", "hybrid"]
export type BiReportId =
  | "omnichannel" | "heatmap" | "inventory" | "ranking" | "cohorts" | "employee_ranking"
  | "loyalty" | "credit_aging" | "promos_roi" | "delivery" | "low_stock" | "segmentation"
  | "margin" | "daily_trend" | "payment_mix" | "product_pairs" | "transfers" | "fill_rate"
  | "employee_margin" | "forecast" | "table_performance" | "appointments" | "rentals"

export interface BiReportDefinition { id: BiReportId; label: string; description: string; modes: BusinessMode[]; group: "Ventas" | "Operación" | "Clientes" | "Inventario" }
const all = BUSINESS_MODES
export const BI_REPORTS: BiReportDefinition[] = [
  { id:"omnichannel",label:"Omnicanal",description:"Compara POS, portal y ticket promedio por sucursal.",modes:all,group:"Ventas" },
  { id:"heatmap",label:"Horas pico",description:"Demanda por día de la semana y hora.",modes:all,group:"Ventas" },
  { id:"daily_trend",label:"Tendencia diaria",description:"Evolución de ventas y ticket promedio.",modes:all,group:"Ventas" },
  { id:"payment_mix",label:"Métodos de pago",description:"Participación de cada forma de cobro.",modes:all,group:"Ventas" },
  { id:"margin",label:"Margen por categoría",description:"Ingresos, costos y margen comercial.",modes:all,group:"Ventas" },
  { id:"ranking",label:"Productos y servicios",description:"Ranking por unidades, ingreso y margen.",modes:all,group:"Ventas" },
  { id:"forecast",label:"Pronóstico",description:"Estimación basada en el historial disponible.",modes:all,group:"Ventas" },
  { id:"inventory",label:"Inventario valorado",description:"Valor a costo y venta por categoría.",modes:all,group:"Inventario" },
  { id:"low_stock",label:"Stock bajo",description:"Existencias por debajo del mínimo.",modes:all,group:"Inventario" },
  { id:"fill_rate",label:"Disponibilidad",description:"Porcentaje de catálogo con existencias.",modes:all,group:"Inventario" },
  { id:"transfers",label:"Transferencias",description:"Movimiento de existencias entre ubicaciones.",modes:["retail","food_service","rental","hybrid"],group:"Inventario" },
  { id:"product_pairs",label:"Canasta",description:"Productos comprados en conjunto.",modes:["retail","food_service","hybrid"],group:"Ventas" },
  { id:"employee_ranking",label:"Desempeño de empleados",description:"Ventas, tickets y unidades por empleado.",modes:all,group:"Operación" },
  { id:"employee_margin",label:"Margen por empleado",description:"Rentabilidad atribuida al personal.",modes:all,group:"Operación" },
  { id:"delivery",label:"Entregas",description:"Tiempos y cumplimiento de pedidos a domicilio.",modes:["retail","food_service","hybrid"],group:"Operación" },
  { id:"table_performance",label:"Mesas",description:"Ocupación, rotación y venta asociada a mesas.",modes:["food_service","hybrid"],group:"Operación" },
  { id:"appointments",label:"Citas",description:"Asistencia, cancelación y facturación de servicios.",modes:["services","hybrid"],group:"Operación" },
  { id:"rentals",label:"Rentas",description:"Reservaciones, unidades e ingresos de renta.",modes:["rental","hybrid"],group:"Operación" },
  { id:"cohorts",label:"Cohortes",description:"Retención de clientes por mes de alta.",modes:all,group:"Clientes" },
  { id:"loyalty",label:"Lealtad",description:"Puntos, gasto y frecuencia por cliente.",modes:all,group:"Clientes" },
  { id:"credit_aging",label:"Cartera de crédito",description:"Saldos y antigüedad de cartera.",modes:all,group:"Clientes" },
  { id:"promos_roi",label:"ROI de promociones",description:"Ingresos producidos frente a descuentos.",modes:all,group:"Ventas" },
  { id:"segmentation",label:"Segmentación",description:"Distribución y valor de segmentos de clientes.",modes:all,group:"Clientes" },
]
export const reportsForMode = (mode: BusinessMode) => BI_REPORTS.filter((report) => report.modes.includes(mode))
