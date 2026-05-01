export const WEAPON_ENHANCEMENT_LEVELS = [19, 20, 21, 22, 23, 24, 25] as const;

export type WeaponEnhancementLevel = (typeof WEAPON_ENHANCEMENT_LEVELS)[number];

// T4 ancient "운명의 전율" weapon attack values observed from Lostark API armory data.
export const T4_ANCIENT_WEAPON_ATTACK_BY_LEVEL: Record<WeaponEnhancementLevel, number> = {
  19: 208130,
  20: 213333,
  21: 218667,
  22: 224133,
  23: 229737,
  24: 235480,
  25: 241367
};

export function isWeaponEnhancementLevel(value: number): value is WeaponEnhancementLevel {
  return WEAPON_ENHANCEMENT_LEVELS.includes(value as WeaponEnhancementLevel);
}

export function readWeaponAttackForEnhancementLevel(level: number): number | null {
  return isWeaponEnhancementLevel(level) ? T4_ANCIENT_WEAPON_ATTACK_BY_LEVEL[level] : null;
}
