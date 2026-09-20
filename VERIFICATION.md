# Verification — September 20, 2026

## Endless survival implementation

The former 36-kill shift is replaced by a continuous run that ends on death. The map streams deterministic scrapyard sections around the following camera. XP opens three paused upgrade choices; seven ranked modules plus repeatable repair/refill/overclock options remain available as the build develops.

## Automated checks

- `npm test`: 21 focused tests cover normalized unbounded movement, independent facing, obstacle collisions, pause/upgrade freezes, XP carryover and consecutive levels, three distinct choices, maxed-build fallbacks, launch guards, swept projectile collisions, ability behavior, death, time-based pressure, entity bounds and terrain determinism/seams.
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

## Turkish language support

- `node scripts/language-browser.mjs` verifies Turkish browser-language detection, saved English override, switching during Help and level-up without resetting time/choices/abilities, and localized upgrade selection.
- Inspected Turkish captures at 1440×900, 390×844, 844×390 and 320×740; mobile header buttons remain at least 48×48px. Turkish character subsets are bundled.
- `src/i18n.test.ts` covers preference fallback, dynamic values and translations for all ten upgrade/consumable IDs without simulation mutation.

## Compact gameplay HUD

- Production build and 21 tests pass. `scripts/hud-browser.mjs` checks full-viewport play, one visible Pause control, compact timer/health/launch geometry, settings access, language switching and actual level-up selection at 1440×900, 390×844, 844×390 and 320×740.
- The compact HUD checks also passed through the public Cloudflare link. Mobile gesture regressions still pass: simultaneous movement/launch, cancellation, scrolling prevention and pause behavior.
- `compact-hud-*.png` and `compact-upgrade-*.png` record the redesigned live layout; earlier survival captures document the previous layout; Turkish captures were refreshed. Physical-device testing remains outstanding.

## Automatic combat (2026-09-20)

This revision replaces the earlier manual launch controls. `npm test` passes 23 tests, including nearest-living-target selection, converging projectiles, cooldown/reload, out-of-range ammo preservation, phase freezing and full projectile-pool behavior. Production build passes; the existing bundle-size advisory remains.

`mobile-regressions.mjs` and `browser-regressions.mjs` pass automatic fire while moving, keyboard-facing behavior, pointer independence, cancellation, no page scrolling and pause checks. `hud-browser.mjs` passes four viewport sizes (1440×900, 390×844, 844×390, 320×740): no launch button or lower HUD, automatic fire, frozen attacks during pause, settings and real level-up selection. Refreshed compact screenshots and inspected the portrait capture. These are Chromium desktop/touch-emulation checks, not physical-phone tests. Earlier manual-launch and balance reports describe their original revision.

## Arcade main menu (2026-09-20)

Production build, formatting checks and all 23 unit tests pass. `scripts/menu-browser.mjs` passes desktop (1440×900), portrait (390×844), landscape (844×390) and narrow portrait (320×740): ten ability entries, Turkish/English settings, sound toggle, Help, no sideways overflow, pause-to-menu with frozen simulation, Continue preserving the run, and New Run resetting it. Menu captures were opened and visually inspected; corrected duplicate mobile input hints during review. `browser-regressions.mjs` and `mobile-regressions.mjs` also pass against the updated UI. Physical devices remain untested. Current runs are retained in memory only, not across page reloads.

## Illustrated ability assets (2026-09-20)

Blender successfully generated ten 384×384 RGBA icons and an editable scene collection in `art/ability-kit.blend`. Production build, TypeScript and Prettier checks pass; Python asset script compilation passes. The existing Vite bundle-size advisory remains.

`ability-browser.mjs` verifies all ten images decode at their expected resolution, 4/3/3 category filtering, all detail selections, repeatable status, Turkish/English copy, unchanged game time/upgrades while browsing, and real level-up cards with the new artwork. `menu-browser.mjs` continues to pass start, resume, new run, settings and Help. Coverage includes 1440×900, 390×844, 844×390 and 320×740 Chromium viewports with touch emulation. Inspected ability-guide and upgrade captures, then gave level-up artwork its own 48px column to avoid touching text. Physical-device testing remains outstanding.

The final ability-browser checks also passed through the public Cloudflare tunnel, including image delivery and level-up image/text separation at desktop and portrait widths.

## Fixed-screen menus and drawn icons (2026-09-20)

