import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolvePublicOrg } from "@/lib/tables/public-org";
import { sweepTableWaitlist, waitlistPosition } from "@/lib/tables/waitlist";
import { normalizePhoneToE164 } from "@/lib/notifications/messaging";

export const dynamic = "force-dynamic";

// Lista de espera de mesas SIN cuenta: nombre y teléfono bastan (igual que
// /reservar). Ruta pública — la organización se resuelve desde `?org=` o desde
// el par mesa+token del QR (`?table=&token=`). Cuando se libera una mesa que
// les quepa, el barrido (sweepTableWaitlist) les manda el aviso por
// WhatsApp/SMS; el anfitrión los sienta desde *Panel → Mesas*.

/** Arma el payload de una entrada para la respuesta pública. */
async function entryPayload(entryId: string) {
  const entry = await prisma.tableWaitlist.findUnique({
    where: { id: entryId },
    include: {
      availableTable: {
        select: { id: true, number: true, room: { select: { name: true } } },
      },
    },
  });
  if (!entry) return null;
  return {
    id: entry.id,
    guests: entry.guests,
    status: entry.status,
    position: (await waitlistPosition(entry.id)) + 1,
    availableAt: entry.availableAt?.toISOString() ?? null,
    availableTable: entry.availableTable
      ? {
          id: entry.availableTable.id,
          number: entry.availableTable.number,
          room: entry.availableTable.room,
        }
      : null,
  };
}

// POST /api/public/waitlist — anotarme en la lista (nombre + teléfono + comensales).
// No duplica entradas activas del mismo teléfono en la organización.
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const org = await resolvePublicOrg(url);
    if ("error" in org) {
      return NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    }

    const input = await req.json().catch(() => ({}));
    const guestName = String(input?.name ?? "").trim();
    const rawPhone = String(input?.phone ?? "").trim();
    if (guestName.length < 2) {
      return NextResponse.json({ ok: false, error: "Ingresa tu nombre" }, { status: 400 });
    }
    if (rawPhone.length < 7) {
      return NextResponse.json({ ok: false, error: "Ingresa un teléfono válido" }, { status: 400 });
    }
    const guests = Math.max(1, Math.min(Number(input?.guests) || 2, 50));
    // Se guarda normalizado (E.164) para que el aviso por WhatsApp/SMS llegue bien.
    const phone = normalizePhoneToE164(rawPhone) ?? rawPhone;

    const existing = await prisma.tableWaitlist.findFirst({
      where: { organizationId: org.organizationId, phone, status: { in: ["waiting", "available"] } },
      select: { id: true },
    });
    if (existing) {
      const payload = await entryPayload(existing.id);
      return NextResponse.json({ ok: true, duplicate: true, entry: payload });
    }

    const entry = await prisma.tableWaitlist.create({
      data: {
        organizationId: org.organizationId,
        locationId: org.locationId,
        customerId: null,
        name: guestName,
        phone,
        guests,
      },
    });

    // Barrido inmediato: quizá ya hay una mesa libre que le quepa (y manda
    // el aviso por WhatsApp/SMS al momento).
    await sweepTableWaitlist(org.organizationId);

    return NextResponse.json({ ok: true, entry: await entryPayload(entry.id) });
  } catch (err) {
    console.error("[public/waitlist] POST", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}

// DELETE /api/public/waitlist — salir de la lista (body: { phone }).
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const org = await resolvePublicOrg(url);
    if ("error" in org) {
      return NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    }

    const input = await req.json().catch(() => ({}));
    const phone = normalizePhoneToE164(String(input?.phone ?? "").trim()) ?? String(input?.phone ?? "").trim();
    if (!phone) {
      return NextResponse.json({ ok: false, error: "Teléfono requerido" }, { status: 400 });
    }

    const updated = await prisma.tableWaitlist.updateMany({
      where: { organizationId: org.organizationId, phone, status: { in: ["waiting", "available"] } },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ ok: true, closed: updated.count });
  } catch (err) {
    console.error("[public/waitlist] DELETE", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
