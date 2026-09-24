# Ability artwork

Seventeen original, procedural Blender models made for Junk Magnet. No stock artwork, external textures, fonts or generated reference images are used in this kit.

- Editable source: `ability-kit.blend` (one scene per ability).
- Rebuild: `npm run assets:abilities` on the configured macOS Blender installation, or `blender --background --factory-startup --python scripts/build_ability_assets.py` elsewhere. To re-render only some icons, pass their ids after Blender's `--` separator: `blender --background --factory-startup --python scripts/build_ability_assets.py -- drone_collector drone_repair drone_guard`. Every scene is still rebuilt and saved to the `.blend`.
- Delivery: `public/abilities/<upgrade-id>.png`, 384 × 384, transparent RGBA. Cycles, 32 samples, orthographic camera, AgX, consistent studio lights.
- Runtime uses the PNGs in the ability guide and level-up choices; the Blender models are not loaded into the running game. Existing compact combat HUD glyphs remain unchanged.

| ID | Object |
| --- | --- |
| saw | Machined saw with an orbit ring |
| lightning | Wound induction coil with an electric bolt |
| turret | Twin-barrel salvage turret |
| burst | Concentric magnetic emitter |
| boots | Tracked booster module |
| magnet | Red horseshoe pickup magnet |
| armor | Steel-rimmed teal shield |
| repair | Portable repair case |
| refill | Scrap crate with spare blade, bolt and nut |
| overclock | Power chip with gold contacts |
| drone_collector | Helper drone with its magnet tool, pulling a nut and bolt through cyan field rings |
| drone_repair | Helper drone with its repair nozzle, a red cross and a cyan repair ring |
| drone_guard | Helper drone with its twin barrels, cyan tracer rounds and a red guard crest |
| harpoon | Red magnet-tipped harpoon with gold barbs, its cable spooled on a navy reel |
| slag | Teal salvage mortar lobbing a molten shell over a crusted slag puddle |
| capacitor | Three charged teal cells on a gold bus bar with a cyan charge bolt |
| amplifier | Teal emitter dish radiating ground field rings with outward gold arrows |

The drone scenes import `public/models/helper-drone.glb`, keep only the matching role tool and swap its materials for the kit's shared ones, so the icons match the gameplay model without drifting from the rest of the set. Rebuild the drone GLB before these icons if its geometry changes. The Workshop's permanent upgrades reuse `armor.png` and `magnet.png`.

The gold, teal, red, cream and brushed-metal materials follow the existing scrapyard art direction. Rebuild the source scenes to change lighting, camera angle or geometry consistently across the set.