Production build, TypeScript, Prettier and whitespace checks pass. `fixed-menu-browser.mjs` verifies 1440×900, 1024×600, 390×844, 320×740, 375×667, 320×568, 844×390 and 568×320 layouts: visible controls inside the viewport, no overflowing menu panels, wheel input without menu scrolling, all ten abilities through pagination, individual compact details, all five Help steps in Turkish and English, settings, preserved paused runs and resume. Rotation between portrait and landscape also passes. Play/infinite/navigation symbols are SVG paths; ability images remain Blender renders.

The revised `menu-browser.mjs` and `ability-browser.mjs` pass navigation, localization, read-only ability browsing and actual level-up selection. `menu-dialog-layout.mjs` uses explicitly labeled DOM fixtures to verify long descriptions and a full seven-ability result build at four viewport sizes; these are layout checks, not simulated run-completion evidence. The narrow choice layout and compact result composition were corrected after initial overflow findings. Inspected the resulting screenshots in `.impeccable/review/fixed-*`. Physical-device testing remains outstanding. The existing Vite chunk-size advisory is unchanged.

## Graphics, damage, six languages and illustrated Help

- Production TypeScript/Vite build and Prettier checks pass. The seven focused graphics/i18n tests pass: profile density, preference fallback/session persistence, language resolution, all catalog keys/placeholders, exact ability names and rank-dependent descriptions without state mutation.
- `node scripts/feature-browser.mjs` passes on production at 1440×900 (DPR 2), 390×844, 320×568, 844×390 and 568×320. Each size covers all six languages, five illustrated Help steps per language, navigation/category SVG icons, three weapon detail descriptions, no overflowing panels/offscreen controls, all four live quality settings, preference persistence and a preserved/resumed run. Evidence: `features-browser.json`, `features-help-*`, `features-settings-*`.
- `node scripts/render-feedback-browser.mjs` is an explicitly isolated renderer fixture with actual assets and controlled events. It verifies matching renderer/composer resolution at all four settings, robot-only material tint, recoil, frozen pause feedback, reduced-motion tint without recoil and reset. At 800×600/DPR 2, canvas sizes are 800×600 / 1200×900 / 1600×1200 / 2400×1800. Evidence: `render-feedback.json`, `robot-hurt-before.png`, `robot-hurt-impact.png`.
- `node scripts/damage-gameplay-browser.mjs` additionally uses real movement keys to approach enemies. Actual contact reduced health from 100 to 91 and triggered the robot feedback; pause froze it, and restarting restored 100 health and cleared it. No page errors. Evidence: `features-gameplay-damage.json`.
- Visually inspected the narrow illustrated Help, portrait settings, and isolated impact render. The direction mesh is removed; automatic targeting mechanics remain unchanged. Physical devices and non-Chromium browsers remain untested; Ultra GPU performance is not benchmarked.

## Pause menu redesign

The pause dialog now uses a dark workshop panel, a primary gold Continue action, a live frozen-run summary (time/level/salvage), and paired SVG-labeled New Run/Main Menu actions. Short landscape uses two columns. Help retains its illustrated card. `node scripts/pause-menu-browser.mjs` passes all six languages at 1440×900, 390×844, 320×568, 844×390 and 568×320: no panel overflow or offscreen actions, accurate summary values, frozen time through language changes, Help, resume, main menu and restart. Desktop and short-landscape captures were visually inspected. Production build, five i18n tests, formatting and whitespace checks pass. Evidence: `pause-redesign.json`, `pause-redesign-*.png`.

## Stable barrels, readable attacks and a visible first reload

- Production build and TypeScript pass. All 30 focused simulation/world/i18n tests pass, including real ground scrap collection before attacks, protected opening movement, blocked launch/abilities, frozen pause, reset, deterministic barrel palettes and locale coverage.
- `scripts/combat-renderer.mjs` is an isolated renderer fixture. It checks the mesh pulse, colored projectile trails and bounded impact pool at all four quality settings, pause, reduced motion, reset, stable geometry counts through repeated attacks, and 41 comparisons of actual barrel colors across streamed chunk seams. No browser errors; the 1440px fixture capture was visually inspected. Evidence: `combat-renderer.json`.
- `scripts/opening-browser.mjs` passes real production gameplay at 1440×900, 390×844, 320×568 and 568×320. Fresh runs have zero ammo and six ground pieces; all six are collected before combat; no immediate launch; opening pauses correctly; automatic attacks begin after it; hints disappear at seven seconds; restart replays the sequence. Ground/orbit captures were refreshed after improving ground-scrap silhouettes, and mobile capture visually inspected. Evidence: `opening-browser.json`.
- `scripts/opening-guide-layout.mjs` exercises actual fresh starts in six languages at 320×568 and 568×320 (36 collect/orbit/reload layouts). Text stays inside the viewport; hint does not overlap the joystick or health bar and has no pointer interception. No page errors. Evidence: `opening-guide-layout.json` and French phase captures. Physical-device GPU performance remains unmeasured.

