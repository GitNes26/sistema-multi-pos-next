import { prisma } from "@/lib/db";
import type { $Enums } from "@prisma/client";

// FASE 18 — Publicaciones / newsfeed (CRUD).

export type PublicationKind = "product_new" | "promotion" | "notice";

export const PUBLICATION_TYPES: { value: PublicationKind; label: string }[] = [
  { value: "product_new", label: "Producto nuevo" },
  { value: "promotion", label: "Promoción" },
  { value: "notice", label: "Aviso" },
];

export const PUBLICATION_TYPE_LABELS: Record<PublicationKind, string> = {
  product_new: "Producto nuevo",
  promotion: "Promoción",
  notice: "Aviso",
};

export interface PublicationInput {
  title: string;
  content?: string | null;
  imageUrl?: string | null;
  type: PublicationKind;
  isActive?: boolean;
  publishedAt?: string | null;
}

export interface PublicationRow {
  id: string;
  title: string;
  content: string | null;
  imageUrl: string | null;
  type: string;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
}

function toRow(p: {
  id: string;
  title: string;
  content: string | null;
  imageUrl: string | null;
  type: $Enums.PublicationType;
  isActive: boolean;
  publishedAt: Date | null;
  createdAt: Date;
}): PublicationRow {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    imageUrl: p.imageUrl,
    type: p.type,
    isActive: p.isActive,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listPublications(organizationId: string): Promise<PublicationRow[]> {
  const rows = await prisma.publication.findMany({
    where: { organizationId },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toRow);
}

export async function createPublication(
  organizationId: string,
  input: PublicationInput
): Promise<PublicationRow> {
  if (!input.title?.trim()) throw new Error("El título es obligatorio");
  const created = await prisma.publication.create({
    data: {
      organizationId,
      title: input.title.trim(),
      content: input.content ?? null,
      imageUrl: input.imageUrl ?? null,
      type: input.type as $Enums.PublicationType,
      isActive: input.isActive ?? true,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : new Date(),
    },
  });
  return toRow(created);
}

export async function updatePublication(
  organizationId: string,
  id: string,
  input: PublicationInput
): Promise<PublicationRow> {
  const existing = await prisma.publication.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Publicación no encontrada");

  const updated = await prisma.publication.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.content !== undefined ? { content: input.content ?? null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
      ...(input.type !== undefined ? { type: input.type as $Enums.PublicationType } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.publishedAt !== undefined
        ? { publishedAt: input.publishedAt ? new Date(input.publishedAt) : null }
        : {}),
    },
  });
  return toRow(updated);
}

export async function deletePublication(
  organizationId: string,
  id: string
): Promise<{ ok: boolean }> {
  const existing = await prisma.publication.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("Publicación no encontrada");
  await prisma.publication.delete({ where: { id } });
  return { ok: true };
}
