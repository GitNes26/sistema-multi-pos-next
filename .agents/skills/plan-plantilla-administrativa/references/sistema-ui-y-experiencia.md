# Sistema de interfaz, apariencia y experiencia

Cómo analizar y decidir el diseño de un producto nuevo y cómo se construyen sus páginas.
Se hereda el **método y las reglas**; la identidad visual se define con el contexto del
producto. Si la skill `impeccable` está disponible, úsala para el contexto y la dirección
(PRODUCT.md/DESIGN.md) y respeta sus reglas de calidad al editar UI.

## 1. Análisis de apariencia (antes de escribir UI)

Responde por escrito (en `PRODUCT.md` y `DESIGN.md` del proyecto nuevo) en este orden:

1. **Modo de la superficie.** Operar (tareas repetitivas: paneles, tablas, editores), Leer
   (documentación), Persuadir (landing) o Experiencia (galería). Un panel administrativo es
   *Operar*: gana escaneabilidad, consistencia y certeza sobre expresión.
2. **Usuarios y escena de uso.** Quién, en qué dispositivo (móvil, tablet táctil, escritorio
   con mouse), con qué luz, con cuánta prisa y qué errores cuestan caro. Decide objetivos
   táctiles, densidad y si hay modo oscuro/alto contraste.
3. **Personalidad y tono.** Tres adjetivos concretos del producto (p. ej. «solemne, cálido,
   claro» para una iglesia; «ágil, preciso, industrial» para rutas). Evita «moderno, limpio».
4. **Identidad.** Matiz primario y de acento, tipografías de encabezado/cuerpo/cifras,
   ilustración/iconografía (lucide por defecto), logotipo. Respeta marca existente.
5. **Referencias.** Qué se quiere parecer y qué no. No copies el aspecto de Multi-POS: reutiliza
   la estructura.
6. **Restricciones.** Accesibilidad (contraste AA, reduced motion), idioma, marca, hardware.

Salida: un resumen de dirección (1 párrafo + tokens + reglas de movimiento) que guía todas las
páginas. Después de construir, haz una sola ronda de revisión visual en móvil y escritorio,
corrige en lote y confirma con una segunda ronda; no entres en bucles de pulido.

### Cómo se expresa la identidad en el código

- **Tokens semánticos** en `src/app/globals.css` (`@theme inline`): `background`, `foreground`,
  `card`, `muted`, `primary`, `accent`, `border`, `ring`, `sidebar-*`, y significado
  `success`/`warning`/`info`/`destructive` (+ `*-ink` para texto). Nunca colores crudos en
  componentes.
- **Apariencia configurable por organización** (`AppSettings`, `src/lib/appearance.ts`,
  `appearance-apply.ts`): `primaryHue`, `accentHue`, `theme` (system/light/dark/otro),
  `fontFamily`, `fontScale`, `density`, `borderRadius`, `cardSize`, `sidebarStyle`,
  `surfaceTone`. `AppearanceSync` aplica variables CSS al cargar. En el starter se conservan
  tal cual; solo cambian los *valores por defecto* y las fuentes disponibles.
- **Variantes Tailwind propias**: `desk:` = ancho ≥ 48rem **y** puntero fino; `touch:` = puntero
  grueso. Nunca uses `md:` como sinónimo de «escritorio».
- **Elevación**: cards planas con `ring-1 ring-foreground/10`; sombras `--shadow-e1..e3` solo
  en hover con puntero fino u overlays.
- **Tipografía**: encabezado, cuerpo y monoespaciada para ids/importes (`tabular-nums` en cifras).
  Tamaños y radios derivan del tema (no px sueltos).

## 2. Movimiento, transiciones e interacción

Fuente única: `src/lib/animation-tokens.ts` (`SPRING_*`, `EASE_*`, `DURATION`, `STAGGER_*`,
`FADE_*`, `PAGE_TRANSITION`/`pageTransition(reduced)`, `LAYOUT_*`, `TRANSITION_*`) y utilidades
CSS (`.press`, `rise-in`, `fade-in`, easings `--ease-out-quart/expo`). No codifiques valores.

Reglas:

