# Prompt reutilizable

Analiza este proyecto como sistema de referencia y crea un plan técnico y de experiencia
para convertir sus patrones transversales en una plantilla administrativa reutilizable.

La plantilla debe servir como base para productos de dominios distintos —por ejemplo,
gestión documental, administración de una iglesia u organización, o control de rutas y
unidades de transporte— conservando la misma calidad, estructura y convenciones. El
contenido y las reglas del negocio deben poder sustituirse sin reescribir el núcleo.

Identifica con evidencia en el código:

- arquitectura, shell, navegación, diseño adaptable y estados de interfaz;
- autenticación, organizaciones/tenants, usuarios, roles, permisos y auditoría;
- modelo de datos mínimo, API, migraciones, seeders y aislamiento;
- formularios configurables, validaciones, formatos, foco, campos compartidos y adjuntos;
- tablas, búsqueda, filtros, paginación, importación/exportación y reportes;
- `DialogComponent`, modales, paneles móviles, confirmaciones y cambios sin guardar;
- pruebas, seguridad, accesibilidad, documentación, observabilidad y despliegue.

Clasifica cada hallazgo como núcleo obligatorio, capacidad opcional, adaptador de dominio
o elemento que debe excluirse. No copies reglas, nombres, marcas, datos demo ni deuda
técnica del proyecto original. Evita sobreabstraer: generaliza solamente patrones con
valor transversal comprobable.

Entrega un `PLAN.md` implementable que incluya alcance y exclusiones, matriz de extracción,
arquitectura objetivo, contratos de extensión, sistema de UI, modelo de permisos, base de
datos mínima, estrategia de migración, etapas priorizadas, riesgos, pruebas y criterios de
cierre. Añade el procedimiento para iniciar un producto nuevo y crear su primer módulo
completo —entidad, migración, API, permiso, ruta, menú, tabla, formulario, diálogo, pruebas
y documentación— siguiendo las convenciones de la plantilla.

No implementes todavía la extracción. Primero deja decisiones cerradas, dependencias y
resultados verificables para que la construcción pueda realizarse por lotes sin volver a
analizar el proyecto completo.
