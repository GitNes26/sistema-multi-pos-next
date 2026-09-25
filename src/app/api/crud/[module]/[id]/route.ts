import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../../guard";
import { prisma } from "@/lib/db";
import { mailConfigured, sendOrganizationWelcomeLink } from "@/lib/auth/mail";

/** Table → model mapping for generic soft-delete restore. */
const MODEL_MAP: Record<string, { table: string; userTable?: string }> = {
  products: { table: "product" },
  categories: { table: "category" },
  customers: { table: "customer", userTable: "user" },
  locations: { table: "location" },
  units: { table: "unitOfMeasure" },
  positions: { table: "employeePosition" },
  employees: { table: "employee", userTable: "user" },
  cashRegisters: { table: "cashRegister" },
  cedis: { table: "cedi" },
  promotions: { table: "promotion" },
};

/** Generic restore: reactivate isActive + user if applicable. */
async function genericRestore(organizationId: string, id: string, module: string) {
  const mapping = MODEL_MAP[module];
  if (!mapping) throw new Error(`Módulo "${module}" no soporta restauración`);

  // Find the record and verify org ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[mapping.table];
  if (!model) throw new Error(`Modelo "${mapping.table}" no encontrado`);

  const record = await model.findFirst({ where: { id, organizationId } });
  if (!record) throw new Error("Registro no encontrado");

  // Reactivate the record
  await model.update({ where: { id }, data: { isActive: true } });

  // If it has a linked user, reactivate that too
  if (mapping.userTable && record.userId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userModel = (prisma as any)[mapping.userTable];
    await userModel.update({ where: { id: record.userId }, data: { isActive: true } });
  }
}

export async function GET(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "view");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    const row = await entry.module.get(organizationId, id);
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "manage");
  if ("response" in guard) return guard.response;
  const { entry, organizationId, userId } = guard;

  try {
    const body = await req.json();
    const row = await entry.module.update(organizationId, id, body, { userId });
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "delete");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    await entry.module.remove(organizationId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (action !== "restore" && action !== "resend-activation") {
    return NextResponse.json({ ok: false, error: "Acción no válida" }, { status: 400 });
  }

  const guard = await guardCrud(module, "manage");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    if (action === "resend-activation") {
      if (module !== "customers") throw new Error("Esta acción solo está disponible para clientes");
      if (!mailConfigured()) throw new Error("El correo SMTP no está configurado");
      const customer = await prisma.customer.findFirst({ where: { id, organizationId }, select: { fullName: true, email: true, user: { select: { activationRequired: true } } } });
      if (!customer?.email) throw new Error("El cliente no tiene un correo de acceso registrado");
      if (!customer.user.activationRequired) throw new Error("La cuenta del cliente ya está activa");
      await sendOrganizationWelcomeLink(customer.email, organizationId, { fullName: customer.fullName, accountType: "cliente" });
      return NextResponse.json({ ok: true });
    }
    if (entry.module.restore) {
      await entry.module.restore(organizationId, id);
    } else {
      await genericRestore(organizationId, id, module);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return crudErrorResponse(err);
  }
}
