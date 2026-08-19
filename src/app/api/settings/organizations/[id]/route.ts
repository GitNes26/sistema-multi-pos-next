import { NextResponse } from "next/server";
import { deleteOrganization, updateOrganization } from "@/lib/settings/organizations";
import { superadminGuard } from "../../guard";

// FASE 15.9 — Actualiza o elimina una organización (solo superAdmin).

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await superadminGuard();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { name?: string; currency?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  try {
    const updated = await updateOrganization(id, {
      name: body.name.trim(),
      currency: body.currency?.trim() || "MXN",
    });
    return NextResponse.json({ organization: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo actualizar" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await superadminGuard();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  try {
    await deleteOrganization(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo eliminar" },
      { status: 400 }
    );
  }
}