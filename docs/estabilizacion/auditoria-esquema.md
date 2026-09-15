# Auditoría de tablas y seeds

## Resultado

No encontré una duplicación estructural entre `User`, `Membership`, `Employee` y
`Customer`. Cada modelo tiene una responsabilidad distinta. `Customer` ya permite el
mismo usuario en varias organizaciones mediante la clave única compuesta
`(organizationId, userId)`.

Las tablas operativas tienen consumidores en rutas, servicios, reportes o relaciones de
Prisma. No se eliminó ninguna tabla histórica por una búsqueda superficial: hacerlo podría
perder datos y exigir una migración irreversible.

## Tablas sin escritura operativa detectada

`DailySalesSummary`, `HourlySalesSnapshot`, `InventorySnapshot`, `ProductPair`,
`EmployeeCommission` y `CustomerSegment` tienen estructura válida, pero actualmente no
hay un proceso activo que las alimente. Son almacenamiento preparado para agregados BI,
comisiones y segmentación. Quedan clasificadas como **dormidas**, no como redundantes:

- no deben aparecer como CRUD para usuarios finales;
- no deben ser requisito para una instalación mínima;
- antes de eliminarse, debe confirmarse que no existen datos históricos y retirarse también
  sus relaciones, índices y migraciones.

`TransferItem` sí es necesaria como detalle de `Transfer`, aunque sus consultas se hagan a
través de la transferencia. Las tablas de opciones, variantes, combos, preparaciones,
reservaciones y devoluciones tienen consumidores activos.

## Seeds

El seed de producción permanece mínimo: SuperAdmin, permisos, roles, menús y unidades del
sistema. No crea una empresa ficticia ni datos comerciales.

El seed demo conserva sus cinco organizaciones y ahora incluye dos materias primas y una
receta vinculada a un producto personalizado del restaurante. La receta permite probar
consumo, merma, falta de insumo y reintegro al cancelar. La limpieza demo ya elimina las
tablas de detalle antes de recrear escenarios, por lo que la ejecución sigue siendo aislada
e idempotente.
