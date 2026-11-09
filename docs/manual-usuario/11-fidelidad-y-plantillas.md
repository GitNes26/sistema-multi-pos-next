# 11. Fidelidad, paquetes de renta y plantillas de arranque

> Para dueños y administradores. Disponible según tu plan y tu tipo de negocio.

## 11.1 Plantillas de arranque (Ajustes → Plantillas)

Si tienes un autolavado, una barbería o un negocio de renta, una plantilla deja listo lo básico con un clic:

| Plantilla | Qué crea |
| --- | --- |
| **Autolavado** | 3 bahías, 3 servicios de ejemplo, el flujo *Recibido → Lavando → Secado → Listo* (avisa al cliente cuando está listo) y «cada 5 lavados, el siguiente gratis». |
| **Barbería** | 3 sillas, servicios de corte y barba, y «cada 5 servicios, el siguiente gratis». |
| **Renta de equipo** | Depósito sugerido, cargo por día de retraso y minutos de gracia. |

- Solo crea lo que **falta**: si la aplicas otra vez no duplica nada ni cambia lo que ya editaste.
- Todo se puede cambiar o borrar después (precios, nombres, bahías…).
- La plantilla aparece disponible solo si coincide con el tipo de negocio de tu empresa.

## 11.2 Programas de fidelidad (Promociones → Fidelidad)

Premia a tus clientes frecuentes. Eliges una **opción ya preparada** y la ajustas a tu gusto:

- **Tarjeta de visitas** — cada *N* compras con tus servicios, el cliente gana un premio (gratis o con un porcentaje de descuento).
- **Paquete prepagado** — el cliente paga por adelantado varios servicios (por ejemplo, 5 lavados) y los va usando.
- **Membresía** — el cliente paga una cuota cada periodo (por ejemplo, cada mes) y recibe servicios que se renuevan. Ver 11.5.

**Cómo configurarlo:** elige la opción → cambia el nombre, las visitas necesarias (o los servicios del paquete), a qué productos aplica y qué parte del servicio cubre cada premio (100 % = gratis) → *Activar*.

**Para los paquetes** crea antes en el catálogo un producto con el precio del paquete (por ejemplo «Paquete 5 lavados»). Al venderlo en el POS, el cliente recibe sus créditos.

**Cómo se usa en la caja:** elige al cliente en el ticket → *Descuentos y cupones* → *Recompensas del cliente* → *Canjear*. Cada crédito cubre un servicio (el más barato elegible del ticket). El sistema vuelve a comprobar el crédito al cobrar.

**El cliente** ve sus créditos y el avance de su tarjeta en el portal, en la sección de puntos.

Notas:
- Pausar un programa no borra los créditos que ya tienen tus clientes.
- Los créditos no caducan y una devolución de venta no los revierte.

## 11.3 Paquetes de renta

En *Reservaciones → Nueva reservación* puedes agregar un **paquete** (un combo cuyos artículos son todos rentables). Se suman sus artículos a la renta con el precio del paquete; el ticket muestra los artículos y el descuento del paquete.

## 11.4 Citas sin preferencia de personal

Al agendar, el campo **Personal** es opcional. Si el cliente no pide a nadie, la cita queda *por asignar* (columna propia en la agenda) y desde su detalle eliges quién la atiende; el sistema comprueba que esa persona preste el servicio y esté libre. En negocios con sillas o bahías puedes ver la agenda **por lugar**.

Los clientes también pueden agendar desde el portal (**Mis citas**): eligen servicio, persona y lugar si quieren, y un horario libre.

## 11.5 Membresías

Es opcional: solo existe si tú la activas en *Promociones → Fidelidad → Agregar programa → Membresía*. Todo es configurable:

- **Cuota:** el producto del catálogo que se cobra (por ejemplo «Membresía mensual $400»). Cada vez que se cobra a un cliente, se da de alta o se renueva su periodo.
- **Servicios por periodo**, **días de cada periodo** (30 = mensual, 7 = semanal…) y **qué parte cubre** cada servicio (100 % = gratis).
- **A qué servicios aplica.**
- **Acumular o no:** si los servicios sin usar pasan al siguiente periodo (solo si renueva antes de vencer).
- **Aviso antes de vencer:** cuántos días antes recibe el cliente un aviso en su portal.
- **Condiciones y políticas:** el texto que el cliente ve junto a su membresía.

**El cliente ve en su portal (Puntos):** si su membresía está vigente o vencida, la fecha de vencimiento y los días que faltan, cuántos servicios le quedan, qué incluye por periodo, la cuota, a qué aplica, si se acumulan y tus condiciones. En su ticket aparece «vigente hasta … · N servicios».

**En caja:** al elegir al cliente, *Descuentos y cupones → Recompensas del cliente* muestra sus servicios y la vigencia. Si la membresía venció, no se puede canjear hasta que pague la cuota otra vez.

## 11.6 Garantías de servicio

También son opcionales (*Promociones → Garantías*). Por ejemplo, en un autolavado: «si llueve el mismo día, repite el lavado exterior sin costo presentando tu ticket». Tú defines:

- **Plazo en horas** y si es **solo el mismo día**.
- **Qué parte cubre** (100 % = sin costo, 50 % = a mitad de precio).
- **Qué servicios tienen la garantía** y **qué se puede repetir** (por ejemplo, solo el lavado exterior).
- **La leyenda del ticket** (si la dejas vacía se arma sola con tus condiciones).

Mientras una garantía esté activa, el ticket de los servicios que cubre lleva la leyenda, para que el cliente lo sepa. Si la pausas, deja de aparecer.

**Canjearla en caja:** *Descuentos y cupones → Garantía de servicio*, escribe el número del ticket original (físico o el que el cliente muestra en su portal) y *Aplicar*. El sistema comprueba plazo, servicio cubierto y que no se haya usado; cada ticket usa cada garantía una sola vez.

**Desde el portal:** el cliente ve sus garantías vigentes y puede pedirla; queda registrada y la canjea en el negocio con su ticket.

## 11.7 Quién puede hacer qué (roles y permisos)

| Permiso | Qué permite | Quién lo tiene por defecto |
| --- | --- | --- |
| Ver / configurar fidelidad y membresías | Abrir *Fidelidad* y crear o cambiar programas | Propietario, Admin, Gerente |
| Ver / configurar garantías de servicio | Abrir *Garantías* y crear o cambiar reglas | Propietario, Admin, Gerente |
| Canjear recompensas y servicios de membresía en caja | Usar «Recompensas del cliente» al cobrar | Además: Cajero, Agente de atención, Trabajador completo |
| Aplicar garantías de servicio en caja | Usar «Garantía de servicio» al cobrar | Además: Cajero, Agente de atención, Trabajador completo |
| Plantillas de arranque | Ajustes → Plantillas | Quien tenga permiso de Ajustes |

Puedes cambiarlo en *Usuarios y roles*. Los permisos siempre se combinan con tu plan: si tu plan no incluye una sección, nadie la ve, ni siquiera el propietario.

Al crear tu empresa, el asistente te ofrece (opcional) aplicar la plantilla de tu tipo de negocio.
