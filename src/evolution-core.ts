import type { UpgradeId } from "./simulation";
export type EvolutionId =
  | "vortex"
  | "storm"
  | "fortress"
  | "reactor"
  | "meltdown"
  | "winch";
export const EVOLUTIONS: Record<
  EvolutionId,
  {
    name: string;
    weapon: UpgradeId;
    support: UpgradeId;
    weaponRank: number;
    supportRank: number;
    description: string;
  }
> = {
  vortex: {
    name: "Scrap Cyclone",
    weapon: "saw",
    support: "magnet",
    weaponRank: 5,
    supportRank: 2,
    description:
      "A permanent cyclone pulls nearby enemies in and shreds them, even with an empty orbit.",
  },
  storm: {
    name: "Storm Circuit",
    weapon: "lightning",
    support: "boots",
    weaponRank: 5,
    supportRank: 2,
    description:
      "Lightning reaches farther, jumps to more targets and strikes twice as often.",
  },
  fortress: {
    name: "Iron Bastion",
    weapon: "turret",
    support: "armor",
    weaponRank: 5,
    supportRank: 2,
    description:
      "Long-lived turrets fire powerful piercing rounds through three enemies.",
  },
  reactor: {
    name: "Pulse Reactor",
    weapon: "burst",
    support: "capacitor",
    weaponRank: 5,
    supportRank: 2,
    description:
      "Blasts fire 20% more often and echo half a second later with more reach. Both pulses sweep nearby pickups to you.",
  },
  meltdown: {
    name: "Meltdown",
    weapon: "slag",
    support: "amplifier",
    weaponRank: 5,
    supportRank: 2,
    description:
      "+1 shell. Slag burns twice as long and 50% hotter, and enemies that die in it burst into new puddles.",
  },
  winch: {
    name: "Scrap Winch",
    weapon: "harpoon",
    support: "magnet",
    weaponRank: 5,
    supportRank: 2,
    description:
      "+2 hooks and faster throws. Hooks reach 10 m, hit harder and drag struck enemies and pickups back to you.",
  },
};
export function createEvolutions(): Record<EvolutionId, boolean> {
  return {
    vortex: false,
    storm: false,
    fortress: false,
    reactor: false,
    meltdown: false,
    winch: false,
  };
}
export function unlockEvolutions(
  upgrades: Record<UpgradeId, number>,
  owned: Record<EvolutionId, boolean>,
): EvolutionId[] {
  const unlocked: EvolutionId[] = [];
  for (const id of Object.keys(EVOLUTIONS) as EvolutionId[]) {
    const r = EVOLUTIONS[id];
    if (
      !owned[id] &&
      upgrades[r.weapon] >= r.weaponRank &&
      upgrades[r.support] >= r.supportRank
    ) {
      owned[id] = true;
      unlocked.push(id);
    }
  }
  return unlocked;
}
