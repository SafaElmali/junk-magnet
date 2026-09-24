import type { Enemy, GameEvent, State, Vec } from "./simulation";
import { STAGES } from "./stages";

/** Caps for arsenal entities per robot; a weapon skips a shot rather than exceed them. */
export const ARSENAL_LIMITS = { harpoons: 10, shells: 8, puddles: 14 };
export const HARPOON = { speed: 22, reel: 26, width: 0.4, release: 2.2, carry: 3, loot: 12 };
export const SLAG = { flight: 0.65, tick: 0.5, range: 10, arc: 3 };
/** Pulse Reactor: a delayed second blast plus a pickup sweep after each blast. */
export const REACTOR = { delay: 0.5, reach: 1.3, damage: 1, cooldown: 0.8, sweep: 9, sweepTime: 0.6, pull: 16 };
/** Elite spawns ramp from 3% at 4:00 to 10% at 12:00, before stage and challenge bonuses. */
export const ELITE = { start: 240, full: 720, base: 0.03, peak: 0.1, health: 3.5, scale: 1.25, radius: 1.15, xp: 3, scrap: 6, parts: 1 };

export type Harpoon = Vec & {
  id: number;
  /** Owner position, so the cable can be drawn for either co-op robot. */
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  travelled: number;
  range: number;
  returning: boolean;
  damage: number;
  knockback: number;
  drag: boolean;
  /** Enemy ids struck during the current pass. */
  hits: number[];
  carried: number[];
  loot: number[];
};
export type SlagShell = Vec & {
  id: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  t: number;
  impact: number;
  burn: number;
  radius: number;
  duration: number;
  slow: boolean;
  erupt: boolean;
};
export type SlagPuddle = Vec & {
  id: number;
  radius: number;
  life: number;
  max: number;
  tick: number;
  burn: number;
  slow: boolean;
  erupt: boolean;
};
/** Plain arrays and numbers only: co-op snapshots and saved runs serialize it as JSON. */
export type ArsenalState = {
  harpoons: Harpoon[];
  shells: SlagShell[];
  puddles: SlagPuddle[];
  timers: { harpoon: number; slag: number };
  /** Rank at the last volley; a new rank fires at once, like the original weapons. */
  ranks: { harpoon: number; slag: number };
  /** Seconds until the Pulse Reactor echo; 0 when none is pending. */
  echo: number;
  /** Seconds left of the Pulse Reactor pickup sweep. */
  sweep: number;
};
export type ArsenalHooks = {
  damage(enemy: Enemy, amount: number): void;
  emit(event: GameEvent): void;
  /** Resolves obstacles after the arsenal moves an enemy. */
  settle(enemy: Enemy): void;
  radius(enemy: Enemy): number;
};
type Build = Pick<State, "upgrades" | "specializations" | "evolutions">;
export function createArsenalState(): ArsenalState {
  return {
    harpoons: [],
    shells: [],
    puddles: [],
    timers: { harpoon: 0, slag: 0 },
    ranks: { harpoon: 0, slag: 0 },
    echo: 0,
    sweep: 0,
  };
}
/** Capacitor Bank: −8% cooldown per rank on weapon abilities. */
export const cooldownScale = (s: Pick<State, "upgrades">) =>
  1 - 0.08 * (s.upgrades.capacitor ?? 0);
/** Field Amplifier: +10% radius per rank on burst, cyclone and slag areas. */
export const areaScale = (s: Pick<State, "upgrades">) =>
  1 + 0.1 * (s.upgrades.amplifier ?? 0);
