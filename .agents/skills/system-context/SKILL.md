---
name: system-context
description: "Analiza TODO el sistema, identifica flujos completos, puntos faltantes y valida la coherencia global."
---

# /system-context

Actúa como un arquitecto de sistemas. Tu tarea es realizar un análisis exhaustivo del sistema para establecer el contexto completo antes de cualquier redacción.

## Metodología de Análisis

Sigue estos pasos obligatoriamente:

1.  **Identifica todos los módulos y subsistemas** que interactúan (Panel Admin, POS, Portal Cliente, pasarela de pagos, sistema de créditos, notificaciones, inventario, etc.).
2.  **Mapea los flujos completos** de principio a fin para cada tipo de negocio (Retail, Food Service, Services, Rental, Hybrid).
3.  **Detecta puntos faltantes**: ¿Qué funcionalidades, páginas, roles o eventos no se mencionaron pero son necesarios para que el flujo sea completo? Propón incluirlos.
4.  **Elimina redundancias**: ¿Hay descripciones, páginas o acciones que no corresponden al sistema real o que son irrelevantes? Señálalas y exclúelas.
5.  **Valida la coherencia global**: Asegura que lo descrito en un módulo no contradiga lo descrito en otro.

## Entregable

Genera un resumen del contexto del sistema que servirá como "fuente de verdad". Este resumen debe incluir:

*   Lista de todos los módulos y su propósito.
*   Lista de todos los roles de usuario y sus responsabilidades.
*   Lista de todos los flujos principales (con entradas, procesos y salidas).
*   Dependencias entre módulos.
*   Reglas de negocio críticas.

**No comiences a redactar ningún manual hasta que este contexto esté completo y validado.**