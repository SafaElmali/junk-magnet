---
name: Junk Magnet
description: A sunlit miniature scrapyard with a clear collect, orbit, and launch loop.
colors:
  ink: "#173342"
  cream: "#fff6e3"
  teal: "#3c9298"
  red: "#cd4e39"
  muted: "#596964"
  line: "#d7cbb4"
  robot-badge: "#f3c74c"
  focus: "#287da2"
  progress: "#71cbd0"
  health: "#cc5944"
  orbit-filled: "#3b8991"
  orbit-empty: "#d8d2bc"
  scene-cream: "#fff4d8"
  scene-teal: "#459b9c"
  scene-rust: "#8c4e36"
  scene-steel: "#a2aca6"
  scene-floor-tint: "#e9c4a9"
  scene-fog: "#dcb394"
  upgrade-card: "#f0e4ca"
  upgrade-hover: "#e4d7b8"
  upgrade-icon: "#f4c44b"
  ability-icon: "#2d7177"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "58px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  wordmark:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "43px"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "45px"
    fontWeight: 800
    lineHeight: 1
  action:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "0.04em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    letterSpacing: "0.13em"
rounded:
  key: "4px"
  chip: "6px"
  action: "9px"
  badge: "10px"
  panel: "12px"
  intro: "16px"
  yard: "18px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  large: "24px"
  spacious: "32px"
components:
  ability-chip:
    backgroundColor: "#fff6e3ed"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "5px 6px"
  upgrade-choice:
    backgroundColor: "{colors.upgrade-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
  upgrade-choice-hover:
    backgroundColor: "{colors.upgrade-hover}"
  upgrade-sheet:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.intro}"
    padding: "30px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "15px 18px"
  button-icon:
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    width: "42px"
    height: "42px"
  button-pause:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    width: "42px"
    height: "42px"
  button-launch:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "13px 20px"
  orbit-panel:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "12px 16px 12px 12px"
  modal-card:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.yard}"
    padding: "32px 38px"
---

# Design System: Junk Magnet

## Overview

**Creative North Star: "Sunlit miniature scrapyard"**

An endless warm concrete scrapyard frames a small yellow salvage robot, a red horseshoe magnet, and can enemies with runner and brute variants. The high-angle orthographic camera, bevelled models, and soft physical shadows make the world feel like a tabletop toy. Sparse tire stacks and salvage drums create navigable obstacles while keeping the robot and scrap orbit readable.

Cream interface panels sit above the scene, with dark condensed titles and compact plain-language instructions. This documents the implemented endless survival prototype: increasing enemy pressure, blue XP pickups, and three paused upgrade choices at each level. Weapon and support upgrades build a run around the original collect, orbit, and automatic attack loop. Bosses, evolutions, and CrazyGames integration are future work. The approved visual direction remains unchanged from the concept stage.

**Key Characteristics:**
- Warm textured ground, cool salvage props, and a yellow/red player silhouette.
- Separate visible scrap pieces, an orbit ring, and a directional launch marker.
- Cream HUD panels at the edges, with the action kept in the center.
- Condensed display type paired with restrained sans-serif instructions.

