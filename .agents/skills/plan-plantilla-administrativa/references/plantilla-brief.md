# Plantilla de brief y ejemplo

Copia el bloque «Plantilla», reemplaza cada `[dato clave]` y pégalo junto con el prompt A de
`prompt-reutilizable.md`. Lo que dejes vacío, la skill lo propone como supuesto explícito.

## Plantilla

```text
Usa la skill plan-plantilla-administrativa en modo Crear.

[1. NOMBRE Y PROPÓSITO]
Nombre del sistema: [nombre]
Qué resuelve (una frase): [propósito]
Carpeta destino: [ruta, p. ej. C:\Desarrollos\mi-sistema]  Paquete: [nombre-paquete]

[2. DOMINIO Y VOCABULARIO]
Cómo llaman a sus cosas: [entidad 1 = ..., entidad 2 = ..., "organización" se llama ...]
Idioma: [español]  Moneda/zona horaria: [MXN / America/Mexico_City]

[3. USUARIOS Y ROLES]
Roles y qué hace cada uno: [rol A: ...; rol B: ...; rol C: ...]
¿Rol "todo en uno" para quien hace de todo?: [sí/no]
¿Usuarios finales externos (portal)?: [sí/no]

[4. TENANCY]
Organizaciones: [una / varias]  Sedes o unidades: [nombre de la unidad o "ninguna"]

[5. MÓDULOS Y ENTIDADES]
Entidades principales: [3–6]
Primer módulo a construir: [entidad/flujo]
Flujos clave: [p. ej. solicitud → revisión → aprobación]

[6. PLANES / LICENCIAS]
Se vende por planes con módulos limitados: [sí/no]

[7. MARCA Y TONO]
Nombre/logo/colores: [si existen]  Tres adjetivos: [a, b, c]
Referencias visuales (qué sí / qué no): [..]

[8. DISPOSITIVOS Y ENTORNO]
Dispositivos: [móvil / tablet / escritorio]  PWA: [sí/no]  Hosting: [..]  BD: [MySQL]

[9. CAPACIDADES OPCIONALES]
[adjuntos, Excel, PDF, reportes, mapas, push, tiempo real, wizards, correo]

[10. RESTRICCIONES]
[cumplimiento, integraciones, fechas límite]

Toma solo la esencia (AGENTS.md, MEMORY.md, diseño, formularios, shell, usuarios, roles,
permisos, menús, componentes y tablas base). Analiza apariencia, animaciones e interacciones
antes de construir. Usa las versiones más recientes de las librerías. No hagas commit ni push.
```

## Qué significa cada punto

Úsala como ayuda para llenar la plantilla; no hace falta pegarla en el prompt.

### 1. Nombre y propósito
- **Nombre del sistema**: el nombre visible (login, título, PWA, correos). Se usa también para
  derivar `AGENTS.md`, `MEMORY.md` y las guías propias.
- **Qué resuelve**: una frase sobre el problema y para quién. Orienta qué módulos entran primero
  y qué se deja fuera.
- **Carpeta destino**: ruta donde se crea el proyecto nuevo. Debe estar vacía o no existir; la
  skill nunca escribe sobre este repositorio.
- **Paquete**: nombre técnico en minúsculas y con guiones (`mi-sistema`), usado en `package.json`
  y como prefijo de claves de almacenamiento.

### 2. Dominio y vocabulario
- **Cómo llaman a sus cosas**: equivalencias entre los términos genéricos de la plantilla
  (organización, unidad, cliente, producto) y los del negocio (iglesia, congregación, miembro).
  Define nombres de modelos, rutas, menús, textos y permisos.
- **Idioma**: idioma de la interfaz y de los mensajes de validación.
- **Moneda / zona horaria**: formato de importes y de fechas/horas (código ISO y zona IANA).
  Aunque no manejes dinero, la zona horaria afecta fechas y reportes.

### 3. Usuarios y roles
- **Roles y qué hace cada uno**: quién entra al sistema y qué puede ver o modificar. De aquí salen
  los roles iniciales y su matriz de permisos.
- **Rol «todo en uno»**: si una sola persona hace de todo (negocio pequeño), se crea un rol con
  todos los permisos operativos en vez de separar funciones.
- **Usuarios finales externos (portal)**: si clientes, socios o miembros inician sesión por su
  cuenta en una vista aparte, distinta del panel administrativo. Si es «no», se omite el portal.

### 4. Tenancy (multiempresa)
- **Organizaciones**: «una» = un solo cliente/negocio; «varias» = muchas empresas aisladas en la
  misma instalación, con datos separados por `organizationId`.
- **Sedes o unidades**: subdivisión dentro de una organización (sucursal, congregación, campus).
  Escribe su nombre, o «ninguna» si no existe.

### 5. Módulos y entidades
- **Entidades principales**: los «sustantivos» que se administran (de 3 a 6): cada una suele
  volverse tabla, CRUD, permisos y entrada de menú.
