# AI Media Network v1.9.4 — AI Brand Studio

## Objetivo
Construir una marca consistente por identidad y convertirla en plantillas que el motor **real** de publicación use automáticamente al crear piezas para ese medio.

## Flujo
1. **Red > Identidades de medios > Identidad gráfica IA**.
2. Generar propuesta cromática con OpenAI (o una propuesta conservadora si no hay API).
3. Revisar el icono de marca, ajustar colores y pulsar **Previsualizar y validar los 5 formatos**.
4. Visualizar pruebas en 4:5, 9:16 y 16:9; aprobar expresamente.
5. Activar: el backend vuelve a generar muestras completas y verifica dimensiones, contraste y ajuste de texto antes de guardar en una **transacción**. Si falla una prueba no se desactivan las plantillas anteriores.
6. Las nuevas plantillas se marcan READY y activas para su identidad; las anteriores quedan registradas pero inactivas. Las publicaciones nuevas que usan esos formatos seleccionan automáticamente las plantillas activas.

## Entregables
- Foto de perfil PNG 1024x1024 y portada 1640x624 desde enlaces de cada identidad.
- Dos plantillas feed 4:5 (FACEBOOK_POST, INSTAGRAM_POST).
- Dos plantillas story 9:16 (FACEBOOK_STORY, INSTAGRAM_STORY).
- Una plantilla editorial horizontal 16:9 (EDITORIAL_GRAPHIC).
- Paleta, reglas visuales y versión en VisualDNA, con datos persistidos en PostgreSQL.
- No se alteran las imágenes de noticias reales. La foto ilustrativa de la vista previa no se utiliza para publicaciones.

## Barreras de calidad
- Dibujo de plantillas mediante SVG/Sharp y mapeos de texto/foto reproducibles. No se generan plantillas compuestas que no puedan editarse ni reutilizarse.
- Ajuste de tamaño tipográfico conservando el texto completo; si una pieza excede los límites se **rechaza sin recortar contenido**.
- Verificación de las dimensiones y dos titulares de prueba por formato antes de activación, más una vista previa de prueba en la interfaz.
- Control de contraste esencial y prevención de nombres de medios truncados.
- Activación atómica en PostgreSQL; no se modifican los medios existentes hasta aprobación.
- Es una propuesta de marca basada en nombre, colores y orientación indicada, no una lectura automática de la identidad real de Facebook.

## Fuera de alcance en esta entrega
- No se crean archivos PSD nuevos ni logotipos ilustrativos generados por un modelo de imagen. El logo se construye como marca tipográfica reproducible.
- No se modifica el flujo de Reels/TikTok, ni se promete una plantilla 1:1 automatizada para esos tipos.
- La publicación continua requiere fotografía real utilizable y contenido verificable; si faltan datos o no cabe el texto, el sistema evita la publicación en lugar de inventar o cortar contenido.

## Pruebas y despliegue
- `/api/health` → `version: "1.9.4"`.
- `npm run check` para sintaxis; `npm run test:brand` para validar cinco formatos, dimensiones y rechazo de titulares desbordados.
- Ejecutar pruebas de integración en Railway de staging antes de sustituir producción. Respaldar PostgreSQL y validar una imagen real por formato en una identidad de prueba.
- El panel administrativo heredado aún no tiene autenticación; no debe exponerse a terceros hasta implementar controles de acceso.
- En el entorno del asistente se comprobó la sintaxis, pero no se pudieron ejecutar pruebas renderizadas locales por bloqueo de red hacia GitHub. Hay un flujo CI incluido para ejecutarlas en GitHub.
