import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword, setMembership, verifyPassword } from "@/lib/auth/users";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface CustomerDto {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  points: number;
  imageUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  salesCount: number;
  ordersCount: number;
}

type CustomerRow = {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  points: { toNumber(): number } | number;
  imageUrl: string | null;
  address: string | null;
  latitude: { toNumber(): number } | number | null;
  longitude: { toNumber(): number } | number | null;
  isActive: boolean;
  user: { email: string | null } | null;
  _count: { sales: number; orders: number };
};

const num = (v: { toNumber(): number } | number): number => (typeof v === "number" ? v : v.toNumber());

const decimalOrNull = (v: { toNumber(): number } | number | null): number | null => {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : v.toNumber();
};

function serialize(c: CustomerRow): CustomerDto {
  return {
    id: c.id,
    customerCode: c.customerCode,
    fullName: c.fullName,
    phone: c.phone,
    // Si no se capturó correo, se muestra el de la cuenta de usuario asociada.
    email: c.email ?? c.user?.email ?? null,
    points: num(c.points),
    imageUrl: c.imageUrl,
    address: c.address,
    latitude: decimalOrNull(c.latitude),
    longitude: decimalOrNull(c.longitude),
    isActive: c.isActive,
    salesCount: c._count.sales,
    ordersCount: c._count.orders,
  };
}

async function nextCustomerCode(organizationId: string): Promise<string> {
  const count = await prisma.customer.count({ where: { organizationId } });
  return `CLI-${String(count + 1).padStart(4, "0")}`;
}

export const customersModule: CrudModule<CustomerDto> = {
  key: "customers",

  async list(organizationId, params: ListParams): Promise<CrudListResult<CustomerDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";

    const where = {
      organizationId,
      ...(q
        ? {
            OR: [
              { fullName: { contains: q } },
              { customerCode: { contains: q.toUpperCase() } },
              { phone: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { _count: { select: { sales: true, orders: true } }, user: { select: { email: true } } },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const c = await prisma.customer.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { sales: true, orders: true } }, user: { select: { email: true } } },
    });
    if (!c) throw new CrudError("Cliente no encontrado", 404);
    return serialize(c);
  },

  async create(organizationId, input, _ctx) {
    const data = input as Record<string, unknown>;
    const fullName = data.fullName ? String(data.fullName).trim() : "";
    if (!fullName) throw new CrudError("El nombre es obligatorio", 400, "fullName");

    const emailRaw = data.email ? String(data.email).trim().toLowerCase() : "";
    const phone = data.phone ? String(data.phone).trim() : null;
    if (emailRaw) {
      const dupEmail = await prisma.user.findUnique({ where: { email: emailRaw } });
      if (dupEmail) throw new CrudError("Ya existe un usuario con ese correo", 400, "email");
    }
    if (phone) {
      const dupPhone = await prisma.customer.findFirst({ where: { organizationId, phone } });
      if (dupPhone) throw new CrudError("Ya existe un cliente con ese teléfono", 400, "phone");
    }

    const customerCode = data.customerCode
      ? String(data.customerCode).trim().toUpperCase()
      : await nextCustomerCode(organizationId);
    if (customerCode) {
      const dupCode = await prisma.customer.findFirst({ where: { organizationId, customerCode } });
      if (dupCode) throw new CrudError("Ese número de cliente ya existe", 400, "customerCode");
    }

    const email = emailRaw || `cli-${randomBytes(4).toString("hex")}@portal.local`;
    // Contraseña inicial = correo (el cliente la cambia en su primer acceso).
    const passwordHash = await hashPassword(email);

    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, phone, isActive: true },
    });

    try {
      await setMembership(user.id, organizationId, "customer");
      const customer = await prisma.customer.create({
        data: {
          organizationId,
          userId: user.id,
          customerCode: customerCode || null,
          fullName,
          phone,
          email: emailRaw || null,
          imageUrl: data.imageUrl ? String(data.imageUrl) : null,
          address: data.address ? String(data.address) : null,
          latitude: data.latitude !== undefined && data.latitude !== null && data.latitude !== ""
            ? Number(data.latitude)
            : null,
          longitude: data.longitude !== undefined && data.longitude !== null && data.longitude !== ""
            ? Number(data.longitude)
            : null,
          isActive: data.isActive !== false,
          ...(data.points !== undefined ? { points: Number(data.points) || 0 } : {}),
        },
        include: { _count: { select: { sales: true, orders: true } }, user: { select: { email: true } } },
      });
      return serialize(customer);
    } catch (err) {
      // Cleanup orphaned user/membership on create failure
      await prisma.membership.deleteMany({ where: { userId: user.id, organizationId } }).catch((cleanupErr) => console.error("[customers] cleanup membership failed:", cleanupErr));
      await prisma.user.delete({ where: { id: user.id } }).catch((cleanupErr) => console.error("[customers] cleanup user failed:", cleanupErr));
      throw err;
    }
  },

  async update(organizationId, id, input, _ctx) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId },
      select: { id: true, userId: true, fullName: true, phone: true, email: true },
    });
    if (!existing) throw new CrudError("Cliente no encontrado", 404);

    const phone = data.phone !== undefined ? (data.phone ? String(data.phone).trim() : null) : existing.phone;
    const emailRaw =
      data.email !== undefined
        ? (data.email ? String(data.email).trim().toLowerCase() : null)
        : existing.email;

    if (phone && phone !== existing.phone) {
      const dupPhone = await prisma.customer.findFirst({
        where: { organizationId, phone, id: { not: id } },
      });
      if (dupPhone) throw new CrudError("Ya existe un cliente con ese teléfono", 400, "phone");
    }
    if (emailRaw) {
      const dupEmail = await prisma.user.findFirst({
        where: { email: emailRaw, id: { not: existing.userId } },
      });
      if (dupEmail) throw new CrudError("Ya existe un usuario con ese correo", 400, "email");
    }

    const fullName =
      data.fullName !== undefined
        ? String(data.fullName).trim() || existing.fullName
        : undefined;

    await prisma.user.update({
      where: { id: existing.userId },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(phone !== undefined && phone !== null ? { phone } : {}),
        ...(emailRaw ? { email: emailRaw } : {}),
      },
    });

    // Si el correo cambió y la contraseña sigue siendo la default (el correo anterior),
    // se resetea para que coincida con el nuevo correo.
    if (emailRaw && emailRaw !== existing.email) {
      const userRow = await prisma.user.findUnique({
        where: { id: existing.userId },
        select: { passwordHash: true },
      });
      if (userRow && (await verifyPassword(existing.email ?? "", userRow.passwordHash))) {
        await prisma.user.update({
          where: { id: existing.userId },
          data: { passwordHash: await hashPassword(emailRaw) },
        });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(data.email !== undefined ? { email: emailRaw } : {}),
        ...(data.points !== undefined ? { points: Number(data.points) || 0 } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl ? String(data.imageUrl) : null } : {}),
        ...(data.address !== undefined ? { address: data.address ? String(data.address) : null } : {}),
        ...(data.latitude !== undefined
          ? { latitude: data.latitude !== null && data.latitude !== "" ? Number(data.latitude) : null }
          : {}),
        ...(data.longitude !== undefined
          ? { longitude: data.longitude !== null && data.longitude !== "" ? Number(data.longitude) : null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive !== false } : {}),
        ...(data.customerCode !== undefined
          ? { customerCode: data.customerCode ? String(data.customerCode).trim().toUpperCase() : null }
          : {}),
      },
      include: { _count: { select: { sales: true, orders: true } }, user: { select: { email: true } } },
    });
    return serialize(customer);
  },

  async remove(organizationId, id) {
    const c = await prisma.customer.findFirst({ where: { id, organizationId } });
    if (!c) throw new CrudError("Cliente no encontrado", 404);
    // Soft-delete: deactivate customer and user instead of hard delete to preserve history.
    await prisma.$transaction([
      prisma.customer.update({ where: { id }, data: { isActive: false } }),
      prisma.user.update({ where: { id: c.userId }, data: { isActive: false } }),
    ]);
  },
};

