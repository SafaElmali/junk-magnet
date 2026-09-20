import { t } from "./i18n";
import type { DiscoveryKind, DiscoveryReward } from "./discovery";
export const discoveryNames = {
  repair: "Repair station",
  chest: "Supply chest",
  salvage: "Salvage contract",
};

/** One compact receipt, never a blocking reward dialog. Values are actual gains. */
export function discoveryFeedback(
  kind: DiscoveryKind,
  status: string,
  reward?: DiscoveryReward,
  progress?: number,
) {
  const metrics: [string, string][] =
    kind === "repair"
      ? [[reward ? `+${reward.hp}` : "≤40", t("Health")]]
      : [
          [
            `+${reward ? reward.xp : kind === "chest" ? 5 : 12}`,
            t("Experience"),
          ],
          [
            reward
              ? reward.scrap
                ? `+${reward.scrap}`
                : "12/12"
              : kind === "chest"
                ? "≤6"
                : "12/12",
            t(
              reward?.scrap === 0
                ? "Orbit full"
                : !reward && kind === "salvage"
                  ? "Refill orbit"
                  : "Attack scrap",
            ),
          ],
          [
            `+${reward ? reward.parts : kind === "chest" ? 3 : 8}`,
            t("Workshop parts"),
          ],
        ];
  return `<div class="discovery-heading"><img src="${import.meta.env.BASE_URL}discoveries/${kind}.png" width="48" height="48" alt=""/><div><strong>${t(discoveryNames[kind])}</strong><span>${status}</span></div></div>
    <div class="discovery-rewards">${metrics.map(([value, label]) => `<span><b>${value}</b><small>${label}</small></span>`).join("")}</div>
    ${progress === undefined ? "" : `<div class="discovery-progress" role="progressbar" aria-label="${status}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><i style="transform:scaleX(${progress})"></i></div>`}
    ${reward?.parts ? `<small class="discovery-bank-note">${t("Saved to the workshop when this run ends.")}</small>` : ""}`;
}

/** Active interaction feedback stays small; no reward table covers the arena. */
export function discoveryProgress(
  kind: DiscoveryKind,
  status: string,
  progress: number,
) {
  return `<div class="discovery-heading"><img src="${import.meta.env.BASE_URL}discoveries/${kind}.png" width="24" height="24" alt=""/><span>${status}</span></div><div class="discovery-progress" role="progressbar" aria-label="${status}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><i style="transform:scaleX(${progress})"></i></div>`;
}
