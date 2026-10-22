# AI Media Network v1.6.6 — limpieza editorial

- Elimina prefijos de navegación pegados a titulares, por ejemplo `GlobalDeclaran` → `Declaran`.
- Limpia títulos y extractos de RSS/HTML, la promoción a historias y los datos de piezas al generarlas.
- Al regenerar una imagen de una pieza anterior, limpia titular y bajada en el render sin modificar el expediente histórico.
- Conserva intactos titulares legítimos como `Global anuncia nuevas medidas`.
- No determina automáticamente que una noticia sea de Nuevo León: requiere validación editorial de su pertinencia geográfica.
- Para actualizar texto ya persistido en la tarjeta de Estudio, genera una nueva versión de la pieza; `Regenerar imagen` solo actualiza el PNG.
