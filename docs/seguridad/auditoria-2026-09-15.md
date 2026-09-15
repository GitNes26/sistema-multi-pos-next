# Auditoría de seguridad — 15 de septiembre de 2026

## Alcance

Revisión estática de dependencias, autenticación, autorización, aislamiento multiempresa,
cargas, recuperación de contraseña, webhooks, variables de entorno y cabeceras HTTP. No
incluye pentest externo, análisis dinámico autenticado ni infraestructura de producción.

## Corregido

- Next.js pasó de 15.5.23 a 15.5.25 para cerrar avisos críticos.
- Sharp pasó a 0.35.4.
- Se añadieron HSTS, bloqueo de iframes, `nosniff`, política de referencia y permisos
  explícitos de cámara y geolocalización.
- Las contraseñas nuevas requieren al menos ocho caracteres en restablecimiento, cambio y
  creación de usuarios de organización, validado en interfaz y servidor.

## Controles comprobados

- bcrypt para contraseñas; tokens de recuperación como hash y con vencimiento.
- Respuesta neutra de recuperación para no revelar cuentas.
- Cambio de organización validado contra acceso vigente.
- Rutas de negocio con organización efectiva y guards de permisos.
- Upload autenticado, aislado, con límite, MIME permitido, nombre aleatorio y recodificación.
- Firmas de webhooks e importe/moneda persistidos comprobados antes de aceptar pagos.
- Demo bloqueada en producción y pruebas protegidas contra bases no desechables.

## Hallazgos abiertos

| Prioridad | Hallazgo | Acción |
|---|---|---|
| Alta | Login y recuperación no comparten limitador distribuido. | Limitar en proxy o Redis por IP e identificador. |
| Alta | Quedan avisos transitivos cuyo arreglo automático exige cambios incompatibles. | Probar actualización coordinada de Next/Prisma en rama separada. |
| Media | No hay CSP global. | Activar primero Report-Only, medir y endurecer. |
| Media | Uploads viven en disco público local. | Usar objetos, escaneo y URLs firmadas si son privados. |
| Media | Rotación y restauración no están ensayadas. | Ejecutar simulacro en staging. |
| Baja | No se detectan contraseñas filtradas. | Añadir comprobación local o externa. |

## Dependencias

Después de la corrección, `npm audit` ya no muestra el aviso crítico directo de Next.
Permanecen siete avisos transitivos (cuatro altos y tres moderados). No se ejecutó
`npm audit fix --force` porque propone bajar Prisma, subir Next de versión mayor o bajar
ExcelJS, con riesgo para migraciones, framework y exportaciones.

## Validación externa pendiente

- DAST autenticado y autorización horizontal entre dos organizaciones;
- replay y rotación de secretos de pasarelas;
- cargas malformadas, antivirus y límites reales;
- TLS, proxy, cookies y cabeceras desde el dominio final;
- restauración de respaldo y respuesta a incidentes.
