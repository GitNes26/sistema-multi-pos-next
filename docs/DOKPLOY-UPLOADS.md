# Archivos persistentes por proyecto en Dokploy

El contenedor monta el volumen compartido en `/app/public/uploads`, pero cada aplicación escribe dentro de una subcarpeta propia:

```text
/app/public/uploads/
├── multi-pos/
│   └── <organizationId>/
├── gestor-archivos/
└── rutas-camiones/
```

## Configuración de Multi-POS

En **Dokploy → Multi-POS → Environment**, configura:

```env
UPLOADS_DIR=/app/public/uploads
UPLOADS_PROJECT=multi-pos
```

El volumen debe montarse sobre el directorio base del contenedor:

```text
<volumen compartido> → /app/public/uploads
```

Usa un `UPLOADS_PROJECT` distinto en cada proyecto. Solo admite letras, números, guiones y guiones bajos. El contenedor crea la subcarpeta al arrancar y la API crea después una carpeta por organización.

Las URLs públicas no incluyen el nombre del proyecto: continúan usando `/api/media/<organizationId>/<archivo>`. El servidor agrega internamente la carpeta configurada, por lo que cambiar el almacenamiento no exige actualizar registros en la base de datos.

## Archivos existentes

Durante la transición, Multi-POS busca primero en `uploads/multi-pos/` y después en la estructura anterior `uploads/<organizationId>/`. Las cargas nuevas siempre se escriben dentro de `uploads/multi-pos/`.

Cuando hayas confirmado qué carpetas antiguas pertenecen a Multi-POS, puedes moverlas desde el administrador de archivos o terminal de Dokploy hacia `uploads/multi-pos/`. Haz un respaldo del volumen antes de moverlas. La aplicación no las mueve automáticamente porque el volumen puede contener archivos de otros proyectos.
