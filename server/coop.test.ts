import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createCoopServer } from "./index";
import type { AddressInfo } from "node:net";
async function connect(url: string) {
  const ws = new WebSocket(url);
  const messages: any[] = [];
  ws.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  const next = async (type: string) => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const index = messages.findIndex((m) => m.type === type);
      if (index >= 0) return messages.splice(index, 1)[0];
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`Missing ${type}`);
  };
  return {
    ws,
    next,
    send: (m: unknown) => ws.send(JSON.stringify(m)),
    messages,
  };
}
test("two real sockets create/join, host starts, authoritative snapshots continue through choices and leave closes room", async () => {
  const app = createCoopServer();
  await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
  const url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/coop`;
  try {
    const a = await connect(url),
      b = await connect(url),
      c = await connect(url);
    a.send({ type: "create" });
    const lobby = await a.next("lobby");
    assert.match(lobby.code, /^[A-F0-9]{6}$/);
    b.send({ type: "join", code: lobby.code });
    assert.equal((await b.next("lobby")).index, 1);
    c.send({ type: "join", code: lobby.code });
    assert.equal((await c.next("error")).reason, "room");
    b.send({ type: "start" });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(app.rooms.get(lobby.code)?.session, undefined);
    a.send({ type: "start" });
    const first = await a.next("snapshot");
    assert.equal(first.runId, (await b.next("snapshot")).runId);
    a.send({ type: "input", x: 999, z: 0 });
    b.send({ type: "input", x: 0, z: 0 });
    const session = app.rooms.get(lobby.code)!.session!;
    session.players[0].xp = 5;
    session.players[1].xp = 5;
    await new Promise((r) => setTimeout(r, 180));
    assert.equal(session.players[0].phase, "playing");
    assert.ok(session.players[0].choices.length);
    const time = session.players[0].time;
    a.send({ type: "pause" });
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(session.players[0].time > time);
    assert.ok(session.players[0].player.x - first.state.player.x < 3);
    a.send({ type: "choose", id: session.players[0].choices[0], level: 2 });
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(session.players[0].choices.length, 0);
    assert.equal(session.players[1].choices.length, 3);
    b.send({ type: "leave" });
    assert.equal((await a.next("ended")).reason, "left");
    assert.equal(app.rooms.size, 0);
    a.ws.close();
    b.ws.close();
    c.ws.close();
  } finally {
    await app.close();
  }
});
