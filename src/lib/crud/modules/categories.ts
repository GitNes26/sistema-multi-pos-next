import { prisma } from "@/lib/db";
import { categoryPlaceholder, isPlaceholderImage, recolorPlaceholder } from "@/lib/catalog/auto-emoji";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface CategoryDto {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  imageUrl: string | null;
  isActive: boolean;
  childCount: number;
  productCount: number;
}

type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
  imageUrl: string | null;
  isActive: boolean;
  parent: { name: string } | null;
  _count: { children: number; products: number };
};

function serialize(c: CategoryRow): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    parentName: c.parent?.name ?? null,
    imageUrl: c.imageUrl,
    isActive: c.isActive,
    childCount: c._count.children,
    productCount: c._count.products,
  };
}

export const categoriesModule: CrudModule<CategoryDto> = {
  key: "categories",

  async list(organizationId, params: ListParams): Promise<CrudListResult<CategoryDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, params.pageSize ?? 50);
    const q = params.q?.trim() ?? "";

    const where = {
      organizationId,
      ...(q ? { name: { contains: q } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.category.findMany({
        where,
        include: { parent: { select: { name: true } }, _count: { select: { children: true, products: true } } },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count({ where }),
    ]);

    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const c = await prisma.category.findFirst({
      where: { id, organizationId },
      include: { parent: { select: { name: true } }, _count: { select: { children: true, products: true } } },
    });
    if (!c) throw new CrudError("Categoría no encontrada", 404);
    return serialize(c);
  },

  async create(organizationId, input) {
    const data = input as { name?: string; parentId?: string | null; imageUrl?: string | null; isActive?: boolean };
    if (!data.name?.trim()) throw new CrudError("El nombre es obligatorio", 400, "name");
    const duplicate = await prisma.category.findFirst({ where: { organizationId, name: data.name.trim() } });
    if (duplicate) throw new CrudError("Ya existe una categoría con ese nombre", 400, "name");

    if (data.parentId) {
      const parent = await prisma.category.findFirst({ where: { id: data.parentId, organizationId } });
      if (!parent) throw new CrudError("La categoría padre no existe", 400, "parentId");
    }

    const c = await prisma.category.create({
      data: {
        organizationId,
        name: data.name.trim(),
        parentId: data.parentId ? data.parentId : null,
        // Sin foto: imagen ilustrada con emoji y color propios de la categoría.
        imageUrl: data.imageUrl || categoryPlaceholder(data.name.trim()),
        isActive: data.isActive ?? true,
      },
      include: { parent: { select: { name: true } }, _count: { select: { children: true, products: true } } },
    });
    return serialize(c);
  },

  async update(organizationId, id, input) {
    const data = input as { name?: string; parentId?: string | null; imageUrl?: string | null; isActive?: boolean };
    const existing = await prisma.category.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Categoría no encontrada", 404);

    if (data.parentId) {
      if (data.parentId === id) throw new CrudError("Una categoría no puede ser su propio padre", 400, "parentId");
      const parent = await prisma.category.findFirst({ where: { id: data.parentId, organizationId } });
      if (!parent) throw new CrudError("La categoría padre no existe", 400, "parentId");
    }

    const newName = data.name !== undefined ? data.name.trim() : existing.name;
    const renamed = newName !== existing.name;
    // Imagen: la foto enviada; si se quita (o no hay) y no es foto real,
    // la ilustración se regenera con el nombre vigente.
    const sentPhoto = data.imageUrl ? !isPlaceholderImage(data.imageUrl) : false;
    const nextImage = sentPhoto
      ? data.imageUrl!
      : (data.imageUrl !== undefined && !data.imageUrl) || (isPlaceholderImage(existing.imageUrl) && (renamed || !existing.imageUrl))
        ? categoryPlaceholder(newName)
        : undefined;

    const c = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: newName } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId ? data.parentId : null } : {}),
        ...(nextImage !== undefined ? { imageUrl: nextImage } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: { parent: { select: { name: true } }, _count: { select: { children: true, products: true } } },
    });

    // Al renombrar, los productos con imagen ilustrada toman el nuevo color.
    if (renamed) {
      const products = await prisma.product.findMany({
        where: { organizationId, categoryId: id, imageUrl: { startsWith: "/api/placeholder/image" } },
        select: { id: true, imageUrl: true },
      });
      for (const p of products) {
        await prisma.product.update({ where: { id: p.id }, data: { imageUrl: recolorPlaceholder(p.imageUrl!, newName) } });
      }
    }
    return serialize(c);
  },

  async remove(organizationId, id) {
    const c = await prisma.category.findFirst({ where: { id, organizationId } });
    if (!c) throw new CrudError("Categoría no encontrada", 404);
    // Soft-delete: deactivate category to preserve history.
    await prisma.category.update({ where: { id }, data: { isActive: false } });
  },
};
