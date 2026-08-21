import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface VariantDto {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost: number;
  imageUrl: string | null;
  isActive: boolean;
  optionValues: { optionId: string; optionName: string; valueId: string; value: string }[];
}

export interface ProductOptionDto {
  id: string;
  name: string;
  position: number;
  values: { id: string; value: string; position: number }[];
}

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  taxRate: number;
  isActive: boolean;
  trackInventory: boolean;
  productType: "standard" | "bulk";
  bulkUnitId: string | null;
  bulkUnitAbbrev: string | null;
  bulkUnitName: string | null;
  bulkPricePerUnit: number;
  bulkMinQuantity: number;
  bulkStep: number;
  bulkMaxQuantity: number;
  allowSplit: boolean;
  splitUnitId: string | null;
  splitUnitAbbrev: string | null;
  splitUnitName: string | null;
  splitPricePerUnit: number;
  options: ProductOptionDto[];
  variants: VariantDto[];
  createdAt: string;
}

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  imageUrl: string | null;
  taxRate: { toNumber(): number } | number;
  isActive: boolean;
  trackInventory: boolean;
  productType: "standard" | "bulk";
  bulkUnitId: string | null;
  bulkPricePerUnit: { toNumber(): number } | number;
  bulkMinQuantity: { toNumber(): number } | number;
  bulkStep: { toNumber(): number } | number;
  bulkMaxQuantity: { toNumber(): number } | number;
  allowSplit: boolean;
  splitUnitId: string | null;
  splitPricePerUnit: { toNumber(): number } | number;
  createdAt: Date;
  category: { name: string } | null;
  bulkUnit: { name: string; abbreviation: string } | null;
  splitUnit: { name: string; abbreviation: string } | null;
  options: {
    id: string;
    name: string;
    position: number;
    values: { id: string; value: string; position: number }[];
  }[];
  variants: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    price: { toNumber(): number } | number;
    cost: { toNumber(): number } | number;
    imageUrl: string | null;
    isActive: boolean;
    optionValues: {
      optionValue: { id: string; value: string; option: { id: string; name: string } };
    }[];
  }[];
};

const num = (v: { toNumber(): number } | number): number => (typeof v === "number" ? v : v.toNumber());

