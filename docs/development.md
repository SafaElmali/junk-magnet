# Development and artwork

[Back to README](../README.md) · [Technology index](technology.md) · [Asset pipeline](assets.md) · [Audio guide](audio.md)

## Checks

```sh
npm test
npm run test:coop
npm run build
```

The build runs TypeScript checking before Vite bundles the game. Browser checks use Playwright and installed Google Chrome. Start the dev server on 5184 and a production preview on 5185:

```sh
npm run dev
# In a separate terminal, after building:
npm run preview -- --port 5185 --strictPort
```

Then run the relevant checks:

```sh
node scripts/browser-check.mjs
node scripts/browser-regressions.mjs
node scripts/mobile-regressions.mjs
node scripts/survival-browser.mjs
```

The scripts open the game at `/play/`; set `GAME_URL` to a game page URL to test elsewhere. Additional scripts cover menus, abilities, workshop portraits, discovery feedback, and co-op. See [verification notes](../VERIFICATION.md) for measured results and limitations. For co-op checks, use the [Node server](multiplayer.md) instead of Vite preview on 5185.

### Performance checks

For the co-op regression, build with `VITE_COOP_ENABLED=true npm run build`, then start `PORT=5279 npm run serve` in a separate terminal and run these checks sequentially. Normal builds keep co-op hidden; the flag only enables it for this local verification.

```sh
node scripts/performance-regressions.mjs
PERF_QUALITIES=high,performance,default PERF_OUTPUT=.impeccable/review/performance-after node scripts/performance-run.mjs
node --expose-gc --import tsx scripts/performance-simulation.ts
```

The browser benchmark measures CPU, process RSS, JavaScript heap, and frame timing in an isolated Chrome session. `default` tests a fresh player's Balanced setting; saved quality choices remain unchanged. Idle scenes should render zero additional frames. The regression check covers pause/resume, upgrades, resizing, quality changes, and live co-op. The simulation check runs twelve simulated minutes without rendering. `GAME_URL` changes the server address and `PERF_OUTPUT` changes the output directory. See the [before/after report](../.impeccable/review/performance-after/README.md) for results and measurement limits.

## Editable assets

Game models are authored with Blender Python and exported as GLB files into [public/models](../public/models/). Editable scenes and generated reference artwork live in [art](../art/).

See [How the characters are built](character-builds.md) for the tools, enemy modeling techniques, export pipeline, mobile implementation, and rebuild workflow.

| Asset set | Rebuild on macOS | Source / notes |
| --- | --- | --- |
| Base robot, enemies, props, scrap | `npm run assets` | [Builder](../scripts/build_assets.py), [Blender scene](../art/junk-magnet-assets.blend) |
| Ability illustrations | `npm run assets:abilities` | [Ability assets](../art/ABILITY-ASSETS.md) |
| Robot variants and portraits | `npm run assets:robots` | [Robot assets](../art/ROBOT-ASSETS.md) |
| Discovery props and previews | `npm run assets:discoveries` | [Discovery assets](../art/DISCOVERY-ASSETS.md) |
| Boss and miniboss | `npm run assets:bosses` | [Boss assets](../art/BOSS-ASSETS.md) |
| Helper drone and preview | `npm run assets:drone` | [Builder](../scripts/build_drone_asset.py), [character workflow](character-builds.md) |

These commands use `/Applications/Blender.app/Contents/MacOS/Blender`. On another machine, invoke your Blender executable with `--background --factory-startup --python` followed by the corresponding builder script. The base asset builder uses an isolated background scene, preserving an open Blender session.

## Provenance and licenses

Game geometry and UI icons are original to this prototype. The README cover and concept board are promotional/reference art, not gameplay screenshots. Exact generation prompts are recorded in [cover provenance](../art/COVER-PROMPT.md), [reference prompts](../art/PROMPTS.md), and [floor texture provenance](../art/FLOOR-PROMPT.md).

Third-party font and Three.js licenses are in [public/licenses](../public/licenses/). Physical mobile and Chromebook profiling, broader browser coverage, balancing, and platform integration remain ongoing work.
