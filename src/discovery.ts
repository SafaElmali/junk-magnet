import { CHUNK_SIZE, getObstacles } from "./world";

export type DiscoveryKind = "repair" | "chest" | "salvage";
export type DiscoveryPoint = {
  id: string;
  sector: number;
  kind: DiscoveryKind;
  x: number;
  z: number;
  progress: number;
  completed: boolean;
};
export const DISCOVERY_LIMITS = { points: 11, sectors: 256 };
export type DiscoveryState = {
  points: DiscoveryPoint[];
  consumed: Map<number, number>;
  highestSector: number;
  chunk: string;
  chestsOpened: number;
  questsCompleted: number;
  repairsUsed: number;
  lastReward: { kind: DiscoveryKind; until: number } | null;
};
export type DiscoveryGameState = {
  phase: string;
  openingRemaining: number;
  time: number;
  player: { x: number; z: number };
  hp: number;
  xp: number;
  scrap: number;
  earnedParts: number;
  discovery: DiscoveryState;
};
const bits: Record<DiscoveryKind, number> = { repair: 1, chest: 2, salvage: 4 };
const durations: Record<DiscoveryKind, number> = {
  repair: 0,
  chest: 1.2,
  salvage: 8,
};
export const discoveryRadius = (kind: DiscoveryKind) =>
  kind === "salvage" ? 2.7 : 1.6;