Source of truth: `src/style.css` for the interface, `src/scene.ts` for runtime scene materials and lighting, `src/world.ts` for procedural terrain props, and `scripts/build_assets.py` for Blender materials. Tokens above are extracted values, not exact sampled colors from the artwork. Descriptive spacing and radius names categorize existing literals; they are not new CSS variables. The sidecar includes nine self-contained component previews and synthesized eight-step OKLCH color ramps for inspection; those ramps are metadata, not an implemented theme scale. Component previews use bundled fonts when available and sans-serif fallbacks otherwise. The optional Impeccable launcher/schema validator was not used. The frontmatter and schema-version-2 sidecar follow the [official document guidance](https://github.com/pbakaus/impeccable/blob/main/skill/reference/document.md).

## Colors

Warm cream and concrete carry the scene; dark blue-green provides contrast, while steel, teal, yellow, and red identify materials and actions.

### Primary
- **Deep yard ink** (`ink`): wordmark, important text, and primary actions.
- **Warm workshop cream** (`cream`): page background, HUD panels, and action text.

### Secondary
- **Salvage teal** (`teal`): orbit icon and loading progress; the scene uses its separate material teal.
- **Magnet red** (`red`): magnetic imagery. The health fill has its own related coral token.
- **Butter yellow** (`robot-badge`): the HUD player badge; the actual robot uses Blender material values under scene lighting.
- **Upgrade paper** (`upgrade-card`, `upgrade-hover`): choice cards and their hover state. Golden icon tiles (`upgrade-icon`) and dark teal ability icons (`ability-icon`) extend the existing workshop palette.

### Neutral
- **Quiet green-gray** (`muted`) and **paper seam** (`line`): declared interface support tokens. Individual labels and borders also retain their observed local shades.
- **Brushed steel**, **rust**, **warm scene ivory**, and **apricot floor tint**: runtime material colors. The floor tint multiplies the concrete texture; lighting and tone mapping change its final appearance.

**The Solid Reading Surface Rule.** Keep instructions and changing counters on cream panels, with shapes and text reinforcing color-coded states.

## Typography

**Display Font:** Barlow Condensed, sans-serif fallback; weights 700 and 800.
**Body Font:** DM Sans, sans-serif fallback; weights 400, 500, and 700.

Both families are bundled through Fontsource imports in `src/main.ts`. Compact condensed headings suit workshop lettering without using generated image lettering as UI text. DM Sans carries instructions and supporting labels.

### Hierarchy
- **Display:** intro title, using the frontmatter display role; reduces to 43px in the narrow layout and 36px in short landscape.
- **Wordmark:** frontmatter wordmark role; 49px on wide screens, 31px on narrow screens, and 30px in short landscape.
- **Headline:** modal titles; 36px narrow and 30px short landscape.
- **Action:** primary buttons. Combat has no manual attack control.
- **Body:** intro copy; modal copy uses 1.7 line height. Keep instructions short rather than filling the arena with text.
- **Label:** small secondary context. HUD numbers use tabular numerals; essential counters remain larger than decorative captions.

## Layout

The lobby retains the cream masthead and instruction footer. Starting a run switches to a full-viewport map with no outer gutters, logo, slogans or persistent tutorial text. `src/play-hud.css` owns the run layout; `src/style.css` retains the lobby and base components.

A 5px XP bar spans the top. Level and 25px ability chips sit at upper left, the 22px timer is centered, and an icon plus kill count sits beside the 48px pause control. Health is a 54×5px bar just below the centered robot, growing to 7px at critical health. There is no launch button or lower ammunition HUD: scrap automatically targets nearby enemies. Mobile movement uses a subdued 84px stick that becomes opaque during a drag. Controls respect safe-area insets.

During play, only Pause remains in the utility menu. Pausing reveals language, sound and help. Upgrade and result screens keep language/sound available while hiding inactive gameplay HUD elements. Upgrade choices are compact rows in a sheet up to 480px wide; short landscape uses three columns up to 720px wide. Titles are 26px and ability names 19px, with readable 12px mechanical descriptions. Keyboard choice shortcuts and focus handling remain intact.

## Elevation & Depth

Depth combines warm ambient interface shadows with actual 3D shadows. The scene uses an orthographic camera, warm directional sunlight, hemisphere fill, and soft shadow maps. Desktop adds small-radius ambient occlusion; coarse-pointer devices omit that postprocessing pass. The concrete texture repeats across the ground and receives shadows. The camera follows the robot on every platform. Nine 20-unit chunks form a streamed 3 × 3 neighborhood, with deterministic tire stacks, colored salvage drums, and ground markings. Props are visible collision obstacles inside the endless world, and the initial spawn area stays clear. The floor and lighting follow the player; chunk changes preserve the texture alignment.

### Shadow Vocabulary
- **Yard:** `0 9px 26px #6752301a`, separating the viewport from the cream page.
- **HUD:** `0 4px 9px #4633261a`, lifting small counters.
- **Action/orbit:** `0 5px 12px #5e462b24`, distinguishing lower controls from terrain.
- **Intro:** `0 10px 32px #503f2929`, supporting the welcome card.
- **Dialog:** `0 12px 36px #1d262938`, over a translucent dark backdrop.

## Shapes

Rounded panels and lightly bevelled model edges share a toy-like form language. The yard and dialogs use the largest panel radius, with tighter corners for buttons, badges, and pips. The circular movement stick and orbit ring signal continuous movement. The magnet, treaded player silhouette, cylindrical enemies, bolts, nuts, and saw scraps carry identity without detailed textures on every object. Movement controls the robot's smoothed facing independently of launch aim, so its body remains legible while automatic fire targets nearby enemies.

Editable models are in `art/junk-magnet-assets.blend`, with runtime GLBs under `public/models/`. The original generated ground image is `public/textures/yard-concrete.png`; its prompt is recorded in `art/FLOOR-PROMPT.md`. `art/concept-board.png` is art direction, not a gameplay screenshot.

## Components

### Buttons

Tactile, compact, and high contrast. Primary buttons use ink/cream, action-radius corners, and an inline arrow. Attacks are automatic; disabled pause reduces opacity. Icon buttons are outlined by default; pause is filled.

Hover changes the surface tone. Keyboard focus is a 3px blue outline offset by 4px. Pressed buttons move down 2px. Background and transform transitions last 150ms. Reduced-motion preference disables CSS transitions and the robot's idle bob; it does not remove gameplay movement or every effect.

### Cards / Containers

Health, timer, and salvage cards use nearly opaque cream, panel-radius corners, and the HUD shadow. Intro and modal cards use more generous padding. Help, pause, loading, upgrade, and defeat states share the same type and surface vocabulary. A defeated run shows survival time, level, recycled enemies, and the owned permanent abilities with ranks.

### Navigation

The masthead's mute, help, and pause controls form a compact utility group. Their icons keep a consistent stroke language. On touch, the larger hit area is independent of the icon artwork.

### Scrap Orbit

The physical orbit shows individual scrap pieces without a separate ammunition panel. Automatic volleys visibly empty the orbit, and nearby wreckage rebuilds it. The translucent ring and pale direction arrow make the action readable without a full-screen flash.

### XP and Build Chips

Blue energy pickups supply XP; silver scrap replenishes orbit ammunition. The top XP bar has a numeric caption and accessible progress values. Level replaces the original player-name label in the health panel. Small translucent cream chips display each owned permanent ability's icon and rank, with a full accessible name. They wrap within a bounded area beneath XP; repeatable consumables do not accumulate as permanent build chips.

### Upgrade Choices

Combat pauses behind a darker translucent backdrop while three choice buttons explain the new ability, next rank, or immediate effect. A gold icon tile, condensed ability name, and short quantitative description establish the reading order. Choices accept a tap, click, or keys 1–3; the existing blue focus treatment remains visible. Choosing resumes play, or presents another earned level if sufficient XP remains.

Permanent upgrades cover Orbiting Saws, Chain Lightning, Scrap Turret, Magnetic Burst, Turbo Treads, Pickup Magnet, and Steel Plating. Maxed permanent upgrades leave the pool. Field Repair, Scrap Delivery, and temporary Overclock keep three choices available as the permanent pool runs out; repair can also appear when health is low. These are repeatable effects, not evolutions or additional permanent ranks. The result build summary lists permanent abilities and ranks.

## Do's and Don'ts

### Do:
- **Do** preserve the sunlit toy-like world and clear yellow/red player silhouette.
- **Do** keep procedural obstacles sparse and visually aligned with their collision shapes.
- **Do** pair resource color with readable counts, shapes, or labels.
- **Do** maintain the coarse-pointer target sizes and visible keyboard focus.
- **Do** check portrait and short landscape layouts when changing the HUD.

### Don't:
- **Don't** replace the selected world with vampire or fantasy styling.
- **Don't** let decorative trails hide individual scrap pieces or enemy silhouettes.
- **Don't** use the concept board as evidence of working gameplay.
- **Don't** imply bosses, evolutions, or platform integration already exist.

Visual reference checks: `.impeccable/review/survival-desktop.png`, `survival-mobile.png`, and `survival-upgrade-desktop.png`, `survival-upgrade-mobile.png`, `survival-upgrade-landscape.png`. These record the implemented composition; they do not establish a blanket accessibility or device-performance guarantee.

## Language

The utility menu includes a 48px touch target for TR/EN, revealed by pausing during a run. Language changes preserve the active run and remember the preference. Turkish text uses the existing Barlow Condensed and DM Sans families with their extended Latin subsets. At narrow widths the wordmark shrinks to keep all four header controls usable. Menus, live HUD text, ability choices and accessible labels share the same locale.

## Main menu

The title screen now fills the viewport with a dimmed scrapyard behind a cream/gold, stacked Junk Magnet wordmark. A column of beveled arcade buttons prioritizes Play (or Continue for an unfinished run); a compact character card presents SCRAP-01 and its starting weapon. The robot portrait is original inline SVG, matching the existing yellow body and red magnet. The stage strip identifies the endless scrapyard without suggesting additional playable maps or characters. The ability reference and language/sound options replace the menu body, with explicit Back controls. On portrait phones the character card becomes a compact row under the actions; short landscape screens place the title beside the controls. Sources: `src/menu.ts`, `src/menu.css`, and lifecycle integration in `src/main.ts`. The sparse combat HUD is unchanged.
