# v1.6.5: typography and template render safety

- Railway/Nixpacks must install `fontconfig` and `fonts-dejavu-core` using `nixpacks.toml`.
- Template Engine checks both families with `fc-match` before rendering; if missing, returns `TEMPLATE_FONTS_UNAVAILABLE` instead of generating squares.
- Required dynamic fields: headline, category, summary, source.
- Automated tests: `npm run test:render` (requires dependencies and fonts installed).
- After deployment, regenerate an existing draft piece and visually inspect Spanish accents, source, headline, summary and original image provenance. Do not publish before human review.
- If Railway ignores nixpacks.toml, explicitly configure the service to use Nixpacks and inspect build logs for font package installation.
