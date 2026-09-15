import { prisma } from "@/lib/db";
import type { ExecutivePdfBranding } from "@/lib/reports/pdf";
import { resolveUploadedUrlPath } from "@/lib/uploads/storage";

export async function getExecutivePdfBranding(organizationId: string, locationId?: string): Promise<ExecutivePdfBranding> {
  const [organization, profile, location, appearance] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, businessMode: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId }, select: { legalName: true, tradeName: true, taxId: true, logoUrl: true, address: true, city: true, state: true, postalCode: true, phone: true, email: true } }),
    locationId ? prisma.location.findFirst({ where: { id: locationId, organizationId }, select: { name: true, address: true, imageUrl: true } }) : null,
    prisma.appSettings.findUnique({ where: { organizationId }, select: { primaryHue: true, accentHue: true, theme: true, fontFamily: true, fontScale: true, density: true, borderRadius: true } }),
  ]);
  let logo: Buffer | null = null;
  const logoUrl = location?.imageUrl || profile?.logoUrl;
  if (logoUrl) try {
    const uploadedPath = resolveUploadedUrlPath(logoUrl);
    if (uploadedPath) {
      const fs = await import("node:fs/promises");
      logo = await fs.readFile(uploadedPath);
    } else if (logoUrl.startsWith("/")) {
      const fs = await import("node:fs/promises"); const path = await import("node:path");
      logo = await fs.readFile(path.join(process.cwd(), "public", logoUrl.replace(/^\/+/, "")));
    } else { const response = await fetch(logoUrl); if (response.ok) logo = Buffer.from(await response.arrayBuffer()); }
  } catch { /* el encabezado textual sigue disponible */ }
  return { organizationName: profile?.tradeName || organization?.name || "Mi negocio", legalName: profile?.legalName, taxId: profile?.taxId, logo, address: [location?.address || profile?.address, profile?.city, profile?.state, profile?.postalCode].filter(Boolean).join(", "), phone: profile?.phone, email: profile?.email, locationName: location?.name, businessMode: organization?.businessMode, appearance: appearance ? { ...appearance, fontScale: Number(appearance.fontScale), borderRadius: Number(appearance.borderRadius) } : null };
}
