import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  initCrazyGames,
  onCrazyGamesMute,
  requestRewardedAd,
  rewardedAdsAvailable,
  setCrazyGamesPlaying,
} from "./crazygames";
import { loadProgress, PROGRESS_KEY } from "./progression";
import { copyMissingKeys, gameStorage } from "./storage";

const memory = (seed: Record<string, string> = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};
type AdCallbacks = {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: { code?: string } | undefined) => void;
};
const fakeSdk = (
  environment: "local" | "crazygames" | "disabled",
  data: Pick<Storage, "getItem" | "setItem">,
  adblock = false,
) => {
  const calls: string[] = [];
  const ads: AdCallbacks[] = [];
  let listener: ((s: { muteAudio: boolean }) => void) | undefined;
  const game = {
    loadingStart: () => void calls.push("loadingStart"),
    loadingStop: () => void calls.push("loadingStop"),
    gameplayStart: () => void calls.push("gameplayStart"),
    gameplayStop: () => void calls.push("gameplayStop"),
    settings: { muteAudio: true },
    addSettingsChangeListener: (l: typeof listener) => void (listener = l),
  };
  const ad = {
    requestAd: (_type: "rewarded", callbacks: AdCallbacks) => {
      calls.push("requestAd");
      ads.push(callbacks);
    },
    hasAdblock: async () => adblock,
  };
  const sdk = { init: async () => {}, environment, game, data, ad };
  return {
    sdk,
    calls,
    ads,
    mute: (muted: boolean) => listener?.({ muteAudio: muted }),
  };
};
const browser = memory({
  [PROGRESS_KEY]: JSON.stringify({ version: 1, parts: 42 }),
  "junk-magnet-language": "tr",
  "posthog-id": "unrelated",
});
Object.defineProperty(globalThis, "localStorage", {
  value: browser,
  configurable: true,
});

test("key migration copies only missing game keys and survives index shifts", () => {
  const cloud = memory({ "junk-magnet-language": "de" });
  copyMissingKeys(browser, cloud, "junk-magnet-");
  assert.equal(cloud.getItem("junk-magnet-language"), "de");
  assert.equal(cloud.getItem(PROGRESS_KEY), browser.getItem(PROGRESS_KEY));
  assert.equal(cloud.getItem("posthog-id"), null);
  // A target sharing its backing store adds keys mid-copy without skipping any.
  const shared = memory({
    "a-1": "1",
    "junk-magnet-x": "x",
    "junk-magnet-y": "y",
  });
  copyMissingKeys(
    shared,
    {
      getItem: () => null,
      setItem: (key, value) => void shared.data.set(`_${key}`, value),
    },
    "junk-magnet-",
  );
  assert.equal(shared.getItem("_junk-magnet-x"), "x");
  assert.equal(shared.getItem("_junk-magnet-y"), "y");
});

test("outside CrazyGames the SDK stays inert and browser storage is kept", async () => {
  await initCrazyGames(undefined);
  const disabled = fakeSdk("disabled", memory());
  await initCrazyGames(disabled.sdk);
  setCrazyGamesPlaying(true);
  onCrazyGamesMute(() => assert.fail("no mute listener without the SDK"));
  assert.deepEqual(disabled.calls, []);
  assert.equal(gameStorage(), browser);
});

test("a disabled Progress Save keeps browser storage but still reports play", async () => {
  const noData = fakeSdk("crazygames", {
    getItem: () => {
      throw new Error("data module disabled");
    },
    setItem: () => {},
  });
  await initCrazyGames(noData.sdk);
  assert.equal(gameStorage(), browser);
  setCrazyGamesPlaying(true);
  setCrazyGamesPlaying(false);
  assert.deepEqual(noData.calls, [
    "loadingStart",
    "gameplayStart",
    "gameplayStop",
  ]);
});

test("CrazyGames saves progress in the data module and reports play transitions once", async () => {
  const cloud = memory();
  const crazy = fakeSdk("crazygames", cloud);
  await initCrazyGames(crazy.sdk);
  assert.equal(gameStorage(), cloud);
  assert.equal(
    loadProgress().parts,
    42,
    "earlier browser progress carries over",
  );
  assert.equal(cloud.getItem("posthog-id"), null);

  for (const playing of [true, true, false, false, true])
    setCrazyGamesPlaying(playing);
  assert.deepEqual(crazy.calls, [
    "loadingStart",
    "gameplayStart",
    "gameplayStop",
    "gameplayStart",
  ]);
  setCrazyGamesPlaying(false);

  const muted: boolean[] = [];
  onCrazyGamesMute((m) => muted.push(m));
  crazy.mute(false);
  assert.deepEqual(muted, [true, false], "current setting first, then changes");
});

test("rewarded ads stay off unless the build enables them", async () => {
  const crazy = fakeSdk("crazygames", memory());
  await initCrazyGames(crazy.sdk, { ads: false });
  assert.equal(rewardedAdsAvailable(), false);
  assert.equal(await requestRewardedAd(), "unavailable");
  assert.equal(crazy.calls.includes("requestAd"), false);
});

test("a finished rewarded ad pauses play, mutes around the ad and grants the reward once", async () => {
  const crazy = fakeSdk("crazygames", memory());
  await initCrazyGames(crazy.sdk, { ads: true });
  await Promise.resolve();
  setCrazyGamesPlaying(true);
  assert.equal(rewardedAdsAvailable(), true);
  const hooks: string[] = [];
  const result = requestRewardedAd({
    started: () => hooks.push("started"),
    ended: () => hooks.push("ended"),
  });
  assert.equal(rewardedAdsAvailable(), false, "one offer at a time");
  assert.deepEqual(crazy.calls.slice(-2), ["gameplayStop", "requestAd"]);
  crazy.ads[0].adStarted?.();
  crazy.ads[0].adFinished?.();
  crazy.ads[0].adError?.({ code: "other" });
  assert.equal(await result, "rewarded");
  assert.deepEqual(hooks, ["started", "ended"]);
  assert.equal(rewardedAdsAvailable(), true);
});

test("unfilled ads can be retried, but Basic Launch and ad blockers end offers for the session", async () => {
  const crazy = fakeSdk("crazygames", memory());
  await initCrazyGames(crazy.sdk, { ads: true });
  const unfilled = requestRewardedAd();
  crazy.ads[0].adError?.({ code: "unfilled" });
  assert.equal(await unfilled, "failed");
  assert.equal(rewardedAdsAvailable(), true);
  const disabled = requestRewardedAd();
  crazy.ads[1].adError?.({ code: "adsDisabledBasicLaunch" });
  assert.equal(await disabled, "failed");
  assert.equal(rewardedAdsAvailable(), false);

  const blocked = fakeSdk("crazygames", memory(), true);
  await initCrazyGames(blocked.sdk, { ads: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rewardedAdsAvailable(), false);
  assert.equal(await requestRewardedAd(), "unavailable");
});

test("an ad request that never starts gives up instead of stranding the player", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const crazy = fakeSdk("crazygames", memory());
    await initCrazyGames(crazy.sdk, { ads: true });
    const hooks: string[] = [];
    const result = requestRewardedAd({ ended: () => hooks.push("ended") });
    mock.timers.tick(15_000);
    assert.equal(await result, "failed");
    assert.deepEqual(hooks, [], "nothing started, so nothing to restore");
    crazy.ads[0].adStarted?.();
    crazy.ads[0].adFinished?.();
    assert.equal(rewardedAdsAvailable(), true);
  } finally {
    mock.timers.reset();
  }
});
