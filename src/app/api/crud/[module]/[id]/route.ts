import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../../guard";

export async function GET(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "view");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    const row = await entry.module.get(organizationId, id);
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "manage");
  if ("response" in guard) return guard.response;
  const { entry, organizationId, userId } = guard;

  try {
    const body = await req.json();
    const row = await entry.module.update(organizationId, id, body, { userId });
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "delete");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    await entry.module.remove(organizationId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return crudErrorResponse(err);
  }
}