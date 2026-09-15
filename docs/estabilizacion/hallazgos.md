# Hallazgos y prioridades

## EST-021 — Crédito por cliente y consumo de insumos

- Tipo: mejora operativa confirmada.
- Severidad: P1 para control de crédito e insumos.
- Alcance: Crédito, Productos, POS, Portal y Agenda; retail, food_service, services e híbrido.
- Resultado: límite general heredable o límite individual; bloqueo reversible; recetas por producto/variante/opción; merma; descuento transaccional; reintegro idempotente al cancelar; disponibilidad inmediata de producto, variante u opción.
- Cierre: Prisma formateado y cliente generado; typecheck, pruebas unitarias 10/10 y build de producción correctos.

## EST-010 — P1/P2 — Wizards no acompañaban el flujo operativo real

- Tipo: defecto confirmado por revisión funcional. Actor: dueño, gerente y operadores; todos los modos y dispositivos.
- Evidencia: Producto, promoción, entrega y portal tenían asistentes que repetían captura o solo describían una ruta; POS podía quedar encerrado en un diálogo propio. El estado de guía tampoco cruzaba páginas fuera del layout administrativo.
- Esperado: una guía inmersiva que navegue las pantallas reales, resalte cada control, acompañe formularios existentes y cubra el flujo completo entre módulos.
- Corrección: `GUIDES` ahora define recorridos con rutas y selectores estables para productos, variantes, inventario, combos, mesas, KDS, agenda, reservaciones, entrega, crédito, promociones, pagos, empresa, portal y POS restaurante. `GuideProvider` se montó en el layout raíz, el avance persiste en la sesión y el coach centra/recorre el control resaltado. Se retiraron los asistentes duplicados sin uso.
- Verificación: typecheck y lint focalizado pasan; cobertura visual/táctil de Firefox/WebKit y hardware físico queda pendiente.
- Estado: corregido en código; pendiente inspección visual conjunta por dispositivo.

## EST-011 — P2 — Encabezado administrativo desbordaba en tablet estrecha

- Tipo: defecto confirmado por inspección visual autenticada. Actor: cualquier usuario de la aplicación; viewport observado 654×856 (entre móvil apaisado y tablet compacta).
- Evidencia: el nombre de organización, modo, usuario y controles del encabezado se mostraban simultáneamente desde `sm`; el documento alcanzaba 662 px frente a 654 px disponibles y aparecía una barra horizontal de página.
- Esperado: el encabezado conserva acciones accesibles sin desplazamiento horizontal y reduce información secundaria cuando el ancho es limitado.
- Corrección: `OrgSwitcher` y `UserMenu` mantienen sus nombres, distintivos y chevrón ocultos hasta `md` en la variante de encabezado; los iconos y etiquetas accesibles permanecen disponibles. El contenido pasa de `scrollWidth=662` a `scrollWidth=644` en el mismo viewport.
- Verificación: inspección autenticada en Chromium, viewport 654×856; overflow de documento ausente. Debe repetirse en 360×800, 390×844, 768×1024, 1024×768 y 1366×768 durante la regresión global.
- Estado: corregido y probado en viewport compacto.

## EST-012 — P2 — Cabeceras del KDS desbordaban en móvil

- Tipo: defecto confirmado por inspección visual autenticada. Actor: cocina y reparto; viewport 390×844.
- Evidencia: la cabecera de Entregas agrupaba GPS, contador, sonido y refrescar en una fila de 554 px; la página mostraba desplazamiento horizontal.
- Esperado: los controles operativos permanecen accesibles dentro del ancho del dispositivo y las secciones conservan jerarquía clara.
- Corrección: las cabeceras de Entregas y Cocina ahora apilan título y acciones en móvil, permiten envolver controles y recuperan la fila compacta desde `sm`. La alerta crítica del KDS usa `animate-pulse` para evitar rebote visual.
- Verificación: Chromium autenticado a 390×844; `scrollWidth` pasó de 554 a 390 px y la pantalla conserva Entregas, Cocina y sus acciones sin overflow.
- Estado: corregido y probado en móvil.

