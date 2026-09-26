# Plan de rediseño UI/UX — Multi-POS

**Dirección:** evolución, no reemplazo. Se conserva el ADN (temas por matiz, densidad, radios y escala configurables por empresa) y se elevan superficies, jerarquía, tamaños táctiles, motion y componentes.
**Alcance:** solo diseño (estilos, layout, interacción, animación). Sin cambios de lógica de negocio.
**Fuente de verdad visual:** `DESIGN.md`.

## Principios por contexto de uso

| Superficie | Dispositivo principal | Principio rector |
|---|---|---|
| POS, KDS, Agenda, Reservaciones | Tablet / monitor táctil (PC como respaldo) | Objetivos ≥48px, lectura a distancia de brazo, cero hover obligatorio, feedback al tocar en <100ms |
| Portal del cliente | Teléfono | Sensación de app nativa: tab bar, sheets desde abajo, gestos, transiciones entre pantallas, safe areas |
| Panel admin | PC con mouse | Densidad, tablas escaneables, navegación lateral |
| Landing, login, wizard | Todos | Primera impresión; landing en modo persuasión |

---

## Fase 1 — Fundación del sistema ✅ (hecha)

- **Tono de fondo** en Apariencia: Neutro / Sutil (default) / Marcado. Las superficies neutras (lienzo, tarjeta, popover, bordes, sidebar, `surface-sunken`) se generan con una rampa de luminosidad teñida hacia el matiz primario. Columna nueva `app_settings.surfaceTone` + migración `20260925180000_appearance_surface_tone`.
- Tema **POS** con lienzo más profundo y más contraste de texto.
- `theme-color` del navegador/PWA sincronizado con el lienzo real.
- Variante **`desk:`** (≥768px **y** puntero preciso): las tablets conservan controles de 44–48px; solo el escritorio con mouse usa tamaños compactos. Variante `touch:` para punteros gruesos.
- Tokens semánticos `success / warning / info` (+ foreground) en claro y oscuro.
- Elevación `shadow-e1/e2/e3` con desplazamiento y blur, teñida por `--shadow-color`.
- Motion: `--ease-out-expo`, `--ease-out-quart`, `animate-rise-in`, `animate-fade-in`, `animate-press-pop`; press en `:active` (0.97 / 0.95 táctil); se eliminó el “crecer al hover” de los botones.
- Superficies del navegador: selección de texto, caret, `touch-action: manipulation` (sin retardo de doble tap), sin rebote del lienzo, `text-wrap: balance/pretty`, utilidad `.tabular` para cifras, `.press` para tarjetas tocables.
- Dialog/Sheet/Popover/Menú: overlay más presente, entradas con curva exponencial, sombras del sistema.

## Fase 2 — Accesos y wizard ✅
- `auth-shell` a dos paneles (marca + formulario) en tablet horizontal/escritorio; columna nativa en teléfono, sin tarjeta flotante. Se quitaron los blobs y la retícula decorativa.
- Login, recuperar, restablecer y cambiar contraseña con el mismo lenguaje (título + descripción, campos de 48px táctiles).
- `WizardShell`: barra de progreso segmentada, "Paso N de M", transición en la dirección del avance, navegación fija abajo.
- Onboarding: reescrito sobre tokens (antes slate/esmeralda fijos), tarjetas de tipo de negocio como radio group accesible.
- Pendiente (requiere backend): login de cajero por PIN con teclado numérico.

## Fase 3 — POS táctil ✅
- Tarjeta de producto: imagen más grande, precio protagonista, existencia discreta (solo alerta si agotado/bajo), insignias Granel/Promo sobrias.
- Categorías tipo píldora de 44px; estados vacíos que explican qué hacer.
- Ticket: encabezado con contador, stepper segmentado, swipe "Quitar", total grande, botón Cobrar a dos columnas (texto/monto), iconos en lugar de emojis/glifos.
- Cobro: métodos de pago sin halos ni degradados (color por método + sólido al elegir), denominaciones y keypad de 64px en táctil.
- Mesas: mosaicos de 112px, número grande, texto mínimo 12px.
- Constructor de producto: selección con el color primario (antes verde fijo), superficies del tema.

## Fase 4 — KDS ✅
- Comanda con número y mesa legibles a distancia, cronómetro con estado en texto+ícono (A tiempo / Atención / Atrasada), barra de progreso de artículos, sin parpadeo de toda la tarjeta.
- Botones Cocinar/Listo de 48px, notas del mesero resaltadas, rejilla auto-ajustable.

## Fase 5 — Agenda y Reservaciones ✅
- Estados de cita/reservación con tokens semánticos; bloques con sombra e1 y feedback táctil; filas de 48px.
- Encabezados unificados (h-16, capa sidebar), navegación de día/mes con botones de 44px.

## Fase 6 — Portal nativo móvil ✅
- **Todos los diálogos en teléfono se abren como bottom sheet** (desde abajo, asa, safe area).
- Transiciones push/pop según profundidad de ruta; fundido entre pestañas.
- Tab bar con píldora activa animada; header "large title" que muestra divisor al desplazar; badge del carrito con rebote.
- Inicio: tarjeta de puntos tipo wallet, carruseles a sangre con snap, secciones con títulos nativos.
- Seguimiento de pedido: línea de tiempo vertical (antes stepper con scroll lateral).
- Notificaciones: banners arriba en teléfono (antes toast abajo sobre la barra), lista sin pings.
- Tarjetas de pago con proporción de tarjeta real.

## Fase 7 — Panel admin ✅
- Migración global de colores crudos → tokens (`success/warning/info/destructive` + variantes `-ink`), ~90 archivos; grises `slate/stone/gray` → neutros del tema.
- Tablas con encabezado en capa hundida, cifras tabulares; gráficas con el color primario y tooltips/ejes tematizados.
- Barra lateral con filas de 40px en táctil; textos de 9–11px subidos a 12px en todo el sistema.

## Fase 8 — Landing ✅
- Hero claro con el producto en uso (POS + portal construidos en HTML con los tokens), diferenciadores reales en filas alternadas, funciones en lista densa, planes, llamado final invertido.
- Se retiró la fila de cifras animadas ("100%", "15+") del hero: era el patrón de métricas de plantilla y no está respaldada por datos.

## Fase 9 — Auditoría ✅
- `tsc` sin errores; ESLint 0 errores (los avisos restantes ya existían).
- Detector de diseño: sin hallazgos bloqueantes; excepción registrada para los tamaños de la maqueta decorativa de la landing.
- Verificado en navegador: login (claro/oscuro, teléfono/escritorio), portal login, landing (escritorio y teléfono), reservar.
- No verificado visualmente (requiere iniciar sesión): POS, KDS, agenda, reservaciones, panel y portal autenticado.

---

## Pendiente del usuario

1. Aplicar la migración en cada entorno: `npx prisma migrate deploy` (en la BD local ya se agregó la columna `surfaceTone` a mano).
2. Revisar **Configuración → Apariencia → Tono de fondo**.
3. Componentes que quedaron sin uso tras la nueva landing: `landing/animated-stats.tsx`, `landing/parallax.tsx`, `landing/scroll-cue.tsx` (se pueden borrar).
