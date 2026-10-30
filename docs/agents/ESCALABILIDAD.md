# Escalabilidad: índices, caché, segundo plano y pruebas de carga

Guía para quien toque rendimiento. Resume lo que se midió, lo que se cambió y lo que **todavía no escala**.
Las cifras salen de `scripts/loadtest/` (ver «Cómo repetir las pruebas»); son de un solo equipo de
escritorio (8 hilos compartidos entre MySQL, el servidor y el generador de tráfico), así que sirven para
comparar antes/después y encontrar cuellos de botella, no para prometer capacidad de producción.

## 1. Qué se midió

Base de pruebas aislada con 300 empresas: 121 mil ventas, 362 mil movimientos de inventario, 30 mil
clientes y una «empresa grande» (51 mil ventas, 154 mil movimientos). Tráfico simulado con cajeros
(catálogo + ventas reales), administradores (panel, listados, reportes), clientes del portal y visitas
públicas, repartidos con tamaños desiguales entre empresas.

| Situación (1 instancia) | Rendimiento |
| --- | --- |
| Antes de los arreglos | tope ≈ 40 peticiones/s; con 1 000 usuarios 19 % de errores; 1 758 fallos «connection pool» |
| Después de los arreglos | tope ≈ 90 peticiones/s; con 300 usuarios p50 ≈ 50 ms y p95 ≈ 150 ms; 0 errores |
| 3 instancias (reparto por turnos) | 300 usuarios p95 140 ms; 600 usuarios p95 1.3 s con 96 peticiones/s; el tope pasó a ser MySQL del mismo equipo |

Un usuario «activo» espera 3–10 s entre acciones, por lo que 100 peticiones/s ≈ 600 usuarios simultáneos.

## 2. Índices (migración `20261030120000_scalability_indexes`)

MySQL ya indexa cada llave foránea, pero no las consultas «de esta empresa, ordenadas por fecha, de esta
sucursal, con este estado». Se agregaron índices compuestos en `sales`, `orders`, `inventory_movements`,
`inventory`, `products`, `product_variants`, `customers`, `cash_sessions`, `loyalty_transactions`,
`sale_returns` y `categories`, más `phone` en `users`, `employees` y `customers`.

Comparación honesta (solo índice de llave foránea vs. índices nuevos, mediana de 15 corridas,
`scripts/loadtest/baseline.mts`):

| Consulta | Empresa normal (400 ventas) | Empresa grande (51 mil ventas / 154 mil movimientos) |
| --- | --- | --- |
| Ventas recientes (20) | 4.7 → 1.5 ms | **431 → 1.6 ms (269×)** |
| Movimientos recientes (50) | 11 → 2 ms | **1 282 → 2.1 ms (610×)** |
| Movimientos de una sucursal en el mes | 11 → 1.2 ms | **1 193 → 45 ms (26×)** |
| Ventas del mes (agregado) | 4 → 2.5 ms | 428 → 193 ms (2×) |

Lectura: con empresas chicas casi no se nota; el índice importa cuando **una** empresa acumula años de
historia. El agregado «ventas del mes» sigue sumando decenas de miles de filas: ver «Pendientes».

Reglas: toda consulta de negocio filtra por `organizationId`; si además ordena o filtra por fecha, estado o
sucursal, define el índice compuesto con ese orden (igualdad primero, rango/orden al final). Una migración
nueva debe verificarse con `prisma migrate diff` sin diferencias nuevas.

**Inicio de sesión por teléfono:** ahora busca primero con índice (`10 dígitos`, `52…`, `+52…`) y solo si no
encuentra recorre con `contains`. Teléfonos guardados con espacios siguen usando el respaldo lento.

## 3. Consultas que no escalaban (corregidas)

Encontradas con `performance_schema` durante la carga:

* **`include: { _count: … }` agrupa la tabla completa.** Prisma une `(SELECT saleId, COUNT(*) FROM sale_items
  GROUP BY saleId)` sin filtrar: la lista de ventas tardaba 1.2 s, la de clientes 3.4 s y la de pedidos 0.35 s.
  Ahora se cuenta solo para los ids de la página con `src/lib/db/counts.ts`. **No uses `_count` de relaciones
  grandes en listas.**
* **Pool de conexiones de 9** (valor por defecto de Prisma en 4 núcleos): las peticiones esperaban en fila hasta
  fallar. `src/lib/db/client.ts` fija `connection_limit=25` y `pool_timeout=20` (`DB_POOL_SIZE`,
  `DB_POOL_TIMEOUT`). Dimensiona así: instancias × `DB_POOL_SIZE` < `max_connections` de MySQL (151 por defecto).
* **Folio por sucursal al inicio de la venta:** `UPDATE locations SET saleSeq = saleSeq + 1` bloqueaba la fila de
  la sucursal durante toda la transacción (y las notificaciones que la referencian). Ahora se reserva al final:
  bloqueo medio 115 ms → 42 ms bajo carga extrema en una misma sucursal.
* Un `console.log` por petición en el inicio del portal (20 mil líneas por prueba) y la lista de pedidos del
  portal sin límite (ahora 100).

## 4. Caché (`src/lib/cache/index.ts`)

`cached(clave, { ttlMs, staleMs, tags }, loader)`:

* **Una sola carga por clave** (single-flight): 500 cajas pidiendo lo mismo generan una consulta.
* **Stale-while-revalidate:** pasado el TTL se sirve el dato anterior mientras uno solo lo refresca.
* **Invalidación por etiqueta** (`orgTag(id)`, `invalidateOrg`): una carga iniciada antes de invalidar no se
  guarda. `guardCrud` (acciones de escritura) y `settingsManageGuard` descartan el caché de la empresa al
  entrar y al terminar la respuesta (`after`); `createSale` lo descarta por los puntos del cliente.
