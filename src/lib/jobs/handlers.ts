import { readFile, rm } from "node:fs/promises"
import path from "node:path"
import { invalidateOrg } from "@/lib/cache"
import { importWorkbook } from "@/lib/excel/spreadsheet"
import { uploadsRoot } from "@/lib/uploads/storage"
import { registerJobHandler } from "./queue"

/** Carpeta de archivos que esperan a ser procesados en segundo plano. */
export const jobFilesDir = () => path.join(uploadsRoot(), "_jobs")

/**
 * Importación de Excel (productos, categorías, clientes). El archivo se guardó en disco al
 * recibirlo; aquí se procesa con el mismo `importWorkbook` de la importación inmediata, de modo
 * que las reglas y los mensajes son idénticos.
 */
registerJobHandler("excel.import", async (payload, { job, progress }) => {
  const { module, fileName, userId, canManageInventory } = payload as { module: string; fileName: string; userId: string; canManageInventory?: boolean }
  if (!job.organizationId) throw new Error("El trabajo no tiene empresa")
  const filePath = path.join(jobFilesDir(), path.basename(fileName))
  const buffer = await readFile(filePath)
  const result = await importWorkbook(job.organizationId, module, buffer, {
    userId,
    canManageInventory,
    onProgress: (done, total) => progress(total ? (done / total) * 100 : 100),
  })
  invalidateOrg(job.organizationId)
  // Con un error de infraestructura se reintenta; un resultado con filas inválidas es una respuesta final.
  await rm(filePath, { force: true })
  return JSON.parse(JSON.stringify(result))
})
