# Contrato del plan

El documento debe ser concreto, trazable al proyecto analizado y contener:

## 1. Propósito y límites

- Qué problemas resuelve la plantilla y qué queda fuera.
- Perfiles de proyecto objetivo y ejemplos de dominios compatibles.
- Stack que se conserva, decisiones abiertas y restricciones de compatibilidad.

## 2. Inventario y matriz de extracción

Para cada capacidad indica: evidencia, capa, decisión (conservar, generalizar, convertir en
módulo o excluir), dependencia y cambio requerido. Incluye rutas, datos, UI, API y pruebas.

## 3. Arquitectura objetivo

- Estructura de paquetes o carpetas y límites entre núcleo, capacidades y dominio.
- Contratos de módulos, registro de rutas/menús/permisos y configuración tipada.
- Modelo de identidad, tenancy, roles, permisos y auditoría.
- Base de datos mínima, migraciones y seed de producción sin datos del dominio.

## 4. Sistema de interfaz

- Tokens, layout administrativo y navegación adaptable.
- Convención única para formularios y campos: icono, etiqueta, requerido, ayuda,
  validación, formato, error inline y foco.
- Contrato de `DialogComponent`: encabezado, cuerpo desplazable y acciones.
- Convenciones para tablas, filtros, estados, responsive y accesibilidad.

Incluye ejemplos breves de configuración o interfaces cuando aclaren el contrato. No
copies módulos completos en el plan.

## 5. Creación de un producto nuevo

Describe el recorrido desde clonar o inicializar la plantilla hasta disponer de:

1. identidad visual y variables de entorno;
2. organización inicial, owner, roles y permisos;
3. primer módulo con entidad, migración, API, formulario, tabla y menú;
4. pruebas, seed, documentación y despliegue.

Demuestra el mecanismo con al menos tres dominios distintos y señala qué se configura y
qué se programa en cada uno.

## 6. Etapas de ejecución

Divide el trabajo en lotes cerrados. Cada lote debe indicar alcance, archivos o áreas,
dependencias, resultado observable, pruebas y criterio de aceptación. Orden recomendado:

1. congelar contrato y pruebas del proyecto base;
2. aislar núcleo técnico y eliminar dependencias de dominio;
3. consolidar UI y CRUD configurables;
4. extraer seguridad, tenancy y permisos;
5. convertir capacidades secundarias en módulos opcionales;
6. crear starter limpio, generadores o ejemplos mínimos;
7. validar con productos piloto y publicar documentación.

## 7. Calidad y riesgos

- Seguridad, aislamiento, accesibilidad, dispositivos, rendimiento y recuperación.
- Riesgo de sobreabstracción, acoplamiento oculto, migraciones y divergencia entre forks.
- Estrategia de versiones y actualización de proyectos derivados.

## 8. Definición de terminado

La plantilla se considera lista cuando puede iniciar un dominio ajeno al original sin
referencias residuales, incluye instalación reproducible y seed mínimo, y permite crear
un módulo completo usando las convenciones documentadas. Typecheck, lint, build y pruebas
aplicables deben pasar.

