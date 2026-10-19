# Formularios, CRUD y componentes canónicos

## Árbol de decisión

1. ¿Es un catálogo CRUD estándar? Usa `src/lib/crud/modules.ts`, `CrudPage`, `CrudForm` y rutas `/api/crud/[module]`.
2. ¿Es un flujo multi-paso o transaccional? Usa un cliente de dominio y `WizardSteps`/`WizardShell` si hay etapas reales.
3. ¿Existe componente base? Reúsalo desde `@/components/base`.
4. Crea una abstracción nueva solo si habrá más de un consumidor o encapsula accesibilidad/regla difícil.

## Contrato de formulario

- React Hook Form + Yup; esquema compartido o generado por `buildYupSchema`.
- Validación inline con `aria-invalid`, texto de error e icono; `useFocusInvalid` enfoca el primer campo inválido.
- `defaultValues` completos para evitar inputs controlados/incontrolados.
- Normaliza teléfono, correo, claves, fechas y decimales antes de enviar; el servidor vuelve a validar.
- Botón principal muestra progreso, impide doble envío y permanece accesible en footer fijo del diálogo.
- Si una entidad compuesta tiene subformularios (variantes, tópicos, reglas), el guardado principal coordina los cambios o advierte claramente; no depende de botones secundarios invisibles.

## Campos obligatorios: asterisco rojo (obligatorio)

Todo campo que el formulario exija —por Yup, por una validación manual o porque el servidor lo rechaza— muestra un **asterisco rojo (*) en su etiqueta**.

- Se logra con el prop `required` de los componentes base (`InputGroupField`, `FormCombobox`, `TextareaField`, `DatePicker`, `TimePicker`, `DateTimePicker`, `Attachment`, `AddressField`, `GpsPicker`, `SwitchField`, `InfoField`), que pinta `<span className="text-destructive"> *</span>`. `OptionSelect` lo toma de `field.required`; en `CrudForm` se declara `required: true` en el campo de `crud-config.ts`.
- Si es condicional (p. ej. el precio solo al crear algo en venta), usa `required={condición}` y alinea la misma condición en el esquema.
- No escribas el `*` dentro del texto de la etiqueta ni lo pongas en campos opcionales; los opcionales pueden llevar «(opcional)» en el texto.
- Al agregar un campo con validación nueva, revisa que su etiqueta lleve `required`; al volver opcional un campo, quítalo. `tests/unit/required-marker.test.mjs` protege que los componentes base sigan pintando el asterisco.

## Palabras técnicas: glosario relajado (obligatorio)

Una palabra del sistema que un negocio nuevo no entendería (fondo inicial, corte, bajo mínimo, BI, CEDIS…) **se queda tal cual** en la pantalla y se explica en un modal, no se reemplaza.

- Agrega la entrada a `src/lib/glossary.ts` (qué es en una frase, explicación en tono relajado y un ejemplo cotidiano).
- Junto a la palabra pon `<GlossaryHint term="id" />` (solo icono) o `<GlossaryHint term="id">¿Qué es…?</GlossaryHint>`; en un encabezado de página usa `PageHeader glossary="id"` (en el CRUD, `glossary` de `crud-config.ts`).
- El glosario completo se abre desde el menú de usuario («¿Qué significa cada cosa?»).

## Campos

| Necesidad | Componente |
|---|---|
| Texto, número, correo, teléfono, contraseña | `InputGroupField` |
| Texto largo | `TextareaField` (etiqueta con icono, pista y error; nunca `Label` + `Textarea` sueltos) |
| Opción fija | `FormCombobox`, sin crear/sincronizar |
| Catálogo relacionado | `OptionSelect` o `FormCombobox` con sync/create + `CrudCreateDialog` |
| Booleano | `SwitchField`; si es composición manual, `id` + `<label htmlFor>` |
| Fecha / hora | `DatePicker`, `TimePicker`, `DateTimePicker` |
| Archivo/imagen | `Attachment`, nunca URL escrita por el usuario |
| Ubicación | `GpsPicker`/`LocationSearch` |
| PIN/código corto | `InputOTP` |
| Cantidad incremental | `QuantityStepper` |

No uses `<select>` ni `<input type="date">`. Los campos de búsqueda usan `type="search"`. Labels y controles deben estar vinculados por `id`/`htmlFor`; helper explica para qué y cuándo usar el dato, no repite el label.

## Cada campo lleva un icono acorde con su dato (obligatorio)

Dinero → moneda, correo → sobre, teléfono → teléfono, fecha → calendario, hora → reloj, dirección → pin, notas → texto largo, persona → usuario, cantidad → numeral, enlace → cadena.

- `InputGroupField`, `TextareaField` y `FormCombobox` lo infieren de la etiqueta, el `type` y el `inputMode` con `inferFieldIcon` (`src/lib/field-icons.ts`); `CrudForm` usa el `icon` declarado y, si falta, infiere por etiqueta y tipo.
- Si no acierta, pasa el icono explícito (`leftIcon`/`icon`). Los grupos que no son un input (`SegmentedFilter`, casillas) llevan su título con icono.
- Añade palabras nuevas a `RULES` de `field-icons.ts`; no lo resuelvas caso por caso.

## Buscadores, filtros y selectores ignoran mayúsculas y acentos (obligatorio)

«jose» encuentra «José» y «adoracion» «Adoración».