export function harpoonStats(s: Build, rank = s.upgrades.harpoon ?? 0) {
  const volley = s.specializations.harpoon === "harpoon_volley";
  const anchor = s.specializations.harpoon === "harpoon_anchor";
  const winch = !!s.evolutions.winch;
  return {
    hooks: (anchor ? 1 : [0, 1, 2, 2, 3, 3][rank] + (volley ? 2 : 0)) + (winch ? 2 : 0),
    damage: (3.5 + rank * 2.5) * (anchor ? 2.4 : volley ? 0.6 : 1) * (winch ? 1.6 : 1),
    cooldown: (2.5 - rank * 0.2) * (winch ? 0.75 : 1) * cooldownScale(s),
    range: winch ? 10 : 8,
    spread: volley ? 0.3 : 0.22,
    knockback: anchor ? 1.2 : 0,
    drag: winch,
  };
}
export function slagStats(s: Build, rank = s.upgrades.slag ?? 0) {
  const cluster = s.specializations.slag === "slag_cluster";
  const pool = s.specializations.slag === "slag_pool";
  const meltdown = !!s.evolutions.meltdown;
  const damage = cluster ? 0.6 : pool ? 0.7 : 1;
  return {
    shells: (pool ? 1 : (rank >= 5 ? 2 : 1) + (cluster ? 1 : 0)) + (meltdown ? 1 : 0),
    impact: (2.5 + rank * 0.5) * damage,
    /** Damage every SLAG.tick seconds to enemies inside the puddle. */
    burn: (0.3 + rank * 0.04) * damage * (meltdown ? 1.5 : 1),
    radius: (0.95 + rank * 0.05) * (cluster ? 1.1 : pool ? 1.25 : 1) * areaScale(s),
    duration: (1.8 + rank * 0.2) * (pool ? 1.3 : 1) * (meltdown ? 2 : 1),
    cooldown: (4.4 - rank * 0.2) * cooldownScale(s),
    slow: pool,
    erupt: meltdown,
  };
}
export type ArsenalUpgrade = "harpoon" | "slag" | "capacitor" | "amplifier";
const tenths = (value: number) => Math.round(value * 10) / 10;
/** English rank copy and its values; the English template is also the translation key. */
export function arsenalRankCopy(s: Build, id: ArsenalUpgrade): [string, Record<string, number>] {
  const rank = s.upgrades[id] ?? 0,
    next = rank + 1;
  if (id === "harpoon") {
    const now = harpoonStats(s, rank),
      after = harpoonStats(s, next);
    if (!rank)
      return [
        "Throw a piercing hook ahead every {seconds}s for {damage} damage, out and back.",
        { seconds: tenths(after.cooldown), damage: tenths(after.damage) },
      ];
    return [
      after.hooks > now.hooks
        ? "Hook damage {before} → {after}; +1 hook; throws every {seconds}s."
        : "Hook damage {before} → {after}; throws every {seconds}s.",
      { before: tenths(now.damage), after: tenths(after.damage), seconds: tenths(after.cooldown) },
    ];
  }
  if (id === "slag") {
    const now = slagStats(s, rank),
      after = slagStats(s, next);
    if (!rank)
      return [
        "Lob slag at the biggest nearby group every {seconds}s. It leaves a burning puddle.",
        { seconds: tenths(after.cooldown) },
      ];
    return [
      after.shells > now.shells
        ? "Impact damage {before} → {after}; +1 shell; larger, longer puddles."
        : "Impact damage {before} → {after}; larger, longer puddles.",
      { before: tenths(now.impact), after: tenths(after.impact) },
    ];
  }
  if (id === "capacitor")
    return rank
      ? ["Weapon cooldowns −{before}% → −{after}%.", { before: rank * 8, after: next * 8 }]
      : ["−8% weapon cooldowns: lightning, turret, burst, harpoon and mortar.", {}];
  return rank
    ? ["Area radius +{before}% → +{after}%.", { before: rank * 10, after: next * 10 }]
    : ["+10% radius for Magnetic Burst, Scrap Cyclone and slag puddles.", {}];
}
export function eliteChance(s: Pick<State, "time" | "config">): number {
  if (s.time < ELITE.start) return 0;
  const ramp = Math.min(1, (s.time - ELITE.start) / (ELITE.full - ELITE.start));
  return (
    ELITE.base +
    (ELITE.peak - ELITE.base) * ramp +
    (s.config.modifiers?.eliteChance ?? 0) +
    (STAGES[s.config.stage]?.eliteChance ?? 0)
  );
}
/** A downed co-op robot leaves no hooks, shells or puddles behind. */
export function clearArsenalEffects(a: ArsenalState) {
  a.harpoons = [];
  a.shells = [];
  a.puddles = [];
  a.echo = a.sweep = 0;
}
const heavy = (e: Enemy) => e.type === "boss" || e.type === "miniboss";
function byId<T extends { id: number }>(list: T[], id: number): T | undefined {
  for (const item of list) if (item.id === id) return item;
  return undefined;
}
function strike(s: State, h: Harpoon, fromX: number, fromZ: number, hooks: ArsenalHooks) {
  const dx = h.x - fromX,
    dz = h.z - fromZ,
    length = dx * dx + dz * dz || 1;
  for (const e of s.enemies) {
    if (e.hp <= 0 || h.hits.includes(e.id)) continue;
    const t = Math.max(0, Math.min(1, ((e.x - fromX) * dx + (e.z - fromZ) * dz) / length));
    const px = fromX + t * dx - e.x,
      pz = fromZ + t * dz - e.z,
      reach = hooks.radius(e) + HARPOON.width;
    if (px * px + pz * pz >= reach * reach) continue;
    h.hits.push(e.id);
    hooks.damage(e, h.damage);
    if (e.hp <= 0 || heavy(e)) continue;
    if (!h.returning && h.knockback) {
      e.x += h.dx * h.knockback;
      e.z += h.dz * h.knockback;
      hooks.settle(e);
    } else if (h.returning && h.drag && h.carried.length < HARPOON.carry) h.carried.push(e.id);
  }
}
function updateHarpoons(s: State, dt: number, hooks: ArsenalHooks) {
  const a = s.arsenal,
    rank = s.upgrades.harpoon ?? 0;
  if (rank) {
    if (rank > a.ranks.harpoon) {
      a.ranks.harpoon = rank;
      a.timers.harpoon = 0;
    }
    a.timers.harpoon -= dt;
    if (a.timers.harpoon <= 0) {
      const stats = harpoonStats(s, rank),
        heading = Math.atan2(s.facing.z, s.facing.x);
      for (let i = 0; i < stats.hooks && a.harpoons.length < ARSENAL_LIMITS.harpoons; i++) {
        const angle = heading + (i - (stats.hooks - 1) / 2) * stats.spread;
        a.harpoons.push({
          id: s.nextId++,
          x: s.player.x,
          z: s.player.z,
          ox: s.player.x,
          oz: s.player.z,
          dx: Math.cos(angle),
          dz: Math.sin(angle),
          travelled: 0,
          range: stats.range,
          returning: false,
          damage: stats.damage,
          knockback: stats.knockback,
          drag: stats.drag,
          hits: [],
          carried: [],
          loot: [],
        });
      }
      hooks.emit({ kind: "harpoon", ...s.player });
      a.timers.harpoon = stats.cooldown;
    }
  }
  let kept = 0;
  for (const h of a.harpoons) {
    h.ox = s.player.x;
    h.oz = s.player.z;
    const fromX = h.x,
      fromZ = h.z;
    let done = false,
      turned = false;
    if (!h.returning) {
      const step = Math.min(HARPOON.speed * dt, h.range - h.travelled);
      h.x += h.dx * step;
      h.z += h.dz * step;
      h.travelled += step;
      turned = h.travelled >= h.range - 1e-6;
    } else {
      const d = Math.hypot(s.player.x - h.x, s.player.z - h.z),
        step = Math.min(d, HARPOON.reel * dt);
      h.x += ((s.player.x - h.x) / (d || 1)) * step;
      h.z += ((s.player.z - h.z) / (d || 1)) * step;
      done = d - step < 0.45;
    }
    strike(s, h, fromX, fromZ, hooks);
    if (turned) {
      // The reel is a second pass: every enemy can be struck once more.
      h.returning = true;
      h.hits.length = 0;
    }
    if (h.drag) carry(s, h, done);
    if (!done) a.harpoons[kept++] = h;
  }
  a.harpoons.length = kept;
}
/** Scrap Winch: struck enemies trail the reeling hook; touched pickups ride it home. */
function carry(s: State, h: Harpoon, done: boolean) {
  if (!h.returning) return;
  const d = Math.hypot(s.player.x - h.x, s.player.z - h.z),
    rx = (s.player.x - h.x) / (d || 1),
    rz = (s.player.z - h.z) / (d || 1);
  // Release enemies before they reach contact range.
  if (d < HARPOON.release || done) h.carried.length = 0;
  for (let i = 0; i < h.carried.length; i++) {
    const e = byId(s.enemies, h.carried[i]);
    if (!e || e.hp <= 0) continue;
    e.x = h.x - rx * (0.5 + i * 0.55);
    e.z = h.z - rz * (0.5 + i * 0.55);
  }
  for (const p of s.pickups) {
    if (h.loot.length >= HARPOON.loot) break;
    if (Math.abs(p.x - h.x) < 0.9 && Math.abs(p.z - h.z) < 0.9 && !h.loot.includes(p.id))
      h.loot.push(p.id);
  }
  for (const id of h.loot) {
    const p = byId(s.pickups, id);
    if (!p) continue;
    // Normal collection still decides who receives it and how much scrap fits.
    p.x = done ? s.player.x : h.x;
    p.z = done ? s.player.z : h.z;
  }
}
function groupTarget(s: State, radius: number, taken: SlagShell[]): Vec | undefined {
  let best: Enemy | undefined,
    score = 0,
    scanned = 0;
  const r2 = radius * radius,
    spread = 4 * r2;
  for (const e of s.enemies) {
    const px = e.x - s.player.x,
      pz = e.z - s.player.z;
    if (e.hp <= 0 || px * px + pz * pz > SLAG.range * SLAG.range) continue;
    let free = true;
    for (const shell of taken)
      if ((shell.toX - e.x) ** 2 + (shell.toZ - e.z) ** 2 < spread) free = false;
    if (!free) continue;
    if (++scanned > 48) break;
    let n = 0;
    for (const o of s.enemies)
      if (o.hp > 0 && (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < r2) n++;
    if (n > score) {
      score = n;
      best = e;
    }
  }
  if (!best) return undefined;
  // Aim at the middle of the group rather than its first member.
  let x = 0,
    z = 0,
    n = 0;
  for (const o of s.enemies)
    if (o.hp > 0 && (o.x - best.x) ** 2 + (o.z - best.z) ** 2 < r2) {
      x += o.x;
      z += o.z;
      n++;
    }
  return { x: x / n, z: z / n };
}
function addPuddle(s: State, p: Omit<SlagPuddle, "id" | "tick" | "max">) {
  const puddles = s.arsenal.puddles,
    puddle = { ...p, id: s.nextId++, tick: SLAG.tick, max: p.life };
  if (puddles.length < ARSENAL_LIMITS.puddles) {
    puddles.push(puddle);
    return;
  }
  // A new impact always leaves a puddle: replace the one closest to cooling.
  let oldest = 0;
  for (let i = 1; i < puddles.length; i++)
    if (puddles[i].life < puddles[oldest].life) oldest = i;
  puddles[oldest] = puddle;
}
/** Meltdown: an enemy killed by slag bursts into a smaller puddle. */
function scorch(s: State, e: Enemy, amount: number, source: SlagShell | SlagPuddle, hooks: ArsenalHooks) {
  if (e.hp <= 0) return;
  hooks.damage(e, amount);
  const radius = source.radius * 0.6;
  if (e.hp > 0 || !source.erupt || radius < 0.5 || s.arsenal.puddles.length >= ARSENAL_LIMITS.puddles) return;
  addPuddle(s, { x: e.x, z: e.z, radius, life: 2, burn: source.burn, slow: source.slow, erupt: true });
}
function updateSlag(s: State, dt: number, hooks: ArsenalHooks) {
  const a = s.arsenal,
    rank = s.upgrades.slag ?? 0;
  if (rank) {
    if (rank > a.ranks.slag) {
      a.ranks.slag = rank;
      a.timers.slag = 0;
    }
    a.timers.slag -= dt;
    if (a.timers.slag <= 0) {
      const stats = slagStats(s, rank),
        volley = a.shells.length;
      for (let i = 0; i < stats.shells && a.shells.length < ARSENAL_LIMITS.shells; i++) {
        const target = groupTarget(s, stats.radius, a.shells.slice(volley));
        if (!target) break;
        a.shells.push({
          id: s.nextId++,
          x: s.player.x,
          z: s.player.z,
          fromX: s.player.x,
          fromZ: s.player.z,
          toX: target.x,
          toZ: target.z,
          t: 0,
          impact: stats.impact,
          burn: stats.burn,
          radius: stats.radius,
          duration: stats.duration,
          slow: stats.slow,
          erupt: stats.erupt,
        });
      }
      // With nothing in range, check again soon rather than waste a full cooldown.
      a.timers.slag = a.shells.length > volley ? stats.cooldown : 0.25;
    }
  }
  let kept = 0;
  for (const shell of a.shells) {
    shell.t = Math.min(1, shell.t + dt / SLAG.flight);
    shell.x = shell.fromX + (shell.toX - shell.fromX) * shell.t;
    shell.z = shell.fromZ + (shell.toZ - shell.fromZ) * shell.t;
    if (shell.t < 1) {
      a.shells[kept++] = shell;
      continue;
    }
    hooks.emit({ kind: "slag", x: shell.x, z: shell.z, radius: shell.radius });
    for (const e of s.enemies)
      if (Math.hypot(e.x - shell.x, e.z - shell.z) < shell.radius + hooks.radius(e) * 0.5)
        scorch(s, e, shell.impact, shell, hooks);
    addPuddle(s, {
      x: shell.x,
      z: shell.z,
      radius: shell.radius,
      life: shell.duration,
      burn: shell.burn,
      slow: shell.slow,
      erupt: shell.erupt,
    });
  }
  a.shells.length = kept;
  // Puddles added this frame tick from their next interval; iterate a stable count.
  const puddles = a.puddles;
  for (let i = 0, count = puddles.length; i < count; i++) {
    const p = puddles[i];
    p.life -= dt;
    p.tick -= dt;
    if (p.tick > 0 || p.life <= 0) continue;
    p.tick += SLAG.tick;
    for (const e of s.enemies) {
      if (e.hp <= 0 || Math.hypot(e.x - p.x, e.z - p.z) >= p.radius + hooks.radius(e) * 0.5) continue;
      if (p.slow) e.slowUntil = Math.max(e.slowUntil ?? 0, s.time + 0.6);
      scorch(s, e, p.burn, p, hooks);
    }
  }
  kept = 0;
  for (const p of a.puddles) if (p.life > 0) a.puddles[kept++] = p;
  a.puddles.length = kept;
}
function updateSweep(s: State, dt: number) {
  const a = s.arsenal;
  if (a.sweep <= 0) return;
  a.sweep = Math.max(0, a.sweep - dt);
  for (const p of s.pickups) {
    const d = Math.hypot(s.player.x - p.x, s.player.z - p.z);
    if (d >= REACTOR.sweep || d < 0.3) continue;
    const step = Math.min(d - 0.2, REACTOR.pull * dt);
    p.x += ((s.player.x - p.x) / d) * step;
    p.z += ((s.player.z - p.z) / d) * step;
  }
}
/** Magnet Harpoon, Slag Mortar and the Pulse Reactor sweep; called from the weapon update. */
export function updateArsenal(s: State, dt: number, hooks: ArsenalHooks) {
  updateHarpoons(s, dt, hooks);
  updateSlag(s, dt, hooks);
  updateSweep(s, dt);
}
