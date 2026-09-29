# AI Media Network Web - Architecture v0.1.1

## Product layers

1. Network: Country -> StateBrain -> MediaIdentity
2. Intelligence: Shared knowledge concepts, Topics, Profiles, Watches, Sources
3. Editorial: DiscoveryRun -> Story -> ContentPiece
4. Distribution: SocialAccount -> Publication
5. Interfaces: Web Control Center and Telegram Operator consume the same API Core

## Core rule

Business logic must not live inside Telegram, Facebook or the web UI. Those are clients/integrations. The API Core owns editorial state and workflows.

## First production slice

Nuevo Leon StateBrain + Norte En Alerta MediaIdentity.

End-to-end path:
DiscoveryRun -> Story -> analysis -> ContentPiece -> approval -> Publication.

## Next backend modules

- states
- identities
- topics
- profiles
- watches
- sources
- discovery
- stories
- content
- publications
- integrations

## Database

PostgreSQL + Prisma. The first real schema is in `packages/database/prisma/schema.prisma`.
