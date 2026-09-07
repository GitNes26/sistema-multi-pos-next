import type { $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/pos/money";
import { createSale, PosError } from "@/lib/pos/server";
import type { PosSalePayload } from "@/types/pos";

// ── Agenda / citas (services / hybrid) ──────────────────────────────────────
// Modelo: un empleado (Employee) ofrece servicios (variantes de producto sin
// inventario) vía EmployeeService; una cita (Appointment) agenda un servicio
// con un cliente en un horario del empleado; el checkout convierte la cita
// en una venta (Sale) ligada por saleId.

export const AGENDA_MODES: $Enums.BusinessMode[] = ["services", "hybrid"];

export class AgendaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Servicios agendables = variantes de productos sin control de inventario. */
export function isBookableVariant(trackInventory: boolean): boolean {
  return !trackInventory;
}

export interface AgendaService {
  variantId: string;
  productId: string;
  name: string;
  price: number;
  durationMin: number;
  isActive: boolean;
}

export interface AgendaStaff {
  id: string;
  fullName: string;
  position: string | null;
  services: AgendaService[];
}

export interface AgendaAppointment {
  id: string;
  status: $Enums.AppointmentStatus;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  notes: string | null;
  saleId: string | null;
  customer: { id: string; fullName: string; phone: string | null } | null;
  employee: { id: string; fullName: string };
  service: { variantId: string; name: string; price: number };
}

/** Personal con sus servicios asignados (empleados activos con ≥1 servicio). */
export async function getAgendaStaff(organizationId: string): Promise<AgendaStaff[]> {
  const rows = await prisma.employeeService.findMany({
    where: { organizationId },
    select: {
      id: true,
      durationMin: true,
      isActive: true,
      employee: { select: { id: true, fullName: true, position: { select: { name: true } } } },
      variant: {
        select: {
          id: true,
          price: true,
          product: { select: { id: true, name: true, trackInventory: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const byEmployee = new Map<string, AgendaStaff>();
  for (const r of rows) {
    if (!r.employee || !isBookableVariant(r.variant.product.trackInventory)) continue;
    let staff = byEmployee.get(r.employee.id);
    if (!staff) {
      staff = {
        id: r.employee.id,
        fullName: r.employee.fullName,
        position: r.employee.position?.name ?? null,
        services: [],
      };
      byEmployee.set(r.employee.id, staff);
    }
    staff.services.push({
      variantId: r.variant.id,
      productId: r.variant.product.id,
      name: r.variant.product.name,
      price: Number(r.variant.price),
      durationMin: r.durationMin,
      isActive: r.isActive,
    });
  }
  return [...byEmployee.values()];
}

/** Servicios agendables de la org: variantes de productos sin inventario. */
export async function getBookableServices(organizationId: string) {
  const rows = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      trackInventory: false,
      variants: { some: { isActive: true } },
    },
    select: {
      id: true,
      name: true,
      variants: {
        where: { isActive: true },
        select: { id: true, price: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      productId: p.id,
      name: p.name,
      price: Number(v.price),
    }))
  );
}

/** Citas en el rango [from, to). */
export async function getAgendaAppointments(
  organizationId: string,
  from: Date,
  to: Date
): Promise<AgendaAppointment[]> {
  const rows = await prisma.appointment.findMany({
    where: {
      organizationId,
      startsAt: { gte: from, lt: to },
    },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      durationMin: true,
      notes: true,
      saleId: true,
      customer: { select: { id: true, fullName: true, phone: true } },
      employee: { select: { id: true, fullName: true } },
      variant: { select: { id: true, price: true, product: { select: { name: true } } } },
    },
    orderBy: { startsAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    durationMin: r.durationMin,
    notes: r.notes,
    saleId: r.saleId,
    customer: r.customer ? { id: r.customer.id, fullName: r.customer.fullName, phone: r.customer.phone } : null,
    employee: { id: r.employee.id, fullName: r.employee.fullName },
    service: { variantId: r.variant.id, name: r.variant.product.name, price: Number(r.variant.price) },
  }));
}

/** ¿El empleado atiende el servicio? Devuelve la asignación (con duración). */
export async function findAssignment(
  organizationId: string,
  employeeId: string,
  variantId: string
) {
  return prisma.employeeService.findFirst({
    where: { organizationId, employeeId, variantId, isActive: true },
  });
}

/** Conflicto de horario: cita activa del mismo empleado en el rango. */
export async function hasTimeConflict(
  organizationId: string,
  employeeId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string
): Promise<boolean> {
  const clash = await prisma.appointment.findFirst({
    where: {
      organizationId,
      employeeId,
      status: { notIn: ["cancelled", "no_show"] },
      id: excludeId ? { not: excludeId } : undefined,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  return Boolean(clash);
}

export interface AppointmentCreateInput {
  customerId: string;
  employeeId: string;
  variantId: string;
  startsAt: Date;
  durationMin?: number;
  notes?: string | null;
}

/** Crea una cita validando personal, asignación y conflicto de horario. */
export async function createAppointment(organizationId: string, input: AppointmentCreateInput) {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId },
    select: { id: true },
  });
  if (!customer) throw new AgendaError("Cliente no encontrado en esta organización", 404);

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!employee) throw new AgendaError("Empleado no encontrado", 404);

  const assignment = await findAssignment(organizationId, input.employeeId, input.variantId);
  if (!assignment) throw new AgendaError("Este empleado no atiende el servicio seleccionado", 409);

  const durationMin = input.durationMin && input.durationMin > 0 ? input.durationMin : assignment.durationMin;
  const endsAt = new Date(input.startsAt.getTime() + durationMin * 60000);

  if (await hasTimeConflict(organizationId, input.employeeId, input.startsAt, endsAt)) {
    throw new AgendaError("El empleado ya tiene una cita en ese horario", 409);
  }

  const location = await prisma.location.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return prisma.appointment.create({
    data: {
      organizationId,
      locationId: location?.id ?? null,
      customerId: input.customerId,
      employeeId: input.employeeId,
      variantId: input.variantId,
      status: "pending",
      startsAt: input.startsAt,
      endsAt,
      durationMin,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    },
  });
}

/** Cobra la cita: crea la venta del servicio y la liga (checkout). */
export async function checkoutAppointment(
  organizationId: string,
  appointmentId: string,
  method: $Enums.PaymentMethod,
  ctx: { userId: string; employeeId: string | null }
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId },
    select: {
      id: true,
      status: true,
      customerId: true,
      locationId: true,
      notes: true,
      variant: {
        select: {
          id: true,
          productId: true,
          price: true,
          product: { select: { name: true, taxRate: true, trackInventory: true } },
        },
      },
    },
  });
  if (!appointment) throw new AgendaError("Cita no encontrada", 404);
  if (appointment.status === "completed") throw new AgendaError("La cita ya fue cobrada", 409);
  if (appointment.status === "cancelled" || appointment.status === "no_show") {
    throw new AgendaError("No se puede cobrar una cita cancelada o sin asistencia", 409);
  }

  const price = Number(appointment.variant.price);
  const taxRate = Number(appointment.variant.product.taxRate);
  const subtotal = round2(price);
  const tax = round2(subtotal * taxRate);
  const total = round2(subtotal + tax);

  const payload: PosSalePayload = {
    items: [
      {
        productId: appointment.variant.productId,
        variantId: appointment.variant.id,
        productType: "standard",
        productName: appointment.variant.product.name,
        variantName: null,
        quantity: 1,
        unitId: null,
        unitPrice: price,
        totalPrice: subtotal,
        discount: 0,
        taxRate,
        lineTotal: subtotal,
        trackInventory: appointment.variant.product.trackInventory,
        notes: appointment.notes ?? undefined,
        extraPrice: 0,
      },
    ],
    customerId: appointment.customerId ?? undefined,
    subtotal,
    discount: 0,
    tax,
    total,
    changeGiven: 0,
    pointsEarned: appointment.customerId ? total : 0,
    pointsRedeemed: 0,
    pointsRedeemedValue: 0,
    payments: [{ method, amount: total }],
    discounts: [],
  };

  const locationId = appointment.locationId ?? (await resolveAgendaLocation(organizationId));
  let sale;
  try {
    sale = await createSale(organizationId, locationId, payload, ctx);
  } catch (err) {
    if (err instanceof PosError) throw new AgendaError(err.message, err.status);
    throw err;
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "completed", saleId: sale.id },
  });

  return { saleId: sale.id, saleNumber: sale.saleNumber, locationName: sale.locationName, total };
}

