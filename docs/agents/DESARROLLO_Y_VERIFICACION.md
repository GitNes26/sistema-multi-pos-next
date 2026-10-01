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
