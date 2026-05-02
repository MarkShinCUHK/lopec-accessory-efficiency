export const ARMOR_SLOTS = ["helmet", "armor", "pants", "gloves", "shoulder"] as const;

export type ArmorSlot = (typeof ARMOR_SLOTS)[number];

export const ARMOR_ENHANCEMENT_LEVELS = [
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25
] as const;

export type ArmorEnhancementLevel = (typeof ARMOR_ENHANCEMENT_LEVELS)[number];
export type ArmorMainStats = Record<ArmorSlot, number>;

// T4 ancient "운명의 전율" armor main stat values observed from Lostark API and LOPEC simulator data.
export const T4_ANCIENT_ARMOR_MAIN_STAT_BY_LEVEL: Record<
  ArmorEnhancementLevel,
  ArmorMainStats
> = {
  11: { helmet: 96801, armor: 77441, pants: 83664, gloves: 116161, shoulder: 103023 },
  12: { helmet: 99554, armor: 79644, pants: 86043, gloves: 119465, shoulder: 105954 },
  13: { helmet: 102404, armor: 81924, pants: 88506, gloves: 122885, shoulder: 108987 },
  14: { helmet: 105353, armor: 84283, pants: 91056, gloves: 126425, shoulder: 112126 },
  15: { helmet: 108406, armor: 86725, pants: 93693, gloves: 130087, shoulder: 115375 },
  16: { helmet: 111565, armor: 89253, pants: 96424, gloves: 133879, shoulder: 118738 },
  17: { helmet: 114358, armor: 91486, pants: 98838, gloves: 137229, shoulder: 121709 },
  18: { helmet: 117218, armor: 93775, pants: 101310, gloves: 140662, shoulder: 124754 },
  19: { helmet: 120150, armor: 96120, pants: 103844, gloves: 144180, shoulder: 127874 },
  20: { helmet: 123155, armor: 98524, pants: 106441, gloves: 147786, shoulder: 131072 },
  21: { helmet: 126236, armor: 100989, pants: 109104, gloves: 151483, shoulder: 134351 },
  22: { helmet: 129393, armor: 103514, pants: 111833, gloves: 155271, shoulder: 137711 },
  23: { helmet: 132629, armor: 106103, pants: 114630, gloves: 159155, shoulder: 141155 },
  24: { helmet: 135946, armor: 108757, pants: 117497, gloves: 163136, shoulder: 144686 },
  25: { helmet: 139346, armor: 111477, pants: 120435, gloves: 167216, shoulder: 148304 }
};

export function isArmorEnhancementLevel(value: number): value is ArmorEnhancementLevel {
  return ARMOR_ENHANCEMENT_LEVELS.includes(value as ArmorEnhancementLevel);
}

export function readArmorMainStatsForEnhancementLevel(level: number): ArmorMainStats | null {
  return isArmorEnhancementLevel(level)
    ? T4_ANCIENT_ARMOR_MAIN_STAT_BY_LEVEL[level]
    : null;
}

export function sumArmorMainStats(stats: ArmorMainStats): number {
  return ARMOR_SLOTS.reduce((sum, slot) => sum + stats[slot], 0);
}
