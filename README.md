# Multi-POS

Sistema de punto de venta multi-sucursal: POS, panel administrativo, cocina (KDS),
mesas, inventario y portal de clientes con lealtad, pedidos y entregas.

**Stack:** Next.js (App Router + Turbopack) · Prisma (MySQL) · NextAuth · Tailwind CSS.

---

## Puesta en marcha (desarrollo)

```bash
# 1. Variables de entorno (ajusta DATABASE_URL y secretos)
cp .env.example .env.local

# 2. Dependencias
npm install

# 3. Base de datos (crea tablas; ver migraciones para producción)
npm run db:push          # o: npm run db:migrate

# 4. Seed (base + demo; ver sección Seeders)
npm run db:seed

# 5. Servidor de desarrollo
npm run dev              # http://localhost:3000
```

El archivo `.env.local` del template trae `SEED_DEMO="true"`, así que el paso 4
siembra la base de producción **y** las organizaciones de demo.

---

## Seeders

Hay un único punto de entrada, `prisma/seed.ts`, con dos fases:

| Fase | Función | Cuándo corre |
|---|---|---|
| Base de producción | `seedProduction()` (`prisma/seeders/production.ts`) | **Siempre** |
| Datos demo | `seedDemo()` (`prisma/seeders/demo.ts`) | Solo con **opt-in doble**: `SEED_DEMO="true"` **y** `NODE_ENV != "production"` |

> **Seguridad:** la demo nunca corre en producción. Aunque un operador copie un
> `.env` de desarrollo (Prisma auto-carga `SEED_DEMO=true`), el guard de
> `NODE_ENV=production` la bloquea. La demo también trae guard propio si se
> invoca `seedDemo()` directamente desde otro script.

### 1. Base de producción (`seedProduction`)

Crea datos de **sistema** (idempotente, upserts por id estable):

- **SuperAdmin** (única cuenta fuera de las orgs demo):

  | Campo | Default | Variable de entorno |
  |---|---|---|
  | Email | `admin@multi-pos.com` | `SUPERADMIN_EMAIL` |
  | Contraseña | `Admin123!` | `SUPERADMIN_PASSWORD` |
  | Nombre | `Super Admin` | `SUPERADMIN_NAME` |

  Nota: en el upsert, la contraseña solo se escribe al **crear** la cuenta; si la
  cuenta ya existe, no se sobreescribe (usa `SUPERADMIN_PASSWORD` solo para una
  BD nueva).

- **Permisos** predefinidos (`src/lib/auth/permission-keys.ts`, ~30 claves).
- **Roles de sistema** (`roles`, `organizationId = NULL`) con permisos por
  `businessMode` — los ids estables `system-*` son los que guardan las
  memberships (roleId):

  | Rol | businessMode | Uso |
  |---|---|---|
  | `superadmin`, `Propietario`, `Admin`, `Gerente`, `Cajero`, `Repartidor`, `customer` | todos (compartidos) | acceso total / operativo / portal |
  | `Mesero` + `Cocina (KDS)` | `food_service` | mesero: tickets y pedidos; cocina: solo KDS |
  | `Mesero` + `Cocina (KDS)` | `hybrid` | ídem para negocios híbridos |
  | `Agente de atención` | `services` | agenda, clientes y cobro |
  | `Agente de renta` | `rental` | reservaciones, clientes y cobro |

  El listado de roles por organización se filtra según el modo del negocio
  (Ajustes → Usuarios y permisos, y el diálogo del superAdmin).
- **Unidades de medida** del sistema (kg, g, lt, ml, pza, m, cm, peso).
- **Menú dinámico** del panel (secciones/ítems con permisos).

### 2. Datos demo (`seedDemo`)

> Todos los usuarios demo comparten la contraseña **`demo1234`** (no aplica al
> SuperAdmin). Las organizaciones se recrean en cada siembra (limpieza +
> creación), por lo que el seed es **idempotente**.

#### Organizaciones

