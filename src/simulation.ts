import { getObstacles } from "./world";

export type Vec = { x: number; z: number };
export type UpgradeId = "saw" | "lightning" | "turret" | "burst" | "boots" | "magnet" | "armor" | "repair" | "refill" | "overclock";
export type Enemy = Vec & { id: number; hp: number; hit: number; seed: number; type: "can" | "runner" | "brute" };
export type Pickup = Vec & { id: number; kind: "scrap" | "xp"; born: number; value?: number };
export type Shot = Vec & { id: number; vx: number; vz: number; life: number; kind: number; damage?: number };
export type Turret = Vec & { id: number; life: number; fireTimer: number; rank: number };
export type GameEvent = Vec & {
  kind: "hit" | "kill" | "collect" | "launch" | "hurt" | "pulse" | "lightning" | "burst";
  fromX?: number; fromZ?: number; radius?: number;
};
export type State = {
  time: number; player: Vec; aim: Vec; facing: Vec; hp: number; scrap: number;
  xp: number; level: number; xpNeeded: number; choices: UpgradeId[]; upgrades: Record<UpgradeId, number>;
  kills: number; spawned: number; wave: number; cooldown: number; immunity: number;
  phase: "ready" | "playing" | "paused" | "upgrade" | "lost";
  enemies: Enemy[]; pickups: Pickup[]; shots: Shot[]; turrets: Turret[]; events: GameEvent[];
  spawnTimer: number; pulseTimer: number; abilityTimers: { lightning: number; turret: number; burst: number };
  nextId: number; rng: number; launched: number; overclockTimer: number;
};
export const MAX_SCRAP = 12;
export const ORBIT_RADIUS = 1.85;
export const ENTITY_LIMITS = { enemies: 140, pickups: 320, shots: 192, turrets: 6, events: 160 };
export const UPGRADES: Record<UpgradeId, { name: string; description: string; maxRank: number }> = {
  saw: { name: "Orbiting Saws", description: "Sharper, wider, faster scrap blades.", maxRank: 5 },
  lightning: { name: "Chain Lightning", description: "Electric arcs jump between nearby enemies.", maxRank: 5 },
  turret: { name: "Scrap Turret", description: "Deploy a turret that fires at nearby enemies.", maxRank: 5 },
  burst: { name: "Magnetic Burst", description: "A magnetic shockwave damages and pushes enemies away.", maxRank: 5 },
  boots: { name: "Turbo Treads", description: "Move faster through the scrapyard.", maxRank: 4 },
  magnet: { name: "Pickup Magnet", description: "Pull energy and scrap from farther away.", maxRank: 4 },
  armor: { name: "Steel Plating", description: "Reduce damage from enemy contact.", maxRank: 4 },
  refill: { name: "Scrap Delivery", description: "Refill all orbiting scrap and reset launch cooldown. Repeatable.", maxRank: Infinity },
  overclock: { name: "Overclock", description: "+25% damage and +15% speed for 20 seconds. Repeatable.", maxRank: Infinity },
  repair: { name: "Field Repair", description: "Restore 35 health immediately. Repeatable.", maxRank: Infinity },
};
export function upgradeDescription(s: State, id: UpgradeId): string {
  const rank = s.upgrades[id], next = rank + 1;
  switch (id) {
    case "saw": return `${2 + rank - 1} → ${2 + next - 1} blade damage; wider and faster orbit.`;
    case "lightning": return rank ? `${rank + 1} → ${next + 1} chained targets; more damage.` : "Zap 2 enemies every 2.8 seconds for 4 damage each.";
    case "turret": return rank ? `Turret damage ${2 + rank} → ${2 + next}; faster fire and longer life.` : "Deploy a turret every 8 seconds. Fires for 3 damage.";
    case "burst": return rank ? `Blast damage ${2 + rank * 2} → ${2 + next * 2}; larger radius and shorter cooldown.` : "Blast and push back nearby enemies every 5 seconds.";
    case "boots": return `Movement speed +12% (total +${next * 12}%).`;
    case "magnet": return `Pickup radius ${Number((3.2 + rank * 0.9).toFixed(1))} → ${Number((3.2 + next * 0.9).toFixed(1))} m.`;
    case "armor": return `Reduce every contact hit by ${next * 2} damage.`;
    case "refill": return "Restore all 12 orbiting scrap pieces and reset launch cooldown.";
    case "overclock": return "+25% damage and +15% movement speed for 20 seconds. Refreshes duration.";
    case "repair": return `Restore 35 health now (${Math.ceil(s.hp)} → ${Math.min(100, Math.ceil(s.hp) + 35)}).`;
  }
}
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
function random(s: State) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
function emit(s: State, event: GameEvent) { if (s.events.length < ENTITY_LIMITS.events) s.events.push(event); }
function resolveObstacles(p: Vec, radius: number) {
  // A second pass handles touching obstacle corners without allowing diagonal clipping.
  const obstacles = getObstacles(p.x, p.z);
  for (let pass = 0; pass < 2; pass++) for (const o of obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), required = radius + o.radius;
    if (d < required) { p.x += (d ? dx / d : 1) * (required - d); p.z += (d ? dz / d : 0) * (required - d); }
  }
}
export function createState(): State {
  const s: State = {
    time: 0, player: { x: 0, z: 0 }, aim: { x: 0, z: 1 }, facing: { x: 0, z: 1 }, hp: 100, scrap: 6,
    xp: 0, level: 1, xpNeeded: 5, choices: [], upgrades: { saw: 1, lightning: 0, turret: 0, burst: 0, boots: 0, magnet: 0, armor: 0, repair: 0, refill: 0, overclock: 0 },
    kills: 0, spawned: 0, wave: 1, cooldown: 0, immunity: 0, phase: "ready", enemies: [], pickups: [], shots: [], turrets: [], events: [],
    spawnTimer: 1.3, pulseTimer: 1, abilityTimers: { lightning: 0, turret: 0, burst: 0 }, nextId: 1, rng: 41, launched: 0, overclockTimer: 0,
  };
  for (let i = 0; i < 7; i++) spawn(s, i * Math.PI * 2 / 7, 8 + random(s) * 2);
  return s;
}
function spawn(s: State, angle = random(s) * Math.PI * 2, radius = 23 + random(s) * 3) {
  if (s.enemies.length >= ENTITY_LIMITS.enemies) return;
  const roll = random(s);
  const type: Enemy["type"] = s.time >= 75 && roll < 0.2 ? "brute" : s.time >= 30 && roll < 0.48 ? "runner" : "can";
  const e: Enemy = { id: s.nextId++, x: s.player.x + Math.cos(angle) * radius, z: s.player.z + Math.sin(angle) * radius,
    hp: (type === "brute" ? 15 : type === "runner" ? 3 : 4) * (1 + s.time / 180), hit: 0, seed: random(s) * 10, type };
  resolveObstacles(e, type === "brute" ? 0.65 : 0.35);
  s.enemies.push(e); s.spawned++;
}
function offerUpgrade(s: State) {
  if (s.xp < s.xpNeeded) return;
  s.xp -= s.xpNeeded; s.level++; s.xpNeeded = 5 + (s.level - 1) * 4;
  const pool = (Object.keys(UPGRADES) as UpgradeId[]).filter(id => !(["repair", "refill", "overclock"] as string[]).includes(id) && s.upgrades[id] < UPGRADES[id].maxRank);
  if (s.hp < 80) pool.push("repair");
  for (const fallback of ["repair", "refill", "overclock"] as const) if (pool.length < 3 && !pool.includes(fallback)) pool.push(fallback);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  s.choices = pool.slice(0, 3); s.phase = "upgrade";
}
export function chooseUpgrade(s: State, id: UpgradeId): boolean {
  if (s.phase !== "upgrade" || !s.choices.includes(id) || s.upgrades[id] >= UPGRADES[id].maxRank) return false;
  s.upgrades[id]++;
  if (id === "refill") { s.scrap = MAX_SCRAP; s.cooldown = 0; }
  if (id === "overclock") s.overclockTimer = 20;
  if (id === "repair") s.hp = Math.min(100, s.hp + 35);
  if (id === "saw") s.scrap = Math.min(MAX_SCRAP, s.scrap + 2);
  if (id === "lightning" || id === "turret" || id === "burst") s.abilityTimers[id] = 0;
  s.choices = []; s.phase = "playing"; offerUpgrade(s); return true;
}
export function orbitPosition(s: State, index: number): Vec {
  const rank = s.upgrades.saw - 1;
  const a = s.time * (2.3 + rank * 0.25) + index * Math.PI * 2 / Math.max(1, s.scrap), radius = ORBIT_RADIUS + rank * 0.12;
  return { x: s.player.x + Math.cos(a) * radius, z: s.player.z + Math.sin(a) * radius };
}
export function launch(s: State): boolean {
  if (s.phase !== "playing" || s.cooldown > 0 || !s.scrap) return false;
  const base = Math.atan2(s.aim.z, s.aim.x), count = s.scrap;
  for (let i = 0; i < count && s.shots.length < ENTITY_LIMITS.shots; i++) {
    const a = base + (i - (count - 1) / 2) * 0.075;
    s.shots.push({ id: s.nextId++, ...orbitPosition(s, i), vx: Math.cos(a) * 17, vz: Math.sin(a) * 17, life: 1.6, kind: i % 3, damage: 4 + s.upgrades.saw });
  }
  s.scrap = 0; s.cooldown = 1.15; s.launched++; emit(s, { kind: "launch", ...s.player }); return true;
}
function addPickup(s: State, p: Pickup) {
  if (s.pickups.length < ENTITY_LIMITS.pickups) { s.pickups.push(p); return; }
  // Preserve the entire value even after long runs. Merge into the nearest same-kind pile.
  let nearest: Pickup | undefined, best = Infinity;
  for (const existing of s.pickups) if (existing.kind === p.kind) { const d = distance(existing, p); if (d < best) { best = d; nearest = existing; } }
  if (nearest && best <= 4) {
    nearest.value = (nearest.value ?? 1) + (p.value ?? 1);
    return;
  }
  // New kills must leave reachable drops, even when a trail of old gems fills
  // the pool. Coalesce an old same-kind pair in place to free a local slot.
  let anchor = s.pickups.find(existing => distance(existing, s.player) > 10) ?? s.pickups[0];
  let partnerIndex = -1, partnerDistance = Infinity;
  function findPartner() {
    partnerIndex = -1; partnerDistance = Infinity;
    for (let i = 0; i < s.pickups.length; i++) {
      const existing = s.pickups[i];
      if (existing === anchor || existing.kind !== anchor.kind) continue;
      const d = distance(existing, anchor);
      if (d < partnerDistance) { partnerDistance = d; partnerIndex = i; }
    }
  }
  findPartner();
  if (partnerIndex < 0) {
    // A lone pile of one kind means the other kind has ample partners.
    anchor = s.pickups.find(existing => existing.kind !== anchor.kind)!;
    findPartner();
  }
  const partner = s.pickups[partnerIndex];
  anchor.value = (anchor.value ?? 1) + (partner.value ?? 1);
  s.pickups[partnerIndex] = p;
}
function hurt(s: State, e: Enemy, damage: number) {
  if (e.hp <= 0) return;
  e.hp -= damage * (s.overclockTimer > 0 ? 1.25 : 1); e.hit = 0.24; emit(s, { kind: "hit", x: e.x, z: e.z });
  if (e.hp > 0) return;
  s.kills++; emit(s, { kind: "kill", x: e.x, z: e.z });
  addPickup(s, { id: s.nextId++, x: e.x, z: e.z, kind: "xp", born: s.time, value: e.type === "brute" ? 4 : 1 });
  for (let i = 0; i < 2; i++) addPickup(s, { id: s.nextId++, x: e.x + (random(s) - 0.5) * 0.6, z: e.z + (random(s) - 0.5) * 0.6, kind: "scrap", born: s.time });
}
function nearestEnemy(s: State, p: Vec, range: number, excluded?: Set<number>) {
  let target: Enemy | undefined, best = range;
  for (const e of s.enemies) if (e.hp > 0 && !excluded?.has(e.id)) { const d = distance(e, p); if (d < best) { best = d; target = e; } }
  return target;
}
function abilities(s: State, dt: number) {
  for (const id of ["lightning", "turret", "burst"] as const) s.abilityTimers[id] -= dt;
  const lightning = s.upgrades.lightning;
  if (lightning && s.abilityTimers.lightning <= 0) {
    let origin = s.player; const hit = new Set<number>();
    for (let i = 0; i < lightning + 1; i++) {
      const e = nearestEnemy(s, origin, i ? 3.8 : 6, hit); if (!e) break;
      emit(s, { kind: "lightning", x: e.x, z: e.z, fromX: origin.x, fromZ: origin.z });
      hit.add(e.id); hurt(s, e, 2 + lightning * 2); origin = e;
    }
    s.abilityTimers.lightning = 3 - lightning * 0.2;
  }
  const burst = s.upgrades.burst;
  if (burst && s.abilityTimers.burst <= 0) {
    const radius = 2.8 + burst * 0.4;
    emit(s, { kind: "burst", ...s.player, radius });
    for (const e of s.enemies) { const d = distance(s.player, e); if (d < radius && e.hp > 0) { hurt(s, e, 2 + burst * 2); e.x += (e.x - s.player.x) / (d || 1) * 1.5; e.z += (e.z - s.player.z) / (d || 1) * 1.5; resolveObstacles(e, e.type === "brute" ? 0.65 : 0.35); } }
    s.abilityTimers.burst = 5.3 - burst * 0.3;
  }
  const rank = s.upgrades.turret;
  if (rank && s.abilityTimers.turret <= 0 && s.turrets.length < ENTITY_LIMITS.turrets) {
    s.turrets.push({ id: s.nextId++, ...s.player, life: 8 + rank * 2, fireTimer: 0, rank }); s.abilityTimers.turret = 8;
  }
  for (const t of s.turrets) {
    t.life -= dt; t.fireTimer -= dt;
    if (t.fireTimer <= 0) {
      const e = nearestEnemy(s, t, 8);
      if (e && s.shots.length < ENTITY_LIMITS.shots) { const d = distance(e, t) || 1; s.shots.push({ id: s.nextId++, x: t.x, z: t.z, vx: (e.x - t.x) / d * 14, vz: (e.z - t.z) / d * 14, life: 0.7, kind: 1, damage: 2 + t.rank }); }
      t.fireTimer = 0.9 - t.rank * 0.1;
    }
  }
  s.turrets = s.turrets.filter(t => t.life > 0);
}
export function update(s: State, dt: number, movement: Vec) {
  if (s.phase !== "playing") return;
  dt = Math.min(0.05, Math.max(0, dt)); if (!dt) return;
  s.time += dt; s.overclockTimer = Math.max(0, s.overclockTimer - dt); s.wave = 1 + Math.floor(s.time / 30);
  s.cooldown = Math.max(0, s.cooldown - dt); s.immunity = Math.max(0, s.immunity - dt);
  const len = Math.hypot(movement.x, movement.z);
  if (len > 0) {
    s.facing = { x: movement.x / len, z: movement.z / len };
    const speed = 6.2 * (1 + s.upgrades.boots * 0.12) * (s.overclockTimer > 0 ? 1.15 : 1);
    s.player.x += movement.x / Math.max(1, len) * speed * dt; s.player.z += movement.z / Math.max(1, len) * speed * dt;
    resolveObstacles(s.player, 0.4);
  }
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    for (let i = 0; i < Math.min(5, 1 + Math.floor(s.time / 60)); i++) spawn(s);
    s.spawnTimer = Math.max(0.22, 1.35 / (1 + s.time / 80));
  }
  // Local buckets bound separation work in a dense horde.
  const buckets = new Map<string, Enemy[]>();
  for (const e of s.enemies) { const key = `${Math.floor(e.x / 1.5)},${Math.floor(e.z / 1.5)}`; const group = buckets.get(key) ?? []; group.push(e); buckets.set(key, group); }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    e.hit = Math.max(0, e.hit - dt);
    let d = distance(e, s.player);
    if (d > 42) { const a = random(s) * Math.PI * 2; e.x = s.player.x + Math.cos(a) * 26; e.z = s.player.z + Math.sin(a) * 26; d = 26; }
    const speed = (e.type === "runner" ? 2.5 : e.type === "brute" ? 0.95 : 1.25) * (1 + Math.min(0.85, s.time / 600));
    if (d > 0.01) { e.x += (s.player.x - e.x) / d * speed * dt; e.z += (s.player.z - e.z) / d * speed * dt; }
    const cx = Math.floor(e.x / 1.5), cz = Math.floor(e.z / 1.5);
    for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (const other of buckets.get(`${x},${z}`) ?? []) {
      if (other.id <= e.id || other.hp <= 0) continue;
      const dx = e.x - other.x, dz = e.z - other.z, ed = Math.hypot(dx, dz), spacing = e.type === "brute" || other.type === "brute" ? 0.95 : 0.65;
      if (ed < spacing && ed > 0) { const push = (spacing - ed) * 0.5; e.x += dx / ed * push; e.z += dz / ed * push; other.x -= dx / ed * push; other.z -= dz / ed * push; }
    }
    resolveObstacles(e, e.type === "brute" ? 0.65 : 0.35);
    if (distance(e, s.player) < (e.type === "brute" ? 0.95 : 0.65) && !s.immunity) {
      const damage = Math.max(1, (e.type === "brute" ? 18 : 9) + Math.floor(s.time / 90) - s.upgrades.armor * 2);
      s.hp = Math.max(0, s.hp - damage); s.immunity = 0.85; emit(s, { kind: "hurt", ...s.player });
    }
    if (!e.hit) for (let i = 0; i < s.scrap; i++) if (distance(e, orbitPosition(s, i)) < (e.type === "brute" ? 0.85 : 0.6)) { hurt(s, e, 1 + s.upgrades.saw); break; }
  }
  if (s.hp <= 0) { s.phase = "lost"; return; }
  s.pulseTimer -= dt;
  if (s.pulseTimer <= 0) {
    s.pulseTimer = s.scrap ? 1.8 : 0.65;
    const target = nearestEnemy(s, s.player, 3.3);
    if (target) { hurt(s, target, 2); emit(s, { kind: "pulse", x: target.x, z: target.z }); }
  }
  abilities(s, dt);
  for (const shot of s.shots) {
    const oldX = shot.x, oldZ = shot.z; shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.life -= dt;
    for (const e of s.enemies) if (e.hp > 0 && shot.life > 0) {
      const dx = shot.x - oldX, dz = shot.z - oldZ, t = Math.max(0, Math.min(1, ((e.x - oldX) * dx + (e.z - oldZ) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(e.x - (oldX + t * dx), e.z - (oldZ + t * dz)) < (e.type === "brute" ? 0.8 : 0.52)) { hurt(s, e, shot.damage ?? 5); shot.life = 0; break; }
    }
  }
  s.enemies = s.enemies.filter(e => e.hp > 0); s.shots = s.shots.filter(p => p.life > 0);
  s.pickups = s.pickups.filter(p => {
    const d = distance(p, s.player), canCollect = p.kind === "xp" || s.scrap < MAX_SCRAP;
    if (canCollect && d < 3.2 + s.upgrades.magnet * 0.9 && s.time - p.born > 0.15) {
      const step = Math.min(d, dt * (7 + 8 / (d + 0.4))); p.x += (s.player.x - p.x) / (d || 1) * step; p.z += (s.player.z - p.z) / (d || 1) * step;
    }
    if (canCollect && distance(p, s.player) < 0.5) {
      const value = p.value ?? 1;
      if (p.kind === "scrap") { const take = Math.min(value, MAX_SCRAP - s.scrap); s.scrap += take; p.value = value - take; }
      else { s.xp += value; p.value = 0; }
      emit(s, { kind: "collect", x: p.x, z: p.z }); return !!p.value;
    }
    return true;
  });
  offerUpgrade(s);
}
