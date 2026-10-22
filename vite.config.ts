import { defineConfig } from "vite";

// Static site. Vercel publishes this folder. No COOP/COEP headers.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
