# Third-party notices

Direct dependencies. Versions are pinned in `package.json` and `package-lock.json`. The running site bundles the font packages and Mediabunny. The rest are build and lint tools. They are not a server, and they do not receive image or video files.

Update this file when a dependency is added or removed.

| Package | Version | License | Role | Upstream |
| --- | --- | --- | --- | --- |
| `@fontsource/jetbrains-mono` | 5.3.0 | OFL-1.1 | Bundled font | https://github.com/JetBrains/JetBrainsMono |
| `@fontsource/noto-sans-symbols-2` | 5.3.0 | OFL-1.1 | Bundled font | https://github.com/notofonts/symbols |
| `mediabunny` | 1.62.0 | MPL-2.0 | Video demux and WebCodecs decode, bundled in the page | https://github.com/Vanilagy/mediabunny |
| `vite` | 8.3.5 | MIT | Build | https://github.com/vitejs/vite |
| `typescript` | 6.0.3 | Apache-2.0 | Typecheck | https://github.com/microsoft/TypeScript |
| `eslint` | 10.13.0 | MIT | Lint | https://github.com/eslint/eslint |
| `@eslint/js` | 10.0.1 | MIT | Lint | https://github.com/eslint/eslint |
| `typescript-eslint` | 8.72.0 | MIT | Lint | https://github.com/typescript-eslint/typescript-eslint |
| `globals` | 17.13.0 | MIT | Lint | https://github.com/sindresorhus/globals |

Font copyright and the full SIL Open Font License text are in [fonts/LICENSES.md](fonts/LICENSES.md).

Indirect packages are pinned in `package-lock.json`. They are tools used to install and build this static site.
