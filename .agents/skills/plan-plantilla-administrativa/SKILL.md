---
name: plan-plantilla-administrativa
description: Extrae la esencia de este proyecto (reglas de AGENTS.md, fuentes de verdad, MEMORY.md, guías de diseño y formularios, shell administrativo, usuarios, roles/permisos, menús, componentes y tablas base de BD) para planear o CREAR la plantilla administrativa de un proyecto nuevo, sin heredar el dominio de Multi-POS. Úsala cuando el usuario quiera iniciar un sistema distinto (documentos, iglesia, rutas, escuela, etc.) con la misma estructura, UX y calidad, o cuando pida actualizar/planear la plantilla reutilizable. No la uses para implementar reglas de negocio de un producto concreto.
---

# Plantilla administrativa reutilizable

Convierte lo aprendido en este proyecto en una **base lista para arrancar cualquier sistema
administrativo**: mismo shell, control de usuarios, roles/permisos/menús por plan, diseño,
formularios, tablas, diálogos y base de datos mínima. Cada proyecto nuevo toma después su
propio dominio y flujo. Esta skill solo aporta lo transversal.

## Modos de uso

Elige el modo según la petición; si no está claro, pregunta una sola vez.

| Modo | Cuándo | Resultado |
|---|---|---|
| **Crear** (principal) | «Crea un proyecto nuevo de…», «arranca la plantilla para…» con contexto del nuevo sistema | Starter funcionando en la carpeta destino + `AGENTS.md`, `MEMORY.md`, `docs/agents/*`, `DESIGN.md`/`PRODUCT.md` propios |
| **Planear** | «Planea/actualiza el plan de la plantilla» | `docs/plantilla-administrativa/PLAN.md` según [contrato-plan.md](references/contrato-plan.md) |
| **Sincronizar** | El proyecto de referencia cambió y la plantilla/skill quedó atrás | Esta skill y sus referencias actualizadas contra el código vigente |

## Principio rector

1. **El código vigente manda; la documentación guía.** Antes de crear o planear, verifica en
   el repositorio de referencia que cada pieza que vas a usar sigue existiendo (rutas en
   [esencia-del-proyecto.md](references/esencia-del-proyecto.md)). Si difiere, actualiza la
   referencia en el mismo trabajo.
2. **Solo lo transversal.** Se lleva: seguridad, tenancy, permisos, menús, shell, diseño,
   formularios, tablas, diálogos, estados, notificaciones base, pruebas y flujo de entrega.
   Se queda: caja, inventario, pedidos, KDS, portal, mesas, reservaciones, promociones,
   lealtad, crédito, nómina y todo vocabulario del punto de venta.
3. **Configuración antes que copia.** Usa registros tipados (módulos CRUD, menús, permisos,
   features) en lugar de bifurcar archivos. Un proyecto nuevo se define editando catálogos,
   no borrando código del anterior.
4. **Sin residuos.** El starter no contiene nombres, datos demo, credenciales, marcas ni
   permisos del proyecto de origen. Nunca copies `.env*`, volcados, uploads ni secretos.
5. **Tecnologías al día.** En un proyecto nuevo instala siempre la **última versión estable**
   de framework, librerías y herramientas (`npm view <paquete> version`, `npx create-next-app@latest`,
   `npm install <paquete>@latest`), revisa guías de migración y registra las versiones en
   `MEMORY.md`. No copies versiones fijadas del proyecto de referencia; si una actualización mayor
   rompe una pieza heredada, adáptala en lugar de congelar la versión vieja.
6. **Notificaciones.** Avisos normales (guardado, error leve, información, éxito) con **notistack**
   (`SnackbarProvider` en `providers/`, `enqueueSnackbar`, variantes success/error/warning/info,
   un único helper `src/lib/notify.ts`). **SweetAlert2 solo** para alertas de gran impacto que
   deben notarse y exigir decisión: confirmar acciones destructivas o irreversibles, errores
   críticos o bloqueos. El proyecto de referencia usa sonner + SweetAlert (`src/lib/swal.ts`);
   en el starter se sustituye sonner/`swalToast` por notistack.
7. **Estilo del proyecto nuevo, no clon visual.** Se heredan las reglas de diseño y
   experiencia; la identidad (paleta, tipografía, tono, ilustración) se decide con el
   contexto del producto nuevo (ver [sistema-ui-y-experiencia.md](references/sistema-ui-y-experiencia.md)).

