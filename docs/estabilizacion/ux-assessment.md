# Auditoría UI/UX — lote inicial

Aplicada la skill `impeccable` en modo `shape`, `audit`, `critique` y `harden` sobre POS, acceso, portal, navegación y componentes compartidos. La revisión automática (`impeccable-deteccion.json`) encontró 65 observaciones: 64 advisory de tipografía fuera de la escala documentada y 1 warning. Son hallazgos de consistencia para el siguiente lote, no bloqueadores funcionales.

La matriz de dispositivos queda definida en `matriz.md`: 360×800, 390×844, 768×1024, 1024×768 y 1366×768. Falta validar físicamente teclado virtual, escáner, impresora y orientación en hardware real.

Prioridad siguiente: cerrar recorridos funcionales de inventario, servicios, rentas y BI; continuar la inspección autenticada por viewport y después abordar la escala tipográfica como un lote acotado. Firefox/WebKit y hardware físico siguen pendientes.
