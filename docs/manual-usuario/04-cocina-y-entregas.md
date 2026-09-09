# 4. Pantalla de Cocina y Entregas (KDS)

La pantalla de cocina (`/kds`, cocina en el menú del panel) es la que se instala en la
tablet o monitor de la cocina y del área de entregas. Solo existe en restaurantes e híbridos.

## 4.1 Lo que ve la cocina

Cada **comanda** aparece como tarjeta con: mesa, hora, productos con sus **notas**
("sin cebolla") y el tiempo transcurrido. El color ayuda a priorizar: cuanto más tiempo
pasa, más "urgente" se ve.

Estados de una comanda:

1. **Nueva** — acaba de llegar del mesero o de la app.
2. **Preparando** — alguien tocó "Empezar".
3. **Lista** — tocó "Lista": la tarjeta avisa al mesero y al cliente en la app.

Acciones: toca la tarjeta para cambiar de estado. Las listas se mueven a la sección de
terminadas del día.

[IMAGEN: pantalla de cocina con tarjetas de comandas]

## 4.2 Lo que ve el repartidor (tablero Entregas)

En la misma pantalla está la sección **Entregas**: los pedidos a domicilio listos para
salir o en camino.

1. El repartidor ve su cola de pedidos: dirección, monto y método de pago (si es efectivo
   contra entrega, lo verá con claridad).
2. Al salir con el pedido, toca **En camino**: la app del cliente empieza a mostrar el
   rastreo en vivo.
3. Su **ubicación GPS** se comparte solo mientras hay pedidos en camino (el navegador
   pedirá permiso la primera vez).
4. Al llegar, toca **Entregado** (si el pedido exige confirmación, el cliente muestra su
   **código QR o PIN** y se captura para cerrar la entrega).

**Eventos típicos:** cocina marca listo y la entrega "se enciende", cliente cancela en
camino (el pedido desaparece con aviso), pago en efectivo al entregar.
