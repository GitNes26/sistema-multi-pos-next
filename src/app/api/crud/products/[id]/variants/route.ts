import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../../../guard";
import { productsModule, createVariant } from "@/lib/crud/modules/products";

type GuardResult = Awaited<ReturnType<typeof guardCrud>>;

function orgIdOf(guard: GuardResult): string {
  if ("response" in guard) throw new Error("guard failed");
  return guard.organizationId;
}

export async function GET(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2];
  const guard = await guardCrud("products", "view");
  if ("response" in guard) return guard.response;

  try {
    const product = await productsModule.get(orgIdOf(guard), id);
    return NextResponse.json({ ok: true, rows: product.variants });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2];
  const guard = await guardCrud("products", "manage");
  if ("response" in guard) return guard.response;
  const { organizationId, userId } = guard;

  try {
    const body = await req.json();
    const variant = await createVariant(organizationId, id, { ...body, createdBy: userId });
    return NextResponse.json({ ok: true, row: variant }, { status: 201 });
  } catch (err) {
    return crudErrorResponse(err);
  }
}