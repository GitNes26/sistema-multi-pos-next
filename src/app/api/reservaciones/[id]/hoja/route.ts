import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reservationErrorResponse, requireReservationsSession } from "../../helpers";

export const dynamic = "force-dynamic";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const dt = (d: Date | null) => (d ? d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—");

// Hoja de renta imprimible (HTML): datos, artículos, depósito, condiciones y firmas. Se abre y se imprime desde el navegador.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireReservationsSession();
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  try {
    const r = await prisma.reservation.findFirst({
      where: { id, organizationId: guard.organizationId },
      select: {
        startsAt: true, endsAt: true, notes: true, depositAmount: true, depositNote: true, deliveredAt: true, returnedAt: true,
        lateFee: true, damageFee: true, depositRefund: true, balanceDue: true, createdAt: true,
        customer: { select: { fullName: true, phone: true, email: true, address: true } },
        items: { select: { quantity: true, unitPrice: true, lineTotal: true, variant: { select: { product: { select: { name: true } } } } } },
      },
    });
    if (!r) return NextResponse.json({ ok: false, error: "Reservación no encontrada" }, { status: 404 });
    const [company, policy] = await Promise.all([
      prisma.companyProfile.findUnique({ where: { organizationId: guard.organizationId }, select: { tradeName: true, legalName: true, address: true, phone: true } }),
      prisma.rentalPolicy.findUnique({ where: { organizationId: guard.organizationId } }),
    ]);
    const total = r.items.reduce((s, i) => s + Number(i.lineTotal ?? 0), 0);
    const rows = r.items
      .map((i) => `<tr><td>${esc(i.variant.product.name)}</td><td class="n">${Number(i.quantity)}</td><td class="n">${money(Number(i.unitPrice))}</td><td class="n">${money(Number(i.lineTotal ?? 0))}</td></tr>`)
      .join("");
    const late = Number(policy?.lateFeePerDay ?? 0);
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hoja de renta</title>
<style>body{font:14px/1.45 system-ui,sans-serif;margin:24px auto;max-width:720px;color:#111}h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.04em}table{width:100%;border-collapse:collapse}td,th{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left}.n{text-align:right}.muted{color:#555}.sign{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:56px}.sign div{border-top:1px solid #111;padding-top:6px;text-align:center}@media print{body{margin:0}.noprint{display:none}}</style></head><body>
<p class="noprint"><button onclick="window.print()">Imprimir</button></p>
<h1>${esc(company?.tradeName ?? company?.legalName ?? "Hoja de renta")}</h1>
<p class="muted">${esc([company?.address, company?.phone].filter(Boolean).join(" · "))}</p>
<h2>Cliente</h2><p>${esc(r.customer?.fullName ?? "Público general")}${r.customer?.phone ? ` · ${esc(r.customer.phone)}` : ""}${r.customer?.address ? `<br>${esc(r.customer.address)}` : ""}</p>
<h2>Período</h2><p>Del ${esc(dt(r.startsAt))} al ${esc(dt(r.endsAt))}<br>Entregado: ${esc(dt(r.deliveredAt))} · Devuelto: ${esc(dt(r.returnedAt))}</p>
<h2>Artículos</h2><table><thead><tr><th>Artículo</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Importe</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3" class="n"><b>Total de la renta</b></td><td class="n"><b>${money(total)}</b></td></tr></tfoot></table>
<h2>Depósito en garantía</h2><p>${money(Number(r.depositAmount))}${r.depositNote ? ` — ${esc(r.depositNote)}` : ""}. Se regresa al devolver el equipo, descontando retrasos y daños.${late > 0 ? ` Cargo por retraso: ${money(late)} por día.` : ""}</p>
${r.returnedAt ? `<h2>Liquidación</h2><p>Retraso: ${money(Number(r.lateFee))} · Daños: ${money(Number(r.damageFee))} · Se regresa al cliente: ${money(Number(r.depositRefund ?? 0))}${Number(r.balanceDue ?? 0) > 0 ? ` · Saldo cobrado: ${money(Number(r.balanceDue))}` : ""}</p>` : ""}
${r.notes ? `<h2>Notas</h2><p>${esc(r.notes)}</p>` : ""}
<p class="muted">El cliente recibe el equipo en buen estado y se compromete a devolverlo en la fecha acordada.</p>
<div class="sign"><div>Firma del cliente</div><div>Firma de la empresa</div></div></body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}
