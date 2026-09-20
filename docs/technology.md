# Technology and tools

[Back to README](../README.md)

Start here to find the tools used to build Junk Magnet and the instructions for changing each part. This index describes the checked-in project; dependency ranges live in [package.json](../package.json), and exact npm resolutions live in [package-lock.json](../package-lock.json). Use `npm ci` to install those versions.

## Game and development

| Technology | What it does here | Project documentation / source |
| --- | --- | --- |
| TypeScript | Game simulation, UI, rendering integration, and multiplayer code | [Development](development.md), [simulation](../src/simulation.ts) |
| Three.js / WebGL | 3D scene, GLTFLoader, material instancing, effects, and animation | [Character integration](character-builds.md), [scene](../src/scene.ts) |
| HTML, CSS, inline SVG | Menus, HUD, touch controls, and authored icons; no UI framework | [Design system](../DESIGN.md), [main](../src/main.ts), [menu](../src/menu.ts) |
| Fontsource | Bundled Barlow Condensed and DM Sans, including Latin extended subsets | [Asset pipeline](assets.md), [font imports](../src/main.ts), [licenses](../public/licenses/) |
| Web Audio API | Decoded local effects, music loops, mixing, and volume controls | [Audio guide](audio.md), [implementation](../src/audio.ts) |
| Browser localStorage | Workshop progression, language, graphics, and audio preferences | [Gameplay](gameplay.md), [progression](../src/progression.ts), [audio preferences](audio.md) |
| Node.js, npm, tsx | Development commands, TypeScript execution, and local co-op server | [Setup](../README.md), [multiplayer](multiplayer.md) |
| Vite | Dev server, static production bundle, preview, and build-time environment variables | [Development](development.md), [configuration](../vite.config.ts) |
| Node test runner | Simulation, audio cue, progression, and co-op tests through tsx | [Verification](../VERIFICATION.md), [npm commands](../package.json) |
| Playwright / Google Chrome | Browser behavior, screenshots, responsive layout, and performance checks | [Development and performance](development.md), [browser scripts](../scripts/) |
| Type declaration packages | Compile-time definitions for Node, Three.js, ws, and Workers | [package.json](../package.json), [TypeScript configuration](../tsconfig.json) |

Use Node.js 22.12+; CI and Netlify currently select 22.22.0. `npm run build` runs TypeScript checking before bundling. There is no separate npm lint command. Browser scripts generally require installed Google Chrome; check the selected script's default URL or set its supported `GAME_URL` override.

## Art and sound production

| Tool / format | What it produces | Workflow |
| --- | --- | --- |
| Built-in ImageGen | Concept board, robot turnaround, README cover, concrete ground texture | [Asset pipeline and generation records](assets.md) |
| Blender, Blender Python (`bpy`, `mathutils`) | Procedural original geometry, materials, editable scenes, and rendered portraits | [Character builds](character-builds.md), [all asset rebuild commands](development.md) |
| glTF 2.0 / GLB | Mesh and material delivery to Three.js | [Export and runtime integration](character-builds.md) |
| Cycles / PNG | Transparent ability illustrations, robot portraits, discovery previews | [Ability kit](../art/ABILITY-ASSETS.md), [robot kit](../art/ROBOT-ASSETS.md), [discovery kit](../art/DISCOVERY-ASSETS.md) |
| Kenney and Fupi audio | Downloaded CC0 effects and music; no sound-generation model is used | [Credits](../public/licenses/audio-credits.md), [filename mapping](../public/audio/sources.json) |
| FFmpeg / WAV, OGG, MP3 | Recreate effect encoding and music fallback conversions | [Audio preparation](audio.md) |

Blender and FFmpeg are separate authoring tools, not npm dependencies. Blender uses its bundled Python. ImageGen is an authoring tool only; no image-generation API or key is required to build or play. The repository includes the shipped media, so normal development does not require regenerating it.

## Services and deployment

| Service / package | Role | Configuration and guide |
| --- | --- | --- |
| `ws` / WebSockets | Local Node co-op transport | [Co-op guide](multiplayer.md), [server](../server/index.ts) |
| Cloudflare Workers / Durable Objects | Hosted co-op rooms and authoritative simulation | [Deployment](deployment.md), [Worker](../worker/index.ts), [Wrangler configuration](../wrangler.jsonc) |
| Wrangler / Miniflare | Worker deployment, local execution, and runtime tests | [Deployment](deployment.md), [runtime tests](../worker/runtime.test.mjs) |
| Netlify | Builds and serves the frontend | [Deployment](deployment.md), [netlify.toml](../netlify.toml) |
| Cloudflare DNS | Domain routing for website and co-op | [DNS and HTTPS](deployment.md) |
| GitHub Actions | Frontend and Worker builds, co-op and Worker tests | [Verify workflow](../.github/workflows/ci.yml) |
| PostHog / `posthog-js` | Explicit anonymous gameplay analytics | [Setup, events, privacy, and verification](analytics.md), [environment example](../.env.example) |

Co-op is hidden by default. Follow the opt-in commands in [multiplayer](multiplayer.md). Production configuration and service identifiers belong in [deployment](deployment.md); analytics configuration belongs in [analytics](analytics.md).

## Keep these records current

When changing a dependency, update the lockfile and this index if its role changes. For new media, record the source or exact generation prompt, inputs, outputs, and any conversion steps. Commit procedural recipes with their generated assets. Update the relevant guide and verification instructions when defaults, ports, flags, or commands change.