## End-of-run report redesign

Production build, TypeScript, five i18n tests, Prettier and whitespace checks pass. `scripts/result-layout.mjs` uses explicit layout fixtures and the actual `resultBuildMarkup` function with seven owned abilities at 1440×900, 390×844, 320×568, 844×390 and 568×320 in all six languages. All 30 layouts fit without panel overflow or clipped controls. These replace the previous plain-text result layout fixture. Desktop and short-landscape captures were visually inspected.

`node scripts/result-gameplay.mjs` additionally reaches a real contact-damage loss using movement inputs, verifies the actual enemy count and owned-ability cards, changes language without changing the finished run, and returns through Main Menu to a fresh playable run. No page errors. The live result capture was visually inspected. Evidence: `result-redesign-layout.json` (fixtures), `result-redesign-live.json` (real gameplay), and their screenshots. Physical devices remain untested.

## Animated loading screen

Production build, TypeScript and five i18n tests pass. `node scripts/loading-browser.mjs` holds an actual model request during production boot, verifying real 78% progress, a moving scrap orbit, reduced-motion behavior, and automatic entry to the main menu when the request completes. It separately fails a real model request, checks that later completed requests do not overwrite the error, and verifies successful Retry recovery. All six languages pass loading and error layouts at 1440×900, 390×844, 320×568, 844×390 and 568×320 (60 layouts), without scrolling or clipped content. Desktop, narrow portrait, short landscape and error captures were visually inspected. Evidence: `loading-browser.json`, `loading-*.png`. These are Chromium checks; physical devices remain untested. The existing Vite bundle-size advisory is unchanged.

## Bosses, evolutions, discovery and workshop expansion

- Focused simulation, world, localization, encounter, discovery, progression and expansion tests pass (61 tests). Coverage includes telegraph-before-damage behavior, shared invulnerability, one-time boss rewards, phase freezing, real evolution attacks/piercing, robot bonuses, malformed/blocked storage, paid unlocks, bounded receipt history and deterministic exploration. Base weapon tests isolate robot damage bonuses; expansion tests cover the bonus separately.
- `src/expansion.test.ts` includes an explicit late-run fixture with maximum upgrades and invulnerability: 300 simulation seconds from 600 to 900, all eight enemy types, peaks of 140 enemies, 10 warnings, eight projectiles and eight danger zones. This is durability coverage, not a claim of natural-play balance.
- `scripts/discovery-browser.mjs` uses real keyboard play on the production build at 1440×900 and 390×844: collects the first chest, chooses the resulting upgrade, completes an eight-second salvage contract and reaches eleven earned parts. Pause freezes progress; hints fit without overlapping the mobile joystick. No application state is injected. Screenshots and `discovery-browser.json` record the checks.
- `scripts/expansion-renderer.mjs` is an explicitly labeled renderer fixture at 1440×900 and 390×844 with each of the three robots. It generates actual warnings through simulation, renders active hazards and all evolutions, and verifies frozen pause visuals and clean resets. Geometry remains 53 → 53 through repeated resets; no page errors. Rust warning boundaries and stronger amber fill were visually inspected on desktop and mobile. Evidence: `expansion-renderer.json` and `expansion-fixture-*.png`.
- `scripts/expansion-result-layout.mjs` is a labeled UI fixture with all seven abilities, three evolved names and a long bank balance. All six languages fit at five viewport sizes down to 320×568 and 568×320 (30 layouts), without clipped actions or scrolling. The narrow result was visually inspected.
- `scripts/expansion-gameplay.mjs` reaches a natural stationary-play defeat on production, verifies the exact persisted reward formula and completed-run counter, changes language without double-payment, and returns to a fresh run. Evidence: `expansion-result-live.json` and screenshot. No state mutation hooks are added to the production app.
- `scripts/workshop-browser.mjs` passes all six languages at the same five viewport sizes (30 cases). A clearly labeled 600-part saved-profile fixture exercises real UI purchases, selection and reload persistence; paused runs retain their original configuration, while the next run uses VOLT, lightning and the purchased hull ranks. Robot browsing, permanent-upgrade cards and all three recipe cards fit without scrolling. Narrow portrait recipes and short landscape upgrades were visually inspected. No page errors. Evidence: `workshop-browser.json` and `workshop-*.png`.

