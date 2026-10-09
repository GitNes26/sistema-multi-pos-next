/** Dirección pública del portal de clientes (QR y texto al pie de tickets y documentos). */
export const PORTAL_LOGIN_URL = process.env.NEXT_PUBLIC_PORTAL_URL?.trim() || "https://multipos.nessik.net/portal/auth/login"

/** Texto estándar de invitación a comprar desde la app (se imprime junto al QR). */
export const PORTAL_PROMO_LINES = [
  "Compra desde la app",
  "Escanea el QR o entra al enlace y",
  "haz tus pedidos desde tu celular.",
  "Regístrate en el punto de venta o con",
  "«Soy nuevo» en el enlace.",
] as const
