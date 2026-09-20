# Ability artwork

Ten original, procedural Blender models made for Junk Magnet. No stock artwork, external textures, fonts or generated reference images are used in this kit.

- Editable source: `ability-kit.blend` (one scene per ability).
- Rebuild: `npm run assets:abilities` on the configured macOS Blender installation, or `blender --background --factory-startup --python scripts/build_ability_assets.py` elsewhere.
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

The gold, teal, red, cream and brushed-metal materials follow the existing scrapyard art direction. Rebuild the source scenes to change lighting, camera angle or geometry consistently across the set.
