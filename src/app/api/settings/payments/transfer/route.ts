import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settingsManageGuard, settingsErrorResponse } from "../../guard";

// Datos para recibir transferencias (se muestran en el cobro del POS).

export const dynamic = "force-dynamic";

const text = (value: unknown, max: number) => {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v.slice(0, max) : null;
};
const digits = (value: unknown, max: number) => {
  const v = typeof value === "string" ? value.replace(/[^\d]/g, "") : "";
  return v ? v.slice(0, max) : null;
};

const SELECT = {
  transferEnabled: true,
  transferBank: true,
  transferHolder: true,
  transferClabe: true,
  transferAccount: true,
  transferCard: true,
  transferNote: true,
} as const;

function view(row: { transferEnabled: boolean; transferBank: string | null; transferHolder: string | null; transferClabe: string | null; transferAccount: string | null; transferCard: string | null; transferNote: string | null } | null) {
  return {
    enabled: row?.transferEnabled ?? false,
    bank: row?.transferBank ?? "",
    holder: row?.transferHolder ?? "",
    clabe: row?.transferClabe ?? "",
    account: row?.transferAccount ?? "",
    card: row?.transferCard ?? "",
    note: row?.transferNote ?? "",
  };
}

export async function GET() {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;
  try {
    const row = await prisma.companyProfile.findUnique({ where: { organizationId: guard.organizationId }, select: SELECT });
    return NextResponse.json({ ok: true, transfer: view(row) });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const data = {
      transferEnabled: b.enabled === true,
      transferBank: text(b.bank, 80),
      transferHolder: text(b.holder, 120),
      transferClabe: digits(b.clabe, 18),
      transferAccount: digits(b.account, 20),
      transferCard: digits(b.card, 19),
      transferNote: text(b.note, 300),
    };
    if (data.transferClabe && data.transferClabe.length !== 18) {
      return NextResponse.json({ ok: false, error: "La CLABE debe tener 18 dígitos" }, { status: 400 });
    }
    if (data.transferEnabled && !data.transferClabe && !data.transferAccount && !data.transferCard) {
      return NextResponse.json({ ok: false, error: "Captura al menos una CLABE, cuenta o tarjeta para habilitarlo" }, { status: 400 });
    }
    const row = await prisma.companyProfile.upsert({
      where: { organizationId: guard.organizationId },
      update: data,
      create: { organizationId: guard.organizationId, ...data },
      select: SELECT,
    });
    return NextResponse.json({ ok: true, transfer: view(row) });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
