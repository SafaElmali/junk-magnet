import type { Enemy, GameEvent, Pickup, Vec } from "./simulation";

export const DRONE_MODES = ["collector", "repair", "guard"] as const;
export type DroneMode = (typeof DRONE_MODES)[number];
export type DroneState = Vec & {
  mode: DroneMode;
  actionTimer: number;
  modeCooldown: number;
  pulse: number;
  targetX: number;
  targetZ: number;
  actions: number;
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
};
export type DroneHooks = {
  damage: (enemy: Enemy, damage: number) => void;
  emit: (event: GameEvent) => void;
  /** Shared, consistently ordered co-op roster for deterministic pickup ownership. */
  players?: readonly DroneGameState[];
};
export function createDroneState(): DroneState {
  return {
    x: 1.4, z: -1, mode: "collector", actionTimer: 2,
    modeCooldown: 0, pulse: 0, targetX: 0, targetZ: 0, actions: 0,
  };
}
export function setDroneMode(s: DroneGameState, mode: DroneMode): boolean {
  if (s.phase !== "playing" || s.hp <= 0 || !DRONE_MODES.includes(mode) ||
      s.drone.modeCooldown > 0 || s.drone.mode === mode) return false;
  s.drone.mode = mode;
  s.drone.modeCooldown = 0.4;
  // Switching roles never grants a fresh charge.
  s.drone.actionTimer = Math.max(s.drone.actionTimer, mode === "repair" ? 5 : 2);
  s.drone.pulse = 0;
  return true;
}
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export function updateDrone(s: DroneGameState, dt: number, hooks: DroneHooks) {
  if (s.phase !== "playing" || s.hp <= 0 || !Number.isFinite(dt) || dt <= 0) return;
  const d = s.drone;
  d.modeCooldown = Math.max(0, d.modeCooldown - dt);
  d.actionTimer = Math.max(0, d.actionTimer - dt);
  d.pulse = Math.max(0, d.pulse - dt);
  let target: Vec = {
    x: s.player.x + s.facing.z * 1.4 - s.facing.x,
    z: s.player.z - s.facing.x * 1.4 - s.facing.z,
  };
  // Opening scrap retains the existing tutorial's readable pull animation.
  const working = s.openingRemaining <= 0;
  let pickup: Pickup | undefined;
  if (working && d.mode === "collector") {
    let nearest = 7;
    for (const p of s.pickups) {
      if ((p.kind === "scrap" && s.scrap >= 12) || s.time - p.born <= 0.15) continue;
      const range = distance(p, s.player);
      if (range <= 1 || range >= nearest) continue;
      const owner = (hooks.players ?? [s]).reduce<DroneGameState | undefined>((best, candidate) => {
        if (candidate.hp <= 0 || candidate.phase !== "playing" ||
            candidate.openingRemaining > 0 || candidate.drone.mode !== "collector" ||
            (p.kind === "scrap" && candidate.scrap >= 12)) return best;
        return !best || distance(p, candidate.player) < distance(p, best.player) ? candidate : best;
      }, undefined);
      if (owner === s) { pickup = p; nearest = range; }
    }
    if (pickup) target = pickup;
  }
  const follow = 1 - Math.exp(-dt * 5);
  d.x += (target.x - d.x) * follow;
  d.z += (target.z - d.z) * follow;
  // Warps / remote reconciliation cannot leave the helper stranded off screen.
  if (distance(d, s.player) > 12) { d.x = target.x; d.z = target.z; }
  if (!working) return;
  if (pickup && distance(d, pickup) < 1.2) {
    const range = distance(pickup, s.player);
    const step = Math.min(range, dt * 8);
    pickup.x += (s.player.x - pickup.x) / (range || 1) * step;
    pickup.z += (s.player.z - pickup.z) / (range || 1) * step;
    d.targetX = pickup.x; d.targetZ = pickup.z; d.pulse = 0.12;
    // Only transport the existing pickup. Normal collection owns consumption,
    // capacity, XP and co-op recipient selection, so rewards cannot duplicate.
  } else if (d.mode === "repair" && !d.actionTimer && s.hp < 100) {
    s.hp = Math.min(100, s.hp + 3);
    d.actionTimer = 5; d.pulse = 0.65; d.actions++;
    d.targetX = s.player.x; d.targetZ = s.player.z;
  } else if (d.mode === "guard" && !d.actionTimer) {
    let enemy: Enemy | undefined;
    let nearest = 5;
    for (const e of s.enemies) {
      const range = distance(e, s.player);
      if (e.hp > 0 && range < nearest) { enemy = e; nearest = range; }
    }
    if (!enemy) return;
    hooks.damage(enemy, 3);
    hooks.emit({kind: "pulse", x: enemy.x, z: enemy.z, fromX: d.x, fromZ: d.z});
    d.actionTimer = 2; d.pulse = 0.3; d.actions++;
    d.targetX = enemy.x; d.targetZ = enemy.z;
  }
}
