# Discovery props

Original Blender models now match the playable robot material palette: rounded teal enamel, ivory panels, brass straps, steel fasteners and rubber fittings.

- `npm run assets:discoveries` rebuilds `public/models/discovery-{chest,repair,salvage}.glb`, matching 768px transparent renders in `public/discoveries/`, and editable scenes in `art/discovery-kit.blend`.
- `scripts/build_discovery_assets.py` reuses geometry/material/studio helpers from `scripts/build_robot_assets.py`; importing those helpers does not rebuild the robots.
- The supply chest has a hollow body and a separate `Chest_Lid` rear hinge plus `Chest_Loot` contents. Game animation opens the lid and removes supplies when collected. It stays open on revisits.
- Repair dock: enamel cabinet, ivory cross panel, charge indicators, service hose/nozzle, docking rails and status lamp.
- Salvage console: machined round platform, safety markers, sloped screen, buttons, intake grille and caged amber signal lamp.
- Geometry is merged by material, while the lid/contents retain their transform groups. All 11 streamed slots share the loaded GLB resources. Only the progress rings and six short reward sparks per slot use generated overlay geometry.
- Consumed station indicators become unlit. Opening/sparks use simulation time and freeze during pause or upgrade selection; reduced motion shows the final open state immediately without flying sparks.

Rewards remain gameplay-driven: chest = 5 XP, up to 6 attack scrap and 3 workshop parts; repair = up to 40 health; salvage = 12 XP, full 12-scrap orbit and 8 workshop parts. The UI receipt records actual capped gains. Workshop parts are banked at the end of the run.
