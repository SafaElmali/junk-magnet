import {
  copyMissingKeys,
  usePlatformStorage,
  type StorageLike,
} from "./storage";

/** The subset of the CrazyGames HTML5 SDK v3 this game uses. */
type CrazySDK = {
  init(): Promise<void>;
  environment: "local" | "crazygames" | "disabled";
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    settings: { muteAudio: boolean };
    addSettingsChangeListener(
      listener: (settings: { muteAudio: boolean }) => void,
    ): void;
  };
  data: StorageLike;
};

let sdk: CrazySDK | undefined;
let playing = false;

/**
 * Starts the SDK when its script is present (CrazyGames build only). Outside
 * CrazyGames, or when an ad blocker removes the script, the game keeps
 * browser storage and every other call here is a no-op.
 */
export async function initCrazyGames(
  candidate = (globalThis as { CrazyGames?: { SDK?: CrazySDK } }).CrazyGames
    ?.SDK,
) {
  if (!candidate) return;
  try {
    await candidate.init();
    if (candidate.environment === "disabled") return;
    sdk = candidate;
    sdk.game.loadingStart();
  } catch {
    return;
  }
  try {
    // Throws when Progress Save is not enabled for this version in the portal.
    sdk.data.getItem("junk-magnet-probe");
  } catch {
    return;
  }
  try {
    copyMissingKeys(localStorage, sdk.data, "junk-magnet-");
  } catch {
    /* No earlier browser save to carry over. */
  }
  usePlatformStorage(sdk.data);
}

export function crazyGamesLoaded() {
  try {
    sdk?.game.loadingStop();
  } catch {
    /* SDK failures must not block play. */
  }
}

/** Reports active play; menus, pauses, level-ups and results all stop it. */
export function setCrazyGamesPlaying(next: boolean) {
  if (!sdk || next === playing) return;
  playing = next;
  try {
    if (next) sdk.game.gameplayStart();
    else sdk.game.gameplayStop();
  } catch {
    /* SDK failures must not block play. */
  }
}

export function onCrazyGamesMute(listener: (muted: boolean) => void) {
  if (!sdk) return;
  try {
    listener(sdk.game.settings.muteAudio);
    sdk.game.addSettingsChangeListener((settings) =>
      listener(settings.muteAudio),
    );
  } catch {
    /* SDK failures must not block play. */
  }
}
