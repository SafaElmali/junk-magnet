# Development and artwork

[Back to README](../README.md)

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

Additional scripts cover menus, abilities, workshop portraits, discovery feedback, and co-op. See [verification notes](../VERIFICATION.md) for measured results and limitations. For co-op checks, use the [Node server](multiplayer.md) instead of Vite preview on 5185.

## Editable assets

Game models are authored with Blender Python and exported as GLB files into [public/models](../public/models/). Editable scenes and generated reference artwork live in [art](../art/).

| Asset set | Rebuild on macOS | Source / notes |
| --- | --- | --- |
| Base robot, enemies, props, scrap | `npm run assets` | [Builder](../scripts/build_assets.py), [Blender scene](../art/junk-magnet-assets.blend) |
| Ability illustrations | `npm run assets:abilities` | [Ability assets](../art/ABILITY-ASSETS.md) |
| Robot variants and portraits | `npm run assets:robots` | [Robot assets](../art/ROBOT-ASSETS.md) |
| Discovery props and previews | `npm run assets:discoveries` | [Discovery assets](../art/DISCOVERY-ASSETS.md) |

These commands use `/Applications/Blender.app/Contents/MacOS/Blender`. On another machine, invoke your Blender executable with `--background --factory-startup --python` followed by the corresponding builder script. The base asset builder uses an isolated background scene, preserving an open Blender session.

## Provenance and licenses

Game geometry and UI icons are original to this prototype. The README cover and concept board are promotional/reference art, not gameplay screenshots. Exact generation prompts are recorded in [cover provenance](../art/COVER-PROMPT.md), [reference prompts](../art/PROMPTS.md), and [floor texture provenance](../art/FLOOR-PROMPT.md).

Third-party font and Three.js licenses are in [public/licenses](../public/licenses/). Physical mobile and Chromebook profiling, broader browser coverage, balancing, and platform integration remain ongoing work.