## EST-013 — P2 — Selector de propina comprimido en checkout móvil

- Tipo: defecto confirmado por inspección de interfaz. Actor: cliente del portal; viewport móvil.
- Evidencia: cinco opciones ocupaban una sola fila con ancho reducido; la etiqueta «Sin propina» podía partirse y dificultar la selección táctil.
- Esperado: cada alternativa debe ser legible y mantener un objetivo táctil cómodo.
- Corrección: el selector usa tres columnas en móvil y cinco desde `sm`; todas las opciones tienen `min-h-11`.
- Verificación: typecheck correcto y detector Impeccable ejecutado sobre checkout; la validación visual final del portal autenticado queda pendiente por el aislamiento de sesión del navegador.
- Estado: corregido en código; verificación visual pendiente.

## EST-014 — Entorno — Sesión compartida al probar portal y aplicación

- Tipo: riesgo de entorno de prueba, no defecto confirmado. Actor: operador y cliente; navegadores con cookies compartidas.
- Evidencia: al abrir `/portal/auth/login` desde una pestaña que conservaba la sesión del operador, el navegador volvió al contexto POS. La resolución de credenciales clasifica cuentas exclusivamente de cliente como `scope=portal`, `role=customer`; la suite HTTP ya prueba sus APIs con cookies separadas.
- Verificación: una regresión HTTP dedicada confirma que una sesión de aplicación recibe 307 al intentar `/portal`, una sesión `customer` abre `/portal` con 200 y la misma sesión recibe 307 al intentar `/pos`.
- Estado: resuelto como condición del navegador visual con cookies compartidas; no se confirmó fuga de permisos.

## EST-015 — P1 — Operaciones críticas de inventario no eran atómicas

- Tipo: defecto confirmado por código y prueba de concurrencia. Actor: gerente; todos los modos con inventario; dispositivo no aplica.
- Evidencia inicial: movimientos y traslados leían el saldo, calculaban un valor absoluto y lo escribían después. Dos solicitudes simultáneas podían perder una actualización o permitir que ambas partieran del mismo saldo. Las consultas y revisiones aceptaban una ubicación sin validar que fuera activa y perteneciera a la organización. Dos cierres simultáneos de la misma revisión podían aplicar dos veces sus diferencias.
- Esperado: cada salida descuenta solo cuando existe saldo suficiente en ese mismo instante; origen, destino, revisión y movimientos quedan en transacciones coherentes; una ubicación ajena o inactiva se rechaza; una revisión solo finaliza una vez.
- Corrección: validación central de ubicación, actualizaciones atómicas con incremento/decremento y condición de saldo, creación o actualización del destino dentro de la transacción y adjudicación condicional del cierre de revisión. Las alertas de mínimo se emiten después del commit. También se rechaza trasladar al mismo origen y las acciones desconocidas de revisión devuelven 400.
- Cierre: regresiones concurrentes confirman una salida 201 y otra 409 sin saldo perdido, y una finalización 200 y otra 409 con un solo ajuste; una ubicación de otra organización devuelve 404. Un traslado sucursal→CEDIS concuerda en ambos saldos y genera su entrada/salida. Suite HTTP completa **27/27**, typecheck y lint focalizado correctos.
- Estado: cerrado.

## EST-016 — P1 — Devoluciones podían exceder la venta o reponer stock dos veces

