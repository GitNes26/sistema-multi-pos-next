// Se ejecuta una vez al arrancar el servidor: pone en marcha el ejecutor de trabajos en segundo
// plano (reintentos, recuperación y trabajos pendientes tras un reinicio). El código de Node va en
// otro archivo para que no se compile para el runtime Edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node")
  }
}
