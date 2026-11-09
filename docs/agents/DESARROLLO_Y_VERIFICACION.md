# Desarrollo, datos, pruebas y entrega

## Antes de editar

1. `git status --short` y `git log -5 --oneline`.
2. Busca con `rg`; identifica implementación canónica y consumidores.
3. Revisa schema/migración si toca datos y permiso/plan/feature si toca acceso.
4. Define impactos transversales: historial, caja, inventario, notificaciones, reportes y portal.
5. Conserva cambios ajenos; si se solapan, integra deliberadamente.

## Prisma y migraciones

- Cambia `prisma/schema.prisma` y crea migración SQL versionada.
- Producción: `prisma migrate deploy`; nunca `db push` ni reset.
- Seeders son idempotentes y no incluyen secretos literales; credenciales provienen de env.
- `db:reset` es destructivo: úsalo solo con autorización y destino resuelto.
- Al cambiar tipo/relación, migra datos existentes o documenta por qué no hay backfill seguro.
- Verifica índices y constraints tenant; evita tablas puente o interfaces nuevas si una relación actual cubre el caso.

## Estrategia de pruebas

| Cambio | Mínimo |
|---|---|
| Tipos/UI local | `npm run typecheck`, lint del archivo/`npm run lint -- --quiet` |
| Regla pura | prueba en `tests/unit/*.test.mjs` + `npm test` |
| API/transacción | entorno test aislado + integración aplicable |
| Flujo crítico/responsive | E2E/Playwright y revisión en breakpoints relevantes |
| Schema/seeder | base nueva de prueba, migraciones, seed y `migrate diff` coherente |

Comandos:

```bash
npm run typecheck
npm run lint -- --quiet
npm test
npm run test:prepare -- demo
npm run test:serve -- demo
npm run test:integration -- demo
npm run test:e2e -- demo
```

Los perfiles de prueba contienen secretos locales y están ignorados. Las barreras exigen DB `multi_pos_test_*`, opt-in, URL coincidente y servidor loopback. Nunca debilites esas barreras para hacer pasar una prueba.

## Revisión manual

- Camino feliz, vacío, loading, error, permiso denegado y doble click/reintento.
- Móvil pequeño, tablet touch, escritorio con mouse, landscape y teclado virtual.
- Tema claro/oscuro/POS, densidad, texto largo y moneda/decimales.
- Diálogo: header/footer visibles, body desplaza, foco inicial/invalid y escape/cierre.
- Operación: comprueba BD e historial, no solo toast o pantalla.

## Integraciones externas

Impresora, escáner, báscula, cámara, GPS, terminal de pago, correo, push, cron y storage requieren validación en ambiente/dispositivo correspondiente. Se puede verificar fallback y manejo de error localmente, pero no declarar la integración completa sin evidencia externa.

## Versionado y entrega

- No commit/push sin solicitud explícita.
- Para flujo GCV: `npm run gcv -- "feat|fix|...: comentario en español"`; el script agrega cambios, crea commit y actualiza versión según `VERSION.md`.
- Después `git push`; confirma hash, rama y estado limpio.
- El resumen final menciona resultado, verificaciones y cualquier limitación real; no enumera actividad irrelevante.

## Actualización de contexto

Actualiza `CONTEXTO_SISTEMA.md`, guía temática y `MEMORY.md` cuando cambie una decisión duradera. No actualices memoria por refactors internos sin impacto, datos locales, credenciales, commits transitorios ni resultados que caducan.

## Base demo para pruebas de permisos (9 nov 2026)

La demo de recorrido (`finalizeDemoAccess` en `prisma/seeders/demo.ts`) deja a TODAS las cuentas como propietario para poder abrir cualquier pantalla. Las pruebas de permisos (`npm run test:integration`) necesitan los roles reales (mesero, cajero, cocina…), así que `scripts/test-env.mjs prepare demo` escribe `SEED_KEEP_DEMO_ROLES=true` y el seeder los conserva. Para regenerar una base demo de pruebas limpia: borra `.env.test-demo.local` y corre `node scripts/test-env.mjs prepare demo` (crea una base nueva, migra y siembra).

Estado verificado el 9 nov 2026: **29/29** pruebas de integración y la de compras pasan. Para que no se caiga el servidor de pruebas hay que darle memoria (`NODE_OPTIONS=--max-old-space-size=6144`; sin eso Next dev se reinicia a media corrida con «approaching the used memory threshold») y levantarlo desacoplado de la llamada que corre las pruebas (en PowerShell: `Start-Process node -ArgumentList "scripts/test-env.mjs","serve","demo" -WindowStyle Hidden`). Las pruebas ya no asumen cosas que cambiaron en el sistema: la tasa de impuesto real de cada producto, las URL de imágenes (`/api/media/…`), que `/pos` redirige con streaming (200 + redirección en el cuerpo) y a `/repartidor` para el repartidor, que una comanda POS lista sigue en el KDS hasta entregarse, el 409 de la segunda devolución simultánea y los 17 asistentes del modo híbrido.

## Datos demo de verticales

`prisma/seeders/demo-verticals.ts` (lo llama el seed de demo) deja en «Híbrido Demo» las plantillas de autolavado, barbería y renta (servicios, bahías, sillas, flujo, política), una membresía mensual de 4 lavados con su cuota, la tarjeta de visitas, la garantía «lluvia el mismo día» y un cliente del portal (`hcli-001@hibrido.local`) con membresía vigente. Es idempotente. Verificación: `npm run verify:demo-verticales`.

## Pruebas e2e (Playwright)

`tests/e2e/verticals.spec.ts` recorre las pantallas de verticales (Fidelidad, Garantías, Plantillas, agenda y el portal) en la demo. Requiere los navegadores (`npx playwright install chromium`, ~150 MB) y el servidor demo en `TEST_BASE_URL` (por defecto `http://127.0.0.1:3107`). Estado verificado el 9 nov 2026: **21/21** (escritorio, móvil y tableta) más las 26 de `public-smoke` y `authenticated-surfaces`. Para que sea estable corre contra el build de producción (`node scripts/test-env.mjs build-prod` y luego `serve-prod`): el servidor de desarrollo se degrada con las compilaciones y los accesos se agotan. El formulario de acceso se rellena esperando la hidratación (si React reinicia los campos se vuelven a llenar); esperar solo el foco no era fiable. Con un diálogo abierto Next bloquea el scroll del body: no se mide desborde de página en ese momento.

## Cobro de membresías por la pasarela (pruebas)

`npm run verify:fidelidad` simula Stripe (sustituye `fetch` solo para `api.stripe.com/v1/checkout/sessions`): nunca se llama a una pasarela real. Probar con cuentas reales de Stripe/Mercado Pago sigue pendiente.
