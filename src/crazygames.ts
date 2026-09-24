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
  ad: {
    requestAd(
      type: "rewarded",
      callbacks: {
        adStarted?: () => void;
        adFinished?: () => void;
        adError?: (error: { code?: string } | undefined) => void;
      },
    ): void;
    hasAdblock(): Promise<boolean>;
  };
};

let sdk: CrazySDK | undefined;
let playing = false;
// Rewarded ads ship switched off: CrazyGames disables ads during Basic Launch,
// so the offers would only fail. Build with VITE_CRAZYGAMES_ADS=true after Full Launch.
let adsEnabled = false;
let adsBlocked = false;
let adPending = false;

/**
 * Starts the SDK when its script is present (CrazyGames build only). Outside
 * CrazyGames, or when an ad blocker removes the script, the game keeps
 * browser storage and every other call here is a no-op.
 */
export async function initCrazyGames(
  candidate = (globalThis as { CrazyGames?: { SDK?: CrazySDK } }).CrazyGames
    ?.SDK,
  options = { ads: import.meta.env?.VITE_CRAZYGAMES_ADS === "true" },
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
  adsEnabled = options.ads;
  adsBlocked = false;
  if (adsEnabled)
    // Never offer an ad the player's blocker would swallow.
    void sdk.ad
      .hasAdblock()
      .then((blocked) => void (adsBlocked ||= blocked))
      .catch(() => {});
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

/** True when a rewarded-ad offer can be shown right now. */
export function rewardedAdsAvailable() {
  return adsEnabled && !!sdk && !adsBlocked && !adPending;
}

export type RewardedAdResult = "rewarded" | "unavailable" | "failed";

/**
 * Plays an optional rewarded ad. The game must stay paused and muted from
 * `started` until `ended`; grant the reward only for "rewarded".
 */
export function requestRewardedAd(
  hooks: { started?: () => void; ended?: () => void } = {},
): Promise<RewardedAdResult> {
  const current = sdk;
  if (!current || !rewardedAdsAvailable())
    return Promise.resolve("unavailable");
  adPending = true;
  setCrazyGamesPlaying(false);
  return new Promise((resolve) => {
    let started = false,
      settled = false;
    const finish = (result: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      adPending = false;
      clearTimeout(watchdog);
      if (started) hooks.ended?.();
      resolve(result);
    };
    // An SDK that never answers must not strand the player on the offer.
    const watchdog = setTimeout(() => {
      if (!started) finish("failed");
    }, 15_000);
    try {
      current.ad.requestAd("rewarded", {
        adStarted() {
          if (settled) return;
          started = true;
          hooks.started?.();
        },
        adFinished: () => finish("rewarded"),
        adError(error) {
          // Basic Launch and ad blockers rule out ads for the whole session;
          // "unfilled" and "adCooldown" may succeed on a later request.
          if (
            error?.code === "adsDisabledBasicLaunch" ||
            error?.code === "adblock"
          )
            adsBlocked = true;
          finish("failed");
        },
      });
    } catch {
      finish("failed");
    }
  });
}
