# Online co-op

[Back to README](../README.md)

## Start a room

```sh
npm ci
npm run build
npm run serve
```

Open [localhost:5185](http://127.0.0.1:5185). Choose **Play Together**, create a room, and share its six-character code. A friend opens the same hosted game and joins with that code; the host starts the match. Each player uses the robot selected in their own workshop.

For development, keep the server running and launch `npm run dev` in another terminal. Vite on port 5184 proxies `/coop` to the server on port 5185.

## Shared survival

- Enemies, hazards, discoveries, XP, and workshop parts are shared. Each robot has its own health, ammunition, weapons, and upgrade choices.
- **Co-op never pauses** for upgrades, menus, or a background tab. The upgrade drawer can be collapsed; movement and automatic attacks continue. Pending choices queue up.
- Stand within 2.3 metres of a fallen teammate for three uninterrupted seconds to revive them with 40 HP and two seconds of protection.
- Both robots going down ends the run and banks rewards. Leaving or disconnecting closes the room without banking an unfinished run.
- Spawn pressure is 1.5× solo, with discoveries streamed around both players.

## Hosting

The Node process serves `dist/` and accepts WebSockets at `/coop`. `PORT` overrides the default 5185. Deploy an always-running Node service with WebSocket support, or forward port 5185 through a tunnel. Static hosting supports solo only.

A normal same-origin reverse proxy needs no origin override. If a proxy rewrites the Host header, set the public origin explicitly; multiple origins can be comma-separated:

```sh
ALLOWED_ORIGINS=https://your-game.example npm run serve
```

Rooms live in one process's memory and close on restart or connection loss. This version has no reconnect or cross-server room routing. Workshop saves remain local; numeric bonuses are bounded to progression limits rather than authenticated accounts.

| Limit | Value |
| --- | --- |
| Concurrent rooms / connected sockets | 12 / 32 |
| Players per room | 2 |
| Idle lobby / finished room expiry | 10 / 5 minutes |
| Input expiry | 350 ms |
| Simulation / snapshot rate | 30 / 15 Hz |

Invalid, oversized, and rate-limited messages are rejected; client rendering smooths server snapshots.

## Verify

```sh
npm run test:coop
node scripts/coop-browser.mjs
```

Run the browser check with the server available on port 5185 and Google Chrome installed. It uses desktop and touch sessions to exercise room creation, shared rewards, upgrades during combat, movement, disconnects, and return to solo.
