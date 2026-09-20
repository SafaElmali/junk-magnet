# Gameplay guide

[Back to README](../README.md)

## Survive and build

Your orbit fires automatically at nearby enemies. Silver wreckage replenishes ammunition, and a close-range magnetic pulse keeps attacking when the orbit is empty. Collect blue energy nuts for XP and choose an upgrade each time you level up. Enemy pressure grows as you explore the endless scrapyard.

The ability guide in the main menu explains all ten abilities and their ranks. Browsing it does not change your build. In solo, upgrade selection pauses combat; use a click, tap, keys 1–3, or arrow keys and Enter to choose. Co-op continues while upgrades are pending.

Three evolutions activate automatically when both requirements are reached during a run:

| Evolution | Requirements | Effect |
| --- | --- | --- |
| Scrap Cyclone | Orbiting Saws 5 + Pickup Magnet 2 | Permanent rotating blades, area damage, and inward pull |
| Storm Circuit | Chain Lightning 5 + Turbo Treads 2 | Longer reach, extra jumps, and faster attacks |
| Iron Bastion | Scrap Turret 5 + Steel Plating 2 | Longer-lived, faster turrets with piercing rounds |

## Explore

Bosses and mini bosses introduce charging lanes, aimed bolts, and temporary danger zones. Watch the ground warnings before attacks land. Boss kills grant parts, energy, scrap, and repairs.

- **Repair stations** restore up to 40 health when needed.
- **Supply chests** open after 1.2 seconds nearby, granting five XP, six scrap, and three parts.
- **Salvage contracts** require eight seconds inside their zone, granting twelve XP, a full orbit, and eight parts. Leaving slowly drains progress.

Each discovery rewards once per run. Parts are banked when the run ends in defeat.

## Workshop and saves

| Robot | Unlock | Bonus |
| --- | --- | --- |
| SCRAP-01 | Available from the start | +10% damage |
| SCOUT | 80 parts | +18% speed and +0.8 m pickup range |
| VOLT | 120 parts | Starts with lightning; +15% damage and −5% speed |

Reinforced Hull reduces incoming damage; Magnet Tuning extends pickup range. Each has three permanent ranks costing 25, 60, and 110 parts. Robot and workshop changes apply to the next run.

Defeat banks discovered and boss parts, plus one part per ten kills and per thirty survival seconds. Starting a new run or abandoning an unfinished run does not bank rewards.

Parts, unlocks, upgrades, and personal bests save in browser local storage. There is no account or cloud sync; blocked storage falls back to session memory. In solo, **Pause → Main Menu → Continue** resumes the current run in memory. Reloading loses it.

## Settings

English, Turkish, German, French, Spanish, and Portuguese are available in **Settings → Language**. Graphics presets, sound, and language choices are remembered locally. Reduced-motion preferences limit animation and impact recoil. During solo play, pause to access settings and help.

For room codes, reviving teammates, and shared rewards, see the [co-op guide](multiplayer.md).

## Field tools and weapon specializations

Every robot now starts with a hovering helper drone. **Q** or the drone button cycles its role during a run: Collector transports nearby existing scrap and energy, Repair restores 3 HP every 5 seconds, and Guard attacks a nearby enemy every 2 seconds. Changing roles retains the action cooldown; a disabled robot cannot repair itself back to life. The Blender-built companion has twin ducted fans, smooth turning and banking, and role-specific equipment: a salvage magnet, repair nozzle or twin guard barrels. Its light and beam match the active role. Regenerate the model and studio preview with `npm run assets:drone`; the editable source is `art/drone-kit.blend`.


At rank 3, each weapon offers a permanent, exclusive specialization for the current run, without consuming another level:

| Weapon | First branch | Second branch |
| --- | --- | --- |
| Orbiting Saws | Wide Reaper: wider, stronger orbit with weaker launches | Rail Shards: stronger piercing launches with weaker orbit damage |
| Chain Lightning | Chain Network: more targets and longer jumps with less damage | Focused Bolt: triple damage to one target, without chaining |
| Scrap Turret | Rapid Sentry: shorter firing intervals with weaker shots | Rail Sentry: stronger, longer-range piercing shots with slower fire |
| Magnetic Burst | Repulsion Wave: wider blasts and stronger knockback with less damage | Core Crusher: concentrated damage in a smaller radius |

Existing rank progression and weapon evolutions continue to work with both branches. Pending XP waits for the branch choice in solo; co-op keeps simulating while each player chooses. The chosen branch appears in loadout tooltips and the end-of-run build report.


The new controls and descriptions support all six languages and desktop/touch layouts. Drone roles and specialization choices are validated by the co-op server; each teammate owns their own choices and cooldowns. Existing saves do not need migration.

`node scripts/field-browser.mjs` checks real keyboard/touch controls, paused timers, responsive layouts, and independent co-op field tools. New simulation tests cover specialization tradeoffs, drone behavior, and streamed terrain.

`node scripts/drone-solo-browser.mjs` checks only solo gameplay at five desktop/mobile viewport sizes, including role controls, the Blender asset, pause and movement across the original scrapyard.
