# API v1

## Sistema
- `GET /api/health`
- `GET /api/bootstrap?state=NL`
- `GET /api/integrations`
- `GET /api/settings`

## Red
- `GET /api/states`
- `GET|POST /api/identities`
- `PATCH /api/identities/:id`
- `PUT /api/identities/:id/dna`

## Inteligencia
- `GET|POST|PATCH|DELETE /api/topics`
- `GET|POST|PATCH|DELETE /api/profiles`
- `GET|POST|PATCH|DELETE /api/watches`
- `GET|POST|PATCH|DELETE /api/sources`
- `GET /api/radar`

## Descubrimiento
- `POST /api/discovery/run`
- `GET /api/discovery/candidates`
- `POST /api/discovery/candidates/:id/promote`
- `POST /api/discovery/candidates/:id/discard`
- `GET /api/runs`

## Historias
- `GET /api/stories`
- `GET /api/stories/:publicId`
- `POST /api/stories`
- `PATCH /api/stories/:publicId`
- `PATCH /api/stories/:publicId/status`
- `POST /api/stories/:publicId/analyze`

## Contenido
- `GET /api/content-pieces`
- `POST /api/stories/:publicId/generate`
- `PATCH /api/content-pieces/:id`
- `POST /api/content-pieces/:id/approve`
- `POST /api/content-pieces/:id/image`
- `POST /api/content-pieces/:id/drive`

## Distribución
- `GET|POST /api/channels`
- `PATCH /api/channels/:id`
- `POST /api/content-pieces/:id/publish`
- `POST /api/content-pieces/:id/schedule`
- `GET /api/publications`

## Operación
- `GET /api/activity`
- `GET /api/errors`
- `POST /api/errors/:id/resolve`


### Visual DNA
`PUT /api/identities/:id/visual-dna` persists the visual identity used by the Visual Engine.
