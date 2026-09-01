import { prisma } from "@/lib/db";
import { Prisma, type $Enums } from "@prisma/client";

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
  businessMode?: string | null;
  publishedAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PublicationRow {
  id: string;
  title: string;
  content: string | null;
  imageUrl: string | null;
  type: string;
  isActive: boolean;
  businessMode: string | null;
  publishedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
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
  startsAt: Date | null;
  endsAt: Date | null;
  metadata: unknown;
  createdAt: Date;
}): PublicationRow {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    imageUrl: p.imageUrl,
    type: p.type,
    isActive: p.isActive,
    businessMode: (p as unknown as { businessMode: string | null }).businessMode ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    startsAt: p.startsAt?.toISOString() ?? null,
    endsAt: p.endsAt?.toISOString() ?? null,
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

  const TYPE_NOTIFICATION_KIND: Record<string, string> = {
    product_new: "publication",
    promotion: "promotion",
    notice: "publication",
  };

  const created = await prisma.$transaction(async (tx) => {
    const pub = await tx.publication.create({
      data: {
        organizationId,
        title: input.title.trim(),
        content: input.content ?? null,
        imageUrl: input.imageUrl ?? null,
        type: input.type as $Enums.PublicationType,
        isActive: input.isActive ?? true,
        businessMode: input.businessMode ?? null,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : new Date(),
        startsAt: input.startsAt ? new Date(input.startsAt.includes("T") ? input.startsAt : input.startsAt + "T00:00:00") : null,
        endsAt: input.endsAt ? new Date(input.endsAt.includes("T") ? input.endsAt : input.endsAt + "T00:00:00") : null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });

    // Crear notificación para todos los clientes de la organización
    const customers = await tx.customer.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    if (customers.length > 0) {
      await tx.notification.createMany({
        data: customers.map((c) => ({
          organizationId,
          userId: c.userId,
          kind: TYPE_NOTIFICATION_KIND[input.type as string] ?? "publication",
          title: input.title.trim(),
          body: input.content?.substring(0, 200) ?? null,
          severity: "info",
          metadata: { publicationId: pub.id, type: input.type },
        })),
      });
    }

    return pub;
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
      ...(input.businessMode !== undefined ? { businessMode: input.businessMode ?? null } : {}),
      ...(input.publishedAt !== undefined
        ? { publishedAt: input.publishedAt ? new Date(input.publishedAt) : null }
        : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt.includes("T") ? input.startsAt : input.startsAt + "T00:00:00") : null }
        : {}),
      ...(input.endsAt !== undefined
        ? { endsAt: input.endsAt ? new Date(input.endsAt.includes("T") ? input.endsAt : input.endsAt + "T00:00:00") : null }
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
