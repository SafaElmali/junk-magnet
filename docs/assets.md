# Asset pipeline

[Technology index](technology.md) · [Development](development.md) · [Audio guide](audio.md)

The game combines original Blender geometry, Blender-rendered UI artwork, generated reference/promotional images and a ground texture, authored SVG icons, bundled fonts, and downloaded CC0 audio. The categories have different sources; an ImageGen reference is not a game mesh.

## Asset inventory

| Assets | Editable source / provenance | Delivered files |
| --- | --- | --- |
| Base robot, common enemies, equipment, props, scrap | [Base builder](../scripts/build_assets.py), [character guide](character-builds.md) | `public/models/*.glb`, `art/junk-magnet-assets.blend` |
| Scout, Volt, three workshop portraits | [Robot builder](../scripts/build_robot_assets.py), [kit notes](../art/ROBOT-ASSETS.md) | Variant GLBs, `public/robots/*.png`, `art/robot-kit.blend` |
| Ten ability illustrations | [Ability builder](../scripts/build_ability_assets.py), [kit notes](../art/ABILITY-ASSETS.md) | `public/abilities/*.png`, `art/ability-kit.blend` |
| Chest, repair dock, salvage console | [Discovery builder](../scripts/build_discovery_assets.py), [kit notes](../art/DISCOVERY-ASSETS.md) | Discovery GLBs, `public/discoveries/*.png`, `art/discovery-kit.blend` |
| Furnace boss, crusher miniboss | [Boss builder](../scripts/build_boss_assets.py), [kit notes](../art/BOSS-ASSETS.md) | Boss GLBs, `art/boss-kit.blend` |
| Helper drone | [Drone builder](../scripts/build_drone_asset.py), [character guide](character-builds.md) | `public/models/helper-drone.glb`, `art/helper-drone.png`, `art/drone-kit.blend` |
| Concept board, robot turnaround | [Exact prompts and references](../art/PROMPTS.md) | `art/concept-board.png`, `art/robot-turnaround.png` |
| README cover and social preview | [Exact prompt and robot portrait reference](../art/COVER-PROMPT.md) | `art/cover.png`, identical `public/og-image.png` |
| Concrete ground texture | [Exact prompt](../art/FLOOR-PROMPT.md) | `public/textures/yard-concrete.png` |
| UI icons / favicon | SVG authored in UI source, e.g. [main](../src/main.ts) and [menu](../src/menu.ts) | Inline SVG and [favicon](../public/favicon.svg) |
| Barlow Condensed / DM Sans | Fontsource packages and imports in [main](../src/main.ts) | Vite-bundled fonts; OFL notices in [licenses](../public/licenses/) |
| Sound effects and music | [Credits](../public/licenses/audio-credits.md), [source manifest](../public/audio/sources.json) | `public/audio/`; see [audio guide](audio.md) |

## Rebuild Blender assets

Install Blender separately. The [character guide](character-builds.md) records the Blender version used for the enemy redesign and explains geometry, coordinates, instancing, and mobile variants. Run these from the repository root on the configured macOS installation:

```sh
npm run assets
npm run assets:robots
npm run assets:abilities
npm run assets:discoveries
npm run assets:bosses
npm run assets:drone
```

Run the base builder before the robot builder: the SCRAP portrait imports `public/models/robot.glb`. The discovery builder imports robot modeling helpers without running the robot build. Each command overwrites its generated outputs, so run only the relevant builders when making a focused change. On other systems, use your Blender executable, for example:

```sh
blender --background --factory-startup --python scripts/build_robot_assets.py
```

The scripts run inside Blender's Python; they do not require a separate `pip install bpy`. They save editable `.blend` snapshots and export the deliverables. Treat the Python recipe as the reproducible source of geometry; manual edits to a `.blend` are not automatically reflected in the next scripted rebuild. The base library snapshot has a documented revision caveat in [character builds](character-builds.md).

Preserve named transform groups used for animation, such as the discovery chest lid and the drone fans/tools. When changing enemy geometry, check the desktop models and the corresponding mobile rendering path. Commit the recipe, affected GLBs/PNGs, refreshed scene snapshots when rebuilt, and relevant notes together.

## Generate or revise images

Use built-in ImageGen with the exact prompt in the asset's provenance file. The dependency order is:

1. Generate the concept board using [its prompt](../art/PROMPTS.md), with no image input.
2. Supply that board as the reference for the robot turnaround prompt in the same file.
3. For the cover, supply `public/robots/scrap.png`, the Blender-rendered portrait, with [the cover prompt](../art/COVER-PROMPT.md).
4. Generate the ground texture independently with [the floor prompt](../art/FLOOR-PROMPT.md). Its delivery is `public/textures/yard-concrete.png`, loaded by [the scene](../src/scene.ts).

These are the recorded prompts and inputs, not a deterministic build command. No seed or underlying model version was recorded; a new generation can differ. Preserve the checked-in original when exact visual continuity matters. The concept board describes an early design and includes controls that differ from the current game.

When replacing the cover, also copy it to `public/og-image.png` and update the dimensions in both HTML pages as described in [deployment metadata](deployment.md).

For a revision, record the exact final prompt, tool used, reference filenames, output filename, and any crop, resize, or other processing. Inspect the output before replacing the shipped file: confirm robot identity and text on the cover, consistent views in the turnaround, and repeating edges, flat lighting, quiet contrast, and gameplay readability in the ground texture. Generated reference/promotional images must remain labeled as such rather than presented as gameplay captures.

## Verify and deliver

For model and UI art changes, run `npm run build`, start the appropriate local server, then use the checks listed in [development](development.md) and [character builds](character-builds.md). Inspect screenshots at actual gameplay scale and in desktop/mobile layouts. For texture changes, inspect a wide ground area so tiling seams and distracting repetition are visible. Review file size changes and loading behavior as well as appearance.

Vite copies `public/` into the production output without requiring Blender or ImageGen. Files in `art/` are authoring/reference material unless explicitly copied or referenced elsewhere. Do not edit generated `dist/` files as the source of a change. Keep font and third-party audio notices with their assets; Three.js's bundled notice is also in [licenses](../public/licenses/).
