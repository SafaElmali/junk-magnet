import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { CoopSession, coopConfig } from "../src/coop-session";
import type { RunConfig } from "../src/progression";
import type { Vec, UpgradeId } from "../src/simulation";

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
  type Peer = {
    ws: WebSocket;
    room?: Room;
    index: number;
    config: RunConfig;
    input: Vec;
    inputAt: number;
    alive: boolean;
    rateAt: number;
    messages: number;
    connectedAt: number;
  };
  type Room = {
    code: string;
    peers: Peer[];
    session?: CoopSession;
    created: number;
    finishedAt?: number;
  };
  const rooms = new Map<string, Room>(),
    peers = new Set<Peer>();
  const send = (p: Peer, data: unknown) => {
    if (p.ws.readyState === WebSocket.OPEN && p.ws.bufferedAmount < 256_000)
      p.ws.send(
        JSON.stringify(data, (key, value) =>
          value instanceof Map
            ? []
            : typeof value === "number" && !Number.isInteger(value)
              ? Math.round(value * 1000) / 1000
              : value,
        ),
      );
  };
  const lobby = (room: Room) =>
    room.peers.forEach((p) =>
      send(p, {
        type: "lobby",
        code: room.code,
        index: p.index,
        players: room.peers.map((a) => a.config.robotId),
      }),
    );
  const closeRoom = (room: Room, reason = "left") => {
    rooms.delete(room.code);
    for (const p of room.peers) {
      p.room = undefined;
      send(p, { type: "ended", reason });
    }
  };
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/coop" || peers.size >= 32) {
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
  wss.on("connection", (ws) => {
    const p: Peer = {
      ws,
      index: 0,
      config: coopConfig(null),
      input: { x: 0, z: 0 },
      inputAt: 0,
      alive: true,
      rateAt: Date.now(),
      messages: 0,
      connectedAt: Date.now(),
    };
    peers.add(p);
    ws.on("pong", () => (p.alive = true));
    ws.on("error", () => {});
    ws.on("message", (raw) => {
      const now = Date.now();
      if (now - p.rateAt > 1000) {
        p.rateAt = now;
        p.messages = 0;
      }
      if (++p.messages > 100) {
        ws.close(1008, "Rate limit");
        return;
      }
      try {
        const m = JSON.parse(raw.toString());
        if (!m || typeof m !== "object") return;
        if (m.type === "create" || m.type === "join") {
          if (p.room) return;
          p.config = coopConfig(m.config);
          if (m.type === "create") {
            if (rooms.size >= 12) {
              send(p, { type: "error", reason: "busy" });
              return;
            }
            let code: string;
            do {
              code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
            } while (rooms.has(code));
            const room: Room = { code, peers: [p], created: now };
            rooms.set(code, room);
            p.index = 0;
            p.room = room;
          } else {
            const room = rooms.get(
              typeof m.code === "string" ? m.code.trim().toUpperCase() : "",
            );
            if (!room || room.peers.length !== 1 || room.session) {
              send(p, { type: "error", reason: "room" });
              return;
            }
            p.index = 1;
            p.room = room;
            room.peers.push(p);
          }
          lobby(p.room!);
        } else if (m.type === "start") {
          const room = p.room;
          if (
            !room ||
            p.index !== 0 ||
            room.peers.length !== 2 ||
            (room.session && !room.session.finished)
          )
            return;
          room.session = new CoopSession(
            [room.peers[0].config, room.peers[1].config],
            randomUUID(),
          );
          room.finishedAt = undefined;
          for (const peer of room.peers) {
            peer.input = { x: 0, z: 0 };
            send(peer, room.session.snapshot(peer.index));
          }
        } else if (m.type === "input") {
          if (
            typeof m.x !== "number" ||
            typeof m.z !== "number" ||
            !Number.isFinite(m.x) ||
            !Number.isFinite(m.z)
          )
            return;
          const length = Math.max(1, Math.hypot(m.x, m.z));
          p.input = { x: m.x / length, z: m.z / length };
          p.inputAt = now;
        } else if (m.type === "choose") {
          if (typeof m.id === "string" && Number.isInteger(m.level))
            p.room?.session?.choose(p.index, m.id as UpgradeId, m.level);
        } else if (m.type === "leave") {
          if (p.room) closeRoom(p.room);
        }
      } catch {
        ws.close(1008, "Invalid message");
      }
    });
    ws.on("close", () => {
      peers.delete(p);
      if (p.room) closeRoom(p.room);
    });
  });
  let frames = 0;
  const timer = setInterval(() => {
    frames++;
    const now = Date.now();
    for (const room of rooms.values()) {
      if (
        (!room.session && now - room.created > 600_000) ||
        (room.finishedAt && now - room.finishedAt > 300_000)
      ) {
        closeRoom(room, "expired");
        continue;
      }
      if (!room.session) continue;
      room.session.tick(
        1 / 30,
        room.peers.map((p) =>
          now - p.inputAt < 350 ? p.input : { x: 0, z: 0 },
        ) as [Vec, Vec],
      );
      if (room.session.finished) room.finishedAt ??= now;
      if (frames % 2 === 0) {
        for (const p of room.peers) send(p, room.session.snapshot(p.index));
        room.session.clearEvents();
      }
    }
  }, 1000 / 30);
  const heartbeat = setInterval(() => {
    for (const p of peers) {
      if (!p.alive || (!p.room && Date.now() - p.connectedAt > 60_000)) {
        p.ws.terminate();
        continue;
      }
      p.alive = false;
      p.ws.ping();
    }
  }, 15_000);
  return {
    server,
    rooms,
    async close() {
      clearInterval(timer);
      clearInterval(heartbeat);
      for (const p of peers) p.ws.terminate();
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
