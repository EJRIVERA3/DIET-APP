import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Standalone static build of the client app for GitHub Pages.
// This is intentionally separate from vite.config.ts (the vinext/Cloudflare
// build) so the two never interfere. It bundles app/DietApp.tsx as a pure
// client-side SPA; the optional cloud-sync API simply stays dormant when the
// server route is absent (the app falls back to localStorage).

const dirname = path.dirname(fileURLToPath(import.meta.url));

// GitHub Pages serves project sites under /<repo>/. Override with
// STATIC_BASE=/ for a custom domain or user/org root page.
const base = process.env.STATIC_BASE ?? "/The-Food-Tracker-App/";

export default defineConfig({
  base,
  root: path.resolve(dirname, "web-static"),
  publicDir: path.resolve(dirname, "public"),
  plugins: [react()],
  css: {
    // Load the root postcss.config.mjs (Tailwind v4) even though the Vite
    // root is web-static/.
    postcss: dirname,
  },
  build: {
    outDir: path.resolve(dirname, "dist-static"),
    emptyOutDir: true,
  },
});
