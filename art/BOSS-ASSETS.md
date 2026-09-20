# Boss models

Original Blender geometry matching the sunlit miniature scrapyard palette. No downloaded models or textures.

- **Furnace boss:** broad tracked base, twin exhaust stacks, recessed glowing furnace grate, armored shoulders and top mortar. 9,468 triangles, five material batches.
- **Crusher miniboss:** lower forward-heavy silhouette, hydraulic ram, ivory tusks, hazard-striped blade and charge beacon. 7,200 triangles, six material batches.

Source: `scripts/build_boss_assets.py`. Editable scenes: `art/boss-kit.blend`. Runtime: `public/models/enemy-boss.glb` and `enemy-miniboss.glb`. Run `npm run assets:bosses` to regenerate with Blender. Models use Blender Z-up/-Y front and export as glTF Y-up/+Z front, authored at runtime scale.

`src/scene.ts` renders separate material-instanced pools on desktop and mobile; the crusher leans into its charge warning. Existing combat timing, collisions, rewards and ground telegraphs are unchanged. The previous enlarged-can models and floating box accents are removed for these two enemies.