const include = {
  category: { select: { name: true } },
  bulkUnit: { select: { name: true, abbreviation: true } },
  splitUnit: { select: { name: true, abbreviation: true } },
  options: {
    select: {
      id: true,
      name: true,
      position: true,
      values: {
        select: { id: true, value: true, position: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  },
  variants: {
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      price: true,
      cost: true,
      imageUrl: true,
      isActive: true,
      optionValues: {
        select: {
          optionValue: {
            select: { id: true, value: true, option: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

function serialize(p: ProductRow): ProductDto {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    imageUrl: p.imageUrl,
    taxRate: num(p.taxRate),
    isActive: p.isActive,
    trackInventory: p.trackInventory,
    productType: p.productType,
    bulkUnitId: p.bulkUnitId,
    bulkUnitAbbrev: p.bulkUnit?.abbreviation ?? null,
    bulkUnitName: p.bulkUnit?.name ?? null,
    bulkPricePerUnit: num(p.bulkPricePerUnit),
    bulkMinQuantity: num(p.bulkMinQuantity),
    bulkStep: num(p.bulkStep),
    bulkMaxQuantity: num(p.bulkMaxQuantity),
    allowSplit: p.allowSplit,
    splitUnitId: p.splitUnitId,
    splitUnitAbbrev: p.splitUnit?.abbreviation ?? null,
    splitUnitName: p.splitUnit?.name ?? null,
    splitPricePerUnit: num(p.splitPricePerUnit),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      price: num(v.price),
      cost: num(v.cost),
      imageUrl: v.imageUrl,
      isActive: v.isActive,
      optionValues: v.optionValues.map((ov) => ({
        optionId: ov.optionValue.option.id,
        optionName: ov.optionValue.option.name,
        valueId: ov.optionValue.id,
        value: ov.optionValue.value,
      })),
    })),
    options: p.options.map((o) => ({
      id: o.id,
      name: o.name,
      position: o.position,
      values: o.values.map((v) => ({ id: v.id, value: v.value, position: v.position })),
    })),
    createdAt: p.createdAt.toISOString(),
  };
}

export const productsModule: CrudModule<ProductDto> = {
  key: "products",

  async list(organizationId, params: ListParams): Promise<CrudListResult<ProductDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const categoryId = (params.categoryId as string) || undefined;
    const productType = (params.productType as "standard" | "bulk") || undefined;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(categoryId ? { categoryId } : {}),
      ...(productType ? { productType } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { variants: { some: { sku: { contains: q } } } },
              { variants: { some: { barcode: { contains: q } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const p = await prisma.product.findFirst({ where: { id, organizationId }, include });
    if (!p) throw new CrudError("Producto no encontrado", 404);
    return serialize(p);
  },

  async create(organizationId, input, _ctx) {
    const data = input as Record<string, unknown>;
    if (!data.name || String(data.name).trim() === "") {
      throw new CrudError("El nombre es obligatorio", 400, "name");
    }
    const productType = data.productType === "bulk" ? "bulk" : "standard";

    const product = await prisma.product.create({
      data: {
        organizationId,
        name: String(data.name).trim(),
        description: data.description ? String(data.description) : null,
        categoryId: data.categoryId ? String(data.categoryId) : null,
        imageUrl: data.imageUrl ? String(data.imageUrl) : null,
        taxRate: Number(data.taxRate) || 0,
        isActive: data.isActive !== false,
        trackInventory: data.trackInventory !== false,
        productType,
        bulkUnitId: productType === "bulk" && data.bulkUnitId ? String(data.bulkUnitId) : null,
        bulkPricePerUnit: productType === "bulk" ? Number(data.bulkPricePerUnit) || 0 : 0,
        bulkMinQuantity: productType === "bulk" ? Number(data.bulkMinQuantity) || 0 : 0,
        bulkStep: productType === "bulk" ? Number(data.bulkStep) || 0.01 : 0,
        bulkMaxQuantity: productType === "bulk" ? Number(data.bulkMaxQuantity) || 0 : 0,
        allowSplit: productType === "bulk" && data.allowSplit === true,
        splitUnitId: productType === "bulk" && data.allowSplit === true && data.splitUnitId ? String(data.splitUnitId) : null,
        splitPricePerUnit: productType === "bulk" && data.allowSplit === true ? Number(data.splitPricePerUnit) || 0 : 0,
      },
      include,
    });

    // Variante inicial "Default" para productos estándar (así aparecen en el POS).
    if (productType === "standard") {
      const options = parseOptions(data.options);
      if (options.length > 0) {
        // Opciones definidas → generar combinaciones de variantes automáticamente.
        const base = data.initialVariant as Record<string, unknown> | undefined;
        await createOptionsWithVariants(organizationId, product.id, options, {
          price: Number(base?.price) || 0,
          cost: Number(base?.cost) || 0,
        });
      } else if (data.initialVariant) {
        const v = data.initialVariant as Record<string, unknown>;
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            organizationId,
            name: v.name ? String(v.name) : "Default",
            sku: v.sku ? String(v.sku) : null,
            barcode: v.barcode ? String(v.barcode) : null,
            price: Number(v.price) || 0,
            cost: Number(v.cost) || 0,
            isActive: true,
          },
        });
        await syncVariantInventory(organizationId, product.id, variant.id);
      }
    }

    return serialize(
      (await prisma.product.findFirstOrThrow({
        where: { id: product.id },
        include,
      })) as unknown as ProductRow
    );
  },

  async update(organizationId, id, input, _ctx) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.product.findFirst({ where: { id, organizationId }, select: { id: true, productType: true } });
    if (!existing) throw new CrudError("Producto no encontrado", 404);

    const productType =
      data.productType === "bulk" || data.productType === "standard" ? data.productType : existing.productType;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
        ...(data.description !== undefined ? { description: data.description ? String(data.description) : null } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId ? String(data.categoryId) : null } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl ? String(data.imageUrl) : null } : {}),
        ...(data.taxRate !== undefined ? { taxRate: Number(data.taxRate) || 0 } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive !== false } : {}),
        ...(data.trackInventory !== undefined ? { trackInventory: data.trackInventory !== false } : {}),
        productType,
        // Granel
        ...(data.bulkUnitId !== undefined ? { bulkUnitId: productType === "bulk" && data.bulkUnitId ? String(data.bulkUnitId) : null } : {}),
        ...(data.bulkPricePerUnit !== undefined ? { bulkPricePerUnit: productType === "bulk" ? Number(data.bulkPricePerUnit) || 0 : 0 } : {}),
        ...(data.bulkMinQuantity !== undefined ? { bulkMinQuantity: productType === "bulk" ? Number(data.bulkMinQuantity) || 0 : 0 } : {}),
        ...(data.bulkStep !== undefined ? { bulkStep: productType === "bulk" ? Number(data.bulkStep) || 0.01 : 0 } : {}),
        ...(data.bulkMaxQuantity !== undefined ? { bulkMaxQuantity: productType === "bulk" ? Number(data.bulkMaxQuantity) || 0 : 0 } : {}),
        ...(data.allowSplit !== undefined ? { allowSplit: productType === "bulk" && data.allowSplit === true } : {}),
        ...(data.splitUnitId !== undefined
          ? { splitUnitId: productType === "bulk" && data.allowSplit === true && data.splitUnitId ? String(data.splitUnitId) : null }
          : {}),
        ...(data.splitPricePerUnit !== undefined
          ? { splitPricePerUnit: productType === "bulk" && data.allowSplit === true ? Number(data.splitPricePerUnit) || 0 : 0 }
          : {}),
      },
      include,
    });

    return serialize((product as unknown) as ProductRow);
  },

  async remove(organizationId, id) {
    const existing = await prisma.product.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { saleItems: true, orderItems: true, inventory: true, variants: true } } },
    });
    if (!existing) throw new CrudError("Producto no encontrado", 404);
    if (existing._count.saleItems > 0 || existing._count.orderItems > 0) {
      throw new CrudError("No se puede eliminar: el producto tiene ventas o pedidos", 409);
    }
    await prisma.$transaction([
      prisma.productVariant.deleteMany({ where: { productId: id } }),
      prisma.inventory.deleteMany({ where: { productId: id } }),
      prisma.inventoryMovement.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);
  },
};

