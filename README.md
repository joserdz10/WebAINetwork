# AI Media Network v1.5.0

## Template Library universal

Todas las identidades actuales y futuras pueden administrar plantillas maestras PSD, base renderizable, mapeo de campos, vista previa de prueba, validación y activación. Norte En Alerta conserva NEA_FEED_4X5_V1 como plantilla canónica.

# AI Media Network v1.3.0

Plataforma web integral para operar una red de medios digitales con inteligencia editorial, descubrimiento de historias, generación multiformato y distribución.


## v1.3.0 — PSD Master + Template Library

- `NEA_FEED_4X5_V1` permanece como plantilla canónica activa de Norte En Alerta.
- Todas las identidades existentes y futuras tienen una Biblioteca de Plantillas.
- Se puede subir un PSD maestro de hasta 30 MB y conservarlo dentro de PostgreSQL.
- El sistema lee dimensiones y nombres de capas PSD cuando están disponibles.
- Convención recomendada para capas dinámicas: `PHOTO`, `CATEGORY`, `HEADLINE`, `SUMMARY`, `SOURCE`.
- Para render automático, la plantilla puede incluir una base PNG/JPG exportada desde el PSD con las capas dinámicas ocultas.
- El mapeo de campos puede revisarse y ajustarse desde la plataforma.
- Las plantillas se versionan, pueden activarse/desactivarse y el motor selecciona la plantilla activa por formato.
- El PSD se conserva como archivo maestro; el servidor no requiere Photoshop para renderizar publicaciones.

## Qué incluye

- Centro de Control nacional y por estado.
- 32 Cerebros Estatales preparados desde el modelo de datos.
- Identidades editoriales con ADN editorial.
- Temas, Perfiles, Monitoreos y Fuentes configurables.
- Descubrimiento real desde páginas web/RSS.
- Deduplicación y puntuación de relevancia.
- Bandeja de candidatos y promoción manual a Historia.
- Expediente de Historia con fuentes, resumen, contexto, datos clave, actores y riesgos editoriales.
- Story Intelligence con IA cuando `OPENAI_API_KEY` está configurada; fallback conservador cuando no lo está.
- Estudio de contenido para Facebook, Instagram, Stories, Reels, X, TikTok, artículo y gráfico editorial.
- Generación de imagen bajo demanda cuando está configurada la API de IA.
- Aprobación de piezas.
- Exportación a Google Drive.
- Publicación directa en Facebook e Instagram cuando Meta está configurado.
- Distribución a Telegram.
- Programación de publicaciones.
- Corridas automáticas opcionales de Descubrimiento.
- Historial de actividad y errores.
- API REST.
- PostgreSQL + Prisma.

## Arranque en Railway

1. Sube el contenido de esta carpeta a la raíz de tu repositorio GitHub.
2. Railway desplegará el servicio Node.js.
3. Agrega PostgreSQL al mismo proyecto.
4. Configura `DATABASE_URL` como referencia a PostgreSQL.
5. Railway ejecutará `npm run build` y `npm start`.
6. El servidor ejecuta `prisma db push` al iniciar, salvo que `AUTO_DB_PUSH=false`.
7. La semilla inicial se crea solo cuando no existe ningún país, salvo que `SEED_ON_EMPTY=false`.

Consulta `docs/RAILWAY_V1.md` para las variables.

## Flujo operativo

Fuentes → Descubrimiento → Candidatos → Historia → Análisis → Estudio de contenido → Aprobación → Publicación.

## Seguridad de secretos

Las credenciales no se almacenan en PostgreSQL ni en la interfaz. Deben vivir en Variables de Railway. `SocialAccount.credentialsRef` queda reservado para una futura bóveda de secretos.

## Nota sobre canales

Facebook, Instagram y Telegram tienen adaptadores de publicación incluidos. X y TikTok están modelados como canales y formatos de contenido, pero la publicación directa requiere registrar y configurar sus APIs/OAuth correspondientes antes de activarlos.


## Corrección v1.0.2
- Las imágenes generadas por OpenAI que llegan como base64 ya no se abren como `data:` en una pestaña nueva.
- La API sirve la imagen desde una ruta del mismo dominio: `/api/content-pieces/:id/image-file`.
- Se agrega vista previa de imagen dentro del Estudio de contenido y se evita `about:blank#blocked`.


## v1.1.0
- Corrige versionado real de `/api/health` y logs de arranque.
- Mantiene la ruta segura `/api/content-pieces/:id/image-file`.
- Hace visible la etiqueta Visual Engine 1.1.0 en Resultado visual.
- Fuerza recarga de frontend con cache busting 1.1.0.


## v1.1.0 — Visual DNA
Cada identidad ahora separa ADN Editorial y ADN Visual. El Visual Engine utiliza paleta, tipografía, composición, tratamiento fotográfico, overlays, ubicación de marca y reglas por formato para generar piezas coherentes con cada medio. Norte En Alerta incluye una configuración visual inicial editable desde Identidades → ADN editorial + visual.


## v1.3.0 — Template Library
- Añade plantillas gráficas bloqueadas por identidad.
- Registra `NEA_FEED_4X5_V1` para Norte En Alerta (1080×1350).
- La IA genera únicamente la fotografía fuente; el Template Engine aplica marca, titular, categoría, bajada y fuente.
- Añade el modelo `MediaTemplate` y la vista Plantillas dentro de Identidades.
- Norte En Alerta deja de depender de diseño generativo libre para feed 4:5.
