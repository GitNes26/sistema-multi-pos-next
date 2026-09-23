import nodemailer from "nodemailer";
import { issuePasswordResetToken } from "@/lib/auth/users";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.NEXTAUTH_URL);
}

function resetUrl(token: string) {
  const base = process.env.NEXTAUTH_URL;
  if (!base) throw new Error("NEXTAUTH_URL no está configurada");
  const url = new URL("/auth/reset", base);
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT inválido");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    disableFileAccess: true, disableUrlAccess: true, connectionTimeout: 10000,
  });
}

function emailShell(title: string, content: string) {
  return `<div style="background:#f5f5f5;padding:28px 12px;font-family:Arial,sans-serif;color:#20242b"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden"><div style="background:#20242b;color:#fff;padding:20px 28px;font-size:18px;font-weight:700">Multi-POS</div><div style="padding:28px"><h1 style="font-size:22px;margin:0 0 16px">${title}</h1>${content}</div></div><p style="text-align:center;color:#6b7280;font-size:12px">Mensaje automático de seguridad · No respondas este correo.</p></div>`;
}

export async function sendPasswordLink(email: string, token: string, kind: "welcome" | "reset") {
  if (!mailConfigured()) throw new Error("Correo SMTP no configurado");
  const url = resetUrl(token);
  const title = kind === "welcome" ? "Configura tu contraseña" : "Restablece tu contraseña";
  const intro = kind === "welcome" ? "Tu cuenta ya está registrada. Elige una contraseña para entrar." : "Recibimos una solicitud para cambiar tu contraseña.";
  await transport().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `${title} · Multi-POS`,
    text: `${intro}\n\nAbre este enlace (vence en 1 hora):\n${url}\n\nSi no esperabas este correo, ignóralo.`,
    html: emailShell(title, `<p style="line-height:1.6">${intro}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#20242b;color:white;text-decoration:none;border-radius:10px;font-weight:700">Elegir contraseña</a></p><p style="font-size:13px;color:#626b76;line-height:1.5">El enlace vence en 1 hora. Al cambiarla se cerrarán las demás sesiones de tu cuenta. Si no hiciste esta solicitud, ignora el mensaje.</p>`),
  });
}

export async function sendPasswordChangeCode(email: string, code: string) {
  if (!mailConfigured()) throw new Error("Correo SMTP no configurado");
  await transport().sendMail({
    from: process.env.SMTP_FROM, to: email, subject: "Código para cambiar tu contraseña · Multi-POS",
    text: `Tu código de verificación es ${code}. Vence en 10 minutos.`,
    html: emailShell("Confirma que eres tú", `<p>Usa este código para autorizar el cambio de contraseña:</p><div style="font-size:30px;letter-spacing:8px;font-weight:700;text-align:center;background:#f3f4f6;border-radius:12px;padding:18px;margin:20px 0">${escapeHtml(code)}</div><p style="font-size:13px;color:#626b76">Vence en 10 minutos. Si no lo solicitaste, conserva tu contraseña actual.</p>`),
  });
}

export async function sendWelcomeLink(email: string) {
  const result = await issuePasswordResetToken(email);
  if (!result.token) throw new Error("No se pudo crear el enlace de acceso");
  await sendPasswordLink(email, result.token, "welcome");
}
