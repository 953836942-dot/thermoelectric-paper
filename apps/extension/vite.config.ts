import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "src/popup/index.html"),
        dashboard: resolve(import.meta.dirname, "src/dashboard/index.html")
      }
    }
  },
  plugins: [
    {
      name: "emit-extension-manifest",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: readFileSync(resolve(import.meta.dirname, "manifest.json"), "utf8")
        });
      }
    }
  ]
});
