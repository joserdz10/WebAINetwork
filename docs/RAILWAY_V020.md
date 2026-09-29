# Despliegue v0.2.0 en Railway

## 1. Actualizar GitHub

Copia el contenido de `ai-media-network-web-v0.2.0` dentro de tu carpeta local `WebAINetwork`, reemplaza los archivos existentes y usa GitHub Desktop:

- Summary: `AI Media Network Web v0.2.0 - API y PostgreSQL`
- Commit to main
- Push origin

Railway hará un deployment nuevo automáticamente.

## 2. Agregar PostgreSQL

En el proyecto de Railway donde ya vive `WebAINetwork`:

- New / Add Service
- Database
- PostgreSQL

Espera a que el servicio quede disponible.

## 3. Conectar DATABASE_URL

Abre el servicio web `WebAINetwork`:

- Variables
- New Variable
- Add Reference / Reference Variable
- Selecciona el servicio PostgreSQL
- Selecciona `DATABASE_URL`

No copies usuario, contraseña y host manualmente si Railway ofrece la referencia.

## 4. Redeploy

Al guardar la variable, Railway normalmente crea un redeploy. Si no sucede, usa Deploy > Redeploy.

Durante el arranque, la aplicación:

1. genera el cliente Prisma durante build;
2. detecta `DATABASE_URL`;
3. sincroniza el esquema con `prisma db push`;
4. crea datos iniciales si la tabla Country está vacía;
5. inicia la API y la interfaz web.

## 5. Comprobar

Abre:

`https://TU-DOMINIO/api/health`

Debe devolver aproximadamente:

```json
{
  "ok": true,
  "version": "0.2.0",
  "databaseConfigured": true,
  "databaseReady": true
}
```

Después vuelve a la raíz del dominio. El Dashboard tomará sus KPIs e historias desde PostgreSQL.