// ── Variantes ────────────────────────────────────────────────────────────────

type OptionInput = { name: string; values: string[] };

function parseOptions(raw: unknown): OptionInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      if (!o || typeof o !== "object") return null;
      const name = String((o as Record<string, unknown>).name ?? "").trim();
      const values = Array.isArray((o as Record<string, unknown>).values)
        ? ((o as Record<string, unknown>).values as unknown[]).map((v) => String(v).trim()).filter(Boolean)
        : [];
      return name && values.length > 0 ? { name, values } : null;
    })
    .filter((o): o is OptionInput => o !== null);
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap((a) => arr.map((b) => [...a, b])), [[]]);
}

/** Crea las opciones + valores y genera una variante por cada combinación de valores. */
async function createOptionsWithVariants(
  organizationId: string,
  productId: string,
  options: OptionInput[],
  base: { price: number; cost: number }
) {
  const optionsWithValues: { name: string; values: { valueId: string; value: string }[] }[] = [];

  let pos = 0;
  for (const opt of options) {
    pos += 1;
    const option = await prisma.productOption.create({
      data: { productId, name: opt.name, position: pos },
    });
    const values: { valueId: string; value: string }[] = [];
    let vpos = 0;
    for (const value of opt.values) {
      vpos += 1;
      const pv = await prisma.productOptionValue.create({
        data: { optionId: option.id, value, position: vpos },
      });
      values.push({ valueId: pv.id, value });
    }
    optionsWithValues.push({ name: opt.name, values });
  }

  const combinations = cartesianProduct(optionsWithValues.map((o) => o.values));
  for (const combo of combinations) {
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        organizationId,
        name: combo.map((v) => v.value).join(" · "),
        price: base.price,
        cost: base.cost,
        isActive: true,
        optionValues: { create: combo.map((v) => ({ optionValueId: v.valueId })) },
      },
    });
    await syncVariantInventory(organizationId, productId, variant.id);
  }
}

async function syncVariantInventory(organizationId: string, productId: string, variantId: string) {
  const locations = await prisma.location.findMany({
    where: { organizationId, isActive: true },
    select: { id: true },
  });
  const unitPza = await prisma.unitOfMeasure.findFirst({
    where: { abbreviation: "pza", OR: [{ organizationId: null }, { organizationId }] },
    select: { id: true },
  });
  await prisma.inventory.createMany({
    data: locations.map((l) => ({
      organizationId,
      productId,
      variantId,
      locationId: l.id,
      locationType: "location" as const,
      quantity: 0,
      unitId: unitPza?.id ?? null,
      minThreshold: 0,
    })),
    skipDuplicates: true,
  });
}

