import type { Enemy, State, Vec } from "./simulation";

export type EncounterEnemyType =
  | "charger"
  | "spitter"
  | "warden"
  | "miniboss"
  | "boss";
export const ENCOUNTER_LIMITS = {
  brains: 140,
  warnings: 32,
  projectiles: 64,
  zones: 12,
};
export type Warning = Vec & {
  id: number;
  owner: number;
  kind: "charge" | "bolt" | "zone";
  dx: number;
  dz: number;
  radius: number;
  length: number;
  remaining: number;
  duration: number;
};
export type EnemyProjectile = Vec & {
  vx: number;
  vz: number;
  life: number;
  damage: number;
};
export type DangerZone = Vec & { radius: number; life: number; damage: number };
type Brain = {
  cooldown: number;
  warning?: number;
  dash: number;
  dx: number;
  dz: number;
};
export type EncounterHooks = {
  spawnEnemy(
    type: EncounterEnemyType,
    position: Vec,
    hp: number,
  ): Enemy | undefined;
  /** The caller applies armor, shared invulnerability, damage feedback, and death. */
  damagePlayer(amount: number, source: Vec, target?: State): void;
  reward(
    reward: { xp: number; scrap: number; healing: number; parts: number },
    enemy: Enemy,
  ): void;
};
export function createEncounterState() {
  return {
    nextAt: 90,
    sequence: 0,
    nextWarningId: 1,
    active: null as {
      id: number;
      type: "miniboss" | "boss";
      maxHp: number;
    } | null,
    defeated: 0,
    brains: new Map<number, Brain>(),
    warnings: [] as Warning[],
    projectiles: [] as EnemyProjectile[],
    zones: [] as DangerZone[],
  };
}
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const isSpecial = (e: Enemy) =>
  ["charger", "spitter", "warden", "miniboss", "boss"].includes(e.type);
const canRun = (s: State) => s.phase === "playing";

/** Scheduling and persistent hazards use simulation time; no browser timers. */
export function updateEncounters(
  s: State,
  dt: number,
  hooks: EncounterHooks,
  players: State[] = [s],
) {
  if (!canRun(s) || dt <= 0) return;
  const c = s.encounters;
  const living = new Set(s.enemies.filter((e) => e.hp > 0).map((e) => e.id));
  for (const id of c.brains.keys()) if (!living.has(id)) c.brains.delete(id);
  c.warnings = c.warnings.filter((w) => living.has(w.owner));
  if (c.active && !living.has(c.active.id)) c.active = null;
  if (s.time >= c.nextAt) {
    const slot = Math.floor(c.nextAt / 90);
    if (!c.active) {
      const type = slot % 2 === 0 ? "boss" : "miniboss";
      const hp =
        (type === "boss" ? 220 : 85) * (1 + Math.max(0, slot - 1) * 0.35);
      const angle = slot * 2.4;
      const enemy = hooks.spawnEnemy(
        type,
        {
          x: s.player.x + Math.cos(angle) * 14,
          z: s.player.z + Math.sin(angle) * 14,
        },
        hp,
      );
      if (enemy) {
        c.active = { id: enemy.id, type, maxHp: hp };
        c.sequence++;
      }
      // A saturated enemy pool retries rather than silently losing its boss.
      else return;
    }
    c.nextAt = (Math.floor(s.time / 90) + 1) * 90;
  }
  c.projectiles = c.projectiles.filter((p) => {
    const old = { x: p.x, z: p.z };
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.life -= dt;
    const dx = p.x - old.x,
      dz = p.z - old.z;
    for (const target of players.filter((a) => a.hp > 0)) {
      const t = Math.max(
        0,
        Math.min(
          1,
          ((target.player.x - old.x) * dx + (target.player.z - old.z) * dz) /
            (dx * dx + dz * dz || 1),
        ),
      );
      if (
        Math.hypot(
          target.player.x - old.x - t * dx,
          target.player.z - old.z - t * dz,
        ) < 0.65
      ) {
        hooks.damagePlayer(p.damage, p, target);
        return false;
      }
    }
    return p.life > 0 && players.some((a) => dist(p, a.player) < 40);
  });
  c.zones = c.zones.filter((z) => {
    z.life -= dt;
    for (const target of players)
      if (
        target.hp > 0 &&
        z.life > 0 &&
        dist(z, target.player) < z.radius + 0.3
      )
        hooks.damagePlayer(z.damage, z, target);
    return z.life > 0;
  });
}

