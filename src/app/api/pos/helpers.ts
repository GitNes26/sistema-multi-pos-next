import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, type SessionUser } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export type PosSession = { user: SessionUser };

export async function requirePosSession(): Promise<
  { session: PosSession } | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  if (session.user.scope === "portal" || !session.user.organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session: session as PosSession };
}

export async function resolveLocationId(
  organizationId: string,
  locationId?: string | null
): Promise<string> {
  if (locationId) {
    const loc = await prisma.location.findFirst({
      where: { id: locationId, organizationId },
      select: { id: true },
    });
    if (loc) return loc.id;
  }
  const locations = await prisma.location.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, isActive: true },
  });
  const defaultLoc = locations.find((l) => l.isActive) ?? locations[0];
  if (!defaultLoc) throw new Error("POS: sin sucursal para la organización");
  return defaultLoc.id;
}

export async function getCashierContext(userId: string, organizationId: string) {
  const employee = await prisma.employee.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  return { userId, employeeId: employee?.id ?? null };
}