- Tipo: defecto confirmado por código y concurrencia. Actor: gerente; todos los modos con ventas.
- Evidencia inicial: se aceptaban listas vacías, cantidades cero/negativas y artículos repetidos. Dos creaciones podían calcular simultáneamente la misma cantidad disponible; dos finalizaciones podían ejecutar movimientos de inventario antes de que el estado cambiara. Para variantes, la búsqueda exigía simultáneamente `productId` y `variantId`, aunque filas válidas pueden identificarse solo por variante.
- Esperado: únicamente ventas completadas, cantidades positivas con precisión válida y suma no superior a lo vendido; aprobación/rechazo excluyentes; una sola finalización; reposición e historial en la misma transacción.
- Corrección: validación estricta, bloqueo de la venta durante el cálculo, filtro por organización, transiciones condicionales y transacción única para adjudicar la finalización, reponer inventario y registrar movimientos. La identidad de inventario usa variante cuando existe.
- Cierre: dos creaciones simultáneas de la cantidad total producen 200/400; dos finalizaciones producen 200/409; el saldo aumenta una vez y existe un único movimiento `return`. Suite HTTP **27/27**, typecheck y lint focalizado correctos.
- Estado: cerrado para reglas, estado e inventario.

## EST-017 — P1 — Reembolso financiero sin medio ni conciliación verificable

- Tipo: defecto confirmado por lectura; actor: gerente/cajero y cliente.
- Evidencia inicial: la resolución «Devolución de dinero» permitía efectivo o tarjeta en el texto, pero `SaleReturn` no conservaba el medio efectivamente reembolsado y el cierre de caja sumaba cobros en efectivo sin descontar devoluciones completadas.
- Esperado: registrar medio, importe y referencia; descontar efectivo de la sesión correspondiente o confirmar la reversa del proveedor; impedir completar dos veces y conciliar el cierre.
- Corrección: se agregó `SaleReturnPayment` con medio, importe y referencia; el cierre de devolución valida disponibilidad por medio, exige caja abierta para efectivo, impide duplicados mediante transición atómica y concilia caja/reportes/exportaciones. El formulario usa errores inline y foco accesible.
- Cierre: devolución concurrente 200/409, disponibilidad por medio, asignación de efectivo, cierre y reporte con descuento de reembolsos; suite HTTP **27/27**, typecheck y build correctos. La reversa externa de Stripe/Mercado Pago sigue pendiente de sandbox y queda explícitamente sin validar.
- Estado: cerrado para registro, idempotencia y conciliación interna; validación externa pendiente.

## EST-018 — P1 — Seed demo no limpiaba dependencias de devoluciones y reservas

- Tipo: defecto confirmado por ejecución. Actor: entorno de pruebas; instalación demo.
- Evidencia: la re-siembra fallaba con restricciones FK al borrar ventas antes de sus devoluciones y al conservar `tableRoom`/`reservationPolicy`.
- Corrección: se ordenó la limpieza de `SaleReturnPayment`, devoluciones y sus items antes de ventas, y se agregaron las dependencias de mesas y políticas.
- Cierre: `npm run test:prepare -- demo` completa migraciones y seed de los cinco modos en una base aislada.
- Estado: cerrado.

## EST-019 — P1 — Checkout de agenda y rentas podía duplicar ventas concurrentes

- Tipo: defecto confirmado por lectura. Actor: agente de atención/rentas; servicios y rental.
- Evidencia: el flujo comprobaba el estado y creaba la venta antes de marcar la cita o reservación como completada; dos solicitudes simultáneas podían crear dos ventas.
- Corrección: el registro se reclama con transición condicional `pending/confirmed → completed` antes de crear la venta; si la venta falla, el estado se revierte de forma condicionada. La asociación final de `saleId` también está acotada por organización y estado.
- Verificación: regresión HTTP concurrente para cita y reservación: cada par responde 200/409 y deja una sola venta ligada; typecheck correcto.
- Estado: cerrado para idempotencia de checkout; conflicto de disponibilidad y estados alternativos continúan en cobertura.

## EST-020 — P1 — Disponibilidad de agenda y rentas se evaluaba fuera de transacción

- Tipo: defecto confirmado por lectura; actor: atención/rentas; servicios y rental.
- Evidencia: la consulta de conflictos o unidades apartadas ocurría antes del `create`, permitiendo que dos solicitudes simultáneas observaran el mismo espacio disponible.
- Corrección: las comprobaciones y escrituras se ejecutan dentro de transacciones `Serializable`; los conflictos de serialización se convierten en 409 y no dejan registros parciales.
- Verificación: creación simultánea de cita y reservación produce 201/409, conserva un único registro y limpia sus fixtures; suite HTTP completa **27/27**, typecheck y ESLint focalizado correctos.
- Estado: cerrado.

