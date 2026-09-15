---
name: manuales-sistema
description: Genera y sincroniza los manuales HTML e imprimibles de Multi-POS desde el código real. Úsala al cambiar rutas, roles, módulos, flujos, configuración, instalación o capacitación; no la uses para documentación ajena al producto.
---

# Manuales de Multi-POS

Mantén como conjunto coherente el manual de usuario, el manual del vendedor, el
manual técnico y la guía para crear o modificar módulos.

## Fuente de verdad

Antes de redactar, lee [references/fuentes.md](references/fuentes.md) y las fuentes
que correspondan al manual solicitado. El código vigente gana frente a documentación
anterior. No presentes flags, tablas o servicios internos como funciones disponibles si
no existe una interfaz o flujo comprobable.

## Flujo

1. Actualiza primero el contexto vigente del sistema y registra fecha y revisión.
2. Conserva los Markdown detallados como fuente editable.
3. Sincroniza `docs/manuales/index.html`: navegación entre manuales, búsqueda local,
   índice por sección y botón **Exportar PDF** mediante impresión del navegador.
4. Usa español LATAM, acciones verificables, rutas visibles y ejemplos coherentes con
   los cinco modos de negocio.
5. Separa requisitos, pasos, resultado esperado, errores recuperables y limitaciones.
6. Verifica enlaces, encabezados, impresión A4, tablas, saltos de página, teclado y móvil.

## Reglas por manual

- **Usuario:** lenguaje no técnico; explica qué ve, qué acción realiza y qué resultado
  obtiene. No documentes acciones sin UI.
- **Vendedor:** recorrido de descubrimiento, demo por modo, preguntas de diagnóstico,
  credenciales demo y límites que no deben prometerse.
- **Técnico:** arquitectura, entornos, secretos, base de datos, migraciones, seeders,
  pruebas, despliegue, observabilidad, respaldo y seguridad.
- **Módulos:** contrato transversal de rutas, permisos, aislamiento por organización,
  flags por modo, datos, validación, UI adaptable, pruebas, exportación y documentación.

## Cierre

Ejecuta typecheck y pruebas aplicables cuando la documentación acompañe cambios de
código. Abre el HTML y comprueba la impresión. Reporta discrepancias como hallazgos;
no las ocultes reescribiendo el manual.
