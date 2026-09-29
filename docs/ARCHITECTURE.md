# AI Media Network — Arquitectura v0.2.0

```text
                     WEB CONTROL CENTER
                            |
                         REST API
                            |
                 +----------+----------+
                 |                     |
             PostgreSQL             AI Core
                 |                  (siguiente fase)
                 |
       +---------+---------+
       |                   |
   Intelligence         Editorial
       |                   |
StateBrain            Story
MediaIdentity         ContentPiece
MediaDNA              Publication
Topic
Profile
Watch
Source
DiscoveryRun
```

## Principio principal

La web, Telegram y futuras integraciones no deben contener la lógica central. Todos deben consumir la misma API y el mismo modelo persistente.

## v0.2.0

La aplicación sigue desplegándose como un único servicio Node.js para simplificar el MVP. El servicio entrega los archivos web y expone `/api/*`. PostgreSQL es un servicio separado dentro del mismo proyecto Railway.

Cuando el producto requiera escalamiento independiente, la API podrá separarse del frontend sin cambiar el modelo de dominio.
