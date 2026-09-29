# API Core v0.2.0

## Salud

- `GET /api/health`

## Dashboard

- `GET /api/dashboard?state=NL`

## Red

- `GET /api/states`
- `GET /api/identities`
- `GET /api/identities?state=NL`

## Inteligencia

- `GET /api/topics?state=NL`
- `GET /api/profiles?state=NL`
- `GET /api/watches?state=NL`
- `GET /api/sources?state=NL`

## Editorial

- `GET /api/stories`
- `GET /api/stories?state=NL`
- `GET /api/stories/:publicId`
- `POST /api/stories`
- `PATCH /api/stories/:publicId/status`

Ejemplo para crear Story:

```json
{
  "stateCode": "NL",
  "title": "Título de la historia",
  "summary": "Resumen inicial",
  "priority": "HIGH",
  "status": "DISCOVERED",
  "confidence": "MEDIUM"
}
```

## Operación

- `GET /api/runs?state=NL`
- `GET /api/publications`

Esta API es el núcleo que después consumirán la interfaz web, Telegram Operator y los publicadores de Meta/Google Drive.
