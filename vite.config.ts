import { copyFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const DOWNLOAD_NAME = "dashboard_superstore.html";

/**
 * Copia docs/index.html con un nombre descriptivo para descargar y enviar, y crea docs/.nojekyll
 * para que GitHub Pages publique el HTML tal cual, sin procesarlo con Jekyll.
 */
function downloadCopy(): Plugin {
  return {
    name: "download-copy",
    apply: "build",
    closeBundle() {
      copyFileSync("docs/index.html", `docs/${DOWNLOAD_NAME}`);
      writeFileSync("docs/.nojekyll", "");
    },
  };
}

// Genera UN solo archivo con datos, JS y CSS incrustados: docs/index.html (lo publica
// GitHub Pages desde /docs) y una copia idéntica docs/dashboard_superstore.html para enviar.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile(), downloadCopy()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
});