export async function createVariant(organizationId: string, productId: string, input: Record<string, unknown>) {
  const product = await prisma.product.findFirst({ where: { id: productId, organizationId, productType: "standard" } });
  if (!product) throw new CrudError("Producto no encontrado o no es estándar", 400);

  const name = input.name ? String(input.name).trim() : "Default";
  const sku = input.sku ? String(input.sku) : null;
  const barcode = input.barcode ? String(input.barcode) : null;
  if (barcode) {
    const dup = await prisma.productVariant.findFirst({ where: { barcode, organizationId } });
    if (dup) throw new CrudError("Ya existe un producto con ese código de barras", 400, "barcode");
  }
  if (sku) {
    const dup = await prisma.productVariant.findFirst({ where: { sku, organizationId } });
    if (dup) throw new CrudError("Ya existe un producto con ese SKU", 400, "sku");
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      organizationId,
      name,
      sku,
      barcode,
      price: Number(input.price) || 0,
      cost: Number(input.cost) || 0,
      imageUrl: input.imageUrl ? String(input.imageUrl) : null,
      isActive: input.isActive !== false,
      ...(Array.isArray(input.optionValueIds)
        ? { optionValues: { create: input.optionValueIds.map((valueId) => ({ optionValueId: String(valueId) })) } }
        : {}),
    },
  });
  await syncVariantInventory(organizationId, productId, variant.id);

  const full = await prisma.productVariant.findUnique({
    where: { id: variant.id },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      price: true,
      cost: true,
      imageUrl: true,
      isActive: true,
      optionValues: {
        select: { optionValue: { select: { id: true, value: true, option: { select: { id: true, name: true } } } } },
      },
    },
  });
  return {
    id: full!.id,
    name: full!.name,
    sku: full!.sku,
    barcode: full!.barcode,
    price: num(full!.price),
    cost: num(full!.cost),
    imageUrl: full!.imageUrl,
    isActive: full!.isActive,
    optionValues: full!.optionValues.map((ov) => ({
      optionId: ov.optionValue.option.id,
      optionName: ov.optionValue.option.name,
      valueId: ov.optionValue.id,
      value: ov.optionValue.value,
    })),
  };
}

export async function updateVariant(organizationId: string, variantId: string, input: Record<string, unknown>) {
  const v = await prisma.productVariant.findFirst({ where: { id: variantId, organizationId } });
  if (!v) throw new CrudError("Variante no encontrada", 404);

  const sku = input.sku !== undefined ? (input.sku ? String(input.sku) : null) : v.sku;
  const barcode = input.barcode !== undefined ? (input.barcode ? String(input.barcode) : null) : v.barcode;

  if (sku) {
    const dup = await prisma.productVariant.findFirst({ where: { sku, organizationId, id: { not: variantId } } });
    if (dup) throw new CrudError("Ya existe un producto con ese SKU", 400, "sku");
  }
  if (barcode) {
    const dup = await prisma.productVariant.findFirst({
      where: { barcode, organizationId, id: { not: variantId } },
    });
    if (dup) throw new CrudError("Ya existe un producto con ese código de barras", 400, "barcode");
  }

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      ...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
      sku,
      barcode,
      ...(input.price !== undefined ? { price: Number(input.price) || 0 } : {}),
      ...(input.cost !== undefined ? { cost: Number(input.cost) || 0 } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ? String(input.imageUrl) : null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive !== false } : {}),
      ...(Array.isArray(input.optionValueIds)
        ? {
            optionValues: {
              deleteMany: {},
              create: input.optionValueIds.map((valueId) => ({ optionValueId: String(valueId) })),
            },
          }
        : {}),
    },
  });

  const full = await prisma.productVariant.findUnique({
    where: { id: v.id },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      price: true,
      cost: true,
      imageUrl: true,
      isActive: true,
      optionValues: {
        select: { optionValue: { select: { id: true, value: true, option: { select: { id: true, name: true } } } } },
      },
    },
  });

  return {
    id: full!.id,
    name: full!.name,
    sku: full!.sku,
    barcode: full!.barcode,
    price: num(full!.price),
    cost: num(full!.cost),
    imageUrl: full!.imageUrl,
    isActive: full!.isActive,
    optionValues: full!.optionValues.map((ov) => ({
      optionId: ov.optionValue.option.id,
      optionName: ov.optionValue.option.name,
      valueId: ov.optionValue.id,
      value: ov.optionValue.value,
    })),
  };
}

