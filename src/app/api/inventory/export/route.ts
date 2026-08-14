import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { inventoryGuard } from "../guard";
import { inventorySnapshot } from "@/lib/inventory/server";
import { buildInventoryPdf } from "@/lib/pdf";

// FASE 8.7 — Exportación de inventario en PDF profesional.
// GET /api/inventory/export?locationType=location&locationId=xxx

export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  const { organizationId } = guard;

  const locationType = (req.nextUrl.searchParams.get("locationType") ?? "location") as $Enums.LocationType;
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  if (!locationId) {
    return NextResponse.json({ ok: false, error: "Falta la ubicación" }, { status: 400 });
  }

  try {
    const [snapshot, organization, location] = await Promise.all([
      inventorySnapshot(organizationId, { locationType, locationId }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      locationType === "location"
        ? prisma.location.findUnique({ where: { id: locationId }, select: { name: true } })
        : prisma.cedi.findUnique({ where: { id: locationId }, select: { name: true } }),
    ]);

    const buffer = await buildInventoryPdf({
      organizationName: organization?.name ?? "Mi negocio",
      locationName: location?.name ?? "Ubicación",
      generatedAt: new Date(),
      rows: snapshot.map((r) => ({
        productName: r.productName,
        variantName: r.variantName,
        sku: r.sku,
        unit: r.unit,
        quantity: r.quantity,
        minThreshold: r.minThreshold,
        status: r.status,
      })),
    });

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="inventario-${date}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[inventory/export]", err);
    return NextResponse.json({ ok: false, error: "Error al generar el PDF" }, { status: 500 });
  }
}