// ── Detalle de cliente (FASE 7.3) ────────────────────────────────────────────

export interface CustomerActivity {
  customerId: string;
  points: number;
  loyalty: {
    id: string;
    kind: string;
    points: number;
    note: string | null;
    createdAt: string;
  }[];
  sales: {
    id: string;
    saleNumber: number;
    total: number;
    itemCount: number;
    createdAt: string;
  }[];
  orders: {
    id: string;
    orderNumber: number;
    status: string;
    total: number;
    deliveryMethod: string | null;
    createdAt: string;
  }[];
  favorites: {
    id: string;
    productName: string;
    variantName: string | null;
    variantId: string;
    createdAt: string;
  }[];
  paymentMethods: {
    id: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    isDefault: boolean;
  }[];
}

export async function customerActivity(organizationId: string, customerId: string): Promise<CustomerActivity> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true, points: true },
  });
  if (!customer) throw new CrudError("Cliente no encontrado", 404);

  const [loyalty, sales, orders, favorites, paymentMethods] = await Promise.all([
    prisma.loyaltyTransaction.findMany({
      where: { customerId, organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.sale.findMany({
      where: { customerId, organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { _count: { select: { items: true } } },
    }),
    prisma.order.findMany({
      where: { customerId, organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.customerFavorite.findMany({
      where: { customerId, organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { variant: { select: { name: true, product: { select: { name: true } } } } },
    }),
    prisma.customerPaymentMethod.findMany({
      where: { customerId, organizationId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    customerId: customer.id,
    points: num(customer.points),
    loyalty: loyalty.map((l) => ({
      id: l.id,
      kind: l.kind,
      points: num(l.points),
      note: l.note,
      createdAt: l.createdAt.toISOString(),
    })),
    sales: sales.map((s) => ({
      id: s.id,
      saleNumber: Number(s.saleNumber),
      total: num(s.total),
      itemCount: s._count.items,
      createdAt: s.createdAt.toISOString(),
    })),
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: Number(o.orderNumber),
      status: o.status,
      total: num(o.total),
      deliveryMethod: o.deliveryMethod,
      createdAt: o.createdAt.toISOString(),
    })),
    favorites: favorites.map((f) => ({
      id: f.id,
      productName: f.variant.product?.name ?? "—",
      variantName: f.variant.name === "Default" ? null : f.variant.name,
      variantId: f.variantId,
      createdAt: f.createdAt.toISOString(),
    })),
    paymentMethods: paymentMethods.map((p) => ({
      id: p.id,
      brand: p.brand,
      last4: p.last4,
      expMonth: p.expMonth,
      expYear: p.expYear,
      isDefault: p.isDefault,
    })),
  };
}