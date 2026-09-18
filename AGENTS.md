# Agent Guidelines

## Project

`pokedex-electron` is a desktop Pokédex built with Electron, React, strict
TypeScript, and modular SCSS. It uses PokéAPI v2 for all available generations
and alternate forms. Preserve the compact handheld design: the cover starts
closed and opens on interaction, with synchronized animation and sound.

## Structure

- `src/electron/`: desktop lifecycle, CLI entrypoint, and preload bridge.
- `src/renderer/components/`: React views; physical controls live in `device/`.
- `src/renderer/hooks/`: application state and device interaction lifecycle.
- `src/renderer/api/`: HTTP client and response validation schemas.
- `src/renderer/domain/`: Pokémon transformations and calculations.
- `src/renderer/services/`: local persistence and synthesized device audio.
- `src/renderer/styles/`: SCSS entrypoint and focused partials.
- `tests/unit/`, `tests/e2e/`, and `tests/fixtures/`: automated checks and fixtures.
- `scripts/`: TypeScript maintenance, release, and preview-recording tools.
- `.github/workflows/`: shared validation, CI, and tag-triggered npm publishing.

## Implementation Rules

- Write code, comments, and documentation in English.
- Use TypeScript for application logic, tooling, and tests; React for UI; SCSS
  for styles. Keep responsibilities in separate modules, not one large file.
- Add a descriptive header comment to every code file and a documentation
  comment above every function. `npm run lint` enforces comment placement.
- Preserve strict typing and validate external API data at the boundary.
- Do not limit the catalogue to the first generation or assume consecutive
  identifiers. Show generation and region information only when available.
- Preserve request cancellation, caching, network recovery, and local favorites.
- Keep the renderer sandboxed and isolated. Expose only narrowly scoped,
  validated operations through the preload bridge; never expose Node.js APIs.
- Maintain keyboard access, focus handling, inert closed panels, reduced-motion
  support, and persistent mute settings. Do not autoplay audio before interaction.
- Avoid adding decorative keypad controls or redundant labels to the catalogue.
- Preserve README headings and `app.gif`; update only information affected by
  the change. Do not recreate CHANGELOG.md or CONTRIBUTING.md unless requested.

## Development and Verification

Use Node.js 24.15 or newer and install locked dependencies with `npm ci`.
`npm run dev` starts the renderer with hot reload; `npm start` builds and launches
the desktop application. `npm run preview` serves an existing renderer build.

For implementation changes, run:

```bash
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run package:check
```

`npm run check` covers types, lint, documentation comments, formatting, and unit
tests. Format changed files with Prettier before validation. Linux desktop tests
require a graphical session; CI uses `xvfb-run --auto-servernum npm run test:e2e`.
For documentation-only changes, check formatting and affected links and commands.
Report which checks ran and any checks that could not run.

Keep automated API tests deterministic using `tests/fixtures/`. For API changes,
consult the official PokéAPI v2 documentation and run `npm run test:live` with the
development server running. `POKEDEX_URL` can target another running preview.
Do not replace fixture-based tests with tests that depend on the public service.

To regenerate the README animation, start the development server and run
`npm run preview:record`. This captures the real closed-to-open interaction into
`app.gif`. Inspect the resulting animation before committing it.

## Git and Releases

- Keep changes focused, preserve unrelated user edits, and use descriptive
  Conventional Commit messages. Do not commit, push, tag, or publish unless asked.
- Keep `package.json` and `package-lock.json` versions synchronized. Do not bump
  the version as a side effect of unrelated work.
- Validate a release tag with `npm run release:check -- v<version>`.
- Preserve publication on matching version tags, with or without the `v` prefix.
  Publish only one tag per version after CI passes.
- The publish workflow uses the repository's `NPM_TOKEN` secret and npm
  provenance. Never write credentials into source, documentation, or logs.
- Only the build output, package manifest, README, and license belong in the npm
  package. Electron remains a runtime dependency; renderer dependencies are bundled.
- Do not commit generated builds, test reports, local application data, or secrets.