async function resolveAgendaLocation(organizationId: string): Promise<string> {
  const loc = await prisma.location.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!loc) throw new AgendaError("Sin sucursal configurada", 400);
  return loc.id;
}

/** Reemplaza las asignaciones de servicio de los empleados indicados. */
export async function syncEmployeeServices(
  organizationId: string,
  assignments: { employeeId: string; variantId: string; durationMin: number; isActive: boolean }[]
) {
  if (!assignments.length) return { count: 0 };
  const employeeIds = [...new Set(assignments.map((a) => a.employeeId))];

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, organizationId },
    select: { id: true },
  });
  if (employees.length !== employeeIds.length) {
    throw new AgendaError("Empleado no válido para esta organización", 404);
  }
  for (const a of assignments) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: a.variantId, organizationId },
      select: { id: true, product: { select: { trackInventory: true } } },
    });
    if (!variant) throw new AgendaError("Servicio no válido para esta organización", 404);
    if (!isBookableVariant(variant.product.trackInventory)) {
      throw new AgendaError("Solo los productos sin inventario son servicios agendables", 400);
    }
    if (!a.durationMin || a.durationMin < 5 || a.durationMin > 480) {
      throw new AgendaError("Duración inválida (5–480 min)", 400);
    }
  }

  await prisma.employeeService.deleteMany({
    where: { organizationId, employeeId: { in: employeeIds } },
  });
  const created = await prisma.employeeService.createMany({
    data: assignments.map((a) => ({
      organizationId,
      employeeId: a.employeeId,
      variantId: a.variantId,
      durationMin: a.durationMin,
      isActive: a.isActive,
    })),
  });
  return { count: created.count };
}