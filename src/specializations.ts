export type WeaponId = "saw" | "lightning" | "turret" | "burst";
export type SpecializationId =
  | "saw_reaper" | "saw_rail"
  | "lightning_chain" | "lightning_focus"
  | "turret_rapid" | "turret_sniper"
  | "burst_wave" | "burst_crush";
export type Specializations = Partial<Record<WeaponId, SpecializationId>>;
export const SPECIALIZATIONS: Record<SpecializationId, { weapon: WeaponId }> = {
  saw_reaper: { weapon: "saw" }, saw_rail: { weapon: "saw" },
  lightning_chain: { weapon: "lightning" }, lightning_focus: { weapon: "lightning" },
  turret_rapid: { weapon: "turret" }, turret_sniper: { weapon: "turret" },
  burst_wave: { weapon: "burst" }, burst_crush: { weapon: "burst" },
};
export function weaponBranches(id: string): SpecializationId[] {
  return (Object.keys(SPECIALIZATIONS) as SpecializationId[]).filter(branch => SPECIALIZATIONS[branch].weapon === id);
}
