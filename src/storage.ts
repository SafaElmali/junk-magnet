export type StorageLike = Pick<Storage, "getItem" | "setItem">;

let platformStorage: StorageLike | undefined;

/** Cloud saves (CrazyGames) replace browser storage before any game module loads. */
export function usePlatformStorage(storage: StorageLike) {
  platformStorage = storage;
}

export function gameStorage(): StorageLike | undefined {
  if (platformStorage) return platformStorage;
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Copies saved keys the target lacks, so switching storage never resets progress. */
export function copyMissingKeys(
  from: Pick<Storage, "getItem" | "key" | "length">,
  to: StorageLike,
  prefix: string,
) {
  // Snapshot first: writing to a localStorage-backed target can shift indices.
  const keys = Array.from({ length: from.length }, (_, i) => from.key(i));
  for (const key of keys) {
    if (!key?.startsWith(prefix) || to.getItem(key) !== null) continue;
    const value = from.getItem(key);
    if (value !== null) to.setItem(key, value);
  }
}
