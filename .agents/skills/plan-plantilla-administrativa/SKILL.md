---
name: plan-plantilla-administrativa
description: Analiza un sistema administrativo existente y genera un plan para extraer una plantilla reutilizable, separando infraestructura y patrones transversales de reglas específicas del dominio. Úsala al preparar una base para futuros paneles, gestores o sistemas internos; no la uses para implementar directamente un producto concreto.
---

# Plan de plantilla administrativa reutilizable

Genera un plan ejecutable para convertir un proyecto real en una base administrativa
reutilizable. La plantilla debe conservar convenciones probadas sin heredar nombres,
datos demo, flujos ni reglas exclusivas del negocio de origen.

## Fuente de verdad

Analiza el código vigente antes que la documentación. Si existe una skill de contexto del
sistema, úsala para evitar inventariar dos veces. Revisa como mínimo:

- shell, rutas, navegación, temas y adaptación por dispositivo;
- autenticación, organizaciones o tenants, usuarios, roles, permisos y auditoría;
- contratos API, acceso a datos, migraciones, seeders y aislamiento;
- componentes de formularios, validación, foco, campos, adjuntos y selectores;
- tablas, búsqueda, filtros, paginación, importación y exportación;
- diálogos, paneles móviles, estados de carga/vacío/error y cambios sin guardar;
- notificaciones, archivos, reportes, pruebas, documentación y despliegue.

Registra evidencia con rutas de archivo. Distingue entre un patrón realmente compartido,
una regla del dominio y una mejora propuesta que todavía no existe.

## Decisión de extracción

Clasifica cada elemento en una de estas capas:

1. **Núcleo obligatorio:** seguridad, tenancy, permisos, navegación, diseño, formularios,
   tablas, errores, accesibilidad, configuración y observabilidad mínimas.
2. **Capacidad opcional:** adjuntos, importación/exportación, reportes, notificaciones,
   wizards, mapas o integraciones que puedan habilitarse sin contaminar el núcleo.
3. **Adaptador de dominio:** entidades, estados, reglas, vocabulario, menús y recorridos
   que cada producto define.
4. **Excluir:** datos, credenciales, marcas, hacks, deuda técnica y comportamiento exclusivo
   del proyecto de referencia.

No conviertas cada componente del proyecto original en parte de la plantilla. Conserva
solo abstracciones que ya tengan más de un uso razonable o cuyo valor transversal sea
demostrable. Favorece configuración tipada y puntos de extensión sobre bifurcaciones o
copias de archivos.

## Resultado

Lee [references/contrato-plan.md](references/contrato-plan.md) y crea o actualiza el plan
en la ruta solicitada; si no se indica una, usa
`docs/plantilla-administrativa/PLAN.md`. Incluye decisiones, dependencias, riesgos,
migración desde el proyecto de referencia, pruebas y criterios de cierre.

El plan debe permitir construir la plantilla por etapas y luego iniciar un producto nuevo
sin eliminar manualmente conceptos del dominio anterior. No implementes la extracción ni
reescribas el proyecto salvo que el usuario lo pida expresamente.

Para reutilizar la petición fuera de Codex, consulta
[references/prompt-reutilizable.md](references/prompt-reutilizable.md).