## EST-021 — P1 — Estados terminales de agenda y rentas podían reabrirse

- Tipo: defecto confirmado por código. Actor: agente de atención/rentas.
- Evidencia: `completed` podía enviarse directamente a la cita; una cita con ausencia y una renta cancelada podían volver a `pending`. La reprogramación y actualización tampoco reclamaban el estado de forma atómica.
- Corrección: transiciones terminales cerradas, `completed` reservado al checkout, reprogramación dentro de transacción serializable y actualización condicional por estado/`updatedAt`.
- Cierre: regresión HTTP confirma rechazo de completado directo, conflicto de horario, ausencia y cancelación terminales, período inválido y rechazo de cobro en estados cerrados. Suite completa **27/27**, typecheck y ESLint focalizado correctos.
- Estado: cerrado.

## EST-022 — P1 — Reportes mezclaban venta bruta, pedidos y devoluciones

- Tipo: defecto confirmado por lectura y conciliación. Actor: gerente/owner.
- Evidencia: el reporte omnicanal sumaba todas las ventas y también los pedidos del portal, duplicando pedidos cobrados e incluyendo pendientes/cancelados. El reporte principal mostraba ventas brutas sin exponer devoluciones ni venta neta.
- Corrección: la venta completada pasa a ser la fuente contable única y se clasifica como POS o portal por su relación con `Order`. Ventas, PDF y Excel comparten devoluciones filtradas. Cohortes/lealtad usan ventas, márgenes usan `SaleItem`, segmentación calcula datos reales y rotación deja de ser constante. Preparación/entrega usan timestamps, pares se derivan de ventas y el pronóstico promedia venta diaria con muestra/confianza.
- Verificación: typecheck y ESLint focalizado sin errores; diez endpoints BI responden 200 y validan números finitos, identidad omnicanal, rangos de confianza y ausencia explícita de puntualidad. Detector Impeccable sin observaciones tras el ajuste de interfaz.
- Estado: cerrado para las métricas implementables con el modelo actual; puntualidad queda bloqueada hasta persistir una ETA comprometida.

## EST-005 — P2 — Formularios con validación y accesibilidad inconsistentes

- Tipo: defecto confirmado por código. Actor: administradores y operadores; escritorio, tablet y móvil.
- Evidencia inicial: etiquetas sin `id`/`htmlFor`, campos sin icono, errores mediante SweetAlert, foco limitado a `input`/`textarea` y mensajes duplicados en el CRUD genérico.
- Esperado: icono y etiqueta asociada en cada campo; Yup; borde y mensaje en todos los inválidos; foco al primero inválido al enviar y al primer control habilitado al abrir o limpiar; errores de guardado dentro del formulario.
- Corrección acumulada: contrato central en `InputGroupField`, `FormCombobox`, `SwitchField`, selectores temporales, dirección y GPS; `CrudForm`, productos, empresa, perfil, lealtad, pagos, supervisor, crédito, entrega, organizaciones, usuarios, roles, permisos, menús, publicaciones, política de reservaciones y wizard de reservación migrados. Variantes e imágenes masivas ya muestran fallos inline. Los wizards validan antes de avanzar.
- Verificación: typecheck, lint focalizado, unitarias y build correctos. El detector Impeccable quedó sin observaciones en las superficies de este lote, incluido el wizard de reservaciones.
- Pendiente: migrar los formularios especializados restantes y ejecutar recorridos visuales/táctiles autenticados. Estado: en corrección por lotes.

## EST-001 — P0 — Webhooks de pago sin validación obligatoria

