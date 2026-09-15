# Modelo de acceso y multiempresa

## Decisión

`User` representa una identidad única y global (correo, credenciales y perfil). `Membership`
representa el acceso de personal a una organización y contiene el rol efectivo. `Employee`
y `Customer` son perfiles operativos separados por organización, ambos ligados al mismo
`User` cuando corresponde.

Esto elimina la duplicación de usuarios cliente: el mismo correo puede tener un `Customer`
en Mini Super Chiquis y otro en Nevería Las Margaritas. Cada registro conserva su propia
clave de cliente, puntos, crédito, favoritos, listas, pedidos, direcciones e historial.

## Permisos

Los permisos actuales son acciones (`view`, `manage`, `delete`, exportación y acciones
especiales) y se resuelven por rol. La pantalla es una agrupación de permisos, no una
segunda fuente de autorización. Un selector que crea otro modelo debe comprobar el permiso
del modelo destino; mostrar Empleados no concede automáticamente crear Puestos o Sucursales.

Los roles `system-*` son plantillas administradas por SuperAdmin. Los roles personalizados
son copias o composiciones pertenecientes a una organización y solo pueden asignarse dentro
de ella. La API sigue siendo la autoridad: la visibilidad de botones nunca sustituye al
guard del servidor.

## Cambio de organización del cliente

El Portal ofrece las organizaciones donde el usuario tiene un cliente activo. El cambio se
valida contra `Customer(userId, organizationId)` antes de actualizar la sesión. Todas las
consultas posteriores reciben la organización activa, por lo que nunca se comparten saldos,
puntos o pedidos entre negocios.

## Pendientes de una fase posterior

- Una matriz visual de permisos por modelo y acción, reutilizando los permisos actuales sin
  duplicar reglas en cada pantalla.
- Flujos de invitación para que una empresa vincule un cliente existente por correo sin
  sobrescribir sus datos personales.
- Auditoría de cambios de roles y membresías.
