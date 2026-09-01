import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId, isSuperadminSession } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";

// POST /api/onboarding — Save business mode, company profile, and first location

const BUSINESS_MODE_FEATURES: Record<string, string[]> = {
  retail: ["inventory", "products", "combos", "promotions", "delivery", "credit"],
  food_service: [
    "inventory",
    "products",
    "combos",
    "promotions",
    "product_builder",
    "item_notes",
    "delivery",
    "credit",
  ],
  services: ["products", "appointments", "employees", "promotions"],
  rental: ["products", "reservations", "calendar", "employees"],
  hybrid: [
    "inventory",
    "products",
    "combos",
    "promotions",
    "product_builder",
    "item_notes",
    "delivery",
    "credit",
    "appointments",
    "reservations",
  ],
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 }
    );
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId && !isSuperadminSession(session)) {
    return NextResponse.json(
      { ok: false, error: "Sin organización" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { businessMode, companyName, taxId, address, city, state, postalCode, country, phone, email, locationName, locationAddress } = body;

    // Validate business mode
    const validModes = ["retail", "food_service", "services", "rental", "hybrid"];
    if (!validModes.includes(businessMode)) {
      return NextResponse.json(
        { ok: false, error: "Modo de negocio no válido" },
        { status: 400 }
      );
    }

    // If no organization yet (first-time user), create one
    let orgId = organizationId;
    if (!orgId) {
      // This is a first-time setup — the user should have been redirected here
      // after creating their session. We'll need to create an org.
      const userId = (session.user as { id?: string }).id;
      if (!userId) {
        return NextResponse.json(
          { ok: false, error: "Usuario no encontrado" },
          { status: 400 }
        );
      }

      const org = await prisma.organization.create({
        data: {
          name: companyName || "Mi Empresa",
          ownerId: userId,
          businessMode: businessMode as "retail" | "food_service" | "services" | "rental" | "hybrid",
        },
      });
      orgId = org.id;

      // Create membership for the owner
      await prisma.membership.create({
        data: {
          userId,
          organizationId: orgId,
          role: "owner",
        },
      });
    } else {
      // Update existing organization
      await prisma.organization.update({
        where: { id: orgId },
        data: { businessMode: businessMode as "retail" | "food_service" | "services" | "rental" | "hybrid" },
      });
    }

    // Save company profile
    if (companyName || taxId || address) {
      await prisma.companyProfile.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          legalName: companyName || null,
          tradeName: companyName || null,
          taxId: taxId || null,
          address: address || null,
          city: city || null,
          state: state || null,
          postalCode: postalCode || null,
          country: country || "México",
          phone: phone || null,
          email: email || null,
        },
        update: {
          legalName: companyName || undefined,
          tradeName: companyName || undefined,
          taxId: taxId || undefined,
          address: address || undefined,
          city: city || undefined,
          state: state || undefined,
          postalCode: postalCode || undefined,
          country: country || "México",
          phone: phone || undefined,
          email: email || undefined,
        },
      });
    }

    // Create first location if provided
    if (locationName) {
      const existingLocations = await prisma.location.count({
        where: { organizationId: orgId },
      });
      if (existingLocations === 0) {
        await prisma.location.create({
          data: {
            organizationId: orgId,
            name: locationName,
            address: locationAddress || null,
            isActive: true,
          },
        });
      }
    }

    // Configure default features based on business mode
    const features = BUSINESS_MODE_FEATURES[businessMode] || BUSINESS_MODE_FEATURES.retail;

    return NextResponse.json({
      ok: true,
      organizationId: orgId,
      businessMode,
      features,
    });
  } catch (error) {
    console.error("[onboarding] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error al guardar configuración" },
      { status: 500 }
    );
  }
}

// GET /api/onboarding — Check if organization needs onboarding
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 }
    );
  }
  const organizationId = effectiveOrgId(session);
  const isSuper = isSuperadminSession(session);

  if (!organizationId && !isSuper) {
    return NextResponse.json({ ok: true, needsOnboarding: true });
  }

  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { businessMode: true, name: true },
    });
    return NextResponse.json({
      ok: true,
      needsOnboarding: org?.businessMode === "retail" && org?.name === "Mi Empresa",
      businessMode: org?.businessMode,
      companyName: org?.name,
    });
  }

  return NextResponse.json({ ok: true, needsOnboarding: false });
}
