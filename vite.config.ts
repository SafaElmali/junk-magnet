import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadingMarkup } from "./src/loading-screen";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** CrazyGames build (`--mode crazygames`): SDK script first, then the SDK-aware entry. */
const crazyGames = (): Plugin[] => [{
  // The upload's index.html is the game, not the playjunkmagnet.com landing page.
  name: "crazygames-game-page",
  apply: "build",
  enforce: "pre",
  load: (id) => (id === page("./index.html") ? readFileSync(page("./play/index.html"), "utf8") : undefined),
}, {
  name: "crazygames-entry",
  transformIndexHtml: {
    order: "pre",
    handler: (html) => html
      .replace(
        '<script type="module" src="/src/main.ts"></script>',
        '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n    <script type="module" src="/src/crazygames-entry.ts"></script>',
      )
      // The guide page is not shipped; scripts/build-crazygames.mjs checks no link remains.
      .replace(/\s*<p><a href="\/guide\/">.*?<\/p>/, "")
      .replace(" You can read the gameplay guide without JavaScript.", ""),
  },
}, {
  name: "crazygames-preload",
  transformIndexHtml: {
    order: "post",
    // The entry imports the game only after the SDK starts; download it meanwhile.
    handler(html, ctx) {
      const game = Object.values(ctx.bundle ?? {}).find(
        (file) => file.type === "chunk" && file.facadeModuleId?.endsWith("/src/main.ts"),
      );
      if (game?.type !== "chunk") return html;
      const css = [...(game.viteMetadata?.importedCss ?? [])].map((file) => `  <link rel="stylesheet" crossorigin href="./${file}">\n`);
      return html.replace("</head>", `  <link rel="modulepreload" crossorigin href="./${game.fileName}">\n${css.join("")}  </head>`);
    },
  },
}];

export default defineConfig(({ mode }) => ({
  // playjunkmagnet.com serves the landing page at / and the game at /play/, so
  // public assets resolve from the site root. CrazyGames hosts the upload in a subfolder.
  base: mode === "crazygames" ? "./" : "/",
  build: mode === "crazygames" ? {} : {
    // Site images are reused across pages and lazy-loaded, so keep them as files.
    assetsInlineLimit: (file: string) => (file.includes("/src/site/img/") ? false : undefined),
    rollupOptions: {
      input: { landing: page("./index.html"), play: page("./play/index.html"), guide: page("./guide/index.html") },
    },
  },
  plugins: [{
    name: "initial-loading-screen",
    transformIndexHtml(html) {
      // Render before the game bundle downloads, using the same loader as boot().
      const css = readFileSync(new URL("./src/loading-screen.css", import.meta.url), "utf8");
      return html
        .replace("<!-- loading-styles -->", `<style>${css}</style>`)
        .replace("<!-- loading-screen -->", `<div class="load-state" id="loading" role="status" aria-live="polite">${loadingMarkup}</div>`);
    },
  }, ...(mode === "crazygames" ? crazyGames() : [])],
  server: {
    host: "127.0.0.1",
    port: 5184,
    strictPort: true,
    proxy: { "/coop": { target: "ws://127.0.0.1:5185", ws: true } },
  },
}));
