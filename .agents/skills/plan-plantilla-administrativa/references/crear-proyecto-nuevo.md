# Crear un proyecto nuevo desde la plantilla

Procedimiento para ejecutar el modo **Crear** con el mínimo esfuerzo del usuario: él aporta
el contexto del producto y la skill produce el starter y su primer módulo.

## 1. Brief de contexto (pregunta solo lo que falte)

Resume en un bloque corto y confírmalo. Propón valores por defecto entre paréntesis.

1. **Nombre y propósito** del sistema; carpeta destino y nombre del paquete.
2. **Dominio y vocabulario**: cómo llaman a las cosas (p. ej. «documentos», «congregaciones»,
   «unidades y rutas»). Idioma de la interfaz (español).
3. **Usuarios y roles**: quién entra y qué hace cada rol; ¿hay un rol «todo en uno» para equipos
   de una persona? ¿usuarios finales externos (portal)? (no).
4. **Tenancy**: una organización o varias; ¿sedes/unidades organizativas? ¿multi-organización
   por usuario? (varias organizaciones, sin sedes).
5. **Entidades y módulos iniciales**: 3–6 entidades principales y el primer módulo a construir.
6. **Planes/licencias**: ¿se vende por planes con módulos limitados? (sí/no).
7. **Marca y tono**: nombre, colores si existen, tres adjetivos, referencias visuales.
8. **Dispositivos y entorno**: móvil/tablet/escritorio, PWA, hardware, hosting.
9. **Capacidades opcionales**: adjuntos, importar/exportar Excel, PDF, reportes, mapas, push,
   tiempo real, wizards, notificaciones por correo.
10. **Restricciones**: base de datos, cumplimiento, integraciones, deadlines.

Si el usuario solo da una frase, completa el brief con supuestos explícitos, muéstralos y
avanza; no bloquees la ejecución por detalles reversibles.

## 2. Decisiones que debe cerrar la skill antes de construir

- Perfil de módulos (reemplazo de `businessMode`): lista de módulos, qué roles de sistema
  existen y qué permisos tiene cada uno (`modulo.accion` en español).
- Nombre de la unidad organizativa (o su eliminación) y de los roles del dominio.
- Capacidades opcionales activas y su costo de mantenimiento.
- Dirección visual: resumen de análisis (ver `sistema-ui-y-experiencia.md` §1).
- Convenciones del repo nuevo: versión/`gcv` sí o no, pruebas mínimas, despliegue.

Anótalas en `MEMORY.md` y `CONTEXTO_SISTEMA.md` del proyecto nuevo.

## 3. Generación del starter

1. Crea el repositorio en la carpeta destino (copia limpia por *lista blanca* de
   `esencia-del-proyecto.md` §4; nunca copies `.env*`, `tmp/`, `output/`, `test-results/`,
   `node_modules/`, `.next/`, volcados, uploads ni `public/` con marca).
2. Instala dependencias en su **última versión estable** (`@latest`), incluido `notistack`
   (reemplaza a sonner/`swalToast`); registra versiones en `MEMORY.md`. Renombra paquete, `README`, manifest, metadata, `docker-compose` y variables de entorno;
   crea `.env.example` con **nombres** de variables (sin valores reales).
3. Reduce el esquema Prisma a las tablas base (`nucleo-y-estructura.md` §3) + las del primer
   módulo. Genera una única migración inicial limpia y el seeder de producción mínimo
   (permisos, roles, menús, planes por defecto, superadmin por env).
4. Sustituye `permission-keys.ts`, `SYSTEM_ROLES`, menús del sistema, `features.ts` y
   `plan-permissions.ts` por los del dominio nuevo; deja solo permisos transversales
   (usuarios, roles, empresa, apariencia, menús, planes, notificaciones) más los del dominio.
5. Elimina de rutas, navegación y tipos todo vestigio del dominio de origen. Busca con `rg`
   términos del proyecto original (marca, `pos`, `kds`, `portal`, `sale`, `inventory`, `order`,
   `cashier`…) y confirma cero referencias.
6. Ajusta tokens, tipografías, valores por defecto de `AppSettings`, logotipo y manifest según
   el análisis de apariencia.
7. Redacta los documentos del proyecto (`AGENTS.md`, `MEMORY.md`, `CONTEXTO_SISTEMA.md`,
   `PRODUCT.md`, `DESIGN.md`, `docs/agents/*`) con la misma estructura y reglas heredadas
   (`esencia-del-proyecto.md` §1–3) y el vocabulario nuevo.
