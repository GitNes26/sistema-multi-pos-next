# Prompts reutilizables

## A. Crear un proyecto nuevo (modo principal)

```text
Usa la skill plan-plantilla-administrativa en modo Crear.

Proyecto nuevo: <nombre y propósito en una frase>.
Carpeta destino: <ruta>.
Dominio y vocabulario: <cómo llaman a sus entidades>.
Usuarios y roles: <quién entra y qué hace>.
Módulo inicial: <entidad o flujo con el que arrancar>.
Marca y tono: <colores/nombre si existen; tres adjetivos>.
Extras (opcionales): <adjuntos, Excel, PDF, reportes, mapas, push, tiempo real, planes>.

Toma de este proyecto solo la esencia: reglas de AGENTS.md y fuentes de verdad, MEMORY.md,
guías de diseño y formularios, shell administrativo, usuarios, roles/permisos y menús, componentes
base, CRUD genérico y las tablas base de la BD. No traigas el dominio de Multi-POS.
Analiza apariencia, estilo, animaciones, transiciones e interacciones antes de construir, genera
el starter con su primer módulo completo y los documentos del proyecto nuevo, y verifícalo
(typecheck, lint, pruebas, migración y seed). No hagas commit ni push.
```

## B. Planear la plantilla (modo Planear)

```text
Analiza este proyecto como sistema de referencia y crea un plan técnico y de experiencia
para convertir sus patrones transversales en una plantilla administrativa reutilizable.

La plantilla debe servir como base para productos de dominios distintos —por ejemplo,
gestión documental, administración de una iglesia u organización, o control de rutas y
unidades de transporte— conservando la misma calidad, estructura y convenciones. El
contenido y las reglas del negocio deben poder sustituirse sin reescribir el núcleo.

Identifica con evidencia en el código:

- arquitectura, shell, navegación, diseño adaptable y estados de interfaz;
- autenticación, organizaciones/tenants, usuarios, roles, permisos, planes y auditoría;
- modelo de datos mínimo, API, migraciones, seeders y aislamiento;
- formularios configurables, validaciones, formatos, teclado por tipo, foco, pickers y adjuntos;
- tablas, búsqueda, filtros (con limpiar filtros), paginación, importación/exportación, reportes;
- `DialogComponent`, modales, paneles móviles, confirmaciones y cambios sin guardar;
- análisis de apariencia, tokens, animaciones, transiciones, interacciones y UX inmersiva;
- pruebas, seguridad, accesibilidad, documentación, observabilidad y despliegue.

Clasifica cada hallazgo como núcleo obligatorio, capacidad opcional, adaptador de dominio
o elemento que debe excluirse. No copies reglas, nombres, marcas, datos demo ni deuda
técnica del proyecto original. Evita sobreabstraer.

Entrega un `PLAN.md` implementable (ver contrato-plan.md). No implementes la extracción.
```

## C. Sincronizar la skill con el proyecto

```text
Usa la skill plan-plantilla-administrativa en modo Sincronizar: compara sus referencias con el
código vigente de este repositorio (rutas, tablas base, componentes, guías, reglas de AGENTS.md
y MEMORY.md), corrige lo que cambió y deja anotado qué se actualizó. No modifiques código del
producto.
```
