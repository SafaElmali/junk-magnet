import { createState, type State } from "./simulation";
import { ROBOTS } from "./progression";

/**
 * Unfinished solo runs survive a reload or a closed tab. The whole State is
 * serialized generically, so fields added to the simulation are saved without
 * listing them here.
 */
// Not "junk-magnet-…": crazygames.ts copies that prefix into cloud saves, and a
// snapshot is too large and too frequent for the CrazyGames Data module.
export const RUN_SAVE_KEY = "junkmagnet-run-v1";
/** Bump when a change keeps State's shape but alters what saved values mean. */
export const RUN_SAVE_VERSION = 1;
export type RunSnapshot = { state: State; runId: string; savedAt: number };
export type RunStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// JSON has no Map, Set, undefined, NaN, ±Infinity or -0, and no shared
// references. Those values become tagged objects; containers are numbered in
// visit order so a repeated reference (or a cycle) restores as the same object.
const TAG = "$jm";
type Tagged = { [TAG]: "map" | "set" | "num" | "undef" | "ref" | "obj"; v?: unknown };
const tagged = (kind: Tagged[typeof TAG], v?: unknown): Tagged =>
  v === undefined ? { [TAG]: kind } : { [TAG]: kind, v };

function encode(value: unknown, seen: Map<object, number>): unknown {
  if (typeof value === "number")
    return Number.isFinite(value) && !Object.is(value, -0)
      ? value
      : tagged("num", Object.is(value, -0) ? "-0" : String(value));
  if (typeof value === "string" || typeof value === "boolean" || value === null)
    return value;
  if (value === undefined) return tagged("undef");
  if (typeof value !== "object") throw new TypeError(`Cannot save a ${typeof value}`);
  const ref = seen.get(value);
  if (ref !== undefined) return tagged("ref", ref);
  seen.set(value, seen.size);
  if (Array.isArray(value)) {
    const out = new Array<unknown>(value.length);
    for (let i = 0; i < value.length; i++) out[i] = encode(value[i], seen);
    return out;
  }
  if (value instanceof Map)
    return tagged("map", Array.from(value, ([k, v]) => [encode(k, seen), encode(v, seen)]));
  if (value instanceof Set) return tagged("set", Array.from(value, (v) => encode(v, seen)));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    throw new TypeError(`Cannot save a ${proto?.constructor?.name ?? "class"} instance`);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value))
    out[key] = encode((value as Record<string, unknown>)[key], seen);
  return TAG in out ? tagged("obj", out) : out;
}
function decode(value: unknown, objects: object[]): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    objects.push(out);
    for (const item of value) out.push(decode(item, objects));
    return out;
  }
  const v = (value as Tagged).v;
  switch ((value as Tagged)[TAG]) {
    case undefined:
      return decodeObject(value as Record<string, unknown>, objects);
    case "obj":
      return decodeObject(v as Record<string, unknown>, objects);
    case "num":
      return Number(v);
    case "undef":
      return undefined;
    case "ref":
      if (typeof v !== "number" || !(v in objects)) throw new TypeError("Bad reference");
      return objects[v];
    case "map": {
      const out = new Map();
      objects.push(out);
      for (const [key, item] of v as [unknown, unknown][])
        out.set(decode(key, objects), decode(item, objects));
      return out;
    }
    case "set": {
      const out = new Set();
      objects.push(out);
      for (const item of v as unknown[]) out.add(decode(item, objects));
      return out;
    }
    default:
      throw new TypeError("Unknown tag");
  }
}
function decodeObject(source: Record<string, unknown>, objects: object[]) {
  if (typeof source !== "object" || source === null) throw new TypeError("Bad object");
  const out: Record<string, unknown> = {};
  objects.push(out);
  for (const key of Object.keys(source))
    if (key !== "__proto__") out[key] = decode(source[key], objects);
  return out;
}

// A structural fingerprint of a fresh run: a game update that adds, removes or
// retypes State fields makes older snapshots incompatible without a manual bump.
let shape: string | undefined;
function describe(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length ? describe(value[0]) : ""}]`;
  if (value instanceof Map) return "Map";
  if (value instanceof Set) return "Set";
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}:${describe((value as Record<string, unknown>)[key])}`)
      .join()}}`;
  return value === null ? "null" : typeof value;
}
export function stateShape(): string {
  if (shape) return shape;
  let hash = 0x811c9dc5;
  const text = describe(createState());
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (shape = (hash >>> 0).toString(16));
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
/** A started solo run that has not ended; "won" and "lost" runs are over. */
export function isResumable(s: State): boolean {
  return (
    finite(s.time) &&
    s.time > 0 &&
    finite(s.hp) &&
    s.hp > 0 &&
    finite(s.player?.x) &&
    finite(s.player?.z) &&
    typeof s.phase === "string" &&
    !["ready", "lost", "won"].includes(s.phase) &&
    ROBOTS.some((robot) => robot.id === s.config?.robotId)
  );
}
export function serializeRun(state: State, runId: string, savedAt = Date.now()): string {
  return JSON.stringify({
    version: RUN_SAVE_VERSION,
    shape: stateShape(),
    runId,
    savedAt,
    state: encode(state, new Map()),
  });
}
/** Null for corrupt, incompatible or finished snapshots. */
export function parseRun(text: string): RunSnapshot | null {
  try {
    const data = JSON.parse(text);
    if (
      data?.version !== RUN_SAVE_VERSION ||
      data.shape !== stateShape() ||
      typeof data.runId !== "string" ||
      !data.runId.length ||
      data.runId.length > 128
    )
      return null;
    const state = decode(data.state, []) as State;
    if (!state || typeof state !== "object" || Array.isArray(state) || !isResumable(state))
      return null;
    return { state, runId: data.runId, savedAt: finite(data.savedAt) ? data.savedAt : 0 };
  } catch {
    return null;
  }
}

// localStorage directly, never the platform cloud storage (see RUN_SAVE_KEY).
function browserStorage(): RunStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
export function saveRun(state: State, runId: string, storage = browserStorage()): boolean {
  if (!storage || !isResumable(state)) return false;
  try {
    storage.setItem(RUN_SAVE_KEY, serializeRun(state, runId));
    return true;
  } catch {
    // Quota, denied storage or an unsaveable value: the last good snapshot stays.
    return false;
  }
}
/** Restores the saved run, discarding a snapshot that cannot be resumed. */
export function loadRun(storage = browserStorage()): RunSnapshot | null {
  let text: string | null;
  try {
    text = storage?.getItem(RUN_SAVE_KEY) ?? null;
  } catch {
    return null;
  }
  if (text === null) return null;
  const snapshot = parseRun(text);
  if (!snapshot) clearRun(storage);
  return snapshot;
}
export function clearRun(storage = browserStorage()) {
  try {
    storage?.removeItem(RUN_SAVE_KEY);
  } catch {
    /* Denied storage has nothing to clear. */
  }
}
