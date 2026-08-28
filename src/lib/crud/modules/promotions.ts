import type { Prisma, $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";
import { createPublication } from "@/lib/publications/server";

// FASE 7.5 — CRUD de promociones. El motor de aplicación (descuentos) vive en
// src/lib/pos/pricing.ts y consume exactamente los campos que aquí se gestionan.

export interface PromotionTargetDto {
  kind: $Enums.PromotionTargetKind;
  targetId: string;
}

export interface PromotionDto {
  id: string;
  name: string;
  description: string | null;
  descriptionFinal: string | null;
  imageUrl: string | null;
  benefit: $Enums.PromoBenefit;
  scope: $Enums.PromoScope;
  value: number;
  buyQuantity: number;
  getQuantity: number;
  minAmount: number;
  minQuantity: number;
  startsAt: string | null;
  endsAt: string | null;
  weekdays: number[];
  startTime: string | null;
  endTime: string | null;
  couponCode: string | null;
  requiresCustomer: boolean;
  priority: number;
  exclusive: boolean;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  usesCount: number;
  isActive: boolean;
  targets: PromotionTargetDto[];
  targetLocations: string[];
  targetCategories: string[];
  targetProducts: string[];
  targetVariants: string[];
  rewardVariants: string[];
}

type Dec = { toNumber(): number } | number;
const num = (v: Dec): number => (typeof v === "number" ? v : v.toNumber());

type PromotionRow = {
  id: string;
  name: string;
  description: string | null;
  descriptionFinal: string | null;
  imageUrl: string | null;
  benefit: $Enums.PromoBenefit;
  scope: $Enums.PromoScope;
  value: Dec;
  buyQuantity: number;
  getQuantity: number;
  minAmount: Dec;
  minQuantity: Dec;
  startsAt: Date | null;
  endsAt: Date | null;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  couponCode: string | null;
  requiresCustomer: boolean;
  priority: number;
  exclusive: boolean;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  usesCount: number;
  isActive: boolean;
  targets: { kind: $Enums.PromotionTargetKind; targetId: string }[];
};

function parseWeekdays(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

function serialize(p: PromotionRow): PromotionDto {
  const targets = p.targets;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    descriptionFinal: p.descriptionFinal,
    imageUrl: p.imageUrl,
    benefit: p.benefit,
    scope: p.scope,
    value: num(p.value),
    buyQuantity: p.buyQuantity,
    getQuantity: p.getQuantity,
    minAmount: num(p.minAmount),
    minQuantity: num(p.minQuantity),
    startsAt: p.startsAt ? p.startsAt.toISOString() : null,
    endsAt: p.endsAt ? p.endsAt.toISOString() : null,
    weekdays: parseWeekdays(p.weekdays),
    startTime: p.startTime,
    endTime: p.endTime,
    couponCode: p.couponCode,
    requiresCustomer: p.requiresCustomer,
    priority: p.priority,
    exclusive: p.exclusive,
    maxUses: p.maxUses,
    maxUsesPerCustomer: p.maxUsesPerCustomer,
    usesCount: p.usesCount,
    isActive: p.isActive,
    targets,
    targetLocations: targets.filter((t) => t.kind === "location").map((t) => t.targetId),
    targetCategories: targets.filter((t) => t.kind === "category").map((t) => t.targetId),
    targetProducts: targets.filter((t) => t.kind === "product").map((t) => t.targetId),
    targetVariants: targets.filter((t) => t.kind === "variant").map((t) => t.targetId),
    rewardVariants: targets.filter((t) => t.kind === "reward_variant").map((t) => t.targetId),
  };
}

const include = {
  targets: { select: { kind: true, targetId: true } },
} as const;

const BENEFITS: $Enums.PromoBenefit[] = [
  "percent_off",
  "amount_off",
  "fixed_price",
  "buy_x_get_y",
  "free_item",
  "next_purchase_coupon",
];
const SCOPES: $Enums.PromoScope[] = ["order", "category", "product", "variant"];

const BENEFIT_LABELS: Record<string, string> = {
  percent_off: "% de descuento",
  amount_off: "Descuento en $",
  fixed_price: "Precio fijo",
  buy_x_get_y: "Lleva X y paga Y",
  free_item: "Producto gratis",
  next_purchase_coupon: "Cupón para próxima compra",
};

const SCOPE_LABELS: Record<string, string> = {
  order: "todo el pedido",
  category: "categoría",
  product: "producto",
  variant: "variante",
};

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function generateDescriptionFinal(data: Record<string, unknown>): string {
  const benefit = data.benefit as string;
  const scope = (data.scope as string) ?? "order";
  const value = Number(data.value ?? 0);
  const buyQ = Number(data.buyQuantity ?? 0);
  const getQ = Number(data.getQuantity ?? 0);
  const minAmount = Number(data.minAmount ?? 0);
  const minQty = Number(data.minQuantity ?? 0);
  const weekdays = Array.isArray(data.weekdays) ? data.weekdays.map(Number) : [];
  const startTime = (data.startTime as string) || null;
  const endTime = (data.endTime as string) || null;
  const startsAt = (data.startsAt as string) || null;
  const endsAt = (data.endsAt as string) || null;

  const parts: string[] = [];

  // 1. What
  switch (benefit) {
    case "percent_off":
      parts.push(`${value}% de descuento en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "amount_off":
      parts.push(`$${value} de descuento en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "fixed_price":
      parts.push(`Precio fijo de $${value} en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "buy_x_get_y":
      parts.push(`Lleva ${buyQ} y llévate ${getQ} gratis en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "free_item":
      parts.push(`Producto gratis en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "next_purchase_coupon":
      parts.push(`Cupón de $${value || "10%"} para tu próxima compra`);
      break;
  }

  // 2. When
  const dateRange: string[] = [];
  if (startsAt) dateRange.push(`desde ${new Date(startsAt).toLocaleDateString("es-MX")}`);
  if (endsAt) dateRange.push(`hasta ${new Date(endsAt).toLocaleDateString("es-MX")}`);
  if (dateRange.length) parts.push(dateRange.join(" "));

  if (weekdays.length > 0) {
    parts.push(`los ${weekdays.map((d) => WEEKDAY_NAMES[d] ?? d).join(", ")}`);
  }

  const timeRange: string[] = [];
  if (startTime) timeRange.push(`de ${startTime}`);
  if (endTime) timeRange.push(`hasta ${endTime}`);
  if (timeRange.length) parts.push(timeRange.join(" "));

  // 3. Conditions
  if (minAmount > 0) parts.push(`compra mínima de $${minAmount}`);
  if (minQty > 0) parts.push(`mínimo ${minQty} pieza(s)`);

  return parts.join(". ") + ".";
}

type RawTargets = {
  targetLocations?: string[];
  targetCategories?: string[];
  targetProducts?: string[];
  targetVariants?: string[];
  rewardVariants?: string[];
};

function toTargetsList(input: RawTargets): { kind: $Enums.PromotionTargetKind; targetId: string }[] {
  const list: { kind: $Enums.PromotionTargetKind; targetId: string }[] = [];
  const push = (kind: $Enums.PromotionTargetKind, ids?: string[]) => {
    for (const id of ids ?? []) {
      if (id) list.push({ kind, targetId: id });
    }
  };
  push("location", input.targetLocations);
  push("category", input.targetCategories);
  push("product", input.targetProducts);
  push("variant", input.targetVariants);
  push("reward_variant", input.rewardVariants);
  return list;
}

async function assertTargetsExist(organizationId: string, targets: { kind: string; targetId: string }[]) {
  for (const t of targets) {
    let count = 0;
    if (t.kind === "location") {
      count = await prisma.location.count({ where: { id: t.targetId, organizationId } });
    } else if (t.kind === "category") {
      count = await prisma.category.count({ where: { id: t.targetId, organizationId } });
    } else if (t.kind === "product") {
      count = await prisma.product.count({ where: { id: t.targetId, organizationId } });
    } else if (t.kind === "variant" || t.kind === "reward_variant") {
      count = await prisma.productVariant.count({ where: { id: t.targetId, organizationId } });
    }
    if (!count) throw new CrudError("Uno de los targets seleccionados no existe", 400);
  }
}

function buildCreateData(organizationId: string, data: Record<string, unknown>) {
  const benefit = data.benefit as $Enums.PromoBenefit;
  const scope = (data.scope as $Enums.PromoScope) ?? "order";
  if (!BENEFITS.includes(benefit)) throw new CrudError("Tipo de beneficio inválido", 400, "benefit");
  if (!SCOPES.includes(scope)) throw new CrudError("Alcance inválido", 400, "scope");

  const weekdays = Array.isArray(data.weekdays) ? data.weekdays : [];
  const validWeekdays = weekdays
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const targetList = toTargetsList(data as RawTargets);
  const uniqueTargets = targetList.filter(
    (t, i, all) => all.findIndex((x) => x.kind === t.kind && x.targetId === t.targetId) === i
  );

  const descriptionFinal = generateDescriptionFinal(data);

  return {
    create: {
      organizationId,
      name: String(data.name ?? "").trim(),
      description: (data.description as string | null) ?? null,
      descriptionFinal,
      imageUrl: (data.imageUrl as string | null) ?? null,
      benefit,
      scope,
      value: Number(data.value ?? 0),
      buyQuantity: Number(data.buyQuantity ?? 0),
      getQuantity: Number(data.getQuantity ?? 0),
      minAmount: Number(data.minAmount ?? 0),
      minQuantity: Number(data.minQuantity ?? 0),
      startsAt: (data.startsAt as string | null) ? new Date((data.startsAt as string) + "T00:00:00") : null,
      endsAt: (data.endsAt as string | null) ? new Date((data.endsAt as string) + "T00:00:00") : null,
      weekdays: validWeekdays.length ? JSON.stringify(validWeekdays) : null,
      startTime: (data.startTime as string | null) || null,
      endTime: (data.endTime as string | null) || null,
      couponCode: (data.couponCode as string | null)?.trim() || null,
      requiresCustomer: Boolean(data.requiresCustomer),
      priority: Number(data.priority ?? 100),
      exclusive: Boolean(data.exclusive),
      maxUses: data.maxUses ? Number(data.maxUses) : null,
      maxUsesPerCustomer: data.maxUsesPerCustomer ? Number(data.maxUsesPerCustomer) : null,
      isActive: Boolean(data.isActive ?? true),
      targets: { create: uniqueTargets },
    },
    uniqueTargets,
  };
}

export const promotionsModule: CrudModule<PromotionDto> = {
  key: "promotions",

  async list(organizationId, params: ListParams): Promise<CrudListResult<PromotionDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";

    const where: Prisma.PromotionWhereInput = {
      organizationId,
      ...(q ? { OR: [{ name: { contains: q } }, { couponCode: { contains: q } }] } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        include,
        orderBy: [{ isActive: "desc" }, { priority: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.promotion.count({ where }),
    ]);

    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const p = await prisma.promotion.findFirst({ where: { id, organizationId }, include });
    if (!p) throw new CrudError("Promoción no encontrada", 404);
    return serialize(p);
  },

  async create(organizationId, input) {
    const data = input as Record<string, unknown>;
    if (!data.name?.toString().trim()) throw new CrudError("El nombre es obligatorio", 400, "name");

    const { create, uniqueTargets } = buildCreateData(organizationId, data);
    await assertTargetsExist(organizationId, uniqueTargets);

    const p = await prisma.promotion.create({
      data: create,
      include,
    });

    // Auto-crear publicación tipo "promotion"
    if (p.isActive) {
      try {
        const descFinal = create.descriptionFinal ?? "";
        await createPublication(organizationId, {
          title: `Promoción: ${p.name}`,
          content: descFinal,
          type: "promotion",
          imageUrl: create.imageUrl as string | null,
          isActive: true,
          startsAt: create.startsAt instanceof Date ? create.startsAt.toISOString() : (create.startsAt as string | null),
          endsAt: create.endsAt instanceof Date ? create.endsAt.toISOString() : (create.endsAt as string | null),
          metadata: { promotionId: p.id },
        });
      } catch {
        // Publicación es best-effort, no falla la promo
      }
    }

    return serialize(p);
  },

  async update(organizationId, id, input) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.promotion.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Promoción no encontrada", 404);
    if (data.name != null && !data.name.toString().trim()) {
      throw new CrudError("El nombre es obligatorio", 400, "name");
    }

    // Regenerar descriptionFinal con los nuevos datos
    const merged = { ...Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])), ...data };
    const descriptionFinal = generateDescriptionFinal(merged);

    const patch: Prisma.PromotionUpdateInput = {
      ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
      ...(data.description !== undefined ? { description: (data.description as string | null) ?? null } : {}),
      descriptionFinal,
      ...(data.imageUrl !== undefined ? { imageUrl: (data.imageUrl as string | null) ?? null } : {}),
      ...(data.benefit !== undefined ? { benefit: data.benefit as $Enums.PromoBenefit } : {}),
      ...(data.scope !== undefined ? { scope: data.scope as $Enums.PromoScope } : {}),
      ...(data.value !== undefined ? { value: Number(data.value) } : {}),
      ...(data.buyQuantity !== undefined ? { buyQuantity: Number(data.buyQuantity ?? 0) } : {}),
      ...(data.getQuantity !== undefined ? { getQuantity: Number(data.getQuantity ?? 0) } : {}),
      ...(data.minAmount !== undefined ? { minAmount: Number(data.minAmount ?? 0) } : {}),
      ...(data.minQuantity !== undefined ? { minQuantity: Number(data.minQuantity ?? 0) } : {}),
      ...(data.startsAt !== undefined ? { startsAt: data.startsAt ? new Date((data.startsAt as string) + "T00:00:00") : null } : {}),
      ...(data.endsAt !== undefined ? { endsAt: data.endsAt ? new Date((data.endsAt as string) + "T00:00:00") : null } : {}),
      ...(data.startTime !== undefined ? { startTime: (data.startTime as string | null) || null } : {}),
      ...(data.endTime !== undefined ? { endTime: (data.endTime as string | null) || null } : {}),
      ...(data.couponCode !== undefined ? { couponCode: (data.couponCode as string | null)?.trim() || null } : {}),
      ...(data.requiresCustomer !== undefined ? { requiresCustomer: Boolean(data.requiresCustomer) } : {}),
      ...(data.priority !== undefined ? { priority: Number(data.priority ?? 100) } : {}),
      ...(data.exclusive !== undefined ? { exclusive: Boolean(data.exclusive) } : {}),
      ...(data.maxUses !== undefined ? { maxUses: data.maxUses ? Number(data.maxUses) : null } : {}),
      ...(data.maxUsesPerCustomer !== undefined
        ? { maxUsesPerCustomer: data.maxUsesPerCustomer ? Number(data.maxUsesPerCustomer) : null }
        : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
    };

    if (data.weekdays !== undefined) {
      const weekdays = Array.isArray(data.weekdays) ? data.weekdays : [];
      const valid = weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      patch.weekdays = valid.length ? JSON.stringify(valid) : null;
    }

    const p = await prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.promotion.update({ where: { id }, data: patch }),
        tx.promotionTarget.deleteMany({ where: { promotionId: id } }),
      ]);
      const targets = toTargetsList(data as RawTargets);
      const unique = targets.filter(
        (t, i, all) => all.findIndex((x) => x.kind === t.kind && x.targetId === t.targetId) === i
      );
      if (unique.length) {
        await assertTargetsExist(organizationId, unique);
        await tx.promotionTarget.createMany({ data: unique.map((t) => ({ promotionId: id, ...t })) });
      }
      return tx.promotion.findFirstOrThrow({ where: { id }, include });
    });

    // Sync publicación vinculada
    try {
      const promoName = p.name;
      const existingPub = await prisma.publication.findFirst({
        where: {
          organizationId,
          type: "promotion",
          metadata: { path: "promotionId", equals: id },
        },
      });

      if (existingPub) {
        // Actualizar publicación existente
        await prisma.publication.update({
          where: { id: existingPub.id },
          data: {
            title: `Promoción: ${promoName}`,
            content: descriptionFinal,
            imageUrl: patch.imageUrl !== undefined ? (patch.imageUrl as string | null) : undefined,
            isActive: patch.isActive !== undefined ? (patch.isActive as boolean) : undefined,
            startsAt: patch.startsAt !== undefined ? (patch.startsAt as Date | null) : undefined,
            endsAt: patch.endsAt !== undefined ? (patch.endsAt as Date | null) : undefined,
          },
        });
      } else if (p.isActive) {
        // Crear publicación si no existe y la promo está activa
        await createPublication(organizationId, {
          title: `Promoción: ${promoName}`,
          content: descriptionFinal,
          type: "promotion",
          imageUrl: (patch.imageUrl as string | null) ?? null,
          isActive: true,
          startsAt: p.startsAt?.toISOString() ?? null,
          endsAt: p.endsAt?.toISOString() ?? null,
          metadata: { promotionId: id },
        });
      }
    } catch {
      // Publicación sync es best-effort
    }

    return serialize(p);
  },

  async remove(organizationId, id) {
    const p = await prisma.promotion.findFirst({ where: { id, organizationId } });
    if (!p) throw new CrudError("Promoción no encontrada", 404);
    await prisma.promotionTarget.deleteMany({ where: { promotionId: id } });
    await prisma.promotion.delete({ where: { id } });

    // Eliminar publicación vinculada si existe
    try {
      const linkedPub = await prisma.publication.findFirst({
        where: { organizationId, type: "promotion", metadata: { path: "promotionId", equals: id } },
      });
      if (linkedPub) await prisma.publication.delete({ where: { id: linkedPub.id } });
    } catch {
      // best-effort
    }
  },
};