| Organización | Modo | Owner | Contenido sembrado |
|---|---|---|---|
| **Supermercado Demo** | `retail` | Ana López (compartido) | 50 productos con variantes/granel, imágenes y descripciones, 4 combos (paquetes), 3 sucursales + CEDIS, 10 clientes, promociones, 100 ventas históricas y 20 pedidos de portal |
| **Restaurante Demo** | `food_service` | Ana López | 24 productos de menú, 4 combos, 8 mesas, 8 pedidos (5 en curso para KDS/Mesas; la mesa 3 queda con una orden en cocina sin cobrar para demostrar cobro o cancelación desde el POS), 6 comensales, 30 ventas |
| **Estética Demo** | `services` | Ana López | 26 productos (21 servicios sin inventario + 5 retail), 2 estilistas con 20 asignaciones, 105 citas en la agenda (70 cobradas con venta ligada), 6 clientas, 100 ventas |
| **Fiestas Demo** | `rental` | Ana López | 22 unidades rentables (brincolines, mobiliario, fotocabina, audio), 125 reservaciones por período (66 cobradas con venta ligada) sobre 45 días de historia y 3 semanas de agenda, 6 clientes, 96 ventas |
| **Híbrido Demo** | `hybrid` | Ana López | Fonda-tienda (retail + food_service): 25 productos (despensa/botanas en anaquel + cocina/desayunos), 3 combos, 4 mesas, 8 pedidos (5 en curso para KDS/Mesas), 6 clientes, 12 ventas |

Las cinco comparten al mismo dueño: **Ana López — `demo@multi-pos.com`**
(membership `owner` en cada organización). Los clientes del portal se crean como
usuarios de portal (ver más abajo).

#### Menú digital por QR (mesas demo)

Las mesas de Restaurante e Híbrido Demo tienen **id y token QR fijos** (no
cambian entre re-siembras), así que estos enlaces se pueden abrir o generar en
QR para probar el menú digital del comensal sin consultar la BD. El menú pide
iniciar sesión como cliente portal de la misma organización (p. ej.
`rcli-001@restaurante.local`), y el pedido a mesa exige el par mesa+token del
QR — validado en servidor al crear el pedido.

| Org | Mesa | URL del menú digital |
|---|---|---|
| Restaurante Demo | 1 | `/portal/menu?table=demo-rest-t1&token=demo-rest-qr-t1` |
| Restaurante Demo | 2 | `/portal/menu?table=demo-rest-t2&token=demo-rest-qr-t2` |
| Restaurante Demo | 3 | `/portal/menu?table=demo-rest-t3&token=demo-rest-qr-t3` |
| Restaurante Demo | 4 | `/portal/menu?table=demo-rest-t4&token=demo-rest-qr-t4` |
| Restaurante Demo | 5 | `/portal/menu?table=demo-rest-t5&token=demo-rest-qr-t5` |
| Restaurante Demo | 6 | `/portal/menu?table=demo-rest-t6&token=demo-rest-qr-t6` |
| Restaurante Demo | 7 | `/portal/menu?table=demo-rest-t7&token=demo-rest-qr-t7` |
| Restaurante Demo | 8 | `/portal/menu?table=demo-rest-t8&token=demo-rest-qr-t8` |
| Híbrido Demo | 1 | `/portal/menu?table=demo-hyb-t1&token=demo-hyb-qr-t1` |
| Híbrido Demo | 2 | `/portal/menu?table=demo-hyb-t2&token=demo-hyb-qr-t2` |
| Híbrido Demo | 3 | `/portal/menu?table=demo-hyb-t3&token=demo-hyb-qr-t3` |
| Híbrido Demo | 4 | `/portal/menu?table=demo-hyb-t4&token=demo-hyb-qr-t4` |

Prefija cada URL con el origen correspondiente (dev: `http://localhost:3000`).
Para lotes completos imprimibles usa **Descargar QRs** en *Panel → Mesas*
(genera una hoja con un QR por mesa activa, lista para imprimir/recortar).

#### Reservar mesa sin cuenta (invitado)

