# AI Media Network Web v0.2.0

Primera versión del Control Center con persistencia real.

## Incluye

- Interfaz web completa en español.
- API REST integrada en el mismo servicio.
- PostgreSQL mediante Prisma.
- Modelo de datos para Country, StateBrain, MediaIdentity, MediaDNA, Topic, Profile, Watch, Source, Story, ContentPiece, Publication y DiscoveryRun.
- Datos semilla para México, Nuevo León, Hidalgo, Colima y las identidades iniciales.
- Dashboard e identidades conectados a la API cuando `DATABASE_URL` está configurada.
- Modo demostración automático si todavía no existe PostgreSQL.

## Desarrollo local

```bash
npm install
npm run build
npm start
```

Con PostgreSQL:

```bash
export DATABASE_URL="postgresql://..."
npm run db:push
npm run db:seed
npm start
```

## Railway

1. Sustituye en tu repositorio el contenido de la versión anterior por esta versión.
2. Commit y Push a `main`.
3. En el mismo proyecto de Railway agrega un servicio PostgreSQL.
4. En el servicio `WebAINetwork`, crea una variable `DATABASE_URL` usando la referencia del PostgreSQL de Railway.
5. Redeploy.
6. Abre `/api/health` en tu dominio para confirmar `databaseReady: true`.

El servidor ejecuta `prisma db push` al arrancar cuando detecta `DATABASE_URL` y carga datos semilla solo si la base está vacía.

Consulta `docs/RAILWAY_V020.md` y `docs/API_V020.md`.