- Tipo: defecto confirmado por código. Actor: externo sin sesión; portal de cualquier modo; dispositivo no aplica.
- Evidencia inicial: `processStripeWebhook` solo verificaba firma si había secreto; MercadoPago omitía validar el header incluso con secreto.
- Reproducción: enviar evento paid de Stripe para un pedido conocido de una organización sin secreto configurado.
- Esperado: rechazo sin cambiar pedido; anterior: podía pasar a confirmed.
- Corrección: proveedor/firma obligatorios, tolerancia temporal Stripe y comparación segura; validación MercadoPago del ID de query, cuerpo y request ID.
- Cierre: pruebas unitarias de firma y regresión HTTP; sandbox externo pendiente. Estado: corregido, validación externa pendiente.

## EST-002 — P1 — Confirmación no registra paidAt ni es atómica ante repetición

- Tipo: defecto confirmado por código. Actor: webhook; todos los modos.
- Evidencia: `markOrderPaid` leía estado y luego actualizaba sin condición; no escribía paidAt.
- Esperado: un cambio e historial, fecha de pago, organización e importe coincidentes.
- Corrección: filtro tenant, importe/moneda, actualización condicional y transacción con historial; estado pagado explícito.
- Cierre: pruebas unitarias y typecheck pasan; webhook sandbox y carrera real quedan pendientes. Estado: corregido en código.

## EST-003 — P0 — Confianza en datos de venta/pedido del cliente

- Tipo: defecto confirmado por lectura; alcance exacto pendiente de reproducción aislada.
- Evidencia: `src/lib/pos/server.ts:createSale` persiste subtotal/total/precios/trackInventory del payload. `src/lib/portal/server.ts` calcula adjustedTotal desde input.total.
- Actor: usuario autorizado capaz de modificar request; modos con ventas; cualquier dispositivo.
- Esperado: precios, descuentos, impuestos, pertenencia y puntos derivados/validados en servidor.
- Corrección: POS y portal vuelven a resolver producto, variante, precio, impuesto, cantidad, importe de línea y subtotal desde la organización; los valores manipulados se rechazan antes de persistir.
- Cierre: regresión HTTP 19 escenarios con caso dedicado de manipulación, typecheck y build correctos. Estado: cerrado.

## EST-023 — P1 — Checkout del portal confiaba en importes y referencias del cliente

- Tipo: defecto confirmado por reproducción HTTP. Actor: cliente del portal; todos los modos.
- Evidencia: el request podía alterar nombres, precios, descuentos, propina, ubicación y referencias de combo; el combo se enviaba con identificadores ficticios.
- Corrección: el servidor resuelve catálogo, variantes, impuestos, opciones, combos, sucursal, política de entrega y total; se agregó idempotencia por organización/cliente/clave y expansión de combos a sus productos reales.
- Cierre: regresión concurrente con payload manipulado, combo válido y combo incompleto; suite HTTP **27/27**, typecheck, unitarias y build correctos. Estado: cerrado.

## EST-024 — P1 — Cancelación concurrente podía duplicar restitución de puntos

- Tipo: defecto confirmado por reproducción HTTP. Actor: cliente del portal; pedidos pendientes o confirmados sin pago.
- Evidencia: dos cancelaciones simultáneas podían competir después de leer el mismo estado y repetir el ajuste de lealtad.
- Corrección: actualización condicional dentro de transacción y restitución vinculada a una única transición a `cancelled`.
- Cierre: la regresión concurrente confirma una sola cancelación efectiva, un solo ajuste y restitución exacta. Estado: cerrado.

## EST-004 — P1 — Suite HTTP podía modificar la base o servidor equivocados

- Tipo: defecto confirmado. Actor: desarrollador; dispositivo no aplica.
- Evidencia anterior: localhost:3000 por defecto y Prisma heredaba DATABASE_URL, sin verificación cruzada.
- Corrección: opt-in y URL explícitos, base con prefijo test, token y fingerprint de servidor antes de crear Prisma/iniciar pruebas.
- Cierre: rechazar ausencia, base existente, URL diferente, servidor remoto y fingerprint incorrecto. Pruebas unitarias añadidas.

