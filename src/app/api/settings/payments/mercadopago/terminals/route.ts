import { NextResponse } from "next/server";
import { settingsManageGuard, settingsErrorResponse } from "../../../guard";
import { listMercadoPagoTerminals } from "@/lib/payments/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;
  try {
    return NextResponse.json({ ok: true, terminals: await listMercadoPagoTerminals(guard.organizationId) });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}
