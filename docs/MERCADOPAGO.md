# Mercado Pago: Checkout Pro y Point

El sistema soporta dos recorridos independientes con una misma aplicación de Mercado Pago:

- **Checkout Pro:** pagos en línea del portal y abonos de crédito. Crea una preferencia por operación y redirige al `init_point` devuelto por Mercado Pago.
- **Point:** cobros presenciales iniciados desde el POS. Crea una `order` de tipo `point`, la envía a la terminal configurada y registra la venta únicamente después de confirmar el pago.

## Variables y configuración por empresa

Se aceptan `MERCADOPAGO_ACCESS_TOKEN` o `MP_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY` o `MP_PUBLIC_KEY`, y `MERCADOPAGO_WEBHOOK_SECRET` o `MP_WEBHOOK_SECRET`. Los valores guardados por empresa en **Ajustes → Pagos** tienen prioridad sobre las variables del servidor.

En cada empresa:

1. Selecciona **Mercado Pago** como pasarela.
2. Configura Access Token, clave pública y firma secreta del webhook.
3. Activa **Cobros presenciales con Point** si corresponde.
4. Consulta las terminales vinculadas y selecciona la que atenderá el POS.

## Webhook

En **Tus integraciones → Webhooks**, registra una URL HTTPS pública con este formato:

`https://TU_DOMINIO/api/payments/webhook/mercadopago?org=ID_DE_LA_EMPRESA`

Activa los eventos de pagos para Checkout Pro y de Orders/Point. Point no admite configurar `notification_url` al crear cada order; por eso su notificación debe registrarse en la aplicación.

## Pruebas

Las credenciales de prueba permiten validar Checkout Pro y consultar terminales sandbox. Para cerrar el recorrido Point se necesita que la cuenta de prueba tenga una terminal compatible vinculada. La venta del POS permanece sin registrar mientras la order está creada, en terminal, cancelada o expirada; solo `processed` o `approved` se aceptan como pago.

Nunca registres números de tarjeta en el sistema. Las tarjetas de prueba se introducen exclusivamente en las superficies de Mercado Pago.

Referencias oficiales:

- https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-preferences/create-payment-preference
- https://www.mercadopago.com.mx/developers/es/docs/mp-point/payment-processing
- https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks
