import type { GameEvent, State, Vec } from "./simulation";
import { gameStorage } from "./storage";

const clips = {
  scrap: ["pickup-scrap-1", "pickup-scrap-2"],
  xp: ["pickup-xp"],
  hit: ["hit-1", "hit-2"],
  kill: ["kill-1", "kill-2"],
  hurt: ["hurt"],
  launch: ["launch"],
  pulse: ["pulse"],
  lightning: ["lightning"],
  burst: ["burst"],
  turret: ["turret"],
  ui: ["ui"],
  start: ["start"],
  upgrade: ["upgrade"],
  level: ["level"],
  reward: ["reward"],
  evolve: ["evolve"],
  boss: ["boss"],
  defeat: ["defeat"],
  repair: ["repair"],
} as const;
export type Cue = keyof typeof clips;
type Music = "menu" | "yard";
const mix: Record<Cue, [volume: number, cooldown: number]> = {
  scrap: [0.16, 0.1],
  xp: [0.12, 0.09],
  hit: [0.14, 0.085],
  kill: [0.23, 0.12],
  hurt: [0.5, 0.3],
  launch: [0.21, 0.13],
  pulse: [0.17, 0.2],
  lightning: [0.26, 0.2],
  burst: [0.36, 0.3],
  turret: [0.12, 0.16],
  ui: [0.25, 0.07],
  start: [0.4, 0.3],
  upgrade: [0.4, 0.2],
  level: [0.45, 0.5],
  reward: [0.45, 0.5],
  evolve: [0.5, 0.5],
  boss: [0.4, 1],
  defeat: [0.45, 1],
  repair: [0.4, 0.5],
};
const priority = new Set<Cue>([
  "hurt",
  "level",
  "upgrade",
  "reward",
  "evolve",
  "boss",
  "defeat",
  "repair",
]);
const preferenceKey = "junk-magnet-audio-v2";

/** Snapshot counters also work with co-op's deserialized states; never replay old rewards. */
export class AudioCues {
  private previous?: ReturnType<AudioCues["snapshot"]>;
  private snapshot(s: State) {
    return {
      time: s.time,
      level: s.level,
      phase: s.phase,
      ranks: Object.values(s.upgrades).reduce((a, b) => a + b, 0),
      boss: s.encounters.active?.id,
      defeated: s.encounters.defeated,
      reward: s.discovery.lastReward?.until,
      evolution: Object.values(s.evolutions).filter(Boolean).length,
    };
  }
  update(s: State): Cue[] {
    const next = this.snapshot(s),
      old = this.previous;
    this.previous = next;
    if (!old || next.time < old.time) return [];
    const cues: Cue[] = [];
    if (next.phase === "lost" && old.phase !== "lost") return ["defeat"];
    if (next.evolution > old.evolution) cues.push("evolve");
    else if (next.ranks > old.ranks) cues.push("upgrade");
    if (next.level > old.level) cues.push("level");
    if (next.boss !== undefined && next.boss !== old.boss) cues.push("boss");
    if (next.defeated > old.defeated) cues.push("reward");
    if (next.reward !== undefined && next.reward !== old.reward)
      cues.push(
        s.discovery.lastReward?.kind === "repair" ? "repair" : "reward",
      );
    return cues;
  }
}

export function eventCue(event: GameEvent): Cue {
  return event.kind === "collect"
    ? event.pickupKind === "xp"
      ? "xp"
      : "scrap"
    : event.kind;
}

export class GameAudio {
  /** Sound effects only; music has its own independent preference. */
  enabled = true;
  musicEnabled = true;
  effectsVolume = 50;
  musicVolume = 50;
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading?: Promise<void>;
  private lastPlayed = new Map<Cue, number>();
  private voices = new Set<AudioBufferSourceNode>();
  private tracks = new Map<
    Music,
    { source: AudioBufferSourceNode; gain: GainNode }
  >();
  private hidden = false;
  /** Host platform mute (CrazyGames) overrides the player's own settings. */
  private platformMuted = false;
  private mode: "menu" | "playing" | "paused" | "upgrade" | "lost" | "won" =
    "menu";
  private cues = new AudioCues();
  private played = 0;
  private failures = new Set<string>();

