import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { loadingMarkup } from "./src/loading-screen";

export default defineConfig({
  base: "./",
  plugins: [{
    name: "initial-loading-screen",
    transformIndexHtml(html) {
      // Render before the game bundle downloads, using the same loader as boot().
      const css = readFileSync(new URL("./src/loading-screen.css", import.meta.url), "utf8");
      return html
        .replace("<!-- loading-styles -->", `<style>${css}</style>`)
        .replace("<!-- loading-screen -->", `<div class="load-state" id="loading" role="status" aria-live="polite">${loadingMarkup}</div>`);
    },
  }],
  server: {
    host: "127.0.0.1",
    port: 5184,
    strictPort: true,
    proxy: { "/coop": { target: "ws://127.0.0.1:5185", ws: true } },
  },
});
