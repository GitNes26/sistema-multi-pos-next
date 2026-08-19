import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";

// FASE 7.11 — Subida de imágenes (Attachment) a almacenamiento local.
// POST /api/uploads (multipart, campo "file"). Las imágenes quedan en
// /public/uploads/<orgId>/ y se sirven desde /uploads/<orgId>/…

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) {
      return NextResponse.json({ ok: false, error: "Enviá el campo «file» con tu imagen" }, { status: 400 });
    }
    file = f;
  } catch {
    return NextResponse.json({ ok: false, error: "Formato de envío inválido" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "La imagen excede 5 MB" }, { status: 413 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "Solo se permiten JPG, PNG, WEBP y GIF" }, { status: 415 });
  }

  try {
    const dir = path.join(process.cwd(), "public", "uploads", organizationId);
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/${organizationId}/${name}`;
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la imagen" }, { status: 500 });
  }
}