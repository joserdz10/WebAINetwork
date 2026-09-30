# Railway — AI Media Network v1.0

## Requeridas

- `DATABASE_URL`: referencia a PostgreSQL de Railway.

## IA

- `OPENAI_API_KEY`: activa Story Intelligence, generación de piezas e imagen.
- `OPENAI_MODEL`: modelo de texto. Si se omite, el código usa `gpt-5.6`.
- `OPENAI_IMAGE_MODEL`: modelo de imagen. Si se omite, usa `gpt-image-2`.

## Meta

- `META_ACCESS_TOKEN`: token válido de Meta.
- `META_API_VERSION`: versión Graph API, opcional.

Además, en **Canales** debes capturar `externalAccountId` de cada Página de Facebook o cuenta profesional de Instagram.

## Google Drive

- `GOOGLE_DRIVE_ACCESS_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID` (opcional)

Para producción conviene sustituir el access token temporal por un flujo OAuth con refresh token o una integración administrada.

## Telegram

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID` (opcional para publicación)
- `TELEGRAM_WEBHOOK_SECRET` (opcional para Operator)

Webhook del Operator:

```text
POST https://TU-DOMINIO/api/telegram/webhook/TELEGRAM_WEBHOOK_SECRET
```

Comandos incluidos en el webhook: `/inbox`, `/story <id>`, `/ready`, `/estado_actual`, `/whoami`, `/ayuda`.

## Automatización opcional

- `AUTO_DISCOVERY_INTERVAL_MINUTES=30`
- `AUTO_DISCOVERY_STATE=NL`
- `AUTO_DISCOVERY_HOURS=6`

Las publicaciones programadas se revisan cada minuto.

## Base de datos

- `AUTO_DB_PUSH=true` por defecto.
- `SEED_ON_EMPTY=true` por defecto.

## Verificación

Abre:

```text
/api/health
```

Debe reportar `databaseReady: true` y el estado de IA, Meta, Drive y Telegram.


## Social Connections Manager

Configura una sola vez `SOCIAL_CREDENTIALS_KEY` con un secreto largo y aleatorio. Las páginas de Facebook e Instagram se administran después desde **Sistema -> Integraciones**. Si Railway no proporciona `RAILWAY_PUBLIC_DOMAIN`, define también `PUBLIC_BASE_URL` con el dominio público de la aplicación.