* Un error del loader nunca se guarda; LRU de 3 000 entradas (`CACHE_MAX_ENTRIES`); `CACHE_DISABLED=1` lo apaga.

Qué se guarda (TTL): catálogo compartido del POS por empresa (30 s; existencias, caja y usuario se leen siempre),
catálogo del portal (30 s), nombre/modo y planes denegados de la empresa para la sesión (30 s), contadores del
panel (15 s), identidad para impresión (60 s), árbol de menús por rol y permisos (60 s), portada pública (60 s).

Medido: aciertos 55–71 %. El efecto en la base de datos fue modesto en esta prueba (15.3 → 14.0 consultas por
petición) porque 1 000 usuarios se repartían entre 300 empresas (≈3 por empresa) y la mezcla incluye muchas
escrituras. El beneficio crece con las cajas por empresa: cada una refresca el catálogo cada 20 s.

**Límite:** el caché vive en la memoria de cada instancia. La invalidación solo llega a la instancia que recibió
el cambio; las demás se actualizan al vencer el TTL (por eso son cortos). Para invalidación compartida,
implementar `CacheDriver` con Redis y llamar `setCacheDriver`.

## 5. Segundo plano

* **Cola de trabajos** (`src/lib/jobs/`, tabla `background_jobs`, migración `20261030130000_background_jobs`):
  `enqueueJob`, reclamo atómico (`UPDATE … WHERE status='queued'`, seguro con varias instancias), reintentos con
  espera creciente, recuperación de trabajos interrumpidos (15 min) y avance 0–100. Arranca con
  `src/instrumentation.ts` (sondeo cada 5 s); `GET /api/cron/jobs` (con `CRON_SECRET`) sirve de respaldo desde un
  cron externo. Estado en `GET /api/jobs/[id]` (solo quien lo inició).
* **Importación de Excel grande** (> 80 KB ≈ cientos de filas, `IMPORT_ASYNC_BYTES`): el servidor guarda el
  archivo, responde 202 con el id y la pantalla muestra «Importando… N %». Medido: 400 productos respondieron en
  12 ms en lugar de tener al usuario ≈ 38 s esperando.
* **Avisos de venta** (SSE, notificaciones, crédito) se envían con `runAfterResponse` (`after`): el cajero no
  espera por ellos.
* `GET /api/health`: `{ ok }` para el balanceador; con `Authorization: Bearer <CRON_SECRET>` añade latencia de BD,
  caché, cola y memoria.

## 6. Pendientes y riesgos (lo que NO escala todavía)

1. **SSE y avisos en memoria** (`kds/live`, `notifications/live`, `portal/live`, `tables/live`): con más de una
   instancia, un evento solo llega a los clientes conectados a la instancia que lo generó. Antes de poner un
   balanceador con varias réplicas hace falta pub/sub compartido (Redis) o sticky sessions + broadcast por BD.
   Cada instancia Node llegó a ≈ 90 peticiones/s con un núcleo al 100 %, así que escalar horizontalmente es el
   camino; ésta es la condición.
2. **Reportes agregados** (`/api/reports`, resumen de ventas): suman decenas de miles de filas por consulta
   (193 ms en la empresa grande). Usar `DailySalesSummary`/instantáneas o caché por rango cerrado, y una réplica
   de lectura para reportes.
3. **Ventas más vendidas** (`topSellingProductIds`): 2 s en la empresa grande, ya con caché de 5 min.
4. **Notificaciones por venta**: una fila por venta; definir retención/purga.
5. **Polling del cliente**: más de 20 `setInterval` (POS cada 20 s, tableros, repartidor 12 s…). Pausar con la
   pestaña oculta y usar SSE donde ya exista.
6. **MySQL**: ajustar `innodb_buffer_pool_size` (≈ 60–70 % de la RAM del servidor de BD), `max_connections` y
   activar el log de consultas lentas; con ≈ 100 peticiones/s el motor consumió ≈ 6 núcleos del equipo de prueba.
7. Importar productos tarda ≈ 100 ms por fila (cada alta recorre `productsModule.create`); es aceptable en
   segundo plano, pero un alta por lotes lo reduciría un orden de magnitud.

## 7. Cómo repetir las pruebas

Todo usa la base aislada `multi_pos_test_*` (nunca la real: `assertTestEnvironment`).

```bash
node scripts/test-env.mjs prepare minimal      # una vez: crea y migra la base de pruebas
npm run loadtest:seed                          # LOAD_ORGS=300 LOAD_SALES=400 (≈ 20 min)
npm run loadtest:whale                         # una empresa con años de historia (×128)
npm run loadtest:baseline                      # índices: antes vs. después
npm run loadtest:build && npm run loadtest:serve   # compilación de producción en el puerto de TEST_BASE_URL
npm run loadtest:run -- --stages 150:60,300:60,600:60 --warmup 25 --label prueba
# varias instancias: LOADTEST_PORT=3109 npm run loadtest:serve  y  --ports 3108,3109,3110
```

`run.mts` firma las sesiones con `NEXTAUTH_SECRET` de la base de pruebas, imprime p50/p95/p99 por etapa y por
tipo de petición, errores, consultas y filas leídas por petición, y escribe `.loadtest/report-<etiqueta>.json`.
Criterio de aprobación: errores < 1 % y p95 < 800 ms (`LOAD_P95_MS`). Para encontrar consultas lentas:
`performance_schema.prepared_statements_instances` (Prisma usa sentencias preparadas).
