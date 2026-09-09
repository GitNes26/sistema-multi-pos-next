/**
 * Aplica los productos Personalizados de la demo (nieve, café, papas estilo
 * Papa Brothers) a la organización "Restaurante Demo" EXISTENTE, sin borrar
 * nada más (a diferencia de un reseed completo). Idempotente: si el producto
 * ya existe por nombre, no lo duplica.
 */
import { prisma } from "../src/lib/db/client";
import { placeholderImageUrl } from "../src/lib/catalog/placeholder";

const REST_ORG_NAME = "Restaurante Demo";

const PRODUCTS = [
  {
    category: "Postres",
    name: "Nieve de garrafa",
    emoji: "🍧",
    desc: "Elige tu tamaño y hasta 2 sabores combinados; agrégale toppings a tu gusto.",
    variants: [
      { name: "Chico", price: 35 },
      { name: "Mediano", price: 45 },
      { name: "Grande", price: 55 },
    ],
    options: [
      {
        name: "Sabores (combinables)",
        required: true,
        minSelect: 1,
        maxSelect: 2,
        values: [
          { value: "Fresa", extraPrice: 0 },
          { value: "Limón", extraPrice: 0 },
          { value: "Vainilla", extraPrice: 0 },
          { value: "Chocolate", extraPrice: 0 },
        ],
      },
      {
        name: "Toppings",
        required: false,
        minSelect: 0,
        maxSelect: 3,
        values: [
          { value: "Chispas de chocolate", extraPrice: 10 },
          { value: "Mermelada", extraPrice: 10 },
          { value: "Nutella", extraPrice: 15 },
          { value: "Granillo", extraPrice: 8 },
        ],
      },
    ],
  },
  {
    category: "Bebidas",
    name: "Café de especialidad",
    emoji: "☕",
    desc: "Tamaño a tu medida, elige tu tipo de leche y decóralo como más te guste.",
    variants: [
      { name: "Chico 250ml", price: 38 },
      { name: "Grande 400ml", price: 48 },
    ],
    options: [
      {
        name: "Tipo de leche",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        values: [
          { value: "Entera", extraPrice: 0 },
          { value: "Deslactosada", extraPrice: 5 },
          { value: "Almendra", extraPrice: 10 },
          { value: "Avena", extraPrice: 8 },
        ],
      },
      {
        name: "Decoraciones",
        required: false,
        minSelect: 0,
        maxSelect: 3,
        values: [
          { value: "Canela", extraPrice: 0 },
          { value: "Chispas de chocolate", extraPrice: 8 },
          { value: "Crema batida", extraPrice: 10 },
          { value: "Caramelo", extraPrice: 5 },
        ],
      },
    ],
  },
  {
    category: "Platos fuertes",
    name: "Papas estilo Papa Brothers",
    emoji: "🍟",
    desc: "Elige tu tamaño; cada una lleva especialidades al gusto y elige tus aderezos.",
    variants: [
      { name: "Chico", price: 55 },
      { name: "Mediano", price: 70 },
      { name: "Grande", price: 85 },
    ],
    options: [
      {
        name: "Especialidades",
        required: true,
        minSelect: 1,
        maxSelect: 3,
        values: [
          { value: "Boneless", extraPrice: 15 },
          { value: "Fajitas", extraPrice: 15 },
          { value: "Pollo teriyaki", extraPrice: 15 },
          { value: "Pastor", extraPrice: 15 },
          { value: "Choriqueso", extraPrice: 18 },
        ],
      },
      {
        name: "Aderezos",
        required: false,
        minSelect: 0,
        maxSelect: 4,
        values: [
          { value: "Cilantro", extraPrice: 0 },
          { value: "BBQ", extraPrice: 8 },
          { value: "Búfalo", extraPrice: 8 },
          { value: "Queso amarillo", extraPrice: 12 },
          { value: "Queso parmesano", extraPrice: 12 },
        ],
      },
    ],
  },
];

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: REST_ORG_NAME },
    select: { id: true },
  });
  if (!org) throw new Error("Restaurante Demo no encontrado");

  const location = await prisma.location.findFirst({
    where: { organizationId: org.id, isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const unitPza = await prisma.unitOfMeasure.findFirst({
    where: { abbreviation: "pza" },
    select: { id: true },
  });

  let created = 0;
  for (const def of PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { organizationId: org.id, name: def.name },
      select: { id: true },
    });
    if (existing) {
      console.log(`⚠ ya existe: ${def.name}`);
      continue;
    }
    const category = await prisma.category.findFirst({
      where: { organizationId: org.id, name: def.category },
      select: { id: true },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: org.id,
        categoryId: category?.id ?? null,
        name: def.name,
        description: def.desc,
        imageUrl: placeholderImageUrl(def.emoji, def.category),
        taxRate: 0.16,
        trackInventory: true,
        productType: "custom",
        isNew: true,
      },
    });
    let skuBase = 900;
    for (const v of def.variants) {
      skuBase += 1;
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          organizationId: org.id,
          sku: `R-${String(skuBase).padStart(3, "0")}`,
          name: v.name,
          price: v.price,
          cost: Math.round(v.price * 0.35 * 100) / 100,
        },
      });
      await prisma.inventory.create({
        data: {
          organizationId: org.id,
          variantId: variant.id,
          locationId: location?.id ?? "",
          locationType: "location",
          quantity: 60,
          unitId: unitPza?.id ?? null,
          minThreshold: 5,
        },
      });
    }
    let optPos = 0;
    for (const opt of def.options) {
      optPos += 1;
      const option = await prisma.productOption.create({
        data: {
          productId: product.id,
          name: opt.name,
          position: optPos,
          required: opt.required,
          minSelect: opt.minSelect,
          maxSelect: opt.maxSelect,
        },
      });
      let valPos = 0;
      for (const val of opt.values) {
        valPos += 1;
        await prisma.productOptionValue.create({
          data: {
            optionId: option.id,
            value: val.value,
            extraPrice: val.extraPrice,
            position: valPos,
          },
        });
      }
    }
    created += 1;
    console.log(`✓ ${def.name} (${def.variants.length} variantes, ${def.options.length} tópicos)`);
  }
  console.log(`Listo: ${created} productos personalizados creados en ${REST_ORG_NAME}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());