  constructor() {
    try {
      const saved = JSON.parse(gameStorage()?.getItem(preferenceKey) ?? "null");
      if (typeof saved?.enabled === "boolean") this.enabled = saved.enabled;
      if (typeof saved?.music === "boolean") this.musicEnabled = saved.music;
      for (const key of ["effectsVolume", "musicVolume"] as const) {
        if (typeof saved?.[key] === "number" && Number.isFinite(saved[key]))
          this[key] = Math.max(0, Math.min(100, Math.round(saved[key])));
      }
    } catch {
      /* Storage is optional. */
    }
  }

  private save() {
    try {
      gameStorage()?.setItem(
        preferenceKey,
        JSON.stringify({
          enabled: this.enabled,
          music: this.musicEnabled,
          effectsVolume: this.effectsVolume,
          musicVolume: this.musicVolume,
        }),
      );
    } catch {
      /* Keep the controls usable in private browsing. */
    }
  }

  async unlock() {
    if ((!this.enabled && !this.musicEnabled) || this.hidden) return;
    try {
      if (!this.context) {
        const context = (this.context = new AudioContext());
        this.master = context.createGain();
        this.master.gain.value = 0.75;
        this.effects = context.createGain();
        this.effects.gain.value = this.effectsVolume / 100;
        this.effects.connect(this.master);
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 12;
        limiter.ratio.value = 8;
        this.master.connect(limiter).connect(context.destination);
      }
      if (this.context.state !== "running") await this.context.resume();
      // One shared load per gesture; failures can retry on the next interaction.
      if (!this.loading)
        this.loading = this.load().finally(() => {
          this.loading = undefined;
        });
      await this.loading;
      this.updateMix();
    } catch {
      /* Autoplay restrictions or unavailable audio must not block play. */
    }
  }

  private async load() {
    const context = this.context!;
    const requests = [
      ...Object.values(clips)
        .flat()
        .map((name) => [name, [`${name}.wav`]] as const),
      ...(["menu", "yard"] as const).map(
        (name) => [name, [`${name}-loop.ogg`, `${name}-loop.mp3`]] as const,
      ),
    ];
    await Promise.all(
      requests.map(async ([name, files]) => {
        if (this.buffers.has(name)) return;
        for (const file of files) {
          try {
            const response = await fetch(
              `${import.meta.env.BASE_URL}audio/${file}`,
            );
            if (!response.ok) throw new Error(String(response.status));
            const buffer = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            this.buffers.set(name, buffer);
            this.failures.delete(name);
            return;
          } catch {
            /* Try the MP3 fallback on browsers without Vorbis support. */
          }
        }
        this.failures.add(name);
      }),
    );
  }

  async toggle() {
    this.enabled = !this.enabled;
    this.save();
    this.updateMix();
    if (this.enabled) {
      await this.unlock();
      this.play("ui");
    } else this.stopEffects();
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    this.save();
    this.updateMix();
    if (this.musicEnabled) void this.unlock();
  }

  setVolume(channel: "sound" | "music", value: number) {
    if (!Number.isFinite(value)) return;
    const volume = Math.max(0, Math.min(100, Math.round(value)));
    if (channel === "sound") this.effectsVolume = volume;
    else this.musicVolume = volume;
    this.save();
    this.updateMix();
  }

  setPlatformMuted(muted: boolean) {
    this.platformMuted = muted;
    this.updateMix();
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.updateMix();
    if (hidden) {
      this.stopEffects();
      void this.context?.suspend().catch(() => {});
    } else if (this.enabled || this.musicEnabled)
      void this.context?.resume().catch(() => {});
  }

  sync(s: State, inMenu: boolean) {
    const mode = inMenu ? "menu" : s.phase === "ready" ? "menu" : s.phase;
    if (mode !== this.mode) {
      this.mode = mode;
      if (
        mode === "paused" ||
        mode === "menu" ||
        mode === "lost" ||
        mode === "won"
      )
        this.stopEffects();
      this.updateMix();
    }
    for (const cue of this.cues.update(s)) this.play(cue);
  }

