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
