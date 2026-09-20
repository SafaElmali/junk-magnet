# Sound and music

[Technology index](technology.md) · [Asset pipeline](assets.md) · [Audio credits](../public/licenses/audio-credits.md)

Junk Magnet uses the browser's native Web Audio API through [GameAudio](../src/audio.ts). There is no audio library or sound-generation service. The checked-in assets are 22 Kenney sound effects and Fupi's separate Empacotatron menu/gameplay loops, with sources and license records in [audio credits](../public/licenses/audio-credits.md). The [source manifest](../public/audio/sources.json) maps shipped filenames to the original downloads.

## Prepare audio assets

Normal builds use the existing files in `public/audio/`; no conversion is needed. To recreate them, download the original packs linked in the credits and retain their license notices. The source archives are not included in this repository. Install FFmpeg separately and use `sources.json` to select each original filename from the appropriate pack.

Effects are mono, 32 kHz, signed 16-bit PCM WAV. For example, from the repository root, set the path to the extracted Impact Sounds file and convert it:

```sh
AUDIO_SOURCE='/absolute/path/to/impactMetal_light_000.ogg'
ffmpeg -n -i "$AUDIO_SOURCE" -vn -ac 1 -ar 32000 -c:a pcm_s16le public/audio/pickup-scrap-1.wav
```

Repeat for each `.wav` entry in the manifest, using its `pack` and `original` fields. `-n` refuses to overwrite an existing output; when intentionally replacing a reviewed asset, use `-y` instead. These settings reproduce the documented delivery format; the original FFmpeg version and complete conversion invocation were not recorded, so byte-identical regeneration is not guaranteed.

Copy the original music loops unchanged and create 128 kbps MP3 fallbacks. Set `MUSIC_SOURCE_DIR` to the directory containing the two original OGG files:

```sh
MUSIC_SOURCE_DIR='/absolute/path/to/empacotatron'
cp -i "$MUSIC_SOURCE_DIR/empacotatron_loop.ogg" public/audio/yard-loop.ogg
cp -i "$MUSIC_SOURCE_DIR/empacotatron_menu.ogg" public/audio/menu-loop.ogg
ffmpeg -n -i public/audio/yard-loop.ogg -vn -c:a libmp3lame -b:a 128k public/audio/yard-loop.mp3
ffmpeg -n -i public/audio/menu-loop.ogg -vn -c:a libmp3lame -b:a 128k public/audio/menu-loop.mp3
```

The gameplay OGG loop is 80 seconds. Listen across loop boundaries after conversion, especially the MP3 fallback; encoded formats may have different boundary behavior. Do not silently replace an original with a trimmed or normalized derivative: record any processing in the credits.

For a new or replaced clip, update the filename mapping and credits, include any required license text, and check its loudness against the existing mix. Preserve the original name and source even when the shipped filename changes.

## Cue routing

[main.ts](../src/main.ts) creates one `GameAudio`, unlocks it on pointer/keyboard interaction, synchronizes game state, forwards gameplay events, and handles document visibility. [audio.ts](../src/audio.ts) owns the following:

| Source | Cue mapping |
| --- | --- |
| `GameEvent` collection | `collect` maps to `xp` for XP and `scrap` otherwise |
| Other `GameEvent` kinds | `hit`, `kill`, `hurt`, `launch`, `pulse`, `lightning`, `burst`, `turret` map directly |
| State transitions through `AudioCues.update()` | Upgrade ranks → `upgrade`; evolution → `evolve`; level increase → `level`; new boss → `boss`; boss defeat → `reward`; discovery → `repair` or `reward`; loss → `defeat` |
| Explicit UI calls | `play("ui")` and `play("start")` for interface and start feedback |

`AudioCues` compares scalar snapshots, so replacing state with a co-op snapshot does not replay old rewards. The first snapshot or a backwards time jump establishes a new baseline without emitting cues. Evolution takes precedence over an ordinary upgrade in the same update; defeat takes precedence over all other state cues.

To add an effect:

