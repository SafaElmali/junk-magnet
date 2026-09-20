/** Stateless coordinates make the scrapyard repeatable without storing an infinite map. */
export const CHUNK_SIZE = 20;
export type Obstacle = { x: number; z: number; radius: number };
export type YardProp = Obstacle & { kind: "tires" | "salvage"; height: number; rotation: number };
const cache = new Map<string, YardProp[]>();
function hash(x: number, z: number, salt: number) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function getChunkProps(cx: number, cz: number): readonly YardProp[] {
  const key = `${cx},${cz}`;
  const cached = cache.get(key);
  if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
  const props: YardProp[] = [];
  for (let i = 0; i < 3; i++) {
    const sideX = i === 1 ? -1 : 1;
    const sideZ = i === 2 ? -1 : 1;
    const x = cx * CHUNK_SIZE + sideX * (5 + hash(cx, cz, i * 31 + 3) * 2.4);
    const z = cz * CHUNK_SIZE + sideZ * (5 + hash(cx, cz, i * 37 + 7) * 2.4);
    if (Math.hypot(x, z) < 8) continue;
    props.push({ x, z, radius: 0.72 + hash(cx, cz, i * 51 + 19) * 0.3,
      kind: hash(cx, cz, i * 29 + 23) < 0.55 ? "tires" : "salvage",
      height: 2 + Math.floor(hash(cx, cz, i * 41 + 29) * 2),
      rotation: hash(cx, cz, i * 43 + 31) * Math.PI * 2 });
  }
  cache.set(key, props);
  if (cache.size > 96) cache.delete(cache.keys().next().value!);
  return props;
}
/** Adjacent chunks are included so collision queries also work at every seam. */
export function getObstacles(x: number, z: number): Obstacle[] {
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const result: Obstacle[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
    result.push(...getChunkProps(cx + dx, cz + dz));
  return result;
}
