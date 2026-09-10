# Cron de recordatorios de crédito en Dokploy

El endpoint que envía los recordatorios ya existe en el sistema:
`GET /api/cron/credit-reminders`. Lo que falta es **programarlo para que se
ejecute una vez al día**. Esta guía cubre los dos caminos posibles en Dokploy.

> Requisito previo: define `CRON_SECRET` en las variables de entorno del proyecto
> (Proyecto → tu app → Advanced → Environment). Ejemplo: `openssl rand -hex 24`.
> Con esa variable puesta, el endpoint rechaza cualquier petición sin la cabecera
> `Authorization: Bearer <CRON_SECRET>`; sin la variable, acepta peticiones sin
> autenticar (solo para pruebas locales).

---

## Opción A — UI de Dokploy: Schedule Jobs (recomendada)

Dokploy trae un programador de tareas con logs de cada ejecución: un trabajo tipo
**Application Job** ejecuta un comando dentro del contenedor de tu app usando
`docker exec`. Como el comando corre **dentro del contenedor**, puede llamarse a sí
mismo por localhost — no necesita salir a internet.

1. Abre tu **Proyecto** en Dokploy → entra a tu **Application** (la del sistema).
2. Pestaña **Advanced** → sección **Schedule Jobs** → botón **Create Schedule Job**.
3. Llena el formulario:
   - **Name**: `recordatorios-credito`
   - **Type**: **Application Job** (corre dentro del contenedor de la app)
   - **Schedule (cron)**: `30 7 * * *` — todos los días a las **7:30 AM** (hora del servidor).
     Ajusta la hora a tu zona (ej. `30 7 * * *` = 07:30; `0 6 * * *` = 06:00).
   - **Command**:
     ```bash
     wget -qO- --header="Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/credit-reminders
     ```
     - `wget -qO-` imprime la respuesta en el log de la ejecución.
     - `${CRON_SECRET}` se expande dentro del contenedor porque ya la definiste en
       las variables de entorno de la app.
     - `http://localhost:3000` es la URL interna de Next.js; si cambiaste el
       `PORT`, usa ese puerto.
4. **Create** y listo. Cada ejecución queda registrada con su log — úsalo para
   confirmar que responde `"ok": true`.

> Si tu app corre en **Docker Compose** en vez de Application suelta, crea el job
> como **Compose Job** apuntando al servicio web; el comando es el mismo.

---

## Opción B — Cron externo (cualquier servidor / cron-job.org)

Si prefieres no usar la UI (o compartes el schedule entre varias instancias),
programa un `curl` diario que llame al dominio público:

```bash
curl -sS -X GET "https://tu-dominio.com/api/cron/credit-reminders" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

En un servidor Linux (`crontab -e`), todos los días a las 7:30:

```
30 7 * * * curl -sS -X GET "https://tu-dominio.com/api/cron/credit-reminders" -H "Authorization: Bearer TU_CRON_SECRET" >> /var/log/cron-reminders.log 2>&1
```

También funciona con servicios gratuitos tipo cron-job.org / EasyCron: crea un job
GET a la URL con la cabecera `Authorization: Bearer TU_CRON_SECRET` y schedule
`0 7 * * *` (o la hora que prefieras).

---

## Cómo saber que funcionó

1. En Dokploy (Opción A): pestaña del job → **Logs** de la última ejecución. Debe
   terminar con `"ok":true` y conteos de `reminders`/`overdue`.
2. Forza una prueba manual: usa el botón **Run** del job en la UI, o ejecuta el
   mismo comando con `docker exec -it <contenedor> sh` pegando el `wget`.
3. Verifica en el sistema: los clientes con crédito próximo a vencer reciben la
   notificación push (requiere el setup de
   [`PUSH-NOTIFICACIONES-DOKPLOY.md`](./PUSH-NOTIFICACIONES-DOKPLOY.md)) y aparece
   en campana 🔔 del portal.

## Diagnóstico rápido

| Síntoma | Causa probable |
|---|---|
| `401 Unauthorized` en el log | `CRON_SECRET` del comando ≠ variable de entorno de la app |
| Conexión rechazada a `localhost:3000` | El contenedor escucha otro puerto (revisa `PORT`) |
| `"ok":false` con error de DB | `DATABASE_URL` no apunta a la base del mismo entorno |
| Job no se ejecuta | Contenedor de la app detenido en el momento del schedule |
