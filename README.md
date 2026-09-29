# AI Media Network v1.0.2

Plataforma web integral para operar una red de medios digitales con inteligencia editorial, descubrimiento de historias, generación multiformato y distribución.

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