/** A square spiral gives every integer sector a permanent, unique ordinal. */
function sectorOrdinal(x: number, z: number) {
  const r = Math.max(Math.abs(x), Math.abs(z));
  if (!r) return 0;
  const edge = 2 * r,
    end = (2 * r + 1) ** 2 - 1;
  if (z === -r) return end - (r - x);
  if (x === -r) return end - edge - (z + r);
  if (z === r) return end - 2 * edge - (x + r);
  return end - 3 * edge - (r - z);
}
function retired(d: DiscoveryState, sector: number) {
  return sector <= d.highestSector - DISCOVERY_LIMITS.sectors;
}
function point(
  d: DiscoveryState,
  cx: number,
  cz: number,
  kind: DiscoveryKind,
  ox = 0,
  oz = 0,
): DiscoveryPoint {
  const sector = sectorOrdinal(cx, cz);
  let x = cx * CHUNK_SIZE + ox,
    z = cz * CHUNK_SIZE + oz;
  // All normal centers are clear of the yard's corner props; retain a collision
  // check so future prop layouts cannot bury an interaction point.
  const clear = (px: number, pz: number) =>
    getObstacles(px, pz).every(
      (o) =>
        Math.hypot(px - o.x, pz - o.z) > o.radius + discoveryRadius(kind) + 0.5,
    );
  if (!clear(x, z)) {
    for (const [dx, dz] of [
      [0, 0],
      [0, 3],
      [3, 0],
      [0, -3],
      [-3, 0],
    ]) {
      const px = cx * CHUNK_SIZE + dx,
        pz = cz * CHUNK_SIZE + dz;
      if (clear(px, pz)) {
        x = px;
        z = pz;
        break;
      }
    }
  }
  return {
    id: `${cx},${cz}:${kind}`,
    sector,
    kind,
    x,
    z,
    progress: 0,
    completed:
      retired(d, sector) || Boolean((d.consumed.get(sector) ?? 0) & bits[kind]),
  };
}
function stream(d: DiscoveryState, x: number, z: number) {
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const chunk = `${cx},${cz}`;
  if (chunk === d.chunk) return;
  d.chunk = chunk;
  // Monotonic retirement, rather than LRU reward history, means revisiting an
  // evicted sector can NEVER create fresh currency. At most 256 ordinal sectors
  // are retained; older machines remain visibly spent for the rest of this run.
  d.highestSector = Math.max(d.highestSector, sectorOrdinal(cx, cz));
  for (const sector of d.consumed.keys())
    if (retired(d, sector)) d.consumed.delete(sector);
  const old = new Map(d.points.map((p) => [p.id, p]));
  const next: DiscoveryPoint[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      const px = cx + dx,
        pz = cz + dz;
      const points =
        px === 0 && pz === 0
          ? [
              point(d, px, pz, "chest", 4, 0),
              point(d, px, pz, "repair", -4, 0),
              point(d, px, pz, "salvage", 0, -8),
            ]
          : [
              point(
                d,
                px,
                pz,
                (["chest", "repair", "salvage"] as const)[
                  sectorOrdinal(px, pz) % 3
                ],
              ),
            ];
      for (const p of points) {
        const previous = old.get(p.id);
        if (previous && !p.completed) p.progress = previous.progress;
        next.push(p);
      }
    }
  d.points = next;
}
export function createDiscoveryState(): DiscoveryState {
  const d: DiscoveryState = {
    points: [],
    consumed: new Map(),
    highestSector: 0,
    chunk: "",
    chestsOpened: 0,
    questsCompleted: 0,
    repairsUsed: 0,
    lastReward: null,
  };
  stream(d, 0, 0);
  return d;
}
export function updateDiscovery(s: DiscoveryGameState, dt: number) {
  if (s.phase !== "playing" || s.openingRemaining > 0 || dt <= 0) return;
  stream(s.discovery, s.player.x, s.player.z);
  for (const p of s.discovery.points) {
    if (p.completed) continue;
    const inside =
      Math.hypot(s.player.x - p.x, s.player.z - p.z) <= discoveryRadius(p.kind);
    if (!inside) {
      p.progress = Math.max(0, p.progress - dt * 0.5);
      continue;
    }
    if (p.kind === "repair" && s.hp >= 100) continue;
    p.progress += dt;
    if (p.progress < durations[p.kind]) continue;
    p.completed = true;
    s.discovery.lastReward = { kind: p.kind, until: s.time + 3 };
    s.discovery.highestSector = Math.max(s.discovery.highestSector, p.sector);
    for (const sector of s.discovery.consumed.keys())
      if (retired(s.discovery, sector)) s.discovery.consumed.delete(sector);
    for (const other of s.discovery.points)
      if (retired(s.discovery, other.sector)) other.completed = true;
    s.discovery.consumed.set(
      p.sector,
      (s.discovery.consumed.get(p.sector) ?? 0) | bits[p.kind],
    );
    if (p.kind === "repair") {
      s.hp = Math.min(100, s.hp + 40);
      s.discovery.repairsUsed++;
    }
    if (p.kind === "chest") {
      s.xp += 5;
      s.scrap = Math.min(12, s.scrap + 6);
      s.earnedParts += 3;
      s.discovery.chestsOpened++;
    }
    if (p.kind === "salvage") {
      s.xp += 12;
      s.scrap = 12;
      s.earnedParts += 8;
      s.discovery.questsCompleted++;
    }
  }
}
export function getDiscoveryHint(s: DiscoveryGameState): {
  kind: DiscoveryKind;
  mode: "approach" | "hold" | "full-health" | "complete";
  progress: number;
  distance: number;
  seconds: number;
} | null {
  let nearest: DiscoveryPoint | undefined,
    distance = 6;
  for (const p of s.discovery.points) {
    if (p.completed) continue;
    const d = Math.hypot(s.player.x - p.x, s.player.z - p.z);
    if (d < distance) {
      nearest = p;
      distance = d;
    }
  }
  if (!nearest) return null;
  const duration = durations[nearest.kind];
  return {
    kind: nearest.kind,
    mode:
      nearest.kind === "repair" && s.hp >= 100
        ? "full-health"
        : distance <= discoveryRadius(nearest.kind)
          ? "hold"
          : "approach",
    progress: duration ? Math.min(1, nearest.progress / duration) : 0,
    distance,
    seconds: Math.max(0, Math.ceil(duration - nearest.progress)),
  };
}
