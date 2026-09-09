---
name: system-context
description: "Analiza el proyecto actual de forma genérica: identifica todos los módulos, flujos, actores, dependencias y reglas de negocio, y valida coherencia global."
---

# /system-context

Actúa como un arquitecto de sistemas experto en análisis de requisitos y documentación. Tu tarea es realizar un **análisis exhaustivo y genérico** del proyecto actual para establecer el contexto completo, independientemente del dominio, stack tecnológico o tipo de sistema.

Este análisis servirá como la **"fuente de verdad"** para cualquier tarea posterior (redacción de documentación, planificación de desarrollo, migraciones, etc.).

---

## Metodología de Análisis (Aplicable a cualquier proyecto)

Sigue estos pasos obligatoriamente. **No asumas nada** sobre el dominio del proyecto; en su lugar, descúbrelo a partir de la conversación, los archivos disponibles, el código fuente, la documentación existente (README, archivos .md) y tu propia inferencia.

### 1. Identificar el Propósito y Alcance del Proyecto
- ¿Cuál es el objetivo principal del sistema?
- ¿Qué problema resuelve?
- ¿Quiénes son los usuarios o actores principales?
- ¿Cuál es el alcance funcional (qué hace y qué no hace)?

### 2. Identificar Módulos y Subsistemas
- Enumera todos los módulos, componentes o subsistemas que lo conforman.
- Describe brevemente el propósito de cada uno.
- Identifica si hay módulos internos (backend, frontend, bases de datos) y externos (APIs de terceros, servicios en la nube, hardware).

### 3. Mapear Flujos Completos (End-to-End)
- Para cada caso de uso o flujo principal, describe:
  - **Entrada**: ¿Cómo se inicia? (evento, acción del usuario, trigger externo).
  - **Procesos**: ¿Qué pasos intermedios ocurren? (validaciones, transformaciones, llamadas a APIs, cálculos).
  - **Salida**: ¿Cuál es el resultado final? (pantalla, notificación, dato persistido, acción física).
- Incluye flujos principales, alternativos y de excepción.
- Si hay distintos tipos de usuarios o roles, mapea los flujos específicos para cada uno.

### 4. Identificar Actores y Roles
- Enumera todos los actores que interactúan con el sistema (personas, sistemas externos, dispositivos).
- Para cada actor, describe sus responsabilidades y permisos.
- Diferencia entre actores humanos (con roles) y actores no humanos (APIs, servicios).

### 5. Detectar Puntos Faltantes o Incompletos
- ¿Hay funcionalidades, pantallas, roles o eventos que no se mencionaron pero son necesarios para que algún flujo sea completo?
- ¿Hay dependencias no declaradas con otros sistemas o servicios?
- ¿Hay reglas de negocio o validaciones que no están especificadas?

### 6. Eliminar Redundancias e Irrelevancias
- ¿Hay descripciones, módulos o funcionalidades que no corresponden al sistema real?
- ¿Hay duplicación de esfuerzos o componentes que podrían unificarse?
- ¿Hay información obsoleta que ya no aplica?

### 7. Validar Coherencia Global
- Asegura que lo descrito en un módulo no contradiga lo descrito en otro.
- Verifica que los flujos tengan un inicio y fin lógicos, sin saltos ni ambigüedades.
- Comprueba que las reglas de negocio se apliquen de forma consistente en todo el sistema.

---

## Entregable (El Resumen de Contexto)

Genera un documento estructurado que sirva como **"fuente de verdad"** para el proyecto. Este resumen debe incluir:

### A. Propósito y Alcance
- Resumen ejecutivo del proyecto (¿qué es?, ¿para qué sirve?, ¿a quién beneficia?).

### B. Módulos y Componentes
- Lista de todos los módulos con su propósito y responsabilidades.
- Dependencias entre módulos (qué módulo necesita de qué otro).

### C. Actores y Roles
- Lista de todos los actores (humanos y no humanos) con su descripción y permisos.

### D. Flujos Principales (End-to-End)
- Descripción paso a paso de los flujos más importantes, incluyendo:
  - **Flujos felices** (todo sale bien).
  - **Flujos alternativos** (decisiones del usuario).
  - **Flujos de excepción** (errores, cancelaciones, tiempos de espera).

### E. Reglas de Negocio Críticas
- Lista de reglas que deben cumplirse siempre (ej. límites de edad, montos máximos, condiciones de descuento, plazos).

### F. Restricciones Técnicas y Dependencias Externas
- Tecnologías utilizadas (lenguajes, frameworks, bases de datos).
- APIs de terceros, servicios externos, hardware necesario.
- Restricciones de rendimiento, seguridad, escalabilidad.

---

## Condiciones de Ejecución

1. **No comiences a redactar ningún manual, propuesta de migración o plan de trabajo** hasta que este contexto esté completo y validado.
2. Si durante el análisis encuentras ambigüedades o información faltante, **pregunta al usuario** para resolverlas antes de continuar.
3. El resumen debe ser **claro, conciso y estructurado**, listo para ser usado como base para cualquier tarea posterior (documentación, estimaciones, planificación de sprints, etc.).

---

**Ahora, inicia el análisis del proyecto actual siguiendo esta metodología. Pregunta si necesitas más información para completar el contexto.**