8. Instala, migra y siembra en una base nueva; entra con el owner semilla; recorre
   login → panel → usuarios/roles → apariencia → primer módulo.

## 4. Receta del primer módulo completo

Cumple en este orden y marca cada paso:

1. **Entidad**: modelo Prisma con `organizationId`, `isActive`, timestamps, índices tenant;
   migración versionada.
2. **Permisos**: `modulo.view`, `modulo.manage` (y `delete`/acciones especiales) en
   `permission-keys.ts`; asignación en `SYSTEM_ROLES`; backfill si ya hay datos; etiquetas en
   español y etiqueta de módulo en `PERMISSION_MODULE_LABELS`.
3. **Lógica**: `lib/<dominio>/server.ts` (consultas con `organizationId`, transacciones,
   validación de relaciones cruzadas) y reglas puras testeables.
4. **Registro CRUD** (si es catálogo): `CrudModule` + entrada en `CRUD_MODULES` + configuración
   de UI (`crud-config.ts`). Si no es catálogo: ruta API propia con el orden obligatorio.
5. **Página**: `/admin/<módulo>` (servidor con permiso) + cliente de módulo con `PageHeader`,
   herramientas (búsqueda `type="search"`, filtros, `ClearFiltersButton`), `DataTable`,
   estados loading/vacío/error.
6. **Formulario**: en `DialogComponent`, RHF + Yup, `useFocusInvalid`, teclado y pickers
   correctos, adjuntos con `Attachment`, selectores con `FormCombobox`.
7. **Menú**: ítem en `SYSTEM_MENUS` (+ fallback `nav.ts`) con `permissionKey` y ícono; feature
   y plan si aplica.
8. **Pruebas**: regla pura en `tests/unit`, caso de permisos, y recorrido manual
   (permiso denegado, vacío, error, doble clic, móvil/escritorio).
9. **Documentación**: `CONTEXTO_SISTEMA.md` (regla y flujo), guía temática si hay convención
   nueva, `MEMORY.md` solo si es un hecho duradero.

## 5. Ejemplos de adaptación (qué se configura y qué se programa)

| Dominio | Se configura | Se programa |
|---|---|---|
| **Gestión documental** | Organización = institución; roles Administrador, Archivista, Revisor, Consulta; permisos `documents.*`, `folders.manage`, `approvals.review`; menú Documentos/Carpetas/Aprobaciones | Entidades `Document`, `DocumentVersion`, `Folder`; flujo de revisión/aprobación; visor y adjuntos; búsqueda |
| **Iglesia / organización** | Organización = iglesia; unidad = congregación/ministerio; roles Pastor, Tesorero, Líder, Secretaría; permisos `members.*`, `offerings.*`, `events.manage` | `Member`, `Ministry`, `Event`, `Offering`; asistencia, calendario, reportes de ofrendas |
| **Rutas y unidades de transporte** | Organización = empresa; unidad = base/terminal; roles Despachador, Operador, Supervisor, Mantenimiento; permisos `routes.*`, `vehicles.*`, `trips.dispatch` | `Route`, `Vehicle`, `Driver`, `Trip`; asignación, seguimiento, mantenimiento, mapas |

En los tres, el núcleo (acceso, permisos, menús, shell, tema, formularios, tablas, diálogos,
notificaciones, pruebas, entrega) se reutiliza sin cambios; solo se programan entidades, reglas
y recorridos propios.

## 6. Checklist de salida

- [ ] Dependencias en última versión estable; avisos con notistack y SweetAlert2 solo en impacto alto.
- [ ] `typecheck`, `lint`, `test` y `build` pasan; migración + seed funcionan en base nueva.
- [ ] Cero referencias residuales del dominio de origen (`rg` documentado).
- [ ] Sin secretos, `.env` reales ni datos demo del proyecto de origen.
- [ ] Owner semilla entra; menú y páginas respetan rol ∩ plan; API devuelve 403 sin permiso.
- [ ] Una organización no ve datos de otra (prueba con dos organizaciones).
- [ ] Primer módulo completo (§4) y documentado.
- [ ] `AGENTS.md`, `MEMORY.md`, `CONTEXTO_SISTEMA.md`, `PRODUCT.md`, `DESIGN.md` y
      `docs/agents/*` del proyecto nuevo coherentes con el código.
- [ ] Revisión visual en móvil y escritorio, claro/oscuro, `prefers-reduced-motion`.
- [ ] Informe final con lo verificado y lo que requiere validación externa.
