# Noticias por estado — v1.6.4

- Nueva vista Noticias: seleccionar estado, periodo, buscar y convertir noticia en historia.
- Radar de candidatos separado de la bandeja de noticias.
- Endpoint GET /api/news?state=NL&hours=24, incluye candidatos de baja relevancia.
- Diagnóstico por fuente en summary.sourceDiagnostics de cada DiscoveryRun.
- No se generan noticias inventadas: solo resultados de fuentes configuradas.
- Las noticias duplicadas en los últimos 7 días siguen excluidas.
- La acción Generar contenido crea primero una historia y abre su expediente; desde allí se elige identidad y formato en Estudio de contenido.
- La ejecución no garantiza noticias nuevas si las fuentes no tienen artículos nuevos o están bloqueadas.
