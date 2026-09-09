---
name: demo-capacitacion
description: "Genera/actualiza el guion de demo y capacitación del vendedor para enseñar el sistema desde cero a un cliente, incluyendo la demostración de los wizards (configuración inicial, acciones guiadas del panel y prueba del portal). Úsala cuando cambien pantallas, wizards, credenciales demo o rutas."
argument-hint: "[formato: html | markdown]"
---

# /demo-capacitacion

Regenera el **kit de capacitación del vendedor** (`.freebuff/capacitacion-demo.html` o
`docs/capacitacion/guion-demo.md` según el argumento): un guion de demo + capacitación de
≈45 minutos para enseñar el sistema desde cero a un cliente nuevo, con demostración en vivo
de los wizards y credenciales demo reales.

## Fuentes de verdad (léelas SIEMPRE, en este orden)

1. `README.md` — credenciales demo (dueño `demo@multi-pos.com` / `demo1234`, clientes
   portal por organización, PIN de supervisor por defecto, URLs fijas de QR de mesa y
   `/reservar`), contenido sembrado de cada organización demo y comandos de re-siembra.
2. `src/components/shared/onboarding/onboarding-wizard.tsx` — **Wizard 1**: pasos reales
   (Bienvenida → Tipo de negocio → ¡Listo!) y textos visibles.
3. `src/lib/business-modes.ts` — nombre, descripción y chips de cada tipo de negocio +
   `MODE_WIZARDS` (qué acciones guiadas muestra cada modo).
4. `src/components/admin/dashboard/wizard-launcher.tsx` — **Wizard 2**: tarjeta de acciones
   guiadas del dashboard, orden numerado, auto-ocultado y el diálogo "Prueba tu portal".
5. `src/components/shared/wizards/first-order-wizard.tsx` — **Wizard del portal**: pasos
   (Cliente de prueba → Ver portal → Hacer un pedido → ¡Listo!) con sus botones reales.
6. `src/components/pos/pos-role-guide.tsx` — **Guía del POS** ("Mesa y cocina en 3 pasos",
   solo food_service/hybrid) y dónde se reabre (header del POS).
7. `src/lib/pos/config.ts` — PIN de supervisor por defecto, métodos de pago y reglas
   (descuento >10% requiere PIN).
8. Rutas: `/onboarding`, `/admin`, `/pos`, `/kds`, `/portal`, `/reservar`,
   `/portal/menu?table=…&token=…`.

## Estructura obligatoria del guion

1. **Preparación** (antes del cliente): servidor, logins, pestañas a abrir, re-siembra.
2. **Agenda** con tiempos (0–5 descubrimiento, 5–10 wizard 1, 10–20 wizard 2 + panel,
   20–30 POS en vivo, 30–38 wizard del portal, 38–45 objeciones y cierre).
3. **Tabla "si el cliente es X → organización demo Y"** con lo que verá en cada una.
4. **Demostración de cada wizard** paso a paso con sus textos reales, frases dichas por el
   vendedor (`.say`) y el "momento wow" de cada uno.
5. **POS en vivo** (venta completa: caja, variantes, granel, constructor, descuento con
   PIN, cobro dividido, crédito, ticket) y, en food/híbrido, la **Guía del POS** + KDS.
6. **Cierre del círculo**: pedido del portal aparece en Operación → Pedidos; delivery con
   GPS y PIN/QR.
7. **Objeciones** en `<details>` plegables con respuestas de venta.
8. **Plan de implantación** (5 fases) y **chuleta final** de rutas + credenciales.

## Reglas

- **Verificación anti-promesa** (misma que `/manual-usuario`): cada pantalla, botón y paso
  citados deben existir hoy en el código. Si un wizard cambió sus pasos, actualiza el
  guion con los pasos nuevos — nunca los memorizados.
- Las credenciales del guion son **solo de demo** (README); nunca incluyas secretos de
  producción ni variables de entorno reales.
- Lenguaje de vendedor: frases cortas dichas en primera persona, español LATAM, tono
  cercano; el cliente debe sentir que ve *su* negocio, no un software genérico.
- Formato HTML (`.freebuff/capacitacion-demo.html`): autocontenido, sin dependencias,
  imprimible (`@media print`), accesible y verificado con `register_preview` +
  `preview_snapshot` + `preview_logs` antes de entregar. Formato markdown: mismo
  contenido en `docs/capacitacion/guion-demo.md`.
- Al terminar, reporta qué cambió respecto a la versión anterior del guion (pasos nuevos
  de wizards, credenciales, rutas).
