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

export async function sendPasswordLink(email: string, token: string, kind: "welcome" | "reset") {
  if (!mailConfigured()) throw new Error("Correo SMTP no configurado");
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT inválido");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 10000,
  });
  const url = resetUrl(token);
  const title = kind === "welcome" ? "Configura tu contraseña" : "Restablece tu contraseña";
  const intro = kind === "welcome" ? "Tu cuenta ya está registrada. Elige una contraseña para entrar." : "Recibimos una solicitud para cambiar tu contraseña.";
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `${title} · Multi-POS`,
    text: `${intro}\n\nAbre este enlace (vence en 1 hora):\n${url}\n\nSi no esperabas este correo, ignóralo.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#20242b"><h1 style="font-size:22px">${title}</h1><p>${intro}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#20242b;color:white;text-decoration:none;border-radius:8px">Elegir contraseña</a></p><p style="font-size:13px;color:#626b76">El enlace vence en 1 hora. Si no esperabas este correo, ignóralo.</p></div>`,
  });
}

export async function sendWelcomeLink(email: string) {
  const result = await issuePasswordResetToken(email);
  if (!result.token) throw new Error("No se pudo crear el enlace de acceso");
  await sendPasswordLink(email, result.token, "welcome");
}
