import { t } from "./i18n";
import { REVIVE_HEALTH } from "./simulation";
import { requestRewardedAd, type RewardedAdResult } from "./crazygames";
import type { DoublePartsState } from "./ad-offers";
import "./ad-offers.css";

const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const adIcon = icon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/>');
const emptyBattery = icon('<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2m-10.5-4L9 12h3.5L10 15"/>');

/** The defeat offer; text is filled by renderReviveOffer so it follows the language. */
export const reviveOfferMarkup = `<div class="modal-backdrop ad-offer hidden" id="revive-offer" role="dialog" aria-modal="true" aria-labelledby="revive-offer-title" aria-describedby="revive-offer-copy"><div class="modal-card"><span class="ad-offer-badge">${emptyBattery}</span><h2 id="revive-offer-title"></h2><p id="revive-offer-copy"></p><div class="ad-offer-actions"><button class="primary-btn" id="revive-watch"><span id="revive-watch-label"></span>${adIcon}</button><button id="revive-decline"></button></div></div></div>`;

const byId = (id: string) => document.getElementById(id)!;
export function renderReviveOffer() {
  byId("revive-offer-title").textContent = t("Out of power");
  byId("revive-offer-copy").textContent = t(
    "Watch a short ad to revive with {health} health.",
    { health: REVIVE_HEALTH },
  );
  byId("revive-watch-label").textContent = t("WATCH AD");
  byId("revive-decline").textContent = t("NO THANKS");
}

/**
 * The result's reward row: this run's parts and the bank, then the double-parts
 * offer or its outcome. Without an offer it is the plain line it always was.
 */
export function renderReward(
  host: HTMLElement,
  reward: { earned: number; bank: number; bonus: number; offer: DoublePartsState | null },
) {
  const text = t(
    reward.bonus > 0
      ? "+{parts} parts (doubled) · Bank: {total}"
      : "+{parts} parts · Bank: {total}",
    { parts: reward.earned + reward.bonus, total: reward.bank + reward.bonus },
  );
  const extra =
    reward.offer === "offer" || reward.offer === "pending"
      ? `<button type="button" class="result-double" id="double-parts"${reward.offer === "pending" ? ' aria-disabled="true"' : ""}>${adIcon}<span>${t("WATCH AD · DOUBLE PARTS")}</span></button>`
      : reward.offer === "failed"
        ? `<span class="result-double-note" role="status">${t("No ad available right now")}</span>`
        : "";
  host.classList.toggle("has-ad-offer", extra !== "");
  if (!extra) host.textContent = text;
  else host.innerHTML = `<span class="result-reward-text">${text}</span>${extra}`;
}

let playing = false;
/** True from the ad request until it settles; the offers ignore every input meanwhile. */
export const adPlaying = () => playing;

/**
 * Plays a rewarded ad for an offer: `dialog` is inert and the game muted until the
 * SDK settles. The game is already paused on both offer screens.
 */
export async function watchRewardedAd(
  dialog: HTMLElement,
  mute: (muted: boolean) => void,
): Promise<RewardedAdResult> {
  playing = true;
  dialog.inert = true;
  dialog.classList.add("is-waiting");
  try {
    return await requestRewardedAd({
      started: () => mute(true),
      ended: () => mute(false),
    });
  } finally {
    mute(false);
    playing = false;
    dialog.inert = false;
    dialog.classList.remove("is-waiting");
  }
}
