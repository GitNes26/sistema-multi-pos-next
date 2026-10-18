# Análisis: crear catálogo a partir de una foto o archivo del menú

Fecha: 17 de octubre de 2026 · Estado: análisis de factibilidad y diseño propuesto. No hay código de esta función.

## Idea

El dueño toma una foto o sube un archivo (imagen, PDF, Excel/CSV) de su menú, lista de precios o catálogo. El sistema lo analiza y propone categorías, productos de cualquier tipo, promociones, combos y avisos. **Antes de crear nada** muestra un resumen de lo detectado y de lo que ya existe, y el dueño decide, pieza por pieza o en bloque, qué cargar.

## Veredicto

**Es factible y encaja con la arquitectura actual**, con un trabajo de tamaño medio-grande (unas 3–5 semanas para una primera versión sólida). Lo difícil no es leer la imagen, sino **mapear lo leído a los tipos reales de Multi-POS y evitar duplicados**. Conviene lanzarlo por fases.

## Lo que ya existe y se reutiliza

| Pieza | Dónde está | Uso en esta función |
|---|---|---|
| Importación con vista previa y validación por fila | `src/lib/excel/spreadsheet.ts` (`previewWorkbook`, `validateImportRecord`, `importWorkbook`), `src/lib/excel/import-schema.ts` | Modelo de «previsualizar → confirmar» y reglas de validación por módulo. |
| Alta de productos con todos los tipos | `src/lib/crud/modules/products.ts`; modelos `Product`, `ProductOption` (variante/tópico), `ProductOptionValue`, `ProductVariant`, `ProductRecipeItem` | Destino de la carga (estándar, variantes, granel, personalizado con tópicos y reglas, servicio, receta). |
| Categorías, combos, promociones, publicaciones | Modelos `Category`, `ProductCombo`/`ComboItem`, `Promotion`, `Publication` | Destino de las demás entidades detectadas. |
| Carga de archivos y conversión de imágenes | `src/app/api/uploads`, `sharp` | Recibir la foto, normalizarla y reducirla. |
| Búsqueda tolerante a mayúsculas y acentos | `src/lib/search.ts` (`matchesSearch`) | Base de la detección de duplicados. |
| Plantillas, permisos y planes | `lib/auth/permissions`, `lib/billing/plan-permissions.ts` | Controlar quién puede importar y en qué plan. |

No hay hoy ningún SDK de modelos de lenguaje en `package.json`: habría que añadir uno (por ejemplo el SDK de Anthropic) y un servicio servidor para llamarlo.

## Flujo de usuario propuesto

1. **Subir.** Botón «Crear desde mi menú» en Productos (junto a Importar). Acepta foto de cámara o galería, varias imágenes, PDF o Excel/CSV. Mensaje claro sobre privacidad y tamaño máximo.
2. **Analizando.** Barra de progreso con pasos («Leyendo imagen», «Reconociendo productos», «Comparando con tu catálogo»).
3. **Resumen antes de crear.** Una sola pantalla con conteos y secciones plegables:
   - Categorías: nuevas / ya existen.
   - Productos: nuevos / **posibles duplicados** / dudosos (baja confianza).
   - Combos, promociones y avisos detectados.
   - Advertencias: precio ilegible, unidad dudosa, texto cortado.
4. **Decidir.** Tabla editable por fila con casilla, y acciones masivas:
   - «Cargar todo», «Cargar todo excepto duplicados», «Solo nuevos», «Omitir dudosos», «Seleccionar/limpiar por sección».
   - Cada fila: editar nombre, categoría, tipo, precio, unidad, variantes, tópicos, receta; ver el recorte de la imagen original de donde salió.
5. **Duplicados.** Cada posible duplicado muestra «Ya existe: [producto actual]» con comparación lado a lado y tres opciones: **Omitir**, **Actualizar el existente** (solo precio/descripción) o **Crear como nuevo**. Si el usuario edita una fila marcada como duplicada y ya no coincide, la fila **se reevalúa en vivo** y cambia a «Ahora es distinto, se creará como nuevo» (y a la inversa).
6. **Confirmar.** Resumen final («Se crearán 4 categorías y 32 productos; se omitirán 5») y creación en una transacción por lote, con resultado por fila y botón «Deshacer esta carga».

## Qué puede extraer el análisis

| Elemento | Qué se detecta | Mapeo a Multi-POS | Nivel de certeza esperado |
|---|---|---|---|
| Categorías | Encabezados de secciones | `Category` | Alto |
| Producto estándar | Nombre, precio, descripción | `Product` + variante base | Alto |
| Variantes | «Chico / Mediano / Grande» con precios | Opciones de tipo variante y combinaciones | Medio-alto |
| A granel | «$32 el kilo», «por 100 g» | Producto granel con unidad y precio por unidad | Medio |
| Personalizado | «Elige tu salsa», «agrega toppings», extras con costo | Opciones de tipo tópico, mínimo/máximo, precio extra | Medio |
| Servicio | Corte de cabello 30 min, lavado, renta por hora | Producto tipo servicio con duración | Medio |
| Receta / ingredientes | Descripción «lleva carne, queso, piña» | Borrador de receta **sin cantidades** (no se infieren gramos) | Bajo: solo sugerencia, requiere captura del dueño |
| Combos | «Combo familiar $199: 2 pizzas + refresco» | `ProductCombo`/`ComboItem` si los componentes existen o se crean | Medio |
| Promociones | «2x1 los martes», «10 % en bebidas» | `Promotion` (beneficio, vigencia, días) | Medio-bajo |
| Productos nuevos y avisos | «Nuevo», «Temporada», horarios, «solo en sucursal» | Marca de producto nuevo y `Publication` | Bajo-medio |