`scripts/boss-hud-layout.mjs` separately checks the actual HUD styles with an explicitly injected full-loadout layout: all five sizes keep the boss bar clear of ability chips, timer and toolbar. Robot renderer checks also verify that Scout/Volt body colors match their portraits, switching robots restores the correct base color, and damage feedback returns to that base.

All checks above use Chromium with emulated viewport sizes, not physical-device performance measurements. The new enemy mix, reward prices and boss health are initial playable tuning; a broad player-balance study has not been performed. Production build and formatting checks pass; the existing Vite chunk-size advisory remains.

## Immediate combat start

The former protected three-second opening is removed. Its remaining timer controls only the visible pickup animation: enemies, spawning, contact damage, weapons, encounters and discovery all advance immediately when Play is pressed. The guide stays readable alongside combat. This supersedes the earlier protected-opening behavior described above.

The 49 focused simulation/encounter/discovery/expansion tests pass, including first-frame enemy movement, first-frame damage and abilities, ongoing spawning during the guide, and real collection followed by firing before the guide finishes. `scripts/opening-browser.mjs` now checks immediate enemy movement before one second, automatic fire before three seconds, intentional pause and immediate restart at 1440×900, 390×844, 320×568 and 568×320. Evidence: `immediate-start.json` and `immediate-start-*.png`. Production build and formatting checks pass; the existing bundle-size advisory remains.

## Level-up cards and visible XP track

The level-up dialog now shares the workshop's dark/gold styling, with three illustrated choices, separate name/status lines, visible rank markers and a gold focus outline. Up/Down navigates the choices and Enter selects; existing pointer and 1–3 shortcuts remain. The full-width XP bar is 26px high with current level, exact XP and next-level labels; gameplay controls are offset below it. Pause/Results retain their original toolbar spacing and hide the track.

Production build, five i18n tests and formatting checks pass. `scripts/level-up-layout.mjs` uses explicit layout fixtures with the production `upgradeChoicesMarkup` renderer: four choice groups covering all ten abilities, six languages and five viewports (120 layouts), including new, ranked and repeatable choices. No panel scrolling or clipped descriptions/images; desktop, narrow portrait and short landscape captures were visually inspected. Evidence: `level-up-layout.json`, `level-up-fixture-*.png`.

`scripts/level-up-browser.mjs` additionally uses actual production gameplay at the same five sizes: reaches level two through the first chest, verifies frozen simulation, navigates with Up/Down, selects with Enter and verifies exactly one rank gained. It then collects real XP, checks the visible XP value and nonzero fill, verifies the strip does not overlap the toolbar/timer/loadout, and pauses/resumes. All five sizes pass without browser errors. Evidence: `level-up-browser.json`, `level-up-live-*.png`, `xp-bar-live-*.png`. These are Chromium viewport/touch-emulation checks; physical devices remain untested.

## Chain-lightning visual update

- Replaced the one-pixel line with layered cyan/white mesh arcs, irregular zigzags, two side branches and target sparks/rings. Strikes fade over 0.32 seconds; reduced-motion mode removes pulsing and ring expansion. Damage, targeting and cooldowns are unchanged.
- `node scripts/lightning-browser.mjs`: four controlled source-renderer fixtures (1440×900, 390×844, 844×390, plus reduced-motion portrait) pass. Actual simulation emits four chained strikes; effects freeze at zero render delta, expire completely and clear on restart. Stress checks cap active arcs at 40 with unchanged GPU geometry count. No page errors. These are controlled fixtures, not natural gameplay or physical-device performance measurements.
- Screenshots and machine-readable evidence: `.impeccable/review/lightning-*.png` and `lightning-browser.json`. Desktop and portrait screenshots visually inspected.
- TypeScript/Vite build and changed-file formatting checks pass. Existing large-bundle advisory remains.
