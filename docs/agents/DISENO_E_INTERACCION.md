# Diseño, interacción, animación y safe areas

## Dirección visual

**Adaptive Operator**: Multi-POS es una herramienta de trabajo. Prioriza velocidad, lectura y certeza. La marca se expresa mediante tema, tipografía y microinteracción; no mediante ruido, gradientes indiscriminados o cards anidadas.

- Fondo y superficies por tokens configurables de apariencia.
- Cards en reposo: `ring-1 ring-foreground/10`; sombra solo en hover con puntero fino u overlay.
- `primary` para selección/acción; `success`, `warning`, `info`, `destructive` para significado. No hardcodear emerald/amber/red.
- Encabezados Poppins, cuerpo Montserrat, identificadores/importes Space Mono cuando mejore lectura.
- Radio, densidad y escala tipográfica provienen del tema. Evita px que los ignoren.

## Jerarquía de una pantalla

1. Contexto: título corto, descripción útil y acción primaria.
2. Estado/resumen: solo métricas que cambien decisiones.
3. Herramientas: búsqueda, filtros segmentados, vista y exportación.
4. Contenido principal: tabla, tablero, catálogo o formulario.
5. Feedback: loading, vacío con siguiente acción, error recuperable y confirmación.

Una página operativa no debe exigir descubrir acciones por hover. En touch las acciones esenciales son visibles.

## Responsive y touch

- Mobile-first, pero POS/KDS/agenda también son touch-first en pantallas grandes.
- Usa `desk:` para reducir altura/padding solo en `(min-width: 48rem) and (pointer: fine)`.
- `touch:` ajusta coarse pointers. No uses `md:` como sustituto de “escritorio”.
- Targets: 44 px Apple / 48 px Material como referencia; separa controles destructivos.
- Tablas se vuelven cards mediante `DataTable`; no fuerces scroll horizontal salvo datos matriciales reales.
- Usa `h-dvh`/`min-h-dvh`; no dependas de `100vh` en móvil.

## Safe areas

- Root metadata debe conservar `viewport-fit=cover`.
- Header pegado arriba: `safe-area-top` o `pt-[env(safe-area-inset-top)]`.
- Navegación/footer fijo: `safe-area-bottom` o padding calculado.
- Contenido deja espacio por barra fija: `calc(altura + env(safe-area-inset-bottom))`.
- Altura de header con inset: `h-[calc(3.5rem+env(safe-area-inset-top))]` (un `h-14` con `pt` con `env(safe-area-inset-top)` encoge el contenido en teléfonos con notch).
- Horizontal (apaisado con notch): barras y raíz del POS suman `env(safe-area-inset-left/right)`.
- POS: la raíz usa `h-dvh`; el inset inferior lo aplica cada panel que toca el borde (ticket y catálogo), nunca el contenedor padre también.
- Diálogos y drawers ya compensan safe area; no la dupliques dentro de cada formulario.
- Para laterales fullscreen usa `safe-area-inset-left/right` si el contenido toca el borde en landscape.
- Prueba 320/375 px, tablet touch, desktop fine pointer y landscape; revisa teclado virtual y zoom.

## Motion

- 60 ms press-in; 150–250 ms cambios; ~300 ms sheets/rutas.
- Usa easing `--ease-out-quart` o `--ease-out-expo`; evita rebotes elásticos en operación.
- `whileTap`/`.press` confirma toque; no escales cards en hover.
- Anima relaciones: cálculo de báscula, avance de pedido, traslado origen→destino, progreso y cambio de estado.
- Stagger solo en entradas cortas; no reanimes listas completas con cada polling.
- Respeta `prefers-reduced-motion`: el estado final y la comprensión no dependen de animación.

## Superficies específicas

### POS

- Catálogo y ticket compiten por espacio: el ticket conserva totales/CTA y compacta líneas sin reducir targets.
- Escáner y teclado no roban foco a campos activos.
- Cambios de cantidad usan flash breve; pago muestra desglose, saldo/cambio y propina separada.
- Errores durante cobro permanecen dentro del flujo y no vacían el ticket.

### Portal

- Header y bottom nav persistentes, contenido con padding por safe area.
- Carrito siempre localizable; la persistencia hasta compra o vaciado explícito es el comportamiento objetivo y figura como solicitud abierta en `MEMORY.md` mientras no exista middleware `persist` comprobado.
- Diálogos móviles se comportan como bottom sheet; acciones principales permanecen alcanzables.
- Estado del negocio abierto/cerrado es visible globalmente y bloquea checkout con explicación.

### Panel

- Densidad mayor solo con puntero fino.
- Filtros y estado quedan vinculados a URL cuando admiten deep link.
- Usa `SegmentedFilter`, `StatusPill`, `EntityCell` y `RowActions` para consistencia.

## Contenido

- Español claro, verbos de acción y explicación de consecuencias.
- Diferencia “producto”, “servicio”, “variante”, “tópico”, “receta”, “sucursal” y “CEDIS”; no uses sinónimos si cambian la regla.
- Empty state: qué falta + cómo resolverlo. Error: qué ocurrió + siguiente acción. Tooltip: contexto, no instrucciones críticas ocultas.
