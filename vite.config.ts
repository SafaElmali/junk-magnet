import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5184,
    strictPort: true,
    proxy: { "/coop": { target: "ws://127.0.0.1:5185", ws: true } },
  },
});
