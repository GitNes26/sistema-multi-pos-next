# Preparación de staging y validaciones externas

Este procedimiento deja staging separado de desarrollo, demos y producción. No reutiliza ninguna de las bases `multi_pos_test_*` ni modifica la base local existente.

## Preparación

1. Crear una base MySQL nueva, con un nombre que no empiece por `multi_pos_test_`.
2. Copiar `.env.example` a un archivo seguro de staging y configurar:
   - `NODE_ENV=production`
   - `DATABASE_URL` apuntando exclusivamente a la base de staging.
   - `NEXTAUTH_URL`, `NEXTAUTH_SECRET` y `NEXT_PUBLIC_APP_URL` propios.
   - `SEED_DEMO=false` para la instalación mínima.
3. Ejecutar `npx prisma migrate deploy`.
4. Ejecutar `npm run db:seed` y completar onboarding hasta la primera operación.
5. Para una demo separada, usar otra base y `SEED_DEMO=true`; nunca compartir credenciales entre ambas.

## Regresión previa

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:prepare
npm run test:serve
npm run test:integration
npm run test:e2e
```

La suite de pruebas debe apuntar a una base explícitamente identificada como prueba. Para staging se ejecutan recorridos manuales con cuentas creadas en esa instalación, sin reutilizar las cuentas demo.

## Validación de hardware

- Imprimir ticket de venta, devolución, cierre de caja y reservación.
- Escanear un código válido, uno inexistente y repetir el escaneo.
- Usar teclado virtual y orientación vertical/horizontal en tablet.
- Verificar objetivos táctiles, foco, botón Atrás y conservación del formulario.
- Registrar dispositivo, navegador, resolución, resultado y evidencia por recorrido.

## Validación de pagos sandbox

- Configurar claves de prueba y endpoints de webhook de staging.
- Probar pago aprobado, rechazado, expirado, reintento y evento duplicado.
- Confirmar firma, importe, moneda, `paidAt`, historial y estado final.
- Probar devolución y reversa desde el proveedor.
- Confirmar que ningún mensaje o cobro llega a clientes reales.

## Criterio de salida

Staging se considera listo cuando migraciones, seed mínimo, regresión automatizada, hardware y sandbox pasan sin P0/P1; cualquier bloqueo se registra con evidencia y no se presenta como validado.