El comensal puede reservar mesa **sin cuenta de portal**: basta nombre y
teléfono. La página pública `/reservar` resuelve la organización desde `?org=`
(id de la empresa) o desde el par mesa+token del QR (misma sintaxis que el
menú digital) y la reservación queda ligada a esos datos de invitado — el
anfitrión la ve en *Panel → Mesas → Reservaciones* con el nombre y teléfono.

| Org | Mesa | URL de reservación de invitado |
|---|---|---|
| Restaurante Demo | 4 | `/reservar?table=demo-rest-t4&token=demo-rest-qr-t4` |
| Restaurante Demo | 8 | `/reservar?table=demo-rest-t8&token=demo-rest-qr-t8` |
| Híbrido Demo | 4 | `/reservar?table=demo-hyb-t4&token=demo-hyb-qr-t4` |

No requiere sesión: ábrela en una ventana de incógnito y reserva con nombre +
teléfono (p. ej. *María García / 55 1234 5678*).

Cuando el anfitrión confirma la reservación, el invitado recibe un aviso por
**WhatsApp** (con fallback a **SMS**) al teléfono que dejó: fecha, hora,
comensales y mesa asignada. Requiere credenciales de Twilio (`TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` y `TWILIO_SMS_FROM`); sin ellas el
aviso se omite con un log y la confirmación sigue funcionando igual.

El **aviso de llegada** de reservaciones (la tira de "próximas reservas" del
POS/KDS) es configurable por organización: en *Panel → Mesas*, junto a los
filtros, se ajustan las **horas de anticipación** (1–24, default 3) con las
que una reservación confirmada aparece como próxima.

#### Confirmar o cancelar sin cuenta (invitado)

Al reservar, el invitado recibe un **código de 6 dígitos** (vence en 15 min):
aparece en pantalla y viaja por WhatsApp/SMS. En la página pública
`/reservar/verificar` confirma o cancela su reservación con **teléfono +
código** — sin cuenta y sin sesión. Hay botón "Enviarme un código" para pedir
uno nuevo (limitado a 3 envíos cada 10 min); si cancela, la mesa se libera
al instante en el POS/KDS.

#### Lista de espera sin cuenta (invitado)

