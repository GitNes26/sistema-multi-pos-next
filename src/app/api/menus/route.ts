import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { getMenuTree, createMenu } from "@/lib/menus/server";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import { menusReadGuard, menusAdminGuard, menusErrorResponse } from "./guard";

// FASE 14.5/14.6 — GET: árbol filtrado por permisos · POST: crear menú (admin).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await menusReadGuard();
  if ("response" in guard) return guard.response;

  try {
    const { session } = guard;
    const isAdmin = session.user.role === "superadmin" || session.user.role === "owner" || session.user.role === "admin";
    const permissions = (session.user.permissions ?? []) as PermissionKey[];
    const planDenied = (session.user.planDenied ?? []) as PermissionKey[];
    // El árbol de menús es el mismo para todos los que comparten rol, permisos y plan: se guarda 60 s.
    const signature = createHash("sha1").update(JSON.stringify([isAdmin, session.user.role, [...permissions].sort(), [...planDenied].sort()])).digest("hex");
    const menu = await cached(`menus:${signature}`, { ttlMs: 60_000, tags: ["menus"] }, () => getMenuTree(permissions, isAdmin, session.user.role, planDenied));
    return NextResponse.json({ ok: true, menu });
  } catch (err) {
    return menusErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await menusAdminGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const node = await createMenu(input);
    return NextResponse.json({ ok: true, menu: node });
  } catch (err) {
    return menusErrorResponse(err);
  }
}
