import type { PublicationInput, PublicationRow } from "@/lib/publications/server";

// FASE 18 — Cliente HTTP de publicaciones.

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? "Error de red");
  return data;
}

export const publicationsApi = {
  list: () => json<{ ok: boolean; publications: PublicationRow[] }>("/api/publications"),
  create: (input: PublicationInput) =>
    json<{ ok: boolean; publication: PublicationRow }>("/api/publications", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: PublicationInput) =>
    json<{ ok: boolean; publication: PublicationRow }>(`/api/publications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    json<{ ok: boolean }>(`/api/publications/${id}`, { method: "DELETE" }),
};