Si no hay mesa disponible para el grupo, la página `/reservar` ofrece
**anotarse en la lista de espera** con nombre y teléfono (mismo flujo sin
cuenta). Cuando se libera una mesa que les quepa, el barrido de la lista de
espera les manda el aviso por **WhatsApp/SMS** con el número de mesa; el
anfitrión la ve en *Panel → Mesas → Lista de espera* con la etiqueta
*Invitado* y la cierra con *Sentado*/*Cancelar* igual que las del portal. Si la
mesa ofrecida se ocupa antes de que lleguen, el sistema re-empareja al invitado
con la siguiente mesa libre y le avisa del cambio; al sentarlo recibe la
confirmación por WhatsApp/SMS con el número de su mesa.

#### Equipo por organización (panel de acceso)

El **código de nómina** (columna "Código") sirve para entrar desde el login con
"Correo o código" (misma contraseña). Las filas marcadas *nómina* son empleados
sin membership: existen para puestos/agenda y, si entran, el sistema les asigna
el rol por defecto **Cajero** (fallback de `inferKindFromUser`).

**Supermercado Demo** (retail) — rol de modo: ninguno extra.

| Email | Nombre | Rol (roleId) | Código |
|---|---|---|---|
| `demo@multi-pos.com` | Ana López | Propietario | EMP-001 |
| `manager@demo.multi-pos.com` | Carlos Ruiz | Gerente | EMP-002 |
| `cajero1@demo.multi-pos.com` | Luis Gómez | Cajero | EMP-003 |
| `cajero2@demo.multi-pos.com` | María Pérez | Cajero | EMP-004 |
| `repartidor@demo.multi-pos.com` | Pedro Hernández | **Repartidor** (`system-courier`) | EMP-005 |

**Restaurante Demo** (food_service) — roles de modo: Mesero y Cocina (KDS).

| Email | Nombre | Rol (roleId) | Código |
|---|---|---|---|
| `demo@multi-pos.com` | Ana López | Propietario | EMP-200 |
| `gerente-rest@demo.multi-pos.com` | Sofía Ramírez | Gerente | EMP-201 |
| `cajero-rest@demo.multi-pos.com` | Diego Torres | Cajero | EMP-202 |
| `mesero@demo.multi-pos.com` | Valentina Flores | **Mesero** (`system-food_service-waiter`) | EMP-203 |
| `cocina@demo.multi-pos.com` | Ricardo Núñez | **Cocina (KDS)** (`system-food_service-kitchen`) | EMP-204 |

**Estética Demo** (services) — rol de modo: Agente de atención.

| Email | Nombre | Rol (roleId) | Código |
|---|---|---|---|
| `demo@multi-pos.com` | Ana López | Propietario | EMP-300 |
| `gerente-est@demo.multi-pos.com` | Ximena Castro | Gerente | EMP-301 |
| `cajero-est@demo.multi-pos.com` | Fernando Gil | Cajero | EMP-302 |
| `agente-est@demo.multi-pos.com` | Daniela Ortiz | **Agente de atención** (`system-services-attendant`) | EMP-303 |
| `estilista1-est@demo.multi-pos.com` | Mariana Soto | Estilista — *nómina* | EMP-304 |
| `estilista2-est@demo.multi-pos.com` | Paola Reyes | Estilista — *nómina* | EMP-305 |

**Fiestas Demo** (rental) — rol de modo: Agente de renta.

| Email | Nombre | Rol (roleId) | Código |
|---|---|---|---|
| `demo@multi-pos.com` | Ana López | Propietario | EMP-400 |
| `gerente-fie@demo.multi-pos.com` | Héctor Aguilar | Gerente | EMP-401 |
| `cajero-fie@demo.multi-pos.com` | Brenda Navarro | Cajero | EMP-402 |
| `agente-fie@demo.multi-pos.com` | Eduardo Lara | **Agente de renta** (`system-rental-agent`) | EMP-403 |
| `operador-fie@demo.multi-pos.com` | Javier Méndez | Operador — *nómina* | EMP-404 |

**Híbrido Demo** (hybrid) — roles de modo: Mesero y Cocina (KDS) bajo el set híbrido.

| Email | Nombre | Rol (roleId) | Código |
|---|---|---|---|
| `demo@multi-pos.com` | Ana López | Propietario | EMP-500 |
| `gerente-hib@demo.multi-pos.com` | Claudia Monroy | Gerente | EMP-501 |
| `cajero-hib@demo.multi-pos.com` | Hugo Paredes | Cajero | EMP-502 |
| `mesero-hib@demo.multi-pos.com` | Renata Aguilar | **Mesero** (`system-hybrid-waiter`) | EMP-503 |
| `cocina-hib@demo.multi-pos.com` | Iván Robles | **Cocina (KDS)** (`system-hybrid-kitchen`) | EMP-504 |

#### Clientes del portal

Cuentas de cliente (`/portal`) con contraseña **`demo1234`**; los códigos de
cliente (columna "Código") también sirven como identificador de login:

| Portal | Correos | Cantidad | Códigos |
|---|---|---|---|
| Supermercado Demo | `cli-001@portal.local` … `cli-010@portal.local` | 10 | CLI-001…CLI-010 |
| Restaurante Demo | `rcli-001@restaurante.local` … `rcli-006@restaurante.local` | 6 | COM-001…COM-006 |
| Estética Demo | `ecli-001@estetica.local` … `ecli-006@estetica.local` | 6 | CLI-001…CLI-006 |
| Fiestas Demo | `fcli-001@fiestas.local` … `fcli-006@fiestas.local` | 6 | CLI-001…CLI-006 |
| Híbrido Demo | `hcli-001@hibrido.local` … `hcli-006@hibrido.local` | 6 | HCL-001…HCL-006 |

---

## Reset / re-siembra

```bash
# Re-siembra idempotente (producción + demo si SEED_DEMO=true en el entorno)
npm run db:seed

# Reset completo de la BD (⚠️ destruye TODOS los datos, solo dev).
# El seed posterior corre SIEMPRE con NODE_ENV=production: la demo queda
# bloqueada aunque un .env de desarrollo filtre SEED_DEMO="true".
# Para recrear las 5 orgs demo después del reset: npm run db:seed
npm run db:reset
```

Comportamiento de la demo según el entorno:

| `SEED_DEMO` | `NODE_ENV` | Resultado |
|---|---|---|
| `"true"` | no `production` | Base **+ demo** (5 orgs) |
| ausente o `"false"` | no `production` | Solo base de producción |
| cualquier valor / ausente | `production` | Solo base de producción (demo bloqueada) |

> `npm run db:reset` siembra siempre en modo producción (demo bloqueada). En dev,
> tras un reset ejecuta `npm run db:seed` para recrear las organizaciones demo.

> El template `.env.example` trae `SEED_DEMO="true"`, por lo que en dev la demo
> corre por defecto al copiarlo a `.env.local`. En producción ejecuta el seed con
> `NODE_ENV=production` y **no** definas `SEED_DEMO`; así nunca se crean
> organizaciones de demo.

## Sesiones multi-org (recordar organización)

El sistema recuerda la última organización activa de cada usuario
(`User.lastOrganizationId`) para que los usuarios multi-org retomen donde
quedaron:

- **Al iniciar sesión** se retoma la última organización recordada, siempre que
  el usuario siga teniendo acceso a ella; si no, se cae a la organización
  natural (la del empleado o la primera membresía).
- **Cambiar de organización** (selector en el header, footer del sidebar o del
  drawer) actualiza la sesión al vuelo: nombre, modo de negocio, **rol y
  permisos** de la nueva org — no hace falta volver a entrar. La elección se
  guarda en BD para el siguiente login.
- **Pantalla de login**: al escribir el correo o código, los usuarios multi-org
  ven un selector rápido *"Entrar a …"* con sus organizaciones accesibles
  (preseleccionada la recordada, marcada como *última vez*). La elección viaja
  en el propio login y define organización activa, rol y permisos desde el
  primer instante. Endpoint `POST /api/auth/org-hint`, con respuestas neutras
  y rate limit: nunca confirma si una cuenta existe.
- **SuperAdmin** opera cualquier organización; la pista no revela el catálogo
  completo de empresas.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión MySQL (`mysql://user:pass@host:3306/multi_pos`) |
| `SEED_DEMO` | Opt-in de datos demo en dev (`"true"`); se ignora con `NODE_ENV=production` |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME` | Credenciales del SuperAdmin del seeder de producción |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | NextAuth (`NEXTAUTH_SECRET` se genera con `openssl rand -base64 32`) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` / `NEXT_PUBLIC_WHATSAPP_MESSAGE` | Botón de contacto de la landing |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Autocomplete de direcciones (opcional) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Credenciales Twilio para avisar al invitado (WhatsApp/SMS) |
| `TWILIO_WHATSAPP_FROM` / `TWILIO_SMS_FROM` | Remitentes de WhatsApp y SMS (el SMS es fallback; `TWILIO_MESSAGING_SERVICE_SID` es alternativa) |
| `MESSAGING_DEFAULT_COUNTRY_CODE` | Lada por defecto para teléfonos locales de 10 dígitos (default: `52`) |

## Scripts útiles

```bash
npm run dev          # servidor de desarrollo (Turbopack)
npm run build        # build de producción
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # pruebas de permisos (integración; requiere dev server + demo sembrada)
npm run db:generate  # prisma generate
npm run db:push      # sincroniza schema → BD (dev)
npm run db:migrate   # crea/aplica migraciones
npm run db:studio    # Prisma Studio
npm run db:seed      # seed (producción + demo en dev)
npm run db:reset     # reset total de BD + seed SIN demo (solo dev; demo con db:seed)
```
