// ── Mensajería saliente (WhatsApp / SMS) ─────────────────────────────────────
// Avisa al invitado (sin cuenta) sobre su reservación confirmada o su mesa
// liberada en la lista de espera. Usa Twilio vía REST con fetch (sin SDK
// extra). Sin credenciales el envío se omite silenciosamente con un log —
// igual que las push en `push.ts`.
//
// Config (todas opcionales):
//   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN   credenciales de Twilio
//   TWILIO_WHATSAPP_FROM                     remitente WhatsApp (E.164; acepta prefijo whatsapp:)
//   TWILIO_SMS_FROM                          remitente SMS (fallback si WhatsApp falla)
//   TWILIO_MESSAGING_SERVICE_SID             servicio de mensajería (alternativa a TWILIO_SMS_FROM)
//   MESSAGING_DEFAULT_COUNTRY_CODE           lada por defecto para números locales (default: 52)

const DEFAULT_COUNTRY_CODE = process.env.MESSAGING_DEFAULT_COUNTRY_CODE || "52";

export type MessagingChannel = "whatsapp" | "sms";

export interface MessagingResult {
  sent: boolean;
  channel: MessagingChannel | null;
}

interface TwilioCreds {
  accountSid: string;
  authToken: string;
}

function twilioCreds(): TwilioCreds | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return { accountSid, authToken };
}

/**
 * Normaliza el teléfono del invitado a E.164: quita no-dígitos, prefijos
 * internacionales (00) y móviles MX antiguos (044/045); agrega la lada por
 * defecto a números locales de 10 dígitos. Devuelve null si no hay dígitos.
 */
export function normalizePhoneToE164(
  raw: string,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE
): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Móviles MX antiguos: 044/045 + número local de 10 dígitos — al quitar el
  // prefijo queda un número local que igual necesita lada país abajo.
  if (/^0(44|45)/.test(digits)) digits = digits.slice(3);
  if (digits.length === 10) {
    digits = `${defaultCountryCode}${digits}`; // número local sin lada país
  }
  return digits ? `+${digits}` : null;
}

/** Oculta el centro del número para logs. */
function maskPhone(e164: string): string {
  return e164.length > 5 ? `${e164.slice(0, 3)}****${e164.slice(-2)}` : "***";
}

async function twilioSend(creds: TwilioCreds, params: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params),
      }
    );
    if (res.ok) return true;
    const detail = await res.text().catch(() => "");
    console.error(`[messaging] Twilio ${res.status}:`, detail.slice(0, 300));
    return false;
  } catch (err) {
    console.error("[messaging] Error de red al llamar a Twilio:", err);
    return false;
  }
}

/**
 * Envía un texto al invitado: WhatsApp primero y, si falla, SMS. Nunca lanza.
 * Sin Twilio configurado devuelve { sent: false, channel: null } con un log.
 */
export async function sendGuestText(phone: string, body: string): Promise<MessagingResult> {
  const creds = twilioCreds();
  if (!creds) {
    console.info("[messaging] Twilio no configurado — se omite el aviso al invitado");
    return { sent: false, channel: null };
  }

  const to = normalizePhoneToE164(phone);
  if (!to) {
    console.warn("[messaging] Teléfono de invitado inválido, no se notifica");
    return { sent: false, channel: null };
  }

  // 1) WhatsApp (canal preferido — es el que el comensal usa para pedir).
  const waFrom = process.env.TWILIO_WHATSAPP_FROM;
  if (waFrom) {
    const ok = await twilioSend(creds, {
      To: `whatsapp:${to}`,
      From: waFrom.startsWith("whatsapp:") ? waFrom : `whatsapp:${waFrom}`,
      Body: body,
    });
    if (ok) return { sent: true, channel: "whatsapp" };
    console.warn(`[messaging] WhatsApp falló para ${maskPhone(to)} — intentando SMS`);
  }

  // 2) Fallback SMS (requiere remitente o servicio de mensajería).
  const smsFrom = process.env.TWILIO_SMS_FROM;
  const serviceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!smsFrom && !serviceSid) {
    console.warn(`[messaging] Sin remitente SMS configurado — ${maskPhone(to)} queda sin aviso`);
    return { sent: false, channel: null };
  }
  const smsParams: Record<string, string> = { To: to, Body: body };
  if (serviceSid) smsParams.MessagingServiceSid = serviceSid;
  if (smsFrom) smsParams.From = smsFrom;
  const ok = await twilioSend(creds, smsParams);
  return ok ? { sent: true, channel: "sms" } : { sent: false, channel: null };
}

export interface GuestConfirmationInput {
  guestName?: string | null;
  /** Teléfono tal como lo dejó el invitado en /reservar. */
  phone: string;
  organizationName: string;
  startsAt: Date;
  guests: number;
  tableNumber?: number | null;
  roomName?: string | null;
}

/** Texto del aviso de confirmación para el invitado (es-MX, texto plano). */
export function buildGuestConfirmationMessage(input: GuestConfirmationInput): string {
  const when = new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(input.startsAt);
  const place = input.tableNumber
    ? `🪑 Mesa ${input.tableNumber}`
    : input.roomName
      ? `🪑 ${input.roomName}`
      : "🪑 Asignaremos tu mesa al llegar";
  const name = input.guestName?.trim() ? ` ${input.guestName.trim()}` : "";
  return [
    `¡Hola${name}! Tu reservación en ${input.organizationName} quedó confirmada ✅`,
    `📅 ${when}`,
    `👥 ${input.guests} ${input.guests === 1 ? "persona" : "personas"}`,
    place,
    "Te esperamos — llega unos minutos antes.",
  ].join("\n");
}