  private updateMix() {
    const context = this.context;
    if (!context || !this.master) return;
    const now = context.currentTime;
    this.effects?.gain.setTargetAtTime(this.effectsVolume / 100, now, 0.025);
    this.master.gain.setTargetAtTime(
      !this.hidden && !this.platformMuted ? 0.75 : 0,
      now,
      0.025,
    );
    for (const name of ["menu", "yard"] as const) {
      const buffer = this.buffers.get(name);
      if (
        !this.tracks.has(name) &&
        buffer &&
        !this.hidden &&
        this.musicEnabled
      ) {
        const source = context.createBufferSource(),
          gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain).connect(this.master);
        source.start();
        this.tracks.set(name, { source, gain });
      }
      // Both loops share the audio clock, so crossfades never restart a track.
      const level =
        this.hidden || !this.musicEnabled
          ? 0
          : name === "menu"
            ? this.mode === "menu"
              ? 0.18
              : this.mode === "lost" || this.mode === "won"
                ? 0.08
                : 0
            : this.mode === "playing"
              ? 0.16
              : this.mode === "upgrade"
                ? 0.05
                : 0;
      this.tracks
        .get(name)
        ?.gain.gain.setTargetAtTime(
          (level * this.musicVolume) / 100,
          now,
          0.18,
        );
    }
  }

  events(events: GameEvent[], listener: Vec) {
    // Play important cues first and the nearest event of each kind only.
    const nearest = new Map<Cue, GameEvent>();
    const distance = (event: Vec) =>
      Math.hypot(event.x - listener.x, event.z - listener.z);
    for (const event of events) {
      const cue = eventCue(event),
        previous = nearest.get(cue);
      if (!previous || distance(event) < distance(previous))
        nearest.set(cue, event);
    }
    for (const [cue, event] of [...nearest].sort(
      ([a], [b]) => Number(priority.has(b)) - Number(priority.has(a)),
    )) {
      const d = distance(event);
      if (d > 22) continue;
      this.play(
        cue,
        Math.max(0.08, 1 - d / 24),
        Math.max(-0.75, Math.min(0.75, (event.x - listener.x) / 12)),
      );
    }
  }

  play(cue: Cue, volume = 1, pan = 0) {
    const context = this.context;
    if (
      !this.enabled ||
      this.hidden ||
      !context ||
      context.state !== "running" ||
      !this.master
    )
      return;
    const [level, cooldown] = mix[cue],
      now = context.currentTime;
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < cooldown) return;
    // Reserve four voices for damage, rewards and other important feedback.
    if (this.voices.size >= (priority.has(cue) ? 16 : 12)) return;
    const choices = clips[cue],
      name = choices[Math.floor(Math.random() * choices.length)];
    const buffer = this.buffers.get(name);
    if (!buffer) return; // Never queue combat sounds to play after a slow download.
    const source = context.createBufferSource(),
      gain = context.createGain(),
      stereo = context.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value =
      priority.has(cue) || cue === "ui" ? 1 : 0.94 + Math.random() * 0.12;
    gain.gain.value = level * volume;
    stereo.pan.value = pan;
    source.connect(gain).connect(stereo).connect(this.effects!);
    this.voices.add(source);
    this.lastPlayed.set(cue, now);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      gain.disconnect();
      stereo.disconnect();
    };
    source.start();
    this.played++;
  }

  private stopEffects() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  diagnostics() {
    return {
      enabled: this.enabled,
      music: this.musicEnabled,
      effectsVolume: this.effectsVolume,
      musicVolume: this.musicVolume,
      state: this.context?.state ?? "locked",
      mode: this.mode,
      hidden: this.hidden,
      loaded: this.buffers.size,
      failed: [...this.failures],
      voices: this.voices.size,
      played: this.played,
      tracks: [...this.tracks.keys()],
    };
  }
}
