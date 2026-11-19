import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  root: "public",
  base: "./",
  publicDir: false,
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  worker: { format: "es" },
  build: { outDir: "../dist-pages", emptyOutDir: true },
  plugins: [{
    name: "splitbuddy-pages",
    transformIndexHtml: {
      order: "pre",
      handler: html => html
        .replace('<script defer src="/app.js"></script>', '<script type="module" src="../pages/browser.mjs"></script>')
        .replace("<main>", '<main>\n    <p id="demo-note" class="muted">Demo changes are saved in this browser.</p>'),
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: ".nojekyll", source: "" });
      const license = readFileSync(new URL("../LICENSE", import.meta.resolve("@electric-sql/pglite")));
      this.emitFile({ type: "asset", fileName: "pglite-license.txt", source: license });
    },
  }],
});
