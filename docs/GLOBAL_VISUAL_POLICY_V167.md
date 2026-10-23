# v1.6.7 - Politica editorial visual global

Se aplica en servidor a todas las identidades para FACEBOOK_POST, INSTAGRAM_POST, FACEBOOK_STORY, INSTAGRAM_STORY y EDITORIAL_GRAPHIC.

- El titular y copy originales se conservan. metadata.visualCaption es el caption visual y metadata.visualSummary es la bajada.
- Con IA configurada se solicita un caption factual de maximo 15 palabras. Sin IA se usa un resumen conservador sujeto a revision.
- Las fotografias deben provenir de fuentes reales.
- El renderizado rechaza texto desbordado en lugar de agregar puntos suspensivos.
- Los endpoints de aprobacion y publicacion verifican caption, contexto, fuente y foto real renderizada.
- La politica se configura actualmente en services/visual-policy.js; la pantalla administrativa editable y limites por plantilla son trabajo pendiente.
- Las piezas existentes deben regenerarse antes de aprobarse; las publicaciones ya enviadas no se corrigen retroactivamente.
