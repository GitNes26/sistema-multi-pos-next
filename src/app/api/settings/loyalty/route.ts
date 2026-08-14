import { NextResponse } from "next/server";
import { getLoyaltySettings, updateLoyaltySettings } from "@/lib/settings/server";
import { settingsManageGuard, settingsErrorResponse } from "../guard";

// FASE 15.6 — Configuración de lealtad.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const settings = await getLoyaltySettings(guard.organizationId);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const settings = await updateLoyaltySettings(guard.organizationId, input);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