Reglas de honestidad del sistema: nunca inventar precios, cantidades de receta ni costos; lo no leído se deja vacío y marcado; todo dato lleva un indicador de confianza.

## Detección de duplicados

Se compara contra categorías, productos, combos y promociones existentes de la organización activa (nunca de otras):

1. Normalizar (minúsculas, sin acentos, sin signos, singular/plural simple, unidades equivalentes).
2. Coincidencia exacta por nombre normalizado, o por SKU/código de barras si aparece.
3. Similitud difusa (distancia de edición o similitud de tokens) con umbral configurable; por encima del umbral sube a «posible duplicado», con la razón mostrada («mismo nombre, precio distinto: $46 vs $48»).
4. Opcional: similitud semántica con el mismo modelo para casos como «Coca 600» y «Refresco de cola 600 ml».
5. Reevaluación inmediata cuando el usuario edita la fila.

Productos inactivos también cuentan como existentes (con la etiqueta «inactivo») para ofrecer reactivarlos en lugar de duplicarlos.

## Arquitectura propuesta

- **Servidor (`src/lib/menu-import/`)**: `extract.ts` (llama al modelo con imagen/PDF/texto y exige respuesta JSON validada con un esquema), `normalize.ts`, `match.ts` (duplicados), `commit.ts` (creación transaccional reutilizando los servicios de `crud/modules/products.ts`).
- **Entrada**: la imagen se reduce con `sharp`; los PDF se envían por páginas; Excel/CSV se leen con `exceljs` y pasan por el mismo esquema (así hay una sola ruta de revisión).
- **API**: `POST /api/menu-import/analyze` (crea un borrador y devuelve su id), `GET/PATCH /api/menu-import/[id]` (editar filas y decisiones), `POST /api/menu-import/[id]/commit` (idempotente, con clave de reintento). Todas autentican, resuelven la organización efectiva y comprueban permiso y plan.
- **Modelo de datos**: una tabla de «cargas» (`MenuImportDraft`: organización, usuario, estado, archivos, JSON propuesto, decisiones, resultado, fecha) con migración versionada y seeder idempotente. Expira en 7 días.
- **Cliente**: página de módulo con estados de carga/vacío/error, `DialogComponent` para ediciones, React Hook Form + Yup, y la tabla de revisión con acciones masivas. Móvil primero: la foto se toma desde la cámara del teléfono.
- **Seguridad**: el modelo nunca decide precios finales ni crea nada; el servidor valida cada fila otra vez al confirmar (precios positivos, categorías de la organización, límites del plan). El texto extraído se trata como dato, no como instrucción (defensa contra texto malicioso dentro de la imagen).

## Riesgos y decisiones abiertas

| Riesgo | Mitigación |
|---|---|
| Fotos borrosas, menús escritos a mano, columnas cortadas | Indicador de confianza por campo, recorte de la imagen al lado, opción de volver a tomar la foto o recortar. |
| Precios mal leídos | Resaltar cambios de precio frente a lo existente, exigir confirmación explícita, nunca cargar automáticamente precios de baja confianza. |
| Menús muy grandes (más de 150 productos, varias páginas) | Procesar por páginas con avance visible y fusionar duplicados entre páginas. |
| Costo por uso del modelo | Límite mensual por plan, vista previa gratuita de cuántas páginas se procesarán, caché por archivo. |
| Privacidad: la imagen sale hacia un proveedor externo | Aviso y consentimiento explícito, no guardar la imagen más de lo necesario, registrar solo metadatos. |
| Recetas y cantidades | No inferir; ofrecer solo la lista de ingredientes como borrador. |
| Mapeo ambiguo de personalizados y reglas | Mostrar «Cómo lo entendí» en lenguaje natural y permitir cambiar el tipo con un clic. |
| Idioma y moneda | Detectar símbolo y formato (por ejemplo «$1,299.50») y avisar si hay mezcla. |

Decisiones que necesita el equipo: proveedor y modelo, presupuesto por plan, si se incluye «actualizar existente» en la primera versión, y si las promociones y avisos entran desde el inicio o en la fase 2.

## Fases sugeridas

1. **Fase 1 (núcleo, 2 semanas):** foto/PDF/Excel → categorías y productos estándar, variantes y granel; resumen, detección de duplicados por nombre, edición por fila, acciones masivas y creación transaccional con deshacer.
2. **Fase 2 (2 semanas):** personalizados con tópicos y reglas, servicios, borrador de ingredientes, combos; duplicados difusos y reevaluación al editar; «actualizar existente».
3. **Fase 3:** promociones y avisos, multi-página grande, similitud semántica, límites por plan, métricas de aciertos (qué porcentaje de filas se editó) para afinar.

## Criterios de aceptación de la primera versión

- Con una foto nítida de un menú de 30 productos, al menos 90 % de nombres y precios se extraen correctamente en la revisión.
- Ningún producto, categoría ni precio se crea antes de confirmar.
- Los duplicados se detectan y explican; al editar una fila duplicada se reevalúa en el momento.
- Se puede cargar todo, todo menos duplicados, o fila por fila; la carga es transaccional e idempotente y se puede deshacer.
- Todo respeta la organización efectiva, el permiso y el plan; hay pruebas del servidor para duplicados, validación y reintento.

## Siguiente paso recomendado

Prototipar la Fase 1 con 5–10 menús reales de clientes (foto de cámara, PDF y hoja de cálculo) para medir la precisión antes de comprometer el diseño final de la pantalla de revisión.
