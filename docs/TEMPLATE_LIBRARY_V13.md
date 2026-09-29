# Template Library v1.3.0

## Objetivo
Separar el diseño aprobado del contenido variable. AI Media Network conserva un PSD maestro por plantilla y genera piezas sustituyendo campos dinámicos sin rediseñar la identidad.

## Norte En Alerta
`NEA_FEED_4X5_V1` permanece como plantilla canónica integrada al sistema. No requiere PSD para seguir funcionando.

## Plantillas nuevas
Desde `Identidades de medios > Plantillas` puede subirse un PSD para cualquier identidad actual o futura.

### Convención recomendada de capas PSD
- `PHOTO`
- `CATEGORY`
- `HEADLINE`
- `SUMMARY`
- `SOURCE`

El parser lee dimensiones y nombres/bounds de capa de PSD estándar (versión 1). PSB no está soportado.

## Archivo maestro vs base renderizable
El PSD se conserva como archivo maestro. Para render automático sin Photoshop, suba también un PNG/JPG base del mismo tamaño con las capas dinámicas ocultas. Los elementos fijos de marca deben permanecer visibles.

El Template Engine compone sobre esa base:
1. PHOTO en su caja.
2. CATEGORY.
3. HEADLINE.
4. SUMMARY.
5. SOURCE.

El mapeo puede editarse desde la plataforma en JSON.

## Estados
- `READY`: puede activarse y renderizar.
- `NEEDS_BASE_IMAGE`: PSD guardado, falta base PNG/JPG.
- `NEEDS_MAPPING`: falta PHOTO o HEADLINE en el mapeo.

## Persistencia
En v1.3.0 el PSD y la base renderizable se guardan en PostgreSQL. Esto permite usar Railway sin volumen persistente. Para una operación de gran escala se recomienda migrar estos binarios a object storage (S3/R2) y mantener solo URLs/metadatos en PostgreSQL.