## Flujo del modo Crear

1. **Contexto.** Reúne con [crear-proyecto-nuevo.md](references/crear-proyecto-nuevo.md) §1 el
   brief del producto: dominio, usuarios y roles, entidades principales, módulos iniciales,
   tenancy (una organización o varias), marca/tono, dispositivos, integraciones. Pregunta solo
   lo que falte y no pueda deducirse; propone valores por defecto razonables.
2. **Lectura de esencia.** Lee [esencia-del-proyecto.md](references/esencia-del-proyecto.md) y,
   del repositorio de referencia, únicamente: `AGENTS.md`, `MEMORY.md`,
   `docs/agents/*`, `DESIGN.md`, `PRODUCT.md` y los archivos canónicos que cite cada
   referencia. Evita reanalizar todo el proyecto.
3. **Clasificación.** Aplica las capas: núcleo obligatorio, capacidad opcional, adaptador de
   dominio, excluir. Decide con el brief qué capacidades opcionales se activan.
4. **Diseño.** Ejecuta el análisis de apariencia y experiencia de
   [sistema-ui-y-experiencia.md](references/sistema-ui-y-experiencia.md) §1 y fija dirección,
   tokens, movimiento y patrón de página del producto. Si la skill `impeccable` está
   disponible, úsala para el contexto/diseño (PRODUCT.md/DESIGN.md del proyecto nuevo).
5. **Construcción por lotes** (ver [nucleo-y-estructura.md](references/nucleo-y-estructura.md)):
   esqueleto y tooling → BD base y seed → auth/tenancy/permisos/menús → shell y tema →
   componentes base y CRUD genérico → módulos de admin base (usuarios, roles, apariencia,
   empresa, perfil) → primer módulo de dominio → documentación y pruebas.
6. **Primer módulo completo** siguiendo la receta de
   [crear-proyecto-nuevo.md](references/crear-proyecto-nuevo.md) §4: entidad, migración,
   permiso, módulo CRUD, API, ruta, menú, tabla, formulario, diálogo, prueba y documentación.
7. **Documentos del proyecto nuevo.** Genera sus `AGENTS.md`, `MEMORY.md`, `CONTEXTO_SISTEMA.md`,
   `docs/agents/*`, `PRODUCT.md` y `DESIGN.md` adaptados (misma estructura y orden de
   autoridad, contenido del nuevo dominio).
8. **Verificación.** `typecheck`, `lint`, pruebas y build; migrar y sembrar en una base nueva;
   iniciar sesión con el owner semilla; comprobar menú por rol; abrir una página en móvil y
   escritorio. Reporta honestamente lo que no pudiste validar (hardware, correo, pagos, etc.).

No hagas `commit` ni `push` en el proyecto nuevo salvo petición expresa. No modifiques el
proyecto de referencia al crear un starter, salvo para actualizar esta skill en modo Sincronizar.

## Qué no es esta skill

- No implementa reglas de negocio específicas ni migra datos reales.
- No elimina el dominio del proyecto de referencia: genera un destino limpio.
- No reemplaza el criterio de diseño: obliga a analizarlo y documentarlo antes de construir.

## Referencias (lee solo lo que necesites)

- [esencia-del-proyecto.md](references/esencia-del-proyecto.md): fuentes de verdad, reglas
  heredables, mapa de archivos canónicos y qué se lleva o se excluye.
- [nucleo-y-estructura.md](references/nucleo-y-estructura.md): estructura de carpetas, tablas
  base de BD, autenticación, tenancy, roles/permisos/menús, API, seed, pruebas y scripts.
- [sistema-ui-y-experiencia.md](references/sistema-ui-y-experiencia.md): análisis de apariencia,
  diseño, animación, transiciones, interacciones y UX inmersiva; anatomía de página,
  formularios, diálogos, tablas y filtros.
- [plantilla-brief.md](references/plantilla-brief.md): plantilla con `[datos clave]` para pegar al
  iniciar un proyecto y un ejemplo completo (iglesia).
- [crear-proyecto-nuevo.md](references/crear-proyecto-nuevo.md): brief, procedimiento, receta
  del primer módulo, ejemplos por dominio y checklist de salida.
- [contrato-plan.md](references/contrato-plan.md) y
  [prompt-reutilizable.md](references/prompt-reutilizable.md): formato del plan y prompts.
