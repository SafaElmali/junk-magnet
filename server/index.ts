import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { createCoopHub } from "./hub";

export function createCoopServer(
  root = resolve(fileURLToPath(new URL("../dist", import.meta.url))),
) {
  const mime: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".glb": "model/gltf-binary",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
  };
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url ?? "/", "http://localhost").pathname,
      );
      if (pathname === "/health") {
        res
          .writeHead(200, { "content-type": "application/json" })
          .end('{"ok":true}');
        return;
      }
      const path = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!path.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const info = await stat(path);
      if (!info.isFile()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": mime[extname(path)] ?? "application/octet-stream",
        "content-length": info.size,
        "cache-control": pathname.startsWith("/assets/")
          ? "public,max-age=31536000,immutable"
          : "no-cache",
        "x-content-type-options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : await readFile(path));
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2048,
    perMessageDeflate: { threshold: 1024 },
  });
  const hub = createCoopHub();
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/coop" || hub.connections >= 32) {
      socket.destroy();
      return;
    }
    // Browsers may use the public tunnel hostname or a local Vite proxy. Reject cross-site sockets.
    const origin = req.headers.origin;
    if (origin) {
      try {
        const o = new URL(origin);
        const forwarded = req.headers["x-forwarded-host"];
        const host =
          typeof forwarded === "string"
            ? forwarded.split(",")[0].trim()
            : req.headers.host;
        if (
          !(process.env.ALLOWED_ORIGINS ?? "").split(",").includes(o.origin) &&
          o.host !== host &&
          !(
            ["localhost", "127.0.0.1"].includes(o.hostname) &&
            ["localhost", "127.0.0.1"].includes((host ?? "").split(":")[0])
          )
        ) {
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });
  wss.on("connection", (ws) => hub.connect(ws));
  return {
    server,
    rooms: hub.rooms,
    async close() {
      hub.close();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { server } = createCoopServer();
  server.listen(Number(process.env.PORT ?? 5185), "0.0.0.0", () =>
    console.log(
      "Junk Magnet + co-op listening on port",
      process.env.PORT ?? 5185,
    ),
  );
}
