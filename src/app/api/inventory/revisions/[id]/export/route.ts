import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inventoryGuard, inventoryErrorResponse } from "../../../guard";
import { getRevision } from "@/lib/inventory/server";
import { buildExecutiveReportPdf } from "@/lib/reports/pdf";
import { getExecutivePdfBranding } from "@/lib/reports/branding";

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

    const branding=await getExecutivePdfBranding(organizationId,revision.locationType==="location"?revision.locationId:undefined);
    const counted=revision.items.filter(item=>item.countedQuantity!=null).length, differences=revision.items.filter(item=>item.difference!=null&&item.difference!==0).length;
    const buffer = await buildExecutiveReportPdf({...branding,organizationName:branding.organizationName||organization?.name||"Mi negocio",locationName:location?.name??branding.locationName,period:revision.startedAt?new Date(revision.startedAt).toLocaleDateString("es-MX"):"Sin iniciar",filters:[`Estado: ${revision.status}`,`Responsable: ${revision.performedBy??"Sin asignar"}`],sections:[{title:`Revisión física #${revision.revisionNumber}`,description:revision.notes||"Conciliación de existencia esperada contra conteo físico.",metrics:[{label:"Registros",value:String(revision.items.length)},{label:"Contados",value:String(counted)},{label:"Con diferencia",value:String(differences)}],analysis:`Se han contado ${counted} de ${revision.items.length} registros; ${differences} presentan diferencias que requieren revisión.`,columns:[{key:"productName",label:"Producto"},{key:"variant",label:"Variante / SKU"},{key:"expected",label:"Esperado",align:"right"},{key:"counted",label:"Contado",align:"right"},{key:"difference",label:"Diferencia",align:"right"}],rows:revision.items.map(item=>({productName:item.productName,variant:[item.variantName,item.sku].filter(Boolean).join(" · ")||"—",expected:item.expectedQuantity,counted:item.countedQuantity??"—",difference:item.difference==null?"—":item.difference}))}]});

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
