import { UPGRADES, type UpgradeId } from "./simulation";

export type AbilityCategory = "Weapons" | "Support" | "Supplies";
export const abilityGuide: Record<
  UpgradeId,
  { category: AbilityCategory; description: string }
> = {
  saw: {
    category: "Weapons",
    description:
      "Scrap blades circle your robot and hit nearby enemies. More ranks increase damage, orbit size and speed.",
  },
  lightning: {
    category: "Weapons",
    description:
      "An electric arc jumps between 2 enemies, dealing 4 damage every 2.8 seconds. More ranks add targets and damage.",
  },
  turret: {
    category: "Weapons",
    description:
      "Deploy a stationary turret every 8 seconds. Each shot deals 3 damage. More ranks improve fire rate, damage and lifetime.",
  },
  burst: {
    category: "Weapons",
    description:
      "A magnetic shockwave hits nearby enemies for 4 damage and pushes them back every 5 seconds. More ranks widen and strengthen the blast.",
  },
  boots: {
    category: "Support",
    description:
      "Move 12% faster per rank. Slip through gaps and keep ahead of the swarm.",
  },
  magnet: {
    category: "Support",
    description:
      "Extend your pickup radius by 0.9 metres per rank. Collect energy and reload your scrap from farther away.",
  },
  armor: {
    category: "Support",
    description:
      "Reduce contact damage by 2 per rank. Every enemy hit still deals at least 1 damage.",
  },
  drone_collector: {
    category: "Support",
    description: UPGRADES.drone_collector.description,
  },
  drone_repair: {
    category: "Support",
    description: UPGRADES.drone_repair.description,
  },
  drone_guard: {
    category: "Support",
    description: UPGRADES.drone_guard.description,
  },
  repair: {
    category: "Supplies",
    description:
      "Restore 35 health immediately, up to 100. Can be selected again on a later level.",
  },
  refill: {
    category: "Supplies",
    description:
      "Refill all 12 scrap pieces and reset the automatic attack cooldown. Can be selected again.",
  },
  overclock: {
    category: "Supplies",
    description:
      "Gain 25% damage and 15% movement speed for 20 seconds. Choosing it again refreshes the duration.",
  },
};
export const abilityAsset = (id: UpgradeId) =>
  `${(import.meta.env?.BASE_URL ?? "/")}abilities/${id.startsWith("drone_") ? "drone" : id}.png`;

export async function preloadAbilityArt(): Promise<void> {
  const sources = new Set(
    (Object.keys(UPGRADES) as UpgradeId[]).map(abilityAsset),
  );
  // Decode every page's art before opening the menu. Drone modes share one image.
  // A missing decorative image must not prevent the game from opening.
  await Promise.allSettled(
    [...sources].map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode();
    }),
  );
}

export const abilityImage = (id: UpgradeId, className = "ability-art") =>
  `<img class="${className}" src="${abilityAsset(id)}" width="384" height="384" alt="" decoding="sync">`;
