# Production deployment

| Service | Address / project |
| --- | --- |
| Landing page | https://playjunkmagnet.com |
| Game | https://playjunkmagnet.com/play/ |
| Website hosting | Netlify project `playjunkmagnet` (`YOUR_NETLIFY_SITE_ID`) |
| Multiplayer | Cloudflare Worker `junk-magnet-coop`, https://coop.playjunkmagnet.com |
| Repository | `SafaElmali/junk-magnet`, branch `main` |
| DNS / registrar | Cloudflare |

## How it works

Co-op is temporarily hidden while performance issues are being fixed. The client
only exposes it when `VITE_COOP_ENABLED=true` at build time; production explicitly
sets this to `false` in `netlify.toml`. To restore it, change that value to `true`
and redeploy. The backend remains available for development and testing.

Netlify builds and serves `dist/`. `netlify.toml` supplies `VITE_COOP_URL` at build
time, so browsers connect directly to `wss://coop.playjunkmagnet.com/coop`.
WebSockets do not pass through Netlify Functions or an HTTP proxy.

The Cloudflare Worker validates the browser origin and routes connections to one
Durable Object. `server/hub.ts` contains the shared room management and simulation
used by both this Worker and the local Node server. Gameplay runs at 30 Hz and
sends snapshots at 15 Hz. Both players keep playing while upgrades or menus are
open, including when either browser goes into the background.

The object stays in memory while sockets are connected and stops its timers when
the last socket closes. State is ephemeral: Worker deployments, restarts, and
connection loss end active rooms. Workshop progress stays in each browser.

## DNS and HTTPS

Cloudflare manages these records:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME (flattened) | `@` | `apex-loadbalancer.netlify.com` | DNS only |
| CNAME | `www` | `playjunkmagnet.netlify.app` | DNS only |
| Worker custom domain | `coop` | `junk-magnet-coop` | Cloudflare managed |

Netlify manages TLS for the apex and `www`, with the apex as the primary domain.
Cloudflare manages TLS for `coop`. Keep Netlify records DNS-only so its domain
verification and certificate renewal can reach Netlify directly. Nameservers
remain with Cloudflare. No Mac, tunnel, or local process is needed for production.

## Deploy and verify

Netlify is connected to the GitHub repository and builds `main` using
`netlify.toml`. Cloudflare deployment configuration lives in `wrangler.jsonc`.
The GitHub `Verify` workflow checks the frontend, Node co-op, and Worker runtime.

For a manual backend deployment, authenticate Wrangler to the domain's Cloudflare
account, then run:

```sh
npm ci
npm run build:worker
npm run test:coop
npm run test:worker
npm run deploy:coop
```

For a manual website deployment, authenticate Netlify and link the project:

```sh
netlify link --id YOUR_NETLIFY_SITE_ID
VITE_COOP_URL=wss://coop.playjunkmagnet.com/coop npm run build
netlify deploy --prod --dir dist
```

Verify the public deployment with:

```sh
npm run verify:deployment
```

The check loads the landing page (including its Play and CrazyGames links), the
game page, a built asset, backend health, and two real WebSocket
clients; they create and join a room, start a shared simulation, and leave.
`GAME_URL` and `COOP_URL` can point this same check at a preview or local server.
Production browser origins are explicitly listed in `wrangler.jsonc`; arbitrary
Netlify deploy previews cannot connect to production co-op.

## Local development

The original `npm run dev` / `npm start` workflow still works without Cloudflare.
Without `VITE_COOP_URL`, the browser uses the same-origin Node `/coop` endpoint.
To test the Cloudflare backend locally:

```sh
npx wrangler dev --port 8797 --var ALLOWED_ORIGINS:http://127.0.0.1:5184
VITE_COOP_ENABLED=true VITE_COOP_URL=ws://127.0.0.1:8797/coop npm run dev
```

## Search and sharing metadata

`/` is a static landing page (`index.html`) with a **Play now** button for
`/play/` and a link to the
[CrazyGames page](https://www.crazygames.com/game/junk-magnet). It carries the
`VideoGame` JSON-LD. The game itself is `play/index.html`, served at `/play/` with
its own canonical URL. The web build uses an absolute `/` base so `/play/` loads
public assets from the site root; the CrazyGames build keeps a relative base.

`/guide/` (`guide/index.html`) is a readable, JavaScript-free gameplay guide,
linked from the game menu. Keep its facts in sync with `docs/gameplay.md` and the
game's own copy (`src/ability-art.ts`, `src/specialization-ui.ts`,
`src/evolution-core.ts`, `src/drone.ts`, `src/progression.ts`), especially
progression costs, controls, and co-op availability. All three pages are in
`public/sitemap.xml`.

The landing page and guide share `src/site/site.css`; each page's own stylesheet
imports it. Their images in `src/site/img/` are small WebP copies of
`public/abilities/`, `public/discoveries/` and `public/robots/`, made with
`cwebp -q 82 -alpha_q 90 -resize 192 0` (320 for robots, 640 for the hero robot).
`gameplay.webp` is a real 1600×900 capture from a run.

`public/og-image.png` is an exact copy of `art/cover.png`, the README promotional
cover. If the cover changes, update that copy and the image dimensions in all
three HTML pages. The cover is artwork, not a gameplay screenshot. Production social
cards use absolute `https://playjunkmagnet.com/og-image.png` URLs; previews need
the production deployment to contain the image before remote unfurlers can load it.

Metadata and guide changes ship with the normal frontend build. After deploying,
check the canonical URLs, `/play/`, `/guide/`, `/og-image.png`, `/robots.txt`, and
`/sitemap.xml`. Search indexing and cached social previews update independently
of deployment.

## Limits and costs

The existing limits remain: 12 rooms, 32 sockets, and two players per room. Keep
one shared Durable Object directory unless room routing is redesigned. Production
uses the existing Netlify account and Cloudflare Workers; no Render service is
required. Cloudflare's free Workers/Durable Objects quotas can stop service when
exhausted. Monitor requests and duration before launching to a larger audience;
upgrading to a paid plan is a separate decision.

No API tokens or credentials belong in this repository. Roll back the website
using a prior Netlify deploy and the backend using Cloudflare's Worker versions.
A backend rollback also ends active rooms.
