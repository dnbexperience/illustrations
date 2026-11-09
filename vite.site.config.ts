import react from "@vitejs/plugin-react";
import { eufemiaCssOptimizer } from "@dnb/eufemia/style/vite-plugin.js";
import { defineConfig } from "vite";
export default defineConfig({
  root: "site",
  base: "./",
  define: { __PUBLISHED_AT__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    eufemiaCssOptimizer({
      components: undefined,
      extensions: ["ts", "tsx"],
      sources: ["."],
    }),
  ],
  build: { outDir: "../.pages", emptyOutDir: true },
  publicDir: "../.catalogue",
});