- Cliente: `matchesSearch` / `matchesAllWords` de `src/lib/search.ts`. Nunca `x.toLowerCase().includes(q)`.
- `FormCombobox` y `ui/command.tsx` ya filtran así; un `cmdk` propio pasa `filter={commandFilter}`.
- Servidor: la intercalación de MySQL es insensible; `contains` de Prisma sin `mode`.

## Teclado, fecha y hora (obligatorio en todo campo nuevo)

El teclado móvil debe corresponder al dato. `ui/input.tsx` e `InputGroupField` lo derivan con `src/lib/input-kind.ts`; si el campo no se infiere por nombre/etiqueta, declara `type`/`inputMode` explícitos.

| Dato | `type` / `inputMode` | Teclado |
|---|---|---|
| Texto libre (nombre, notas, dirección) | `text` | normal |
| Teléfono / celular | `tel` | numérico telefónico |
| Cantidades, enteros, montos | `inputMode="numeric"` (enteros) o `"decimal"` | numérico |
| Correo | `email` | con `@` |
| Sitio web / enlace | `url` | con `/` y `.com` |
| Buscador o filtro | `search` | `Esc` limpia el campo |

- Hora siempre con `TimePicker`; fecha con `DatePicker`; fecha+hora con `DateTimePicker`. Nunca `<input type="date|time|datetime-local">`. Convierte con `src/lib/date-input.ts` (`ymdToDate`, `dateToYmd`, `localToDate`, `dateToLocal`).
- Toda pantalla con filtros o búsqueda incluye `ClearFiltersButton` (`src/components/base/clear-filters-button.tsx`), que aparece solo si hay algún filtro distinto del predeterminado y los regresa a su valor por defecto. `DataTable` ya lo trae para su búsqueda interna; los filtros externos se conectan con `filtersActive` y `onClearFilters`.
- `CrudForm` mapea los tipos `phone` → `tel` y `email` → `email` por sí mismo.
- **`DateTimePicker` ocupa todo el ancho disponible** (fecha y hora se reparten la fila; en móvil se apilan). No lo envuelvas en contenedores de ancho fijo.
- Todo selector de fecha trae **«Hoy»** al pie del calendario y todo selector de hora **«Ahora»** (hora actual); `DateTimePicker` los hereda. La letra de `TimePicker` es una talla menor y sus selects son fluidos para no salirse del contenedor.
- `SegmentedFilter` con más opciones que ancho muestra **flechas** a los lados para desplazar con el puntero (en táctil se arrastra).
- Todo selector de fecha trae **«Hoy»** al pie del calendario y todo selector de hora **«Ahora»** (hora actual); `DateTimePicker` los hereda. La letra de `TimePicker` es una talla menor y sus selects son fluidos para no salirse del contenedor.
- `SegmentedFilter` con más opciones que ancho muestra **flechas** a los lados para desplazar con el puntero (en táctil se arrastra).

## Notificaciones y alertas

Avisos normales con el sistema de toasts (en proyectos derivados de la plantilla: **notistack**); SweetAlert2 solo para alertas de gran impacto (acciones destructivas o irreversibles, errores críticos). En proyectos nuevos usa siempre las versiones estables más recientes de las librerías.

## Combobox y creación anidada

- `FormCombobox` siempre puede buscar; `clearable` depende de nulabilidad.
- Opciones provenientes de catálogo ofrecen sincronizar y, si el permiso lo permite, crear.
- `OptionSelect` abre `CrudCreateDialog`, recarga y selecciona el registro creado.
- Cada diálogo/form usa un `formId` único (`React.useId`) para que formularios portaled y anidados no colisionen.
- No conviertas enums fijos en tablas solo para alimentar un selector.

## Diálogos y overlays

Usa `DialogComponent` con `open`, `onOpenChange`, `title`, `description`, `icon`, `size`, `footer` y cuerpo. Se compone de **tres partes**: encabezado fijo (icono en recuadro + nombre + leyenda; sin `icon` se infiere del título con `inferDialogIcon`), cuerpo con scroll que crece hasta casi 100 dvh y pie fijo con las acciones finales. El componente ya ofrece:

- header/footer fijos y body con scroll;
- altura limitada y safe area;
- bottom sheet en teléfono;
- prevención de cierre accidental por SweetAlert u overlays anidados;
- acción por Enter cuando es segura.

Usa `BottomSheet` del portal solo para interacción nativa con snap points/arrastre. Usa SweetAlert wrappers de `src/lib/swal.ts` para confirmaciones breves, no como formulario complejo.

## Tablas y acciones

- `DataTable` para orden, búsqueda, filtros, paginación y cards móviles.
- `EntityCell` combina imagen/identidad; `StatusPill` y wrappers compartidos traducen estado; `RowActions` concentra acciones.
- Fechas se presentan DD/MM/YYYY, hora de 12 horas cuando la UI lo establece, moneda con locale/currency de organización y números con `tabular-nums`.
- Una acción destructiva requiere nombre del objetivo, consecuencias y confirmación; preferir inactivar cuando existe historia.

## Accesibilidad y teclado

- Orden de tab lógico, foco visible y botones con nombre accesible.
- Listeners globales ignoran `input`, `textarea`, `select` y `contenteditable`.
- No dependas solo de color; combina icono, texto o forma.
- Mantén mínimo táctil de 44–48 px; la variante `desk:` compacta solo con puntero fino.