export async function deleteVariant(organizationId: string, variantId: string) {
  const v = await prisma.productVariant.findFirst({
    where: { id: variantId, organizationId },
    include: { _count: { select: { saleItems: true, orderItems: true, inventory: true } } },
  });
  if (!v) throw new CrudError("Variante no encontrada", 404);
  if (v._count.saleItems > 0 || v._count.orderItems > 0 || v._count.inventory > 0) {
    throw new CrudError("No se puede eliminar la variante: tiene ventas, pedidos o inventario", 409);
  }
  await prisma.productVariant.delete({ where: { id: variantId } });
}

// ── Opciones de variante (talla, color, contenido…) ──────────────────────────

const optionsInclude = {
  options: {
    select: {
      id: true,
      name: true,
      position: true,
      values: { select: { id: true, value: true, position: true }, orderBy: { position: "asc" } },
    },
    orderBy: { position: "asc" },
  },
} as const;

export async function getProductOptions(organizationId: string, productId: string): Promise<ProductOptionDto[]> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: optionsInclude,
  });
  if (!product) throw new CrudError("Producto no encontrado", 404);
  return product.options.map((o) => ({
    id: o.id,
    name: o.name,
    position: o.position,
    values: o.values.map((v) => ({ id: v.id, value: v.value, position: v.position })),
  }));
}

export async function saveProductOptions(
  organizationId: string,
  productId: string,
  options: { id?: string; name: string; values: { id?: string; value: string }[] }[]
): Promise<ProductOptionDto[]> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, productType: "standard" },
    select: { id: true },
  });
  if (!product) throw new CrudError("Producto no encontrado o no es estándar", 400);

  const existing = await prisma.productOption.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((o) => o.id));
  const keepIds = new Set((options ?? []).filter((o) => o.id).map((o) => o.id as string));

  // Eliminar opciones removidas (y sus valores / vínculos en cascada).
  const removedIds = [...existingIds].filter((id) => !keepIds.has(id));
  if (removedIds.length > 0) {
    const values = await prisma.productOptionValue.findMany({ where: { optionId: { in: removedIds } }, select: { id: true } });
    const valueIds = values.map((v) => v.id);
    await prisma.$transaction([
      prisma.variantOptionValue.deleteMany({ where: { optionValueId: { in: valueIds } } }),
      prisma.productOptionValue.deleteMany({ where: { optionId: { in: removedIds } } }),
      prisma.productOption.deleteMany({ where: { id: { in: removedIds } } }),
    ]);
  }

  // Upsert opciones y valores en orden.
  let pos = 0;
  for (const opt of options ?? []) {
    pos += 1;
    const optId = opt.id && keepIds.has(opt.id) ? opt.id : undefined;
    const option = optId
      ? await prisma.productOption.update({ where: { id: optId }, data: { name: opt.name.trim(), position: pos } })
      : await prisma.productOption.create({ data: { productId, name: opt.name.trim(), position: pos } });

    const existingValues = await prisma.productOptionValue.findMany({
      where: { optionId: option.id },
      select: { id: true, value: true },
    });
    const existingValueMap = new Map(existingValues.map((v) => [v.value.trim().toLowerCase(), v.id]));
    let vpos = 0;
    for (const raw of opt.values ?? []) {
      vpos += 1;
      const value = raw.value.trim();
      if (!value) continue;
      const existingId = existingValueMap.get(value.toLowerCase());
      if (existingId) {
        await prisma.productOptionValue.update({ where: { id: existingId }, data: { value, position: vpos } });
        existingValueMap.delete(value.toLowerCase());
      } else {
        await prisma.productOptionValue.create({ data: { optionId: option.id, value, position: vpos } });
      }
    }
    // Remover valores que ya no estén en la lista.
    const removedValues = [...existingValueMap.values()];
    if (removedValues.length > 0) {
      await prisma.$transaction([
        prisma.variantOptionValue.deleteMany({ where: { optionValueId: { in: removedValues } } }),
        prisma.productOptionValue.deleteMany({ where: { id: { in: removedValues } } }),
      ]);
    }
  }

  return getProductOptions(organizationId, productId);
}