/** Notifica al invitado que su reservación sin cuenta fue confirmada. */
export async function notifyGuestReservationConfirmed(
  input: GuestConfirmationInput
): Promise<MessagingResult> {
  return sendGuestText(input.phone, buildGuestConfirmationMessage(input));
}

export interface GuestWaitlistReadyInput {
  guestName?: string | null;
  phone: string;
  organizationName: string;
  tableNumber: number;
  roomName?: string | null;
  guests: number;
}

/** Texto del aviso de mesa libre para el invitado (es-MX, texto plano). */
export function buildGuestWaitlistReadyMessage(input: GuestWaitlistReadyInput): string {
  const room = input.roomName ? ` (${input.roomName})` : "";
  const name = input.guestName?.trim() ? ` ${input.guestName.trim()}` : "";
  return [
    `¡Buenas noticias${name}! Se liberó la mesa #${input.tableNumber}${room} en ${input.organizationName} 🪑`,
    `Cabe tu grupo de ${input.guests} ${input.guests === 1 ? "persona" : "personas"}.`,
    "Preséntate con este mensaje — el anfitrión te sentará. La mesa se libera si tardas mucho.",
  ].join("\n");
}

/** Notifica al invitado en lista de espera que su mesa quedó libre. */
export async function notifyGuestWaitlistTableReady(
  input: GuestWaitlistReadyInput
): Promise<MessagingResult> {
  return sendGuestText(input.phone, buildGuestWaitlistReadyMessage(input));
}

export interface GuestWaitlistTableTakenInput {
  guestName?: string | null;
  phone: string;
  organizationName: string;
  /** Mesa ofrecida que se ocupó. */
  takenTableNumber: number;
  /** Nueva mesa re-emparejada (null → sigue en espera). */
  newTableNumber?: number | null;
  newRoomName?: string | null;
  guests: number;
}

/** Texto: la mesa ofrecida se ocupó (con re-emparejamiento o en espera). */
export function buildGuestWaitlistTableTakenMessage(input: GuestWaitlistTableTakenInput): string {
  const name = input.guestName?.trim() ? ` ${input.guestName.trim()}` : "";
  const head = `¡Hola${name}! La mesa #${input.takenTableNumber} que te ofrecimos en ${input.organizationName} se ocupó.`;
  if (input.newTableNumber) {
    const room = input.newRoomName ? ` (${input.newRoomName})` : "";
    return [
      head,
      `No te preocupes: te apartamos la mesa #${input.newTableNumber}${room} para tu grupo de ${input.guests}.`,
      "Preséntate con este mensaje — el anfitrión te sentará. La mesa se libera si tardas mucho.",
    ].join("\n");
  }
  return [
    head,
    "Te mantenemos en la lista — te avisamos apenas se libere otra mesa para tu grupo.",
  ].join("\n");
}

/** Avisa al invitado que su mesa ofrecida se ocupó (con nueva mesa si hubo). */
export async function notifyGuestWaitlistTableTaken(
  input: GuestWaitlistTableTakenInput
): Promise<MessagingResult> {
  return sendGuestText(input.phone, buildGuestWaitlistTableTakenMessage(input));
}

export interface GuestWaitlistSeatedInput {
  guestName?: string | null;
  phone: string;
  organizationName: string;
  /** Mesa donde quedó sentado (null → el anfitrión lo acomodó sin oferta previa). */
  tableNumber?: number | null;
  roomName?: string | null;
  guests: number;
}

/** Texto: el anfitrión ya sentó al invitado. */
export function buildGuestWaitlistSeatedMessage(input: GuestWaitlistSeatedInput): string {
  const name = input.guestName?.trim() ? ` ${input.guestName.trim()}` : "";
  const table = input.tableNumber
    ? `Tu mesa es la #${input.tableNumber}${input.roomName ? ` (${input.roomName})` : ""}.`
    : "El anfitrión ya los acomodó.";
  return [
    `¡Hola${name}! Ya estás sentado en ${input.organizationName} 🪑`,
    `${table} Grupo de ${input.guests} — ¡buen provecho!`,
  ].join("\n");
}

/** Confirma al invitado que el anfitrión lo sentó (con su mesa). */
export async function notifyGuestWaitlistSeated(
  input: GuestWaitlistSeatedInput
): Promise<MessagingResult> {
  return sendGuestText(input.phone, buildGuestWaitlistSeatedMessage(input));
}

export interface GuestVerifyCodeInput {
  phone: string;
  code: string;
  organizationName?: string | null;
  /** Minutos de vigencia, para el texto (p. ej. 15). */
  ttlMinutes?: number;
}

/** Texto con el código de verificación para gestionar la reservación. */
export function buildGuestVerifyCodeMessage(input: GuestVerifyCodeInput): string {
  const org = input.organizationName ? `en ${input.organizationName}` : "";
  const ttl = input.ttlMinutes ?? 15;
  return [
    `Tu código para confirmar o cancelar tu reservación ${org}:`,
    input.code,
    `Vence en ${ttl} minutos. No lo compartas.`,
  ].join("\n");
}

/** Envía el código de verificación al invitado por WhatsApp/SMS. */
export async function notifyGuestVerificationCode(
  input: GuestVerifyCodeInput
): Promise<MessagingResult> {
  return sendGuestText(input.phone, buildGuestVerifyCodeMessage(input));
}
