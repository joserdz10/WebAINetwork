# AI Media Network v1.9.5 - Logotipo manual

En Red > Identidades de medios > Identidad gráfica IA, ahora puedes subir un PNG, JPG o WebP de hasta 4 MB (128 a 4096 píxeles por lado).

## Funcionamiento
- El logo se normaliza a PNG con canal alfa en el servidor (Sharp), manteniendo las proporciones.
- En la vista previa se integra en el icono, la portada y las cabeceras de las cinco plantillas.
- Los diseños gráficos y las noticias siguen usando la paleta aprobada, imágenes reales verificables y ajuste de texto sin truncamiento.
- Si no subes un nuevo logo, se conserva el que ya se aprobó. Si ninguno existe, se mantiene el monograma anterior.
- El logo y las plantillas se guardan dentro de una única transacción después de renderizar las cinco plantillas en sus dimensiones reales. No se altera el diseño activo si falla una validación.

## Operación
1. Respaldar la base PostgreSQL y probar en staging (cambia el esquema Prisma: `brandLogoData` y `brandLogoMimeType`).
2. Desplegar v1.9.5 con `prisma db push` del proceso habitual.
3. Verificar `/api/health` versión `1.9.5`.
4. Identidades > Identidad gráfica IA > Generar > Cargar logo.
5. Previsualizar y validar los cinco formatos.
6. Aprobar y activar; revisar el perfil, portada y generar una noticia de prueba.

### Alcance y límites
- No cambia automáticamente la foto o portada de las páginas de Facebook: los PNG están disponibles para subirlos en Meta.
- No genera PSD editable, pero integra el logo al motor de plantillas persistentes.
- No modifica las publicaciones antiguas.
- La plataforma todavía requiere autenticación administrativa; no dar acceso a terceros sin implementar el control de accesos.