- **Primer módulo a construir**: el que se entrega completo como ejemplo de referencia; los
  demás quedan con su estructura y se construyen después con el mismo patrón.
- **Flujos clave**: procesos con pasos o estados (solicitud → revisión → aprobación). Indica
  quién ejecuta cada paso; se traducen en estados, acciones y permisos.

### 6. Planes / licencias
- **Se vende por planes**: «sí» = cada cliente tiene un plan que habilita ciertos módulos y la
  autorización es permiso del rol ∩ lo que incluye el plan. «No» = todos los módulos disponibles.

### 7. Marca y tono
- **Nombre/logo/colores**: identidad existente (hex o archivo). Define los tokens de color.
  Si no hay, la skill propone una paleta.
- **Tres adjetivos**: personalidad visual y de textos (p. ej. sobrio, cálido, ágil); guían
  tipografía, densidad, animación y redacción.
- **Referencias visuales**: sistemas o pantallas que te gustan (qué sí) y lo que quieres evitar
  (qué no). Sirven para decidir contra qué comparar el diseño.

### 8. Dispositivos y entorno
- **Dispositivos**: dónde se usará realmente (móvil, tablet, escritorio). Define prioridad
  responsive y tamaño de objetivos táctiles.
- **PWA**: si se instala como app (ícono, offline básico, notificaciones).
- **Hosting**: dónde se desplegará (VPS, Vercel, servidor propio); condiciona variables de
  entorno, almacenamiento de archivos y procesos en segundo plano.
- **BD**: motor de base de datos (por defecto MySQL con Prisma).

### 9. Capacidades opcionales
Funciones adicionales que no vienen por defecto: **adjuntos** (fotos/archivos), **Excel**
(importar/exportar), **PDF** (recibos, reportes), **reportes** (tableros y gráficas), **mapas**
(direcciones con pin), **push** (notificaciones al dispositivo), **tiempo real** (pantallas que
se actualizan solas), **wizards** (formularios por pasos), **correo** (avisos y recuperación de
contraseña). Elige solo las necesarias.

### 10. Restricciones
Límites que condicionan el diseño: **cumplimiento** (privacidad de datos, facturación fiscal,
accesibilidad), **integraciones** (pagos, ERP, WhatsApp, APIs externas) y **fechas límite**.

### Cierre del bloque
Las últimas líneas fijan el alcance: copiar solo la esencia (reglas, diseño, formularios, shell,
usuarios/roles/permisos, menús, componentes base), revisar apariencia e interacciones antes de
construir, usar versiones recientes de librerías y no versionar (sin commit ni push).

## Ejemplo completo: administración de una iglesia

```text
Usa la skill plan-plantilla-administrativa en modo Crear.

Nombre del sistema: Ekklesia
Qué resuelve: administrar miembros, ministerios, eventos y ofrendas de una o varias iglesias.
Carpeta destino: C:\Desarrollos\ekklesia   Paquete: ekklesia

Vocabulario: organización = iglesia; unidad = congregación; Member = miembro;
Ministry = ministerio; Offering = ofrenda. Idioma: español. Moneda: MXN.

Roles: Pastor (todo), Tesorero (ofrendas y reportes), Líder de ministerio (su ministerio y
sus eventos), Secretaría (miembros y asistencia). Rol "todo en uno": sí (iglesia pequeña).
Portal de miembros: no.

Tenancy: varias iglesias; unidad = congregación.

Entidades: Miembro, Ministerio, Evento, Asistencia, Ofrenda.
Primer módulo: Miembros (alta, edición, foto, ministerio, estado).
Flujos clave: registrar asistencia por evento; corte semanal de ofrendas.

Planes: no.

Marca y tono: sin logo aún; azul profundo y dorado suave; solemne, cálido, claro.
Referencias: sobrio y legible para personas mayores; nada recargado.

Dispositivos: móvil y escritorio; PWA sí; hosting VPS; BD MySQL.
Opcionales: adjuntos (foto), Excel (importar miembros), PDF (recibos), reportes, notificaciones.
Restricciones: privacidad de datos personales; textos grandes por accesibilidad.

Toma solo la esencia (AGENTS.md, MEMORY.md, diseño, formularios, shell, usuarios, roles,
permisos, menús, componentes y tablas base). Analiza apariencia, animaciones e interacciones
antes de construir. Usa las versiones más recientes de las librerías. No hagas commit ni push.
```

## Qué produce la skill con ese ejemplo

Starter con login, panel, usuarios/roles/permisos (`members.*`, `ministries.*`, `events.*`,
`offerings.*`), menú Miembros/Ministerios/Eventos/Ofrendas, apariencia en azul/dorado,
módulo Miembros completo, y `AGENTS.md`/`MEMORY.md`/guías propias de Ekklesia.
