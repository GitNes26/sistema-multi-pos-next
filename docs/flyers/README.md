# Flyers

Fuente editable: los `.html` de esta carpeta (los `.pdf` se generan imprimiendo desde Chrome: Carta, sin márgenes, con gráficos de fondo).

Para mostrarlos en producción se sirven copiados en `public/p/<token-aleatorio>/` (ruta no listada, sin enlaces desde la app y con `X-Robots-Tag: noindex`, ver `next.config.ts`). Al cambiar los flyers, vuelve a copiar los `.html` y `.pdf` a esa carpeta; el `index.html` de allí es el menú con los dos flyers.
