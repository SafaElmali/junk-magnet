import { CoopSession, coopConfig } from "../src/coop-session";
import type { RunConfig } from "../src/progression";
import type { Vec, UpgradeId } from "../src/simulation";

/** The room simulation is shared by the Node server and the Cloudflare adapter. */
export interface CoopSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
  ping(): void;
  on(event: "message", listener: (raw: { toString(): string }) => void): void;
  on(event: "pong" | "error" | "close", listener: () => void): void;
}

export function createCoopHub() {
  type Peer = {
    ws: CoopSocket;
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
    if (p.ws.readyState === 1 && p.ws.bufferedAmount < 256_000)
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
  function connect(ws: CoopSocket) {
    startTimers();
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
              code = Array.from(
                crypto.getRandomValues(new Uint8Array(3)),
                (byte) => byte.toString(16).padStart(2, "0"),
              )
                .join("")
                .toUpperCase();
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
            crypto.randomUUID(),
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
      if (!peers.size) stopTimers();
    });
  }
  let frames = 0;
  function tick() {
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
  }
  function checkConnections() {
    for (const p of peers) {
      if (!p.alive || (!p.room && Date.now() - p.connectedAt > 60_000)) {
        p.ws.terminate();
        continue;
      }
      p.alive = false;
      p.ws.ping();
    }
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  function startTimers() {
    timer ??= setInterval(tick, 1000 / 30);
    heartbeat ??= setInterval(checkConnections, 15_000);
  }
  function stopTimers() {
    if (timer !== undefined) clearInterval(timer);
    if (heartbeat !== undefined) clearInterval(heartbeat);
    timer = heartbeat = undefined;
  }
  return {
    rooms,
    get connections() {
      return peers.size;
    },
    connect,
    close() {
      stopTimers();
      for (const p of peers) p.ws.terminate();
      peers.clear();
      rooms.clear();
    },
  };
}
