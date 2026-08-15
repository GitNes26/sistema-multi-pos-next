import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inventoryGuard, inventoryErrorResponse } from "../../../guard";
import { getRevision } from "@/lib/inventory/server";
import { buildRevisionPdf } from "@/lib/pdf";

// Exportación de una revisión física en PDF profesional.
// GET /api/inventory/revisions/[id]/export

export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  const { organizationId } = guard;

  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2];

  try {
    const [revision, organization] = await Promise.all([
      getRevision(organizationId, id),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    ]);

    const location =
      revision.locationType === "location"
        ? await prisma.location.findUnique({ where: { id: revision.locationId }, select: { name: true } })
        : await prisma.cedi.findUnique({ where: { id: revision.locationId }, select: { name: true } });

    const buffer = await buildRevisionPdf({
      organizationName: organization?.name ?? "Mi negocio",
      locationName: location?.name ?? "Ubicación",
      revisionNumber: revision.revisionNumber,
      status: revision.status,
      notes: revision.notes,
      performedBy: revision.performedBy,
      startedAt: revision.startedAt,
      completedAt: revision.completedAt,
      generatedAt: new Date(),
      items: revision.items.map((i) => ({
        productName: i.productName,
        variantName: i.variantName,
        sku: i.sku,
        unit: i.unit,
        expectedQuantity: i.expectedQuantity,
        countedQuantity: i.countedQuantity,
        difference: i.difference,
      })),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="revision-${revision.revisionNumber}.pdf"`,
      },
    });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}