/** True means this enemy owns its movement; the caller still resolves obstacles/contact. */
export function updateEnemyBehavior(
  s: State,
  e: Enemy,
  dt: number,
  hooks: EncounterHooks,
): boolean {
  if (!isSpecial(e)) return false;
  if (!canRun(s) || e.hp <= 0 || dt <= 0) return true;
  const movementScale = (e.slowUntil ?? 0) > s.time ? 0.5 : 1;
  const c = s.encounters;
  let b = c.brains.get(e.id);
  if (!b) {
    if (c.brains.size >= ENCOUNTER_LIMITS.brains) return false;
    b = { cooldown: 1.1 + (e.seed % 1), dash: 0, dx: 0, dz: 1 };
    c.brains.set(e.id, b);
  }
  if (b.dash > 0) {
    const step = Math.min(dt, b.dash) * (e.type === "miniboss" ? 10 : 12) * movementScale;
    e.x += b.dx * step;
    e.z += b.dz * step;
    b.dash = Math.max(0, b.dash - dt);
    if (dist(e, s.player) < (e.type === "miniboss" ? 1.15 : 0.8))
      hooks.damagePlayer(e.type === "miniboss" ? 22 : 14, e);
    return true;
  }
  if (b.warning !== undefined) {
    const warning = c.warnings.find((w) => w.id === b!.warning);
    if (!warning) {
      b.warning = undefined;
      b.cooldown = 1;
      return true;
    }
    warning.remaining -= dt;
    if (warning.remaining > 0) return true;
    if (warning.kind === "charge") {
      b.dx = warning.dx;
      b.dz = warning.dz;
      b.dash = warning.length / (e.type === "miniboss" ? 10 : 12);
    } else if (warning.kind === "bolt") {
      if (c.projectiles.length < ENCOUNTER_LIMITS.projectiles)
        c.projectiles.push({
          x: e.x,
          z: e.z,
          vx: warning.dx * 7,
          vz: warning.dz * 7,
          life: 3.5,
          damage: 12,
        });
    } else if (c.zones.length < ENCOUNTER_LIMITS.zones) {
      c.zones.push({
        x: warning.x,
        z: warning.z,
        radius: warning.radius,
        life: e.type === "boss" ? 3.2 : 2.4,
        damage: e.type === "boss" ? 20 : 10,
      });
    }
    c.warnings = c.warnings.filter((w) => w.id !== b!.warning);
    b.warning = undefined;
    b.cooldown = e.type === "boss" ? 2 : e.type === "miniboss" ? 2.2 : 3;
    return true;
  }
  const d = dist(e, s.player),
    dx = (s.player.x - e.x) / (d || 1),
    dz = (s.player.z - e.z) / (d || 1);
  const charging = e.type === "charger" || e.type === "miniboss";
  b.cooldown -= dt;
  const desired = charging ? 1.6 : e.type === "boss" ? 5 : 6;
  const direction = d > desired + 1 ? 1 : !charging && d < desired - 1 ? -1 : 0;
  const speed = (e.type === "boss" ? 0.9 : charging ? 2 : 1.3) * movementScale;
  e.x += dx * speed * direction * dt;
  e.z += dz * speed * direction * dt;
  if (
    b.cooldown <= 0 &&
    d < 12 &&
    c.warnings.length < ENCOUNTER_LIMITS.warnings
  ) {
    const kind = charging ? "charge" : e.type === "spitter" ? "bolt" : "zone";
    const duration = e.type === "boss" ? 1.5 : charging ? 1.05 : 0.95;
    const w: Warning = {
      id: c.nextWarningId++,
      owner: e.id,
      kind,
      x: kind === "zone" ? s.player.x : e.x,
      z: kind === "zone" ? s.player.z : e.z,
      dx,
      dz,
      radius:
        e.type === "boss"
          ? 3.2
          : e.type === "miniboss"
            ? 1
            : kind === "zone"
              ? 1.8
              : 0.55,
      length: kind === "charge" ? Math.min(12, d + 2) : 14,
      remaining: duration,
      duration,
    };
    c.warnings.push(w);
    b.warning = w.id;
  }
  return true;
}

/** Death integration calls this before removing the enemy; active identity prevents duplicate rewards. */
export function onEncounterKill(s: State, e: Enemy, hooks: EncounterHooks) {
  const c = s.encounters;
  c.brains.delete(e.id);
  c.warnings = c.warnings.filter((w) => w.owner !== e.id);
  if (e.hp > 0 || c.active?.id !== e.id) return;
  const boss = c.active.type === "boss";
  c.active = null;
  c.defeated++;
  if (boss) s.stats.bossKills++;
  else s.stats.minibossKills++;
  hooks.reward(
    {
      xp: boss ? 30 : 12,
      scrap: boss ? 12 : 6,
      healing: boss ? 20 : 10,
      parts: boss ? 40 : 15,
    },
    e,
  );
}
