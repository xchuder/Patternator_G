# Patternator

Static browser app. Vite + TypeScript. No server.

Phase 0 is the shell and the capability page. Do not add effect features unless that phase is requested.

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

src/effects/               later: ascii, dither, halftone, pixel, banding
src/render/                later: WebGL2 shaders, Canvas2D fallback
src/workers/               later: Floyd–Steinberg, palette, other CPU work
src/video/                 later: WebCodecs and Mediabunny
src/export/                later: PNG, SVG, MP4, ZIP
```

Later pipeline: Upload → Decode → Pre-filter → Sample grid → Effect → Palette map → Render → Preview or Export.

Heavy work goes in a Web Worker. Close each `VideoFrame` as soon as it has been read.
