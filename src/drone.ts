import type { Enemy, GameEvent, Pickup, Vec } from "./simulation";

export const DRONE_MODES = ["collector", "repair", "guard"] as const;
export type DroneMode = (typeof DRONE_MODES)[number];
export const DRONE_UPGRADES = { collector: "drone_collector", repair: "drone_repair", guard: "drone_guard" } as const;
export type DroneUpgradeId = (typeof DRONE_UPGRADES)[DroneMode];
export const DRONE_SPECIAL_DESCRIPTIONS: Record<DroneMode, string> = {
  collector: "Pull up to 5 pickups every 6 seconds.",
  repair: "In Repair mode: restore 20 health at 30 health or less, once per run.",
  guard: "Guard shots slow enemies by 50% for 1 second.",
};
export const DRONE_MAX_RANK = 3;
export const DRONE_CLUSTER_INTERVAL = 6;
export const DRONE_EMERGENCY_HEAL = 20;
export const DRONE_LOW_HEALTH = 30;
export function droneStats(rank: number) {
  rank = Math.max(0, Math.min(DRONE_MAX_RANK, rank));
  return {
    range: 7 + rank * 2, follow: 5 + rank, retrieval: 8 + rank * 2,
    healing: 3 + rank, repairInterval: 5 - rank * 0.5,
    damage: 3 + rank * 2, guardInterval: 2 - rank * 0.25,
  };
}
export function droneUpgradeDescription(mode: DroneMode, rank: number) {
  const before = droneStats(rank), next = droneStats(rank + 1);
  const description = mode === "collector" ? `Collection range ${before.range} → ${next.range} m; faster retrieval.` :
    mode === "repair" ? `Healing ${before.healing} → ${next.healing} health; every ${next.repairInterval}s.` :
      `Shot damage ${before.damage} → ${next.damage}; every ${next.guardInterval}s.`;
  return description + (rank + 1 >= DRONE_MAX_RANK ? ` ${DRONE_SPECIAL_DESCRIPTIONS[mode]}` : "");
}
export type DroneState = Vec & {
  mode: DroneMode;
  actionTimer: number;
  modeCooldown: number;
  pulse: number;
  targetX: number;
  targetZ: number;
  actions: number;
  emergencyUsed: boolean;
  specialPulse: number;
};
export type DroneGameState = {
  drone: DroneState;
  player: Vec;
  facing: Vec;
  phase: string;
  openingRemaining: number;
  time: number;
  hp: number;
  scrap: number;
  pickups: Pickup[];
  enemies: Enemy[];
  upgrades: Record<DroneUpgradeId, number>;
};
export type DroneHooks = {
  damage: (enemy: Enemy, damage: number) => void;
  emit: (event: GameEvent) => void;
  /** Shared, consistently ordered co-op roster for deterministic pickup ownership. */
  players?: readonly DroneGameState[];
};
export function droneRank(s: DroneGameState, mode: DroneMode = s.drone.mode) {
  return s.upgrades[DRONE_UPGRADES[mode]];
}
export function createDroneState(): DroneState {
  return {
    x: 1.4, z: -1, mode: "collector", actionTimer: 2,
    modeCooldown: 0, pulse: 0, targetX: 0, targetZ: 0, actions: 0,
    emergencyUsed: false, specialPulse: 0,
  };
}
export function setDroneMode(s: DroneGameState, mode: DroneMode): boolean {
  if (s.phase !== "playing" || s.hp <= 0 || !DRONE_MODES.includes(mode) ||
      s.drone.modeCooldown > 0 || s.drone.mode === mode) return false;
  s.drone.mode = mode;
  s.drone.modeCooldown = 0.4;
  // Switching roles never grants a fresh charge.
  const rank = droneRank(s), stats = droneStats(rank);
  const interval = mode === "repair" ? stats.repairInterval :
    mode === "collector" && rank === DRONE_MAX_RANK ? DRONE_CLUSTER_INTERVAL : stats.guardInterval;
  s.drone.actionTimer = Math.max(s.drone.actionTimer, interval);
  s.drone.pulse = 0;
  s.drone.specialPulse = 0;
  return true;
}
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
/** The same range/capacity rules apply to every actor before assigning a pickup. */
function ownsPickup(s: DroneGameState, p: Pickup, players: readonly DroneGameState[]) {
  const owner = players.reduce<DroneGameState | undefined>((best, candidate) => {
    const range = distance(p, candidate.player);
    if (candidate.hp <= 0 || candidate.phase !== "playing" || candidate.openingRemaining > 0 ||
        candidate.drone.mode !== "collector" || (p.kind === "scrap" && candidate.scrap >= 12) ||
        candidate.time - p.born <= 0.15 || range <= 1 || range >= droneStats(droneRank(candidate, "collector")).range) return best;
    return !best || range < distance(p, best.player) ? candidate : best;
  }, undefined);
  return owner === s;
}
function pullPickup(s: DroneGameState, p: Pickup, amount: number) {
  const range = distance(p, s.player);
  const step = Math.min(Math.max(0, range - 0.5), amount);
  p.x += (s.player.x - p.x) / (range || 1) * step;
  p.z += (s.player.z - p.z) / (range || 1) * step;
}
export function updateDrone(s: DroneGameState, dt: number, hooks: DroneHooks) {
  if (s.phase !== "playing" || s.hp <= 0 || !Number.isFinite(dt) || dt <= 0) return;
  const d = s.drone;
  const rank = droneRank(s), stats = droneStats(rank);
  const mastered = rank === DRONE_MAX_RANK;
  d.modeCooldown = Math.max(0, d.modeCooldown - dt);
  d.actionTimer = Math.max(0, d.actionTimer - dt);
  d.pulse = Math.max(0, d.pulse - dt);
  d.specialPulse = Math.max(0, d.specialPulse - dt);
  let target: Vec = {
    x: s.player.x + s.facing.z * 1.4 - s.facing.x,
    z: s.player.z - s.facing.x * 1.4 - s.facing.z,
  };
  // Opening scrap retains the existing tutorial's readable pull animation.
  const working = s.openingRemaining <= 0;
  let pickup: Pickup | undefined;
  if (working && d.mode === "collector") {
    let nearest = stats.range;
    const players = hooks.players ?? [s];
    if (mastered && !d.actionTimer) {
      const cluster = s.pickups.filter(p => ownsPickup(s, p, players))
        .sort((a, b) => distance(a, s.player) - distance(b, s.player)).slice(0, 5);
      if (cluster.length) {
        for (const p of cluster) pullPickup(s, p, 4);
        d.actionTimer = DRONE_CLUSTER_INTERVAL;
        d.specialPulse = 0.65;
        d.actions++;
      }
    }
    for (const p of s.pickups) {
      if ((p.kind === "scrap" && s.scrap >= 12) || s.time - p.born <= 0.15) continue;
      const range = distance(p, s.player);
      if (range <= 1 || range >= nearest) continue;
      if (ownsPickup(s, p, players)) { pickup = p; nearest = range; }
    }
    if (pickup) target = pickup;
  }
  const follow = 1 - Math.exp(-dt * stats.follow);
  d.x += (target.x - d.x) * follow;
  d.z += (target.z - d.z) * follow;
  // Warps / remote reconciliation cannot leave the helper stranded off screen.
  if (distance(d, s.player) > stats.range + 5) { d.x = target.x; d.z = target.z; }
  if (!working) return;
  if (mastered && d.mode === "repair" && !d.emergencyUsed && s.hp <= DRONE_LOW_HEALTH) {
    s.hp = Math.min(100, s.hp + DRONE_EMERGENCY_HEAL);
    d.emergencyUsed = true;
    d.specialPulse = 0.65;
    d.pulse = 0.65;
    d.targetX = s.player.x; d.targetZ = s.player.z;
    d.actions++;
  }
  if (pickup && distance(d, pickup) < 1.2) {
    pullPickup(s, pickup, dt * stats.retrieval);
    d.targetX = pickup.x; d.targetZ = pickup.z; d.pulse = 0.12;
    // Only transport the existing pickup. Normal collection owns consumption,
    // capacity, XP and co-op recipient selection, so rewards cannot duplicate.
  } else if (d.mode === "repair" && !d.actionTimer && s.hp < 100) {
    s.hp = Math.min(100, s.hp + stats.healing);
    d.actionTimer = stats.repairInterval; d.pulse = 0.65; d.actions++;
    d.targetX = s.player.x; d.targetZ = s.player.z;
  } else if (d.mode === "guard" && !d.actionTimer) {
    let enemy: Enemy | undefined;
    let nearest = 5;
    for (const e of s.enemies) {
      const range = distance(e, s.player);
      if (e.hp > 0 && range < nearest) { enemy = e; nearest = range; }
    }
    if (!enemy) return;
    hooks.damage(enemy, stats.damage);
    if (mastered && enemy.hp > 0) {
      enemy.slowUntil = Math.max(enemy.slowUntil ?? 0, s.time + 1);
      d.specialPulse = 0.4;
    }
    hooks.emit({kind: "pulse", x: enemy.x, z: enemy.z, fromX: d.x, fromZ: d.z});
    d.actionTimer = stats.guardInterval; d.pulse = 0.3; d.actions++;
    d.targetX = enemy.x; d.targetZ = enemy.z;
  }
}
