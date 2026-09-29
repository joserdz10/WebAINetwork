# Arquitectura AI Media Network v1.0

## Capas

```text
Navegador / Telegram Operator
          |
       REST API
          |
+---------+-----------+------------------+
|                     |                  |
Editorial Core     Intelligence       Distribution
|                     |                  |
Stories             Discovery          Meta
Content             Topics             Telegram
Media DNA           Profiles           Drive
Approval            Watches
                    Sources
          |
       PostgreSQL
```

## Jerarquía de conocimiento

```text
Shared Brain (México)
    -> State Brain
        -> Media Identity
            -> Media DNA
                -> Story
                    -> Content Piece
                        -> Publication
```

## Entidades principales

Country, StateBrain, MediaIdentity, MediaDNA, Topic, Profile, Watch, Source, DiscoveryRun, DiscoveryCandidate, Story, StorySource, StoryTopic, StoryProfile, ContentPiece, SocialAccount, Publication, ActivityEvent, SystemError, AppSetting.

## Principios

1. La fuente y el expediente existen antes que el contenido.
2. Descubrimiento propone; no publica.
3. Una Historia puede generar múltiples piezas para múltiples identidades.
4. El ADN editorial cambia tono/formato, no los hechos.
5. Política/electoral se trata de forma factual y neutral; el sistema no debe persuadir ni recomendar opciones políticas.
6. Secretos fuera de base de datos.
7. Telegram y Web consumen el mismo núcleo.


## Visual DNA (v1.1.0)
`MediaIdentity` now has two independent profiles: `MediaDNA` for editorial behavior and `VisualDNA` for visual behavior. VisualDNA stores palette rules, typography, composition, photographic treatment, overlays, brand placement, reference URL, format-specific ratios and visual prompt instructions. The Visual Engine merges Story + ContentPiece type + VisualDNA before calling image generation.
