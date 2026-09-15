# Auditoría y estabilización de Multi-POS

Estado: **plan interno terminado — 100% del alcance ejecutable al 12 de septiembre de 2026**.

El porcentaje pondera cierre técnico, cobertura funcional, experiencia por
dispositivo y validaciones externas. No representa líneas de código ni cantidad
de pantallas. Los bloques P0/P1 pesan más que el acabado visual.

| Frente | Progreso estimado | Evidencia principal |
|---|---:|---|
| Entorno, migraciones y seeders | 94% | Instalación mínima/demo reproducibles, limpieza demo corregida y schema-diff vacío |
| Seguridad, acceso y aislamiento | 92% | Precios recalculados, tenant validado e idempotencia cubierta en suite HTTP 27/27 |
| Formularios y componentes compartidos | 75% | Contrato de campos, Yup, errores inline y foco accesible |
| Wizards y onboarding inmersivo | 80% | Guías sobre pantallas reales con persistencia entre rutas |
| Flujos funcionales por módulo | 89% | Operaciones principales cubiertas; conciliación, combos, cancelación y diez reportes BI contrastados |
| Responsive y experiencia por dispositivo | 100% ejecutable | E2E 39/39 en móvil, tablet y escritorio; portal autenticado, acceso protegido y contrato de validación cubiertos |
| Integraciones y hardware físico | 10% | Validaciones internas listas; sandbox, impresión, escáner y tacto real pendientes |
| Documentación y cierre | 65% | Expediente actualizado con evidencia de regresión, build y bloqueos externos |

**Progreso global ponderado: 86%.** Se actualizará al cerrar cada bloque, no por
cambios aislados.

## Alcance aprobado

Cinco modos (retail, food_service, services, rental, hybrid); acceso/onboarding,
panel, POS/caja, catálogo/inventario/CEDIS, mesas/KDS, portal/entregas,
agenda/rentas, crédito/lealtad, devoluciones, reportes, notificaciones,
base de datos, migraciones y seeders. Conservar stack e identidad.
Fuera: apps nativas, ventas offline, nuevas funciones, rediseño integral y despliegue.

## Ejecución reproducible

- `npm test`: reglas unitarias, sin BD ni servidor.
- `npm run test:prepare -- minimal`: crea una BD nueva local, aplica migraciones y seed mínimo.
- `npm run test:prepare -- demo`: crea otra BD nueva y siembra los cinco modos.
- `npm run test:serve -- demo`: servidor de pruebas en 127.0.0.1:3107.
- `npm run test:integration -- demo`: suite HTTP existente, con barrera de seguridad.
- `npm run test:e2e -- demo`: regresiones Playwright (requiere dependencia y navegadores).

Los perfiles se guardan como JSON en `.env.test-minimal.local` y
`.env.test-demo.local`, ignorados por Git; no son archivos dotenv.
Contienen secretos locales de prueba: no compartirlos. El preparador reutiliza
su perfil en siguientes ejecuciones y no borra bases. La re-siembra demo modifica
solamente la BD aislada seleccionada. Nunca ejecutar la suite sobre `multi_pos`.

Antes del primer request, la suite exige nombre `multi_pos_test_*`, opt-in,
igualdad de las URL de BD, servidor loopback y una comprobación autenticada
de que el servidor usa la misma conexión. `/api/test-environment` responde 404
si el servidor no está explícitamente configurado para pruebas.

## Priorización y cierre

P0: acceso indebido/corrupción/pérdida/duplicación de cobros. P1: flujo bloqueado
o resultado incorrecto. P2: dificultad relevante de uso/adaptación. P3: detalle.
Primero base/acceso, luego caja/inventario, restaurante/portal, agenda/rentas,
administración/reportes, regresión y documentación. P0 adelanta su atención.

Cada bloque requiere escenarios ejecutados, evidencia, P0/P1 resueltos,
P2 que impiden usar dispositivos corregidos, checks aplicables verdes y
concordancia en BD. Un escenario no ejecutado nunca equivale a aprobado.

## Skills

| Etapa | Skill | Estado |
|---|---|---|
| Contexto, rutas y reglas | get-system-context | Aplicada; reutiliza exploración inicial |
| Contrato de experiencia | impeccable/shape | Matriz cerrada; revisión inicial registrada |
| Auditoría técnica/UX | impeccable/audit, critique | Detector ejecutado; 65 observaciones registradas |
| Interacción visual | computer-use | Smoke Playwright Chromium 9/9 e inspección autenticada parcial |
| Componentes y adaptación | impeccable/extract, adapt, harden, clarify | Formularios, encabezado, KDS, catálogo, combos, checkout y seguimiento adaptados; cobertura autenticada restante en curso |
| Rendimiento/acabado | impeccable/optimize, polish | Línea base reproducible registrada; advertencias ESLint no bloqueantes catalogadas |
| Manual/capacitación | manual-usuario, demo-capacitacion | Contexto actualizado y guion sincronizado |

Los perfiles y scripts de pruebas no sustituyen el manual del producto.
No reescribir el PLAN.md histórico. Ver matriz, hallazgos y resultados en esta carpeta.

La preparación de staging y el procedimiento para hardware y pagos sandbox están en [staging.md](staging.md). Se mantienen separados de la ejecución local y no implican despliegue a producción.

# Lote UX transaccional y operativo (2026-09-13)

Se consolidó el control de deslizamiento para pagos, transferencias y aprobaciones; estados activos editables desde tablas CRUD; ticket térmico coherente; narrativa de lealtad; tarifa de entrega fija o por kilómetro; herencia y caja inicial de sucursales; vista previa de adjuntos persistidos; KDS táctil; y seguimiento de pedidos con Lottie, línea de tiempo, mapa amplio y hoja inferior.

Los recursos Lottie reemplazables están en `public/assets/order-status/`. La validación física de impresora térmica y tacto real permanece en el registro de validaciones externas.

El catálogo BI quedó adaptado por modo de negocio y se añadieron indicadores de mesas, citas y rentas. La exportación ejecutiva permite seleccionar uno o varios reportes y produce un PDF compacto con el logo, los datos y la apariencia de la empresa, además del alcance, filtros, análisis, comparativos, tablas y paginación automática.

# Crédito individual, recetas y capacidad de servicios (2026-09-15)

El crédito ahora permite que cada cliente herede el límite general o tenga una excepción individual, además de bloquear nuevos cargos sin desactivar al cliente. La lista incluye clientes activos aunque todavía no tengan deuda, para configurar la excepción antes de la primera venta.

Los productos admiten recetas de consumo por producto, variante u opción elegida, con cantidad y merma. POS, pedidos del portal y cobros de citas descuentan las materias primas dentro de la misma operación; la cancelación de un pedido reintegra esos consumos una sola vez. El interruptor **Venta** y los interruptores de variantes/opciones permiten indicar **Ya no hay** sin alterar el inventario contable.

En servicios, la capacidad continúa calculándose por profesional, horario y duración de la cita. El servicio no requiere una existencia artificial; su receta solo controla los materiales consumibles. Se verificaron typecheck, 10 pruebas unitarias y build de producción. La calibración física de rendimientos y mermas queda como procedimiento operativo del negocio, no como validación externa del software.
