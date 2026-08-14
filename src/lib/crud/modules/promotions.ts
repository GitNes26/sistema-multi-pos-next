import type { Prisma, $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

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
}

type Dec = { toNumber(): number } | number;
const num = (v: Dec): number => (typeof v === "number" ? v : v.toNumber());

type PromotionRow = {
  id: string;
  name: string;
  description: string | null;
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
  return {
    id: p.id,
    name: p.name,
    description: p.description,
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
    targets: p.targets,
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

  return {
    create: {
      organizationId,
      name: String(data.name ?? "").trim(),
      description: (data.description as string | null) ?? null,
      imageUrl: (data.imageUrl as string | null) ?? null,
      benefit,
      scope,
      value: Number(data.value ?? 0),
      buyQuantity: Number(data.buyQuantity ?? 0),
      getQuantity: Number(data.getQuantity ?? 0),
      minAmount: Number(data.minAmount ?? 0),
      minQuantity: Number(data.minQuantity ?? 0),
      startsAt: (data.startsAt as string | null) ? new Date(data.startsAt as string) : null,
      endsAt: (data.endsAt as string | null) ? new Date(data.endsAt as string) : null,
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
    return serialize(p);
  },

  async update(organizationId, id, input) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.promotion.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Promoción no encontrada", 404);
    if (data.name != null && !data.name.toString().trim()) {
      throw new CrudError("El nombre es obligatorio", 400, "name");
    }

    const patch: Prisma.PromotionUpdateInput = {
      ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
      ...(data.description !== undefined ? { description: (data.description as string | null) ?? null } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: (data.imageUrl as string | null) ?? null } : {}),
      ...(data.benefit !== undefined ? { benefit: data.benefit as $Enums.PromoBenefit } : {}),
      ...(data.scope !== undefined ? { scope: data.scope as $Enums.PromoScope } : {}),
      ...(data.value !== undefined ? { value: Number(data.value) } : {}),
      ...(data.buyQuantity !== undefined ? { buyQuantity: Number(data.buyQuantity ?? 0) } : {}),
      ...(data.getQuantity !== undefined ? { getQuantity: Number(data.getQuantity ?? 0) } : {}),
      ...(data.minAmount !== undefined ? { minAmount: Number(data.minAmount ?? 0) } : {}),
      ...(data.minQuantity !== undefined ? { minQuantity: Number(data.minQuantity ?? 0) } : {}),
      ...(data.startsAt !== undefined ? { startsAt: data.startsAt ? new Date(data.startsAt as string) : null } : {}),
      ...(data.endsAt !== undefined ? { endsAt: data.endsAt ? new Date(data.endsAt as string) : null } : {}),
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

    return serialize(p);
  },

  async remove(organizationId, id) {
    const p = await prisma.promotion.findFirst({ where: { id, organizationId } });
    if (!p) throw new CrudError("Promoción no encontrada", 404);
    await prisma.promotionTarget.deleteMany({ where: { promotionId: id } });
    await prisma.promotion.delete({ where: { id } });
  },
};