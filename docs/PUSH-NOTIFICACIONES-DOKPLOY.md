# Notificaciones push en producción (Dockploy) — Checklist

Las notificaciones push usan Web Push: el **navegador** del cliente se suscribe a un
"canal" (suscripción), y tu servidor envía el mensaje usando las llaves **VAPID**.
Para que funcionen en el servidor hacen falta 4 cosas. El código ya está listo
(`public/sw.js`, `src/hooks/use-push-subscription.ts`, `src/lib/notifications/push.ts`,
`src/app/api/portal/push/subscribe/route.ts`); lo que falta es configuración.

---

## 1. Generar las llaves VAPID (una sola vez)

En tu máquina local, dentro del proyecto:

```bash
npx web-push generate-vapid-keys
```

Te devuelve un par público/privado. Guárdalos:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = la llave pública
- `VAPID_PRIVATE_KEY` = la llave privada (¡nunca la compartas!)
- `VAPID_SUBJECT` = `mailto:tu-correo@dominio.com`

---

## 2. Configurarlas en Dockploy (Proyecto → Settings → Variables)

### Variables de entorno (runtime)

| Variable | Valor |
|---|---|
| `VAPID_PRIVATE_KEY` | la privada |
| `VAPID_SUBJECT` | `mailto:...` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | la pública |
| `NEXTAUTH_URL` | `https://tu-dominio.com` (¡la URL HTTPS real, no localhost!) |
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.com` |
| `NEXTAUTH_SECRET` | un secreto largo (`openssl rand -base64 32`) |
| `DATABASE_URL` | apunta a tu base administrada de Dockploy |
| `CRON_SECRET` | (opcional) para el cron de recordatorios, ver paso 5 |

### Build args (¡esto era lo que faltaba!)

Las variables `NEXT_PUBLIC_*` se **embeben en el código del navegador al compilar**.
Si la llave pública no está disponible durante el build, el cliente compila sin ella
y **el navegador nunca pide permiso** — las notificaciones parecen "no funcionar" sin
ningún error visible.

> El Dockerfile del proyecto **ya fue corregido** para aceptar
> `NEXT_PUBLIC_VAPID_PUBLIC_KEY` como build arg. En Dockploy:
>
> - **Build args**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = la pública
>   y `NEXT_PUBLIC_APP_URL` = `https://tu-dominio.com`
> - Luego **redeploy** (un simple redeploy con variables no recompila el cliente;
>   debe reconstruirse la imagen).

---

## 3. HTTPS (obligatorio)

Web Push solo funciona sobre **HTTPS** (o `localhost`). Dockploy emite certificados
SSL automáticamente con Traefik, pero verifica:

1. El dominio apunta al servidor (DNS) y está agregado en **Custom domains**.
2. Abre `https://tu-dominio.com` (no `http://`).
3. Confirma que el service worker responda: visita
   `https://tu-dominio.com/sw.js` — debe mostrar JavaScript, no un 404.

---

## 4. Probar de punta a punta

1. Entra al **portal de cliente** (`https://tu-dominio.com/portal`) con una cuenta de cliente.
2. Toca el botón de **campana** (arriba) → "Activar notificaciones push" → acepta el permiso del navegador.
3. Dispara una notificación (ej. que el cliente tenga un crédito próximo a vencer o haz una venta con pedido web).
4. El mensaje debe aparecer aunque la pestaña esté cerrada.

> Si la campana muestra "Activar" pero al tocarla no pide permiso: casi siempre es la
> llave pública ausente del build (paso 2) o una pestaña abierta en `http://`.

---

## 5. Cron de recordatorios (créditos por vencer)

Los recordatorios de crédito se disparan con un cron. El endpoint existe:
`GET /api/cron/credit-reminders`. En Dockploy: **Proyecto → Settings → Cron Jobs**
(o cualquier cron externo), diario:

```bash
curl -X GET "https://tu-dominio.com/api/cron/credit-reminders" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

Define `CRON_SECRET` en las variables del proyecto para que el endpoint exija esa
cabecera (sin `CRON_SECRET`, el endpoint acepta peticiones sin autenticar).

---

## Diagnóstico rápido

| Síntoma | Causa probable |
|---|---|
| La campana no aparece o no pide permiso | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ausente del **build** → redeploy reconstruyendo |
| "Permiso denegado" | El usuario bloqueó notificaciones en el navegador (ajustes del sitio) |
| La campana se activa pero no llegan mensajes | `VAPID_PRIVATE_KEY` no coincide con la pública, o `NEXTAUTH_URL` apunta a localhost |
| Error al suscribir en la consola (`fetch /api/portal/push/subscribe`) | URL de la app incorrecta o sesión expirada |