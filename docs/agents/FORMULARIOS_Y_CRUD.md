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

## Campos

| Necesidad | Componente |
|---|---|
| Texto, número, correo, teléfono, contraseña | `InputGroupField` |
| Texto largo | `Textarea` dentro de un field con label/helper/error consistente |
| Opción fija | `FormCombobox`, sin crear/sincronizar |
| Catálogo relacionado | `OptionSelect` o `FormCombobox` con sync/create + `CrudCreateDialog` |
| Booleano | `SwitchField`; si es composición manual, `id` + `<label htmlFor>` |
| Fecha / hora | `DatePicker`, `TimePicker`, `DateTimePicker` |
| Archivo/imagen | `Attachment`, nunca URL escrita por el usuario |
| Ubicación | `GpsPicker`/`LocationSearch` |
| PIN/código corto | `InputOTP` |
| Cantidad incremental | `QuantityStepper` |

No uses `<select>` ni `<input type="date">`. Los campos de búsqueda usan `type="search"`. Labels y controles deben estar vinculados por `id`/`htmlFor`; helper explica para qué y cuándo usar el dato, no repite el label.

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
- `CrudForm` mapea los tipos `phone` → `tel` y `email` → `email` por sí mismo.

## Combobox y creación anidada

- `FormCombobox` siempre puede buscar; `clearable` depende de nulabilidad.
- Opciones provenientes de catálogo ofrecen sincronizar y, si el permiso lo permite, crear.
- `OptionSelect` abre `CrudCreateDialog`, recarga y selecciona el registro creado.
- Cada diálogo/form usa un `formId` único (`React.useId`) para que formularios portaled y anidados no colisionen.
- No conviertas enums fijos en tablas solo para alimentar un selector.

## Diálogos y overlays

Usa `DialogComponent` con `open`, `onOpenChange`, `title`, `description`, `icon`, `size`, `footer` y cuerpo. El componente ya ofrece:

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
