# Instrucciones para agentes

Este repositorio contiene **Multi-POS**, un monolito Next.js multiempresa y multisucursal. Antes de modificar código, lee este archivo y después únicamente la guía pertinente de [`docs/agents/README.md`](docs/agents/README.md). La fuente extensa de verdad es [`CONTEXTO_SISTEMA.md`](CONTEXTO_SISTEMA.md); [`PLAN.md`](PLAN.md) es histórico y no prueba el estado actual.

## Orden de autoridad y recuperación

1. Instrucciones actuales del usuario y del entorno.
2. Este `AGENTS.md`.
3. Código, `prisma/schema.prisma` y migraciones.
4. `CONTEXTO_SISTEMA.md` y guías de `docs/agents/`.
5. `MEMORY.md` como índice rápido.
6. `PLAN.md` solo como antecedente.

Si documentación y código difieren, comprueba el comportamiento y actualiza la documentación en la misma tarea. No mantengas afirmaciones obsoletas.

## Invariantes que no deben romperse

- Toda lectura o mutación comercial se aísla por el `organizationId` efectivo de la sesión. Nunca aceptes el tenant del cuerpo como autoridad.
- Autorización = permiso del rol **intersectado** con lo incluido por el plan. Aplica el control tanto en interfaz como en servidor; ocultar un botón no autoriza una API.
- `superadmin` puede operar sin empresa solo en funciones globales; para datos de negocio necesita una organización activa válida.
- Precios, promociones, totales, crédito, puntos y disponibilidad se recalculan en servidor. El cliente solo propone datos.
- Las operaciones que combinan venta/pedido, pago, caja, inventario/receta, puntos o devoluciones deben ser transaccionales e idempotentes cuando exista reintento.
- Un pedido cobrado o concluido que representa salida de mercancía debe vincularse con una venta; esa venta concentra ticket, caja, movimientos y reportes sin duplicarlos.
- Productos inactivos no aparecen en flujos operativos; sus referencias históricas se conservan. Inventario canónico: estándar/personalizado por variante activa, granel por producto.
- Nunca expongas secretos, hashes, tokens o credenciales en documentación, logs o respuestas. Usa nombres de variables de entorno.

## Reglas de implementación

- Reutiliza primero componentes y servicios existentes. No crees una segunda abstracción si `src/components/base`, `src/components/ui`, CRUD genérico o `src/lib/*/server.ts` ya resuelven el patrón.
- Página nueva: autorización y carga inicial en servidor; interacción en un cliente de módulo; estados loading/empty/error; navegación y feature gates coherentes. Consulta [`docs/agents/PAGINAS_Y_ARQUITECTURA.md`](docs/agents/PAGINAS_Y_ARQUITECTURA.md).
- Formularios: React Hook Form + Yup + `useFocusInvalid`; `InputGroupField`, `FormCombobox`/`OptionSelect`, pickers y `Attachment`. No uses `<select>` ni fechas nativas; hora = `TimePicker`, fecha = `DatePicker`, y el teclado debe coincidir con el dato (`tel`, `numeric`/`decimal`, `email`, `url`, `search`). Consulta [`docs/agents/FORMULARIOS_Y_CRUD.md`](docs/agents/FORMULARIOS_Y_CRUD.md).
- Overlays: usa `DialogComponent`; solo el cuerpo desplaza y header/footer permanecen visibles. En portal usa el patrón móvil ya incorporado o `BottomSheet` cuando se necesiten snap points. No armes modales ad hoc.
- Diseño: tokens semánticos, superficies planas, `ring` antes que sombras, tipografía y densidad configurables, animación funcional y `prefers-reduced-motion`. Mantén objetivos táctiles; `desk:` significa puntero fino, no simplemente ancho. Consulta [`docs/agents/DISENO_E_INTERACCION.md`](docs/agents/DISENO_E_INTERACCION.md).
- Safe areas: toda superficie fija al borde usa `env(safe-area-inset-*)`; evita sumar padding dos veces entre shell e hijo. Usa `dvh` para viewport móvil.
- API: autentica, resuelve organización efectiva, comprueba scope/permiso/plan, valida entrada, ejecuta lógica en `src/lib`, responde sin filtrar datos sensibles.
- Prisma: agrega migración versionada y seeder idempotente. No uses `db push` en producción ni hagas resets/destrucción sin autorización explícita.
- Conserva cambios ajenos del worktree. Usa `apply_patch` para ediciones puntuales y no reviertas archivos que no sean parte de la tarea.

## Verificación y entrega

Ejecuta en proporción al riesgo:

```bash
npm run typecheck
npm run lint -- --quiet
npm test
```

Para cambios de flujos críticos agrega/actualiza pruebas y usa los entornos aislados descritos en [`docs/agents/DESARROLLO_Y_VERIFICACION.md`](docs/agents/DESARROLLO_Y_VERIFICACION.md). Hardware, correo, pagos sandbox e infraestructura requieren evidencia externa; no los declares verificados por inspección estática.

Solo crea commits o push cuando el usuario lo solicite. Si pide el flujo versionado, usa `npm run gcv -- "tipo: comentario en español"` y después `git push`; no incrementes la versión manualmente.

## Mantenimiento del contexto

Cuando cambie arquitectura, una regla de negocio, un componente canónico, un flujo o un pendiente real, actualiza en el mismo cambio:

- `CONTEXTO_SISTEMA.md` para la verdad extensa.
- La guía temática correspondiente en `docs/agents/`.
- `MEMORY.md` solo si el hecho es duradero y útil para reanudar trabajo.

No guardes en `MEMORY.md` credenciales, detalles efímeros, resultados de una sola ejecución ni listas largas de archivos.
