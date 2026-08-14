// FASE 7.11 — Helper de subida de archivos al endpoint /api/uploads.

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "No se pudo subir el archivo");
  return data.url ?? "";
}

export const UPLOAD_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";