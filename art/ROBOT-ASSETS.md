# Playable robot models and workshop portraits

SCOUT and VOLT are original Blender models, built to match SCRAP-01's rounded enamel shell, ivory faceplate, glass eyes and detailed rubber tracks. SCOUT has a compact collector crown, sensor bar, raked aerials and utility pods; VOLT has copper-wound ceramic coils, glass energy terminals and a power backpack.

- Builder: `npm run assets:robots` (`scripts/build_robot_assets.py`, Blender).
- Editable scenes: `art/robot-kit.blend`, one scene per robot.
- Game models: `public/models/robot-scout.glb`, `robot-volt.glb`. SCRAP's `robot.glb` comes from the base builder (`scripts/build_assets.py`).
- Workshop portraits: `public/robots/{scrap,scout,volt}.png`, 768×768 transparent Cycles renders of the exact matching models. These are rendered 3D images, not a separate live WebGL scene in the menu.
- Render setup: orthographic three-quarter camera, three area lights, 48 samples with denoising, AgX color transform.
- GLB meshes are merged by material to keep draw calls bounded, except for the moving parts below. All three models load during the existing asset-loading phase; changing robots toggles model visibility without rebuilding geometry. Damage feedback operates on isolated materials and restores each model's original colors.

## Moving parts

All three robots share the rig conventions in `scripts/robot_rig.py`, which [RobotRig](../src/robot-rig.ts) drives from the robot's movement each frame:

- `body`: an empty at the top of the tracks. The shell, face, magnet and other body meshes are parented to it, so the game can rock the body on its suspension while the tracks stay planted. It rocks back when the robot pulls away, dips when it stops, leans slightly forward while driving and rolls outward in turns.
- `<robot>_chassis_*`: the rubber tracks (and SCOUT/VOLT fenders), merged by material and fixed.
- `wheel_<L|R>_<n>`: road wheels with their origin on the axle. The hex nut and four lug bolts make the spin readable.
- `tread_<L|R>_<nn>`: tread links spaced evenly round each track, numbered in the order the belt moves when driving forward. The game slides every link towards the next one's pose.

`L` is the robot's left (+X). Wheels and links are linked duplicates, so each GLB stores one wheel mesh and one link mesh; the game draws each as an `InstancedMesh`. The tracks run at different speeds when turning, and in opposite directions during a pivot turn. The belt runs at a quarter of ground speed and never moves more than a third of a link per frame, because a true-speed belt strobes backwards at 60 fps. Reduced motion keeps the wheels and tracks moving but turns off the body sway and bob.

Rebuilding regenerates both the two variant GLBs and all three portraits. The SCRAP source GLB is only read for its portrait, so rebuild it first when SCRAP changes. No stock or AI-generated character art is used.