- Duraciones: 60 ms press, 150–250 ms cambios de estado, ~300 ms sheets/rutas. Easing
  out-quart/expo; sin rebotes en pantallas operativas (bounce solo en deleite menor).
- Anima **relaciones y estados**, no decoración: avance de un proceso, cambio de pestaña
  (`layoutId`), aparición/desaparición de elementos, contadores (`AnimatedNumber`), progreso.
- Transición de rutas (`RouteTransition`): `subtle` (fundido con leve ascenso) en el panel;
  `native` (push/pop según profundidad) para apps tipo móvil.
- Stagger solo en entradas cortas; no reanimar listas completas en cada refresco/polling.
- `prefers-reduced-motion`: el estado final y la comprensión no dependen de la animación;
  usa `useReducedMotion()` y reduce a fundido/instantáneo.
- Feedback táctil: `whileTap`/`.press`, `haptics.ts` solo para confirmaciones relevantes.
- Estados siempre diseñados: skeleton de carga con la forma del contenido, vacío con
  «qué falta + cómo resolverlo» (`EmptyState`), error recuperable con acción, éxito discreto
  (toast `sonner`/`swalToast`).

## 3. Experiencia inmersiva (cuando el flujo lo amerita)

Patrones probados que elevan un flujo de varios pasos o de alta frecuencia:

- **Wizard con progreso real**: pasos con icono, línea de avance animada, retroceso tocable,
  titular por paso («¿Cuándo y cuántos?»), transición direccional entre pasos
  (`AnimatePresence mode="wait"` con `x` según dirección), navegación fija abajo en móvil con
  safe area y resumen tipo boleto antes de confirmar. Ejemplo: asistente de reservación
  (`src/components/reservations/reservation-wizard.tsx`) y `WizardSteps`/`WizardShell`.
- **Selección por toque que avanza**: elegir una opción excluyente avanza solo tras ~180 ms.
- **Atajos de entrada**: chips rápidos para valores frecuentes, agrupación temporal (mañana,
  tarde, noche), teclado correcto al enfocar, valores por defecto inteligentes.
- **Mapa/pantalla completa** para tareas espaciales (`address-map-picker`), con sugerencias
  cercanas y resumen confirmable (nunca dejar el campo «sin respuesta» tras elegir).
- **Tiempo real** donde la información caduca: SSE por organización (`announce…` + hook
  `use-*-live`), con refresco silencioso (sin parpadeo) y red de seguridad por intervalo.
- **Detalle que guía**: línea de proceso con hora de cada paso, «¿qué sigue?» en lenguaje
  operativo y una sola acción primaria (ver `order-detail-dialog.tsx`).
- **Confirmaciones con consecuencia**: nombre del objetivo + efecto; preferir inactivar a borrar.

Úsalos con criterio: en un panel *Operar* prioriza velocidad; reserva lo inmersivo para flujos
guiados (asistentes, seguimiento, onboarding).

## 4. Anatomía de una página administrativa

Orden vertical (jerarquía):

1. **Contexto**: `PageHeader` (icono, título corto, descripción útil, breadcrumb opcional,
   acción primaria).
2. **Resumen**: solo métricas que cambian decisiones (cards con `AnimatedNumber`).
3. **Herramientas**: búsqueda (`type="search"`), `SegmentedFilter`, selectores, rango de
   fechas, vista y exportación, más **`ClearFiltersButton`** cuando hay filtros.
4. **Contenido principal**: `DataTable` (cards en móvil), tablero, catálogo o formulario.
5. **Feedback**: loading (skeleton), vacío, error, confirmación.

Reglas de construcción:

- `page.tsx` (servidor): `getServerSession` → permiso (`hasPermission` + `redirect`) → datos
  iniciales serializables → renderiza un **cliente de módulo** (`components/admin/<módulo>/…`).
- El cliente maneja interacción/mutaciones; la lógica de dominio vive en `lib/<dominio>/server.ts`.
- Filtros relevantes viajan en query string (deep links y notificaciones).
- Acciones esenciales visibles en táctil (no depender de hover); `RowActions` concentra las de fila.
- Compón con `EntityCell`, `StatusPill`, `InfoField`, `InfoTooltip`; fechas DD/MM/YYYY, moneda
  de la organización, cifras con `tabular-nums`.
