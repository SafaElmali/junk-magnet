# Junk Magnet — product context

<!-- impeccable:product-schema 1 -->

## Platform
web

## Confirmed brief
Create an original survivor-like game intended for CrazyGames, using Impeccable design guidance and ImageGen. Vampire Survivors is a reference to the genre loop, not the theme. The user selected the Junk Magnet concept and explicitly authorized its first playable visual prototype.

## Authorized survival implementation
Preserve the selected warm scrapyard art direction and implement a Vampire Survivors-style loop with an endless scrolling map, increasing enemy pressure, XP-based levels and three upgrade choices per level. Maintain optional directional scrap launching alongside automatic abilities. Support desktop and mobile, including simultaneous movement and launch.

## Stack
Blender for original editable models and GLB export; Three.js, TypeScript and Vite for the browser implementation. HTML/CSS for the HUD. Built-in ImageGen for reference artwork and the ground texture. These were recommended to and accepted by the user before implementation.

## Current state
Endless local single-player prototype in this folder. A procedural world follows the robot; time-driven pressure introduces runners and brutes alongside cans. XP offers weapon and support upgrades while combat pauses. Death shows survival time, level, kills and the run build. Art is simpler than the original generated target. No server, accounts, ads or CrazyGames SDK integration.

## Positioning
Defeated enemies provide temporary scrap ammunition. It automatically orbits and attacks; launching spends the orbit to clear a path, then the player rebuilds from wreckage. A small automatic pulse allows recovery even when the orbit is empty.

## Open decisions
Tune progression, module balance and late-run crowd pressure; consider bosses and evolutions after validating the core loop. Validate physical mobile and Chromebook performance and current CrazyGames submission requirements before release. Working title availability is unchecked; platform approval is not claimed.