1. Place its WAV in `public/audio/` and record its source and license.
2. Add its filename stem to `clips`; an array provides random variants. `Cue` is derived from these keys.
3. Add a `[gain, cooldownSeconds]` entry to `mix`. Add to `priority` only for feedback that needs the reserved voice capacity.
4. Route it from a gameplay event, a state transition, or an explicit UI call. Avoid triggering one cue through multiple routes. New event kinds also need matching simulation types and event emission.
5. Extend [audio cue tests](../src/audio.test.ts) for new routing behavior. If the decoded clip count changes, update the expected counts in [the browser check](../scripts/audio-browser.mjs).

For a simple replacement with the same filename and cue, the routing does not need to change. Music track IDs are currently `menu` and `yard`; adding a third track requires extending the type, loading list, and state-based mix in `audio.ts`.

## Mixing and performance

Effects flow through a per-voice gain and stereo panner, then the effects-volume bus. Music has per-track gain nodes and bypasses the effects bus. Both feed a master gain of 0.75 and a dynamics compressor before the output. The compressor uses threshold −12 dB, knee 12, and ratio 8.

- `mix` controls gain and cooldown per cue. Effects vary playback speed between 0.94 and 1.06, except priority cues and UI clicks, which use 1.
- At most 12 ordinary voices play concurrently; priority cues may use up to 16 total. They do not evict active sounds.
- Gameplay events select only the nearest event of each cue kind per call and process priority cues first. Events farther than 22 world units are skipped; closer ones are attenuated and panned relative to the player.
- Missing or not-yet-decoded effects are skipped rather than queued. Subsequent interactions can retry failed loads.

Music loops keep running on the shared audio context and fade via gain changes instead of restarting at each transition. These base gains are multiplied by the music-volume preference and then the master gain:

| Game mode | Menu loop gain | Yard loop gain |
| --- | --- | --- |
| Menu / ready | 0.18 | 0 |
| Playing | 0 | 0.16 |
| Upgrade selection | 0 | 0.05 |
| Paused | 0 | 0 |
| Lost | 0.08 | 0 |

Music fades use `setTargetAtTime` with a 0.18-second time constant. Effects/master volume smoothing uses 0.025 seconds. Entering pause, menu, or loss stops active effects. Hiding the page stops effects and suspends the audio context; returning resumes it when at least one audio channel is enabled. Co-op keeps the simulation running while menus are open; UI overlays do not necessarily imply the solo `paused` mode.

## Preferences, loading, and diagnostics

Both channels start enabled at 50% for a fresh player. Settings offers separate toggles and volume controls; changing volume does not change the mute preference. Values are rounded and clamped to 0–100. The `junk-magnet-audio-v2` localStorage record contains `enabled`, `music`, `effectsVolume`, and `musicVolume`. Invalid/missing storage falls back safely.

The first pointer or keyboard interaction creates/resumes the audio context and loads the clips. Music tries OGG first, then MP3 if fetching or decoding fails. Successful decoding produces 24 buffers: 22 effects and two music tracks, with each MP3 serving as a fallback rather than a separate track. No remote audio service is used during play.

After the game finishes loading, inspect this read-only snapshot in the browser console:

```js
window.__JUNK_MAGNET__.snapshot().audio
```

Look at `state`, `loaded`, `failed`, `mode`, `voices`, `played`, and `tracks`, as well as the mute and volume values. `locked` before interaction is expected. For silent audio, interact first, check both channel settings and page visibility, then inspect failed filenames and network responses. A missing file must not block gameplay. The snapshot is exposed by [main.ts](../src/main.ts).

## Verification

From the repository root:

```sh
npx tsx --test src/audio.test.ts
npm run build
npm run preview -- --port 5185 --strictPort
```

Keep the preview running and use a second terminal:

```sh
node scripts/audio-browser.mjs
```

The browser check uses Playwright with installed Google Chrome. It checks real mixed output, mute independence, controls, saved preferences, pause/resume, a visibility fixture, OGG-to-MP3 fallback, and behavior with a missing effect. It covers five desktop/mobile viewport sizes. `GAME_URL` changes the address, `AUDIO_VIEWPORT=390` selects one viewport (fallback checks still run), and `AUDIO_LAYOUT_ONLY=1` limits coverage to settings layout and controls.

Reports are written to `/tmp/junk-magnet-audio-browser.json` and screenshots to `/tmp/junk-magnet-audio/`. Browser assertions complement a listening check for clipping, repetitive effects, and audible loop seams; they do not verify perceived audio quality or real-device autoplay behavior.
