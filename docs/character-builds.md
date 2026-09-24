# How the characters are built

[Back to development and artwork](development.md)

The characters are real 3D meshes built with Python inside Blender, exported as `.glb` files, and displayed by Three.js in the browser. The enemy redesign was made by editing the procedural modeling script and running Blender in the background. The Python script is the editable recipe: changing dimensions, shapes, or materials and running it again regenerates the models.

This document records the enemy redesign introduced in commit `9965376`, along with the build commands for the other characters.

## Tools used

| Tool | Role in this work |
| --- | --- |
| Blender 5.2.0 LTS | Created the geometry, applied modeling modifiers, and exported the enemy GLBs. This was the local version used for the redesign. |
| Blender Python API (`bpy`) | Added primitives, built custom meshes, assigned materials, joined parts, and exported assets programmatically. It runs inside Blender's bundled Python. |
| Python `math` and Blender `mathutils` | Calculated curved profiles, rotations, and scene transforms. |
| glTF 2.0 binary format (`.glb`) | Packaged meshes and materials for the game. |
| TypeScript and Three.js | Loaded the GLBs, rendered repeated enemies with instancing, and animated their movement. |
| Vite, Playwright, and Google Chrome | Served the local game and checked the actual browser rendering on desktop and simulated mobile viewports. |

The enemy meshes were authored from geometry and material definitions in this repository. This redesign did not use downloaded character models, image-to-3D services, or AI-generated textures. The preview images below are browser screenshots of the actual models in a controlled scene.

## What was wrong with the old enemies?

The blue rectangle was the spitter's nozzle. The brown charger's two cream rectangles represented horns. These were separate `BoxGeometry` attachments in [ExpansionView](../src/expansion-view.ts), rather than detailed parts of the Blender model. The warden also used rectangular shield blocks.

The replacement keeps the scrapyard can silhouette and gives each attachment a recognizable shape. Large optics and mechanical details also make the shared body easier to read from the game's elevated camera.

![Spitter, charger, and warden in the desktop renderer](../.impeccable/review/enemies-desktop.png)

## How the enemy meshes were modeled

All four enemy asset definitions live in [build_assets.py](../scripts/build_assets.py), between the `# Enemy can` and `# Container` sections.

| Asset | Construction |
| --- | --- |
| `enemy-can.glb` | A cylindrical body with torus rings, a thick lid with a recessed rust-colored center, a pull tab, raised eye sockets, emissive amber lenses, angled eyebrows, a mouth grille, a rear service vent, shoulder joints, boots, and small pincer hands. |
| `enemy-charger-kit.glb` | Two curved tusks, rounded sockets, and a brow ram. Each tusk is a custom mesh joining four rings of 12 vertices; the rings move forward and upward while narrowing toward the tip. |
| `enemy-spitter-kit.glb` | A cylindrical socket and barrel, a torus muzzle rim, a dark inset disc that suggests a bore, a small glowing aperture, and two rounded pressure pods. The bore is modeled as an inset surface, not a Boolean-cut tunnel. |
| `enemy-warden-kit.glb` | Close-fitting shield plates extruded from clipped polygon outlines, with beveled edges, dark backing plates, circular hubs, and small rivets. |

The builder's `cube`, `cyl`, `sphere`, `torus`, and `poly` helpers provide the basic shapes. Bevel modifiers soften machined edges; weighted normals on beveled boxes and smooth shading on curved surfaces control how light catches them. Small rectangular pieces remain useful for brows, vents, and pincers, where their shape has a clear mechanical purpose.

Materials use Blender's Principled BSDF shader with base color, metallic, and roughness values. Dark gunmetal separates joints from the shell, brushed steel defines hardware, and rubber distinguishes the feet. Amber optics add emission so the eyes remain visible. These enemy materials do not require image textures.

## Export and game integration

The builder uses Blender's Z-up coordinates, with the character facing negative Y. The glTF export converts this to the game's Y-up coordinates, facing positive Z.

Before export, the script joins parts that share a material. Each asset is exported at its authored origin; only afterward are objects moved into the Blender library display layout. The three equipment files contain attachments only and are positioned to fit the shared can body.