- Nueva ruta: agrega permiso → ítem de menú (BD + fallback `nav.ts`) → feature/plan si aplica.

## 5. Formularios y componentes (contrato)

- RHF + Yup (`buildYupSchema` en CRUD) + `useFocusInvalid`; defaults completos; normalizar y
  validar también en servidor; botón principal con progreso y sin doble envío.
- Campos: `InputGroupField` (texto/número/correo/teléfono/contraseña), `Textarea` con field
  consistente, `FormCombobox`/`OptionSelect` (con crear/sincronizar vía `CrudCreateDialog`),
  `SwitchField`, `DatePicker`/`TimePicker`/`DateTimePicker`, `Attachment`, `InputOTP`,
  `QuantityStepper`. Prohibido `<select>` y `<input type="date|time|datetime-local">`.
- **Teclado según el dato** (`src/lib/input-kind.ts`): texto libre `text`; teléfono `tel`;
  cantidades `numeric`/`decimal`; correo `email`; sitio web `url`; buscador/filtro `search`
  (Esc limpia). Aplica a todos los campos existentes y futuros.
- Cada campo: icono, etiqueta vinculada (`id`/`htmlFor`), requerido, ayuda que explica para qué
  sirve (no repite la etiqueta), error inline con `aria-invalid`.
- `DialogComponent`: `open`, `onOpenChange`, `title`, `description`, `icon`, `size`, `footer`;
  header y footer fijos, cuerpo con scroll, bottom sheet en teléfono, safe areas ya resueltas.
  Cada formulario usa `formId` único (`useId`). Nada de modales ad hoc.
- Tablas: `DataTable` (orden, búsqueda, filtros, paginación, cards móviles, `onRefresh`,
  `filtersActive`/`onClearFilters`).
- Notificaciones: **notistack** para avisos normales (`src/lib/notify.ts` con variantes
  success/error/warning/info y `prefers-reduced-motion`); **SweetAlert2** solo para alertas de
  gran impacto (destructivas, irreversibles, errores críticos) y nunca como formulario complejo.
  La referencia usa sonner + `src/lib/swal.ts`; el starter usa notistack.

## 6. Responsive, safe areas y accesibilidad

- Mobile-first; destinos táctiles 44–48 px; `desk:` compacta solo con puntero fino.
- `h-dvh`/`min-h-dvh`; `viewport-fit=cover`; barras fijas usan `env(safe-area-inset-*)` y el
  contenido reserva `calc(altura + inset)`; no sumar el inset dos veces entre shell e hijo.
- Navegación adaptable: sidebar (full/compact/icon) en escritorio, `BottomTabBar` y
  `NavigationDrawer` en móvil, buscador global (`SearchDialog`).
- Foco visible, orden de tab lógico, nombre accesible en iconos-botón, listeners globales que
  ignoran inputs, color nunca como único canal (icono/texto/forma).
- Prueba 320/375 px, tablet táctil, escritorio con mouse, landscape, teclado virtual y zoom;
  claro/oscuro, densidad, textos largos y moneda/decimales.

## 7. Estructura de archivos de una funcionalidad

```text
src/lib/<dominio>/server.ts          # consultas Prisma + transacciones + validación tenant
src/lib/<dominio>/<regla>.ts         # reglas puras (sin Prisma) + tests/unit/<regla>.test.mjs
src/app/api/<dominio>/route.ts       # sesión → scope → org → permiso → validar → delegar
src/app/admin/<dominio>/page.tsx     # servidor: acceso + datos iniciales
src/components/admin/<dominio>/<dominio>-page.tsx   # cliente de módulo
src/components/admin/<dominio>/<dominio>-dialogs.tsx # formularios en DialogComponent
src/lib/crud/modules/<entidad>.ts    # solo si es catálogo CRUD estándar
```

Un componente nuevo entra a `components/base` solo si tendrá más de un consumidor o encapsula
accesibilidad/regla difícil; de lo contrario, queda junto a su módulo.
