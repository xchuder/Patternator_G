# Patternator

Patternator is a browser-only app for image and video effects: ASCII, dither, halftone, and pixel treatments, exported as PNG, SVG, or MP4. Everything runs in the page. There is no server.

This revision is Phase 0: the Vite + TypeScript shell, self-hosted fonts, and a page that checks WebGL2, WebCodecs, and `isSecureContext`. Effect features are not built yet.

## Privacy

Image and video files never leave the browser. The app does not upload them, and it has no account or analytics that receive file data. Hosting this site only delivers the static page.

## Run

Node.js `^20.19.0 || >=22.12.0` and npm.

```sh
npm ci
npm run dev
```

Vite prints a local URL. `localhost` is a secure context, so `isSecureContext` should be true.

```sh
npm run typecheck
npm run lint
npm run build
npm run preview
```

`npm run build` typechecks, then writes the static site to `dist`.

## Deploy on Vercel

Hobby plan. The site is the Vite build, not a server.

1. Import this private GitHub repository into a Vercel project on the Hobby plan.
2. Confirm the framework preset is **Vite**.
3. Build command: `npm run build`. Output directory: `dist`. Install command can stay `npm ci` or npm’s default install.
4. Turn **Deployment Protection** off for production and for previews (Settings → Deployment Protection, including Vercel Authentication). Anyone with the link should be able to open it without signing in.
5. Pushes to `main` deploy production. Other branches and pull requests get their own preview URL.
6. Open the production URL in a private or incognito window. It should not ask for a login. The sample `△▽☆CZO()8` should have no empty boxes. WebGL2, VideoEncoder, VideoDecoder, and `isSecureContext` are listed on the page. On the HTTPS URL, `isSecureContext` should be true.

There is no `vercel.json`. COOP and COEP headers are not set. The MVP does not use ffmpeg.wasm or `SharedArrayBuffer`.

## Browsers

The page reports what this browser can do.

- WebGL2 is the target for real-time effects. Without it, later phases use a Canvas2D fallback.
- MP4 export needs WebCodecs (`VideoEncoder` and `VideoDecoder`) in a secure context: Chrome, Edge, Firefox desktop, or Safari 26+. Firefox on Android does not support WebCodecs. The page says so instead of failing silently.
- `VideoEncoder` also needs HTTPS (or `localhost`).

## Fonts

Faces are self-hosted with `@fontsource` (JetBrains Mono, then Noto Sans Symbols 2). Licenses are in [fonts/LICENSES.md](fonts/LICENSES.md). Packages are listed in [THIRD_PARTY.md](THIRD_PARTY.md).

## License

All rights reserved. This repository is private.
