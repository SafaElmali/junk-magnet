# Playable robot models and workshop portraits

SCOUT and VOLT are original Blender models, built to match SCRAP-01's rounded enamel shell, ivory faceplate, glass eyes and detailed rubber tracks. SCOUT has a compact collector crown, sensor bar, raked aerials and utility pods; VOLT has copper-wound ceramic coils, glass energy terminals and a power backpack.

- Builder: `npm run assets:robots` (`scripts/build_robot_assets.py`, Blender).
- Editable scenes: `art/robot-kit.blend`, one scene per robot.
- Game models: `public/models/robot-scout.glb`, `robot-volt.glb`. Original `robot.glb` remains unchanged.
- Workshop portraits: `public/robots/{scrap,scout,volt}.png`, 768×768 transparent Cycles renders of the exact matching models. These are rendered 3D images, not a separate live WebGL scene in the menu.
- Render setup: orthographic three-quarter camera, three area lights, 48 samples with denoising, AgX color transform.
- GLB meshes are merged by material to keep draw calls bounded. All three models load during the existing asset-loading phase; changing robots toggles model visibility without rebuilding geometry. Damage feedback operates on isolated materials and restores each model's original colors.

Rebuilding regenerates both the two variant GLBs and all three portraits. The SCRAP source GLB is only read for its portrait. No stock or AI-generated character art is used.
