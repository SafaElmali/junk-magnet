import assert from "node:assert/strict";
import { WebSocket } from "ws";

const base = new URL(process.env.GAME_URL ?? "https://playjunkmagnet.com");
const backend = new URL(
  process.env.COOP_URL ??
    (base.hostname === "127.0.0.1" || base.hostname === "localhost"
      ? base.origin
      : "https://coop.playjunkmagnet.com"),
);
const request = (path) =>
  fetch(new URL(path, base), { signal: AbortSignal.timeout(20_000) });
const health = await fetch(new URL("/health", backend), {
  signal: AbortSignal.timeout(20_000),
});
assert.equal(health.status, 200, "Health endpoint must respond");
assert.deepEqual(await health.json(), { ok: true });
const page = await request("/");
assert.equal(page.status, 200, "Game page must respond");
const html = await page.text();
assert.match(html, /Junk Magnet/);
const asset = html.match(/src="([^"]+\.js)"/);
assert.ok(asset, "Page must load a built JavaScript asset");
assert.equal((await request(asset[1])).status, 200, "Built asset must respond");

const socketUrl = new URL("/coop", backend);
socketUrl.protocol = backend.protocol === "https:" ? "wss:" : "ws:";
const sockets = [];
async function connect() {
  const socket = new WebSocket(socketUrl, {
    origin: base.origin,
    handshakeTimeout: 15_000,
  });
  sockets.push(socket);
  const queued = [];
  let failure;
  socket.on("message", (raw) => queued.push(JSON.parse(raw.toString())));
  socket.on("error", (error) => {
    failure = error;
  });
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return {
    send: (message) => socket.send(JSON.stringify(message)),
    async next(type) {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        if (failure) throw failure;
        const index = queued.findIndex((message) => message.type === type);
        if (index !== -1) return queued.splice(index, 1)[0];
        if (socket.readyState !== WebSocket.OPEN)
          throw new Error("Socket closed before " + type);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error("Timed out waiting for " + type);
    },
  };
}
try {
  const host = await connect();
  const guest = await connect();
  host.send({ type: "create" });
  const lobby = await host.next("lobby");
  assert.match(lobby.code, /^[A-F0-9]{6}$/);
  guest.send({ type: "join", code: lobby.code });
  assert.equal((await guest.next("lobby")).index, 1);
  host.send({ type: "start" });
  const first = await host.next("snapshot");
  assert.ok(first.runId);
  assert.equal((await guest.next("snapshot")).runId, first.runId);
  guest.send({ type: "leave" });
  assert.equal((await host.next("ended")).reason, "left");
  console.log(
    `PASS ${base.origin}: page, built asset, health, and two-player co-op`,
  );
} finally {
  for (const socket of sockets) socket.terminate();
}
