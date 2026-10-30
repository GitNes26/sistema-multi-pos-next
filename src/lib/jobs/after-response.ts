import { after } from "next/server"

/**
 * Ejecuta trabajo que el usuario no necesita esperar (avisos, correos, recálculos) cuando la
 * respuesta ya salió. Los errores se registran y nunca llegan al usuario. Fuera de una petición
 * (pruebas, scripts) se ejecuta de inmediato, también sin bloquear a quien llama.
 */
export function runAfterResponse(label: string, task: () => Promise<void>) {
  const run = async () => {
    try {
      await task()
    } catch (err) {
      console.error(`[after:${label}]`, err)
    }
  }
  try {
    after(run)
  } catch {
    void run()
  }
}
