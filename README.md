# Junk Magnet — endless scrapyard survival

A tiny salvage robot in a sunny 3D scrapyard. Enemies become orbiting weapons. Your scrap storm fires automatically; collect the wreckage and build it again.

## Run

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5184/**. Choose **PLAY** (or **OYNA** in Turkish).

- **Move:** WASD / arrow keys, or drag anywhere in the yard on a touch device.
- **Attack:** automatic. Scrap targets the nearest living enemy within 8 units, with a 1.15-second cooldown. Collect wreckage to reload; the automatic close-range pulse keeps attacking when the orbit is empty.
- **Upgrade:** collect blue energy nuts to level up; choose one of three modules with a tap, click, or keys 1–3. Solo combat freezes while choosing; co-op continues.
- **Pause (solo):** Escape or the pause button. Leaving the tab pauses; mobile browser focus changes do not interrupt a visible game.
- **Sound:** optional; toggle the speaker button. Audio is synthesized locally.

Your orbit attacks automatically. Silver wreckage replenishes it; the automatic pulse can defeat enemies even with an empty orbit. Survive for as long as you can: enemy pressure grows with elapsed time, and death ends the run. Blue energy nuts grant XP and upgrade choices. The map continues as you move through streamed, deterministic scrapyard sections.

## What's included

- Original Blender-authored robot, can enemy, container, tires, cones and three scrap models.
- GLB assets loaded by Three.js, warm directional light, soft shadows and desktop contact shading.
- Following camera on desktop and mobile; a scrolling procedural yard with sparse solid props.
- Ordinary cans, fast runners and durable brutes.
- Upgradeable scrap orbit, chain lightning, deployed turrets, magnetic bursts, speed, pickup range, armor and repairs.
- Keyboard, mouse and touch controls; paused background state; reduced-motion support without damage flicker.
- Cream/navy HUD with health, XP, level, survival timer, equipped modules, automatic attack feedback.
- A deterministic simulation separated from rendering, with focused progression, combat and endurance tests.

## Compact play screen

The map fills the viewport during a run. A 26px framed XP bar shows the current level, collected/required energy and next level. Small timer/kill counters and ability icons sit below it. Health follows the centered robot. Combat has no launch button, ammunition panel, or manual aiming. Pause reveals language, sound and help. The lobby retains its title and instructions.

## Language / Dil

Choose a language in **Settings → Language**, or cycle languages with the flag/code button without restarting your run. During play, pause first to reveal language, sound and help controls. The first visit follows the browser language; your choice is saved locally. Menus, HUD, help, upgrade names/descriptions, results and accessibility labels are translated. Extended Latin font subsets support the six available languages.

**TR / EN** düğmesiyle dili değiştirebilirsin. Oyun sırasında bu ayarlara ulaşmak için önce duraklat. Oyun sıfırlanmaz; dil tercihin sonraki ziyaretlerde de korunur.

## Artwork and editable source

- `art/junk-magnet-assets.blend` — editable Blender asset library.
- `scripts/build_assets.py` — reproducible model authoring and GLB export script.
- `public/models/` — eight runtime GLB assets.
- `art/robot-turnaround.png` — generated production reference.
- `art/concept-board.png` — selected visual target, not a running-game screenshot.
- `public/textures/yard-concrete.png` — generated concrete base-color texture.
- `art/PROMPTS.md`, `art/FLOOR-PROMPT.md` — exact built-in ImageGen prompts and provenance.
- `.impeccable/review/desktop.png` — actual playable browser capture.

Regenerate the assets on this Mac with `npm run assets`. On another machine, run your Blender executable with `--background --factory-startup --python scripts/build_assets.py`. The script builds an isolated background scene and preserves the user's open Blender session.

The models were authored with Blender Python; no paid AI-to-3D service was used. Surface wear, environment density and magnetic trails remain simpler than the concept image.

## Verification

```sh
npm test
npm run build
```

The saved browser checks use installed Google Chrome through Playwright. Run the dev server on 5184 and a production preview on 5185 (`npm run preview -- --port 5185 --strictPort`):

```sh
node scripts/browser-check.mjs
node scripts/browser-regressions.mjs
node scripts/mobile-regressions.mjs
node scripts/survival-browser.mjs
```

The regression check covers repeated Help, movement facing, automatic targeting, actual emulated touch movement and automatic attacks, and 48px touch controls. The mobile regression checks drag-to-move, scrolling, automatic fire during movement and pause behavior. The HUD check verifies the absence of manual fire controls and reaches a real level-up in four viewport sizes. The survival browser check reaches a real level-up, chooses an ability, and traverses beyond the old arena. New survival checks default to production preview on port 5185; set `GAME_URL` to verify a tunnel instead.

See `VERIFICATION.md` for measured results and limitations.

## Scope and next stage

The game is local, single-player, and has no server, accounts, ads or CrazyGames SDK integration. The endless survival loop is implemented; it is still a prototype requiring balance and physical-device profiling. Enemy and visual counts are bounded rather than retaining every object forever.

Weapon evolutions, bosses, local permanent progression and alternate robots are implemented. Physical mobile/Chromebook profiling, broader browser coverage, further art work and platform integration are still needed before submission.

Font and Three.js licenses are included in `public/licenses/`. Game geometry and UI icons are original to this prototype; generated reference provenance is recorded alongside the art.

### Main menu

The full-screen title menu includes Play/Continue, New Run, the ten-ability reference, language, display-quality and sound settings, and How to Play. Pause → Main Menu preserves the current run in memory; Continue resumes it. New Run resets the run. Returning from the results screen prepares a fresh run. Reloading the page does not save an unfinished run. Menu buttons support keyboard focus, Enter/Space, and up/down navigation; Escape returns from a submenu. The portrait layout stacks the character card below the actions, while landscape keeps the controls beside the title.

`node scripts/menu-browser.mjs` checks the menu, settings, reference, fresh starts and same-run resume at desktop, portrait, narrow portrait and landscape sizes.

### Illustrated ability guide

Blender renders now illustrate all ten abilities. The guide filters Weapons, Support and Supplies, and selecting a card shows its effect, maximum rank or repeatable status, and how to acquire it. Browsing does not equip upgrades or modify the run. The same artwork appears in level-up choices. All six languages and mobile layouts are supported.

`npm run assets:abilities` rebuilds the transparent icons and editable `art/ability-kit.blend`. See `art/ABILITY-ASSETS.md` for provenance and build details. `node scripts/ability-browser.mjs` verifies image delivery, categories, all detail selections, translation, read-only browsing and level-up images.

### Menus without scrolling

Main menu, settings, ability browsing and Help fit the current viewport. Compact ability screens use explicit previous/next pages and a separate detail screen; Back and Escape return to the same page. Help has five short steps. Orientation changes recalculate the visible cards. Menu symbols are drawn SVGs, and ability images remain the original Blender renders; no emoji icons are used.

`node scripts/fixed-menu-browser.mjs` verifies eight desktop/phone viewport sizes, all ten abilities across pages, both help languages, settings, resume, rotation, visible controls and absence of overflow. `node scripts/menu-dialog-layout.mjs` verifies long-copy upgrade/result layouts using explicitly labeled UI fixtures.

### Display, languages and feedback

Settings → Graphics quality applies immediately and remembers the selected preset. High is the desktop default (native resolution up to 2× device density, antialiasing and richer shadows); Balanced is the touch-device default. Ultra adds 1.5× supersampling, capped at 3× density, and larger shadow maps. Performance reduces resolution and effects. Post-processing now uses the same resolution as the output canvas, fixing the previous desktop softness.

English, Turkish, German, French, Spanish and Portuguese are available through a named language picker with original SVG flags. The choice persists across reloads. Menu/category icons and five How to Play diagrams are original SVG drawings; ability art remains the original Blender renders. The automatic targeting arrow has been removed because attacks require no manual aiming.

Contact damage now changes the robot's own materials with a brief impact highlight, fading red tint and slight visual recoil. This does not move its collision position. Reduced motion removes the recoil; pausing freezes the feedback and restarting resets it.

### Readable first combat

New runs start with six real scrap pieces on the ground and an empty orbit. Enemies, spawning, contact damage and weapons are active from the first gameplay frame. The collection introduction is visual only and never freezes combat. The magnet starts pulling after 0.7 seconds, so players can see where their first ammunition comes from. A small translated, illustrated hint follows collecting, orbiting and reloading, then disappears after seven simulation seconds. Pause freezes the run; restarting begins combat immediately again.

Scrap projectiles have larger silhouettes and colored trails; the fallback magnetic pulse uses a thick cyan mesh beam with a gold tip and bounded impact effects. Ground scrap is enlarged and tilted for clarity. Barrel teal/rust/steel colors are decorative, with no damage or threat meaning. Their palette is derived from fixed world coordinates, so loading adjacent chunks no longer recolors existing barrels.

### End-of-run report

The results screen uses the same dark workshop panel as Pause. Survival time leads the three statistics; the enemy total is labeled accurately. The build summary uses the original Blender ability images with visible rank badges and accessible names. One More Shift is the primary gold action, with Main Menu alongside it. Narrow portrait wraps modules into four columns; short landscape splits the summary and modules into two columns without scrolling.

### Animated loading screen

An inline SVG robot and orbiting scrap appear immediately while the actual game assets load, using the same dark workshop colors as the menus. The progress bar reflects completed asset loads; animation adds no minimum wait. Narrow phones use a compact vertical layout and short landscape uses two columns. Reduced-motion preferences disable the orbit, hover and blink. Failed loading retains the design with a translated Retry button, and later asset callbacks cannot overwrite the error message.

### Bosses, exploration and evolving builds

Mini bosses arrive at 90-second slots and bosses at alternating 180-second slots; only one boss is active at a time. Their health scales with the run. Chargers lock a lane before dashing, spitters telegraph aimed bolts, and wardens place temporary danger zones. Rust boundaries and amber fill warn before impact; active ground hazards turn coral. Boss kills grant parts, energy, scrap and repairs. Existing endless enemy and world limits remain bounded.

Repair stations restore 40 health when needed. Supply chests open after 1.2 seconds nearby and grant five XP, six scrap and three parts. Salvage contracts require eight seconds inside their marked zone and grant twelve XP, a full orbit and eight parts; leaving slowly drains progress. Each point rewards once per run. Nearby points stream from deterministic sectors; a bounded sector ledger retires old sectors permanently within that run rather than letting revisits farm rewards.

Three automatic evolutions activate when both requirements are reached in the same run. Abilities → Recipes explains them:

| Evolution     | Requirements                       | Effect                                                                            |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| Scrap Cyclone | Orbiting Saws 5 + Pickup Magnet 2  | Permanent rotating blades, repeated area damage and inward pull even without ammo |
| Storm Circuit | Chain Lightning 5 + Turbo Treads 2 | Longer reach, four additional jumps, half the cooldown                            |
| Iron Bastion  | Scrap Turret 5 + Steel Plating 2   | Longer-lived, faster turrets with stronger rounds that pierce three enemies       |

### Robot workshop and saved progress

Workshop offers SCRAP-01 (+10% damage), SCOUT (+18% speed and +0.8 m pickup range, 80 parts), and VOLT (starts with lightning, +15% damage and −5% speed, 120 parts). Each has a matching 3D workshop portrait. SCOUT and VOLT have dedicated Blender-built game models with rounded shells, detailed tracks, collector equipment or copper coils; SCRAP-01 retains its original model. Regenerate the models and 768px portraits with `npm run assets:robots` (see `art/ROBOT-ASSETS.md`). Reinforced Hull and Magnet Tuning each have three permanent ranks, costing 25/60/110 parts. These reduce incoming damage and extend pickup range. A run takes a snapshot of its chosen robot and bonuses; workshop changes apply to the next run, never a paused one.

Defeat banks discovered/boss parts plus one part per ten kills and per thirty survival seconds. Main Menu and New Run do not bank unfinished runs. Results show the award and balance; repeated result rendering or changing languages cannot award it twice. Parts, unlocks, upgrades and best time/kills are versioned and validated in this browser's local storage. There is no account/cloud sync; blocked storage falls back to session memory. An unfinished run still does not survive reloading.

### Clearer level-up choices

Level-up uses three framed, illustrated choices with prominent ability names, new/rank-change labels and small rank markers. The focused choice receives a gold outline. Arrow Up/Down moves focus; Enter, a click/tap, or keys 1–3 select an ability. The simulation stays paused until selection. Desktop and portrait use rows, while short landscape fits three compact cards without scrolling. All six languages reuse the same choice renderer. The larger XP strip remains visible during level-up; Pause and Results use their existing run summaries instead.

### Discovery props and clear reward receipts

Supply chests, repair docks and salvage consoles now use original detailed Blender models. A chest opens on its rear hinge, releases a brief spark effect and remains open/empty; used stations switch their indicators off. Models and 768px preview art share the robots’ enamel/metal style. Rebuild with `npm run assets:discoveries`; editable sources and reward rules are documented in `art/DISCOVERY-ASSETS.md`.

Nearby prompts preview the rewards. Supply-chest cards disappear immediately after collection, including after a level-up selection; rewards and the opening animation still apply. Repair and salvage rewards retain a compact five-second receipt of actual capped gains. It explains that parts are banked when the run ends. Level-up selection pauses the receipt timer, so it remains readable after choosing an ability. No extra reward dialog interrupts combat.

## Online co-op (2 players)

Choose **PLAY TOGETHER / BİRLİKTE OYNA**, create a room, and share its six-character code. A friend opens the same website and joins with that code. The host starts the match. Each player uses the robot selected in their own workshop.

- The server owns the shared enemies, hazards, discoveries, rewards and simulation clock. Each robot has its own health, ammo, weapons and upgrade choices. XP and workshop parts are shared; an opened chest cannot pay twice.
- **Co-op never pauses for upgrades, menus or a background tab.** The compact upgrade drawer can be collapsed; movement and auto-attacks keep working while it is open. Select with touch/click or 1–3. Unspent level choices remain available and additional XP queues up.
- Stand within 2.3 metres of a fallen teammate for 3 uninterrupted seconds to revive them with 40 HP and 2 seconds of protection. Both robots down ends the run and banks its rewards. Leaving/disconnecting closes the room without banking an unfinished run.
- A teammate marker, health, distance and direction help you stay together. Spawn pressure is 1.5× solo. The world remains endless, with discoveries streamed around both players.
- Solo retains its existing pause and level-selection behavior.

### Run the multiplayer server

```sh
npm ci
npm run build
npm run serve
```

Open `http://127.0.0.1:5185`. The Node process serves `dist/` and accepts WebSockets at `/coop`. `PORT` can override 5185. During development, run `npm run dev` separately; Vite proxies `/coop` to the server on 5185.

The existing Cloudflare tunnel can forward port 5185. If the proxy rewrites the Host header, set `ALLOWED_ORIGINS` to the public origin (comma-separated for several), for example `ALLOWED_ORIGINS=https://your-game.example npm run serve`. A normal same-origin reverse proxy needs no override. Production requires an always-running Node service with WebSocket support; uploading `dist` alone provides solo play but cannot host co-op. Rooms live in this process's memory and close on restart or connection loss; there is no reconnect or cross-server room routing in this version.

Limits: 12 concurrent rooms, 32 connected sockets, 2 players per room; idle lobbies expire after 10 minutes and finished rooms after 5 minutes. Inputs expire after 350 ms without an update. Invalid/oversized/rate-limited messages are rejected. Simulation ticks at 30 Hz, snapshots at 15 Hz with client visual smoothing. Workshop saves remain local; their numeric bonuses are bounded to existing progression limits, not authenticated accounts.

```sh
npm run test:coop
node scripts/coop-browser.mjs
```

The browser check uses two independent sessions (desktop + touch mobile), real room creation/joining, real chest XP, movement and enemies during pending upgrades, separate choices, menus without pause, touch movement, disconnect handling and return to solo. No browser gameplay state is injected.
