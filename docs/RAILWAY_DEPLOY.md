# Deploy the current web prototype to Railway

This prototype has no external dependencies and uses Node's built-in HTTP server.

## Recommended path: GitHub -> Railway

1. Extract this project locally.
2. Create a GitHub repository, for example `ai-media-network`.
3. Upload the contents of this folder to the repository root.
4. In Railway create a new project and choose `Deploy from GitHub repo`.
5. Select the repository.
6. Railway should detect the `package.json` and run `npm start`.
7. In the service, open Settings -> Networking -> Generate Domain.
8. Open the generated `*.up.railway.app` URL.

The server already reads `process.env.PORT`, which Railway supplies automatically.

## Database step for v0.2

In the same Railway project add PostgreSQL. The API service will later receive `DATABASE_URL` and Prisma migrations will create the real schema.