[YardScene](../src/scene.ts) loads the GLBs with `GLTFLoader`. It renders the common body and gives enemy types their proportions and shell tints. [ExpansionView](../src/expansion-view.ts) loads the corresponding equipment into material-based `InstancedMesh` batches. More enemies reuse those batches rather than adding a separate draw call for every individual part.

The meshes have no skeletal animation for this enemy workflow. The renderer applies facing, bounce, lean, and hit squash with object transforms. Equipment follows the same transforms as its body so it stays attached during movement and damage feedback.

For mobile, `YardScene.mobileModels()` constructs a simpler can body directly from Three.js primitives. Its face, lid, vents, and arms were updated to match the Blender design. The charger, spitter, and warden still use the Blender equipment GLBs. Changes to the shared body therefore need a matching edit to the mobile version.

![The matching mobile versions](../.impeccable/review/enemies-mobile.png)

## Rebuilding the assets

Run commands from the repository root. Install Blender separately; the npm commands use its bundled Python, so a separate `pip install bpy` is unnecessary.

On macOS, the full base asset build is:

```sh
npm run assets
```

This invokes:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python scripts/build_assets.py
```

On another platform, replace the Blender executable path with your installation's path. The background process starts with a fresh scene and does not alter an open interactive Blender session.

The full command regenerates the base robot, enemies, equipment, props, and scrap in `public/models/`, and saves `art/junk-magnet-assets.blend`. Review the generated diff before committing because this command rebuilds more than just enemies.

For the September 20 enemy change, only the builder's common setup/helpers and enemy section were executed in background Blender, exporting the four enemy GLBs. The existing `art/junk-magnet-assets.blend` library snapshot was not regenerated in that commit. Use the Python source or import the current GLBs to inspect this revision; run the full asset build to refresh the editable library scene.

Other character builders use the same Blender-to-GLB workflow:

| Characters | Command | Source |
| --- | --- | --- |
| Base robot, can body, and special enemy equipment | `npm run assets` | [Base asset builder](../scripts/build_assets.py) |
| Scout and Volt, plus workshop portraits | `npm run assets:robots` | [Robot builder](../scripts/build_robot_assets.py), [model and portrait notes](../art/ROBOT-ASSETS.md) |
| Boss and miniboss | `npm run assets:bosses` | [Boss builder](../scripts/build_boss_assets.py) |
| Helper drone | `npm run assets:drone` | [Drone builder](../scripts/build_drone_asset.py) |

The robot-variant builder reads the existing base robot GLB for its portrait, so generate the base asset first when rebuilding everything from source.

The playable robots, unlike the enemies, export separate moving parts: a rocking `body`, spinning wheels and tread links that run round the tracks. The [robot asset notes](../art/ROBOT-ASSETS.md#moving-parts) describe the naming the game relies on. For the September 24 wheel-animation change, only the base builder's common setup/helpers and robot section were executed to export `robot.glb`, followed by the full robot-variant build. As with the enemy change, `art/junk-magnet-assets.blend` was not regenerated.

## Checking a character change

1. Edit the Blender recipe and regenerate the affected GLBs. Match shared-body changes in `mobileModels()`.
2. Run `npm run build` for TypeScript checking and production bundling.
3. Start `npm run dev`, then run `node scripts/expansion-renderer.mjs` in another terminal. Set `GAME_URL` if using a different local port.
4. Inspect the screenshots from above, from the front, and from behind. Check that eyes, weapons, and shields stay legible at normal gameplay size and that equipment follows body movement.
5. Commit the recipe, generated GLBs, renderer changes, and relevant visual evidence together.

The expansion renderer check covers desktop and simulated mobile layouts, attachment instances, encounter effects, pause behavior, resets, and stable geometry counts across repeated fixtures. It passed for this redesign, as did the production build. Physical-device performance was not measured in this work. A separate combat renderer check encountered an existing pulse-width assertion mismatch (`0.28` expected versus `0.15` reported); that unrelated assertion was left unchanged.
