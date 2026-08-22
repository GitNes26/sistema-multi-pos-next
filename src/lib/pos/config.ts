import type { $Enums } from "@prisma/client";

// 6.10 – Denominaciones del NumPad de efectivo (MXN).
export const CASH_DENOMINATIONS = [20, 50, 100, 200, 500, 1000] as const;

// 6.12 – Ancho del ticket térmico 80mm.
export const RECEIPT_WIDTH = "80mm";

// Puntos de lealtad: 100 puntos = $1.00 de crédito.
export const POINTS_PER_PESO = 100;
// Puntos ganados: 1 punto por cada peso pagado.
export const LOYALTY_EARN_RATE = 1;

export const DEFAULT_TAX_RATE = 0.16;

export const PAYMENT_METHOD_LABELS: Record<$Enums.PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  wallet: "Monedero",
  other: "Otro",
  points: "Puntos",
};

// 6.20 – Semáforo de pedidos.
export const ORDER_STATUS_COLORS: Record<$Enums.OrderStatus, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-sky-500",
  preparing: "bg-orange-500",
  ready: "bg-emerald-500",
  in_transit: "bg-violet-500",
  delivered: "bg-blue-600",
  cancelled: "bg-red-500",
};

export const ORDER_STATUS_LABELS: Record<$Enums.OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  in_transit: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

// 6.19 – Aprobación de supervisor (demo). En producción se resuelve con el
// permiso `supervisor.approve` de RBAC (FASE 14); aquí el PIN se configura en
// el POS y se guarda en localStorage.
export const POS_SUPERVISOR_PIN_DEFAULT = "1234";
export const POS_SUPERVISOR_STORAGE_KEY = "pos.supervisor.pin";
export const POS_SUPERVISOR_REQUIRED_STORAGE_KEY = "pos.supervisor.required";

// Descuento manual máximo sin aprobación de supervisor (percent).
export const POS_MANUAL_DISCOUNT_LIMIT_PERCENT = 10;
