# Patternator

Static browser app. Vite + TypeScript. No server.

Phase 0 is the shell and the capability page. Phase 1a is still images: upload, pre-filter, ASCII, pixelate, PNG export. Do not add dither, halftone, banding, mask, overlay, HUD, palette, SVG, or video unless that phase is requested.

## Rules

- TypeScript stays strict: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `verbatimModuleSyntax`.
- No server code. No SSR, API routes, upload endpoint, database, or framework that needs one. The deployed app is the Vite `dist` folder.
- No ffmpeg.wasm in the MVP, and no COOP/COEP headers for `SharedArrayBuffer`.
- Product settings live in `src/data/`, not as magic numbers in the UI or in detection code. That includes codec probes, the glyph sample, browser-support copy, and later limits (duration, resolution, default charset).
- Visual tokens (color, space, type size) live as custom properties in `src/styles.css`.
- Fonts are self-hosted through `@fontsource/*`. Do not request `fonts.googleapis.com`. A new face needs an entry in `fonts/LICENSES.md` (name, OFL-1.1, link) and a row in `THIRD_PARTY.md`.
- Glyph stack: JetBrains Mono, then Noto Sans Symbols 2, then `monospace`. The stack is `glyphFontStack` in `src/data/typography.ts`.

## Naming

- Files and folders: kebab-case.
- Functions and variables: camelCase.
- Types and interfaces: PascalCase.
- Named exports. A default export only where a tool requires it (`vite.config.ts`).

## Folder layout

```
index.html                 shell
vite.config.ts             static build, outDir dist
src/main.ts                entry
src/fonts.css              @font-face rules, files from @fontsource
src/styles.css             visual tokens and layout
src/data/                  config and copy
src/capabilities/          feature detection
src/ui/                    page structure
fonts/LICENSES.md
THIRD_PARTY.md
public/                    files copied as-is, when a phase needs them

src/data/defaults.json      slider ranges, default charset, export limits
src/data/glyph-coverage.json  cmap of the shipped woff files
src/effects/               one module per effect, behind EffectModule
src/effects/ascii/         charset, glyph atlas, shader
src/effects/pixelate/
src/render/                WebGL2 pipeline and Canvas2D fallback
src/image/                 createImageBitmap
src/export/                PNG
src/workers/               later: Floyd–Steinberg, palette, other CPU work
src/video/                 later: WebCodecs and Mediabunny
```

Pipeline: Upload → Decode → Pre-filter → Effect → Preview or PNG. Palette map is a later pass.

A new effect is a folder under `src/effects/<name>` that implements `EffectModule` and is added to `src/effects/registry.ts`. Numeric defaults stay in `src/data/defaults.json`. Glyph coverage is regenerated with `node scripts/extract-glyph-coverage.mjs` when the shipped font files change.

Heavy work goes in a Web Worker. Close each `VideoFrame` as soon as it has been read.