## EST-005 — P2 — Documento técnico de otro dominio

- Tipo: defecto confirmado. `docs/system-overview.md` describía supervisión industrial.
- Esperado: arquitectura y límites Multi-POS consistentes con código.
- Corrección y validación: sustituir por contexto real y referencias al expediente.

## EST-006 — Entorno — Memoria insuficiente

- Node y posteriormente PowerShell fallaron con OutOfMemory durante preparación demo e instalación Playwright; se recuperó ejecutando procesos secuencialmente y con límites.
- No es un defecto demostrado de Multi-POS. Reintentar secuencialmente; no cerrar aplicaciones del usuario.
- Estado: mitigado; no bloquea la suite actual.

## EST-007 — P1 — Deriva entre esquema Prisma y migraciones

- Tipo: defecto confirmado. La base limpia no podía ejecutar el seed demo porque faltaban `Product.isNew`, enum `custom` y claves de tablas de configuración.
- Corrección: migración `20260911000000_schema_consistency`; instalación mínima y demo pasan y `schema-diff` devuelve migración vacía.
- Estado: cerrado.

## EST-008 — P2 — Escala tipográfica inconsistente en superficies compartidas

- Tipo: mejora de experiencia confirmada por detector Impeccable. 65 observaciones (64 advisory, 1 warning) en POS, portal y navegación.
- Estado: registrado para el siguiente lote visual; no bloquea recorridos.

## EST-009 — Entorno — Navegadores Playwright ausentes

- Tipo: bloqueo de entorno, resuelto instalando Chromium.
- Cierre: smoke responsive 9/9 correcto en móvil, tablet y escritorio emulados.
- Firefox/WebKit y hardware físico permanecen pendientes.

## Mejoras posteriores

## EST-010 — P1/P2 — Navegación, apariencia y altas inconsistentes por empresa

- Tipo: defectos confirmados en navegación, persistencia visual y formularios compartidos.
- Corrección: Agenda y Reservaciones se filtran y protegen por el tipo de la empresa activa; apariencia usa esa empresa como fuente persistente y amplía la paleta; `active`/`isActive` inicia habilitado; clientes y empleados reciben folios visibles calculados por el sistema.
- Integridad: productos rechazan categorías ajenas. La migración separa referencias históricas cruzadas y el POS conserva esos productos en **Sin categoría**.
- Cierre: typecheck y unitarias pasan; migración aplicada desde cero; integración añadida para defaults, persistencia de apariencia y rechazo de categoría cruzada.

## EST-011 — P2 — Importación de inventario y descripción de productos incompletas

- Tipo: defectos confirmados de orientación y consulta de catálogo.
- Corrección: Inventario ofrece una plantilla XLSX con instrucciones, columnas protegidas, validación de cantidades y catálogo vigente. El POS incorpora un botón accesible de información con descripción y datos operativos. El Portal muestra la descripción en el catálogo y en la ficha seleccionada.
- Cierre: typecheck y lint sin errores; prueba HTTP valida la estructura real del libro generado.

## Cierre del alcance ejecutable

- El alcance interno de auditoría y estabilización queda cerrado: regresiones HTTP, unitarias y E2E, typecheck, build, lint sin errores, detector visual y línea base de rendimiento están registrados.
- Los puntos de experiencia por dispositivo, consolidación compartida y estabilización por flujo se cerraron con interacción diferenciada por tipo de puntero, navegación móvil adaptable, diálogos en español y regresión E2E **39/39**.
- Quedan fuera del cierre técnico las validaciones externas de hardware, navegadores no instalados y proveedores de pago; se conservan como pendientes futuros y no se simulan como aprobadas.

Apps nativas: evaluar hardware/tiendas/plataformas después de estabilización web.
Offline: requiere contrato de sincronización, idempotencia y resolución de conflictos; no implementar aquí.
Rediseño integral: definir identidad y alcance propio después de medir problemas de uso actuales.

