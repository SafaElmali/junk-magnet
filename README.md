# Junk Magnet — endless scrapyard survival

A tiny salvage robot in a sunny 3D scrapyard. Enemies become orbiting weapons. Your scrap storm fires automatically; collect the wreckage and build it again.

## Run

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5184/**. Click **LET’S MAKE A MESS**.

- **Move:** WASD / arrow keys, or drag anywhere in the yard on a touch device.
- **Attack:** automatic. Scrap targets the nearest living enemy within 8 units, with a 1.15-second cooldown. Collect wreckage to reload; the automatic close-range pulse keeps attacking when the orbit is empty.
- **Upgrade:** collect blue energy nuts to level up; choose one of three modules with a tap, click, or keys 1–3. Combat freezes while choosing.
- **Pause:** Escape or the pause button. Leaving the tab pauses; mobile browser focus changes do not interrupt a visible game.
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

The map fills the viewport during a run. A thin XP bar, small timer/level/kill counters and ability icons sit at the top. Health follows the centered robot. Combat has no launch button, ammunition panel, or manual aiming. Pause reveals language, sound and help. The lobby retains its title and instructions.

## Language / Dil

Use the **TR / EN** button to switch between Turkish and English without restarting your run. During play, pause first to reveal language, sound and help controls. The first visit follows the browser language; your choice is saved locally. Menus, HUD, help, upgrade names/descriptions, results and accessibility labels are translated. Extended Latin font subsets support Turkish characters.

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

Weapon evolutions, bosses, permanent progression and alternate characters are not included. Physical mobile/Chromebook profiling, broader browser coverage, further art work and platform integration are still needed before submission.

Font and Three.js licenses are included in `public/licenses/`. Game geometry and UI icons are original to this prototype; generated reference provenance is recorded alongside the art.

### Main menu

The full-screen title menu includes Play/Continue, New Run, the ten-ability reference, language/sound settings, and How to Play. Pause → Main Menu preserves the current run in memory; Continue resumes it. New Run resets the run. Returning from the results screen prepares a fresh run. Reloading the page does not save an unfinished run. Menu buttons support keyboard focus, Enter/Space, and up/down navigation; Escape returns from a submenu. The portrait layout stacks the character card below the actions, while landscape keeps the controls beside the title.

`node scripts/menu-browser.mjs` checks the menu, settings, reference, fresh starts and same-run resume at desktop, portrait, narrow portrait and landscape sizes.
