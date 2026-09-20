# Verification — September 20, 2026

## Endless survival implementation

The former 36-kill shift is replaced by a continuous run that ends on death. The map streams deterministic scrapyard sections around the following camera. XP opens three paused upgrade choices; seven ranked modules plus repeatable repair/refill/overclock options remain available as the build develops.

## Automated checks

- `npm test`: 19 focused tests cover normalized unbounded movement, independent facing, obstacle collisions, pause/upgrade freezes, XP carryover and consecutive levels, three distinct choices, maxed-build fallbacks, launch guards, swept projectile collisions, ability behavior, death, time-based pressure, entity bounds and terrain determinism/seams.
- Pickup saturation regression: after leaving 320 distant drops behind, a local kill still produces locally collectible XP and scrap, without losing the old accumulated values.
- `npm run build`: TypeScript and Vite production build passed.
- `node scripts/browser-regressions.mjs`: keyboard/pointer aim ownership, repeated Help, 48px touch targets, real emulated touch movement and launching, and no page errors.
- `node scripts/mobile-regressions.mjs`: portrait and landscape drag-to-move, no page scrolling, simultaneous movement and firing, cancellation, visible focus changes, explicit pause and a simulated hidden-document notification.
- `node scripts/survival-browser.mjs`: real combat reaches the first level at about six seconds, opens three choices, freezes time, prevents Escape from skipping the choice, and accepts keyboard/touch selections. Travel extends 39 world units beyond the start; the camera follows and nine terrain chunks remain active. No state injection is used. Captures cover desktop, portrait and short landscape.

## Endurance and rendering

`npx tsx scripts/survival-soak.ts` runs the actual simulation without rendering. The unprotected XP-chasing test bot survived 99.5 simulated seconds, reached level 8 and defeated 135 enemies. This bot is not a balance benchmark or Jev.

A separate protected-player fixture ran 716 simulated seconds, reached level 74, and defeated 6,958 enemies. Protection deliberately prevents early death so later progression and storage caps can be exercised. Peaks stayed at 140 enemies and 320 pickups, with all three enemy types present. This is simulated endurance, not a claim of physical-device performance.

The scene uses instancing for enemies, loot, projectiles and terrain. Renderer stress across 80 distant chunk transitions preserved geometry allocation and disposed of transient lightning effects. Mobile omits desktop SSAO and uses a smaller shadow map. Per-instance culling and simpler mobile enemy/loot/tire meshes reduced the dense fixture from 4,217,078 to 261,350 triangles (94%). The original robot is retained. `node scripts/mobile-render-audit.mjs` recorded 16.5 ms median frames on the host GPU with touch emulation; this is not a phone benchmark. Its offscreen check rendered zero enemies while retaining all 140 enemies in simulation.

A real-time browser playthrough survived 74.7 seconds, reached level 6 and 72 kills, equipped turret/burst/lightning, then died. The results screen appeared and restart reset level, kills and abilities. No browser errors were reported. The final production bundle also passed survival and multi-touch checks through the public Cloudflare tunnel.

## Visual verification

Opened and inspected `.impeccable/review/survival-desktop.png`, `survival-mobile.png`, and the desktop/portrait/landscape `survival-upgrade-*.png` captures. The upgrade choices remain readable and selectable at 390×844 and 844×390. The warm scrapyard palette, yellow robot, self-hosted type and cream controls remain established design choices.

## Known limits

- Physical phones, Safari/Firefox, Chromebook hardware and screen readers were not tested. Desktop Chromium touch emulation does not establish performance on a physical phone.
- The production bundle still emits Vite's chunk-size advisory. Three.js and rendering helpers dominate the main bundle.
- Late-run difficulty and module balance need human playtesting. Bosses, weapon evolutions, permanent progression, alternate characters and CrazyGames SDK/ads integration are not implemented.
- The world is procedural and repeatable, with bounded active chunks. It is not an authored campaign or a saved persistent world.
- Generated art remains a visual reference; runtime assets simplify its surface detail.

## Evidence

Reports and screenshots are in `.impeccable/review/`: `regressions.json`, `survival-browser.json`, `survival-soak.json`, and `survival-playthrough.json`. The playthrough uses normal frame timing and keyboard input; the separate protected simulation stress is labeled explicitly.
