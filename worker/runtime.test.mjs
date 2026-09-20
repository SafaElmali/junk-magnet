import test from "node:test";
import assert from "node:assert/strict";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { WebSocket } from "ws";

test(
  "Cloudflare co-op enforces origins, shares a running room, and bounds messages",
  { timeout: 30_000 },
  async () => {
    const origin = "https://playjunkmagnet.com";
    const runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        scriptPath: ".wrangler/test-bundle/index.js",
        compatibilityDate: "2026-09-20",
        bindings: { ALLOWED_ORIGINS: origin },
        durableObjects: {
          COOP: { className: "JunkMagnetCoop", useSQLite: true },
        },
      }),
    );
    const sockets = [];
    try {
      const address = await runtime.ready;
      const url = new URL("/coop", address);
      url.protocol = "ws:";
      assert.deepEqual(
        await (await fetch(new URL("/health", address))).json(),
        { ok: true },
      );
      assert.equal((await fetch(url.href.replace("ws:", "http:"))).status, 426);
      const rejected = new WebSocket(url, {
        origin: "https://unrelated.example",
      });
      rejected.on("error", () => {});
      sockets.push(rejected);
      await new Promise((resolve, reject) => {
        rejected.once("open", () =>
          reject(new Error("Foreign origin connected")),
        );
        rejected.once("unexpected-response", (_request, response) => {
          try {
            assert.equal(response.statusCode, 403);
            response.resume();
            rejected.terminate();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
      const connect = async () => {
        const ws = new WebSocket(url, { origin, handshakeTimeout: 5000 });
        const messages = [];
        let failure;
        sockets.push(ws);
        ws.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
        ws.on("error", (error) => {
          failure = error;
        });
        await new Promise((resolve, reject) => {
          ws.once("open", resolve);
          ws.once("error", reject);
        });
        return {
          ws,
          send: (message) => ws.send(JSON.stringify(message)),
          async next(type) {
            const deadline = Date.now() + 3000;
            while (Date.now() < deadline) {
              if (failure) throw failure;
              const index = messages.findIndex(
                (message) => message.type === type,
              );
              if (index !== -1) return messages.splice(index, 1)[0];
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
            throw new Error("Missing " + type);
          },
        };
      };
      const host = await connect(),
        guest = await connect();
      host.send({ type: "create" });
      const room = await host.next("lobby");
      guest.send({ type: "join", code: room.code });
      assert.equal((await guest.next("lobby")).index, 1);
      host.send({ type: "start" });
      const first = await host.next("snapshot");
      assert.equal((await guest.next("snapshot")).runId, first.runId);
      assert.ok((await host.next("snapshot")).state.time > first.state.time);
      guest.send({ type: "leave" });
      assert.equal((await host.next("ended")).reason, "left");
      const closed = new Promise((resolve) => guest.ws.once("close", resolve));
      guest.ws.send("x".repeat(2049));
      assert.equal(await closed, 1009);
      // Closing a room must allow a fresh room without a stale simulation.
      host.send({ type: "create" });
      await host.next("lobby");
    } finally {
      for (const socket of sockets) socket.terminate();
      await runtime.dispose();
    }
  },
);
