import {
  type AccessoryCandidate,
  type AccessoryMetricMode,
  type AccessoryScoringMode,
  type AccessorySlot,
  type AccessoryState
} from "@/lib/domain/accessory";
import { ARMOR_SLOTS, type ArmorMainStats } from "@/lib/domain/armor";
import type { CharacterState } from "@/lib/domain/character";
import type {
  LopecSimulatorAccessory,
  LopecSimulatorData
} from "@/lib/lopec/snapshot";

export interface ExactLopecReplacementScore {
  baseScore: number;
  nextScore: number;
  deltaScore: number;
  scoreRatio: number;
  deltaEfficiency: number;
  metricMode: AccessoryMetricMode;
}

export interface ExactLopecReplacementInput {
  replacedSlot: AccessorySlot;
  candidate: AccessoryCandidate;
}

type LopecAccessorySlot = "necklace" | "earing1" | "earing2" | "ring1" | "ring2";

const ACCESSORY_SLOT_TO_LOPEC: Record<AccessorySlot, LopecAccessorySlot> = {
  necklace: "necklace",
  earring1: "earing1",
  earring2: "earing2",
  ring1: "ring1",
  ring2: "ring2"
};

const LOPEC_ACCESSORY_SLOTS: LopecAccessorySlot[] = [
  "necklace",
  "earing1",
  "earing2",
  "ring1",
  "ring2"
];
const ARK_GRID_ATTACK_CORE: Record<number, Record<"유물" | "고대", { atkPlus: number; atkPer: number }>> = {
  10: { 유물: { atkPlus: 900, atkPer: 0 }, 고대: { atkPlus: 900, atkPer: 0 } },
  14: { 유물: { atkPlus: 900, atkPer: 0.55 }, 고대: { atkPlus: 900, atkPer: 0.55 } },
  17: { 유물: { atkPlus: 2700, atkPer: 1.65 }, 고대: { atkPlus: 3600, atkPer: 2.2 } },
  18: { 유물: { atkPlus: 2700, atkPer: 1.81 }, 고대: { atkPlus: 3600, atkPer: 2.36 } },
  19: { 유물: { atkPlus: 2700, atkPer: 1.97 }, 고대: { atkPlus: 3600, atkPer: 2.52 } },
  20: { 유물: { atkPlus: 2700, atkPer: 2.13 }, 고대: { atkPlus: 3600, atkPer: 2.68 } }
};

const ARK_GRID_WEAPON_CORE: Record<
  number,
  Record<"유물" | "고대", { weaponAtkPlus: number; weaponAtkPer: number }>
> = {
  10: { 유물: { weaponAtkPlus: 1300, weaponAtkPer: 0 }, 고대: { weaponAtkPlus: 1300, weaponAtkPer: 0 } },
  14: { 유물: { weaponAtkPlus: 1300, weaponAtkPer: 0.75 }, 고대: { weaponAtkPlus: 1300, weaponAtkPer: 0.75 } },
  17: { 유물: { weaponAtkPlus: 3900, weaponAtkPer: 2.25 }, 고대: { weaponAtkPlus: 5200, weaponAtkPer: 3 } },
  18: { 유물: { weaponAtkPlus: 3900, weaponAtkPer: 2.48 }, 고대: { weaponAtkPlus: 5200, weaponAtkPer: 3.23 } },
  19: { 유물: { weaponAtkPlus: 3900, weaponAtkPer: 2.71 }, 고대: { weaponAtkPlus: 5200, weaponAtkPer: 3.46 } },
  20: { 유물: { weaponAtkPlus: 3900, weaponAtkPer: 2.94 }, 고대: { weaponAtkPlus: 5200, weaponAtkPer: 3.69 } }
};

const ARK_GRID_ADDITIONAL_DAMAGE_CORE: Record<number, Record<"유물" | "고대", number>> = {
  10: { 유물: 0, 고대: 0 },
  14: { 유물: 0.7, 고대: 0.7 },
  17: { 유물: 2.1, 고대: 3.5 },
  18: { 유물: 2.33, 고대: 3.73 },
  19: { 유물: 2.56, 고대: 3.96 },
  20: { 유물: 2.78, 고대: 4.19 }
};

const ARK_GRID_LIFE_CORE: Record<
  number,
  Record<"유물" | "고대", { health: number; statHP?: number }>
> = {
  10: { 유물: { health: 420 }, 고대: { health: 420 } },
  14: { 유물: { health: 420, statHP: 900 }, 고대: { health: 420, statHP: 900 } },
  17: { 유물: { health: 1260, statHP: 2700 }, 고대: { health: 1680, statHP: 3600 } },
  18: { 유물: { health: 1400, statHP: 2700 }, 고대: { health: 1820, statHP: 3600 } },
  19: { 유물: { health: 1540, statHP: 2700 }, 고대: { health: 1960, statHP: 3600 } },
  20: { 유물: { health: 1680, statHP: 2700 }, 고대: { health: 2100, statHP: 3600 } }
};

const ARK_GRID_SUPPORT_CARE_CORE: Record<number, Record<"유물" | "고대", number>> = {
  10: { 유물: 1.0084, 고대: 1.0084 },
  14: { 유물: 1.0168, 고대: 1.0168 },
  17: { 유물: 1.0504, 고대: 1.0672 },
  18: { 유물: 1.056, 고대: 1.0728 },
  19: { 유물: 1.0616, 고대: 1.0784 },
  20: { 유물: 1.0672, 고대: 1.084 }
};

const ARK_GRID_CRIT_FINAL_DAMAGE_CORE: Record<
  string,
  Record<number, Record<"유물" | "고대", number>>
> = {
  "혼돈의 해 코어 : 현란한 공격": {
    10: { 유물: 1.0055, 고대: 1.0055 },
    14: { 유물: 1.0055, 고대: 1.0055 },
    17: { 유물: 1.011, 고대: 1.0165 },
    18: { 유물: 1.011, 고대: 1.0165 },
    19: { 유물: 1.011, 고대: 1.0165 },
    20: { 유물: 1.011, 고대: 1.0165 }
  }
};

const DEALER_CLASS_BASE_EFFECTS: Record<
  string,
  { atkSpeed: number; critDamage: number; critRate: number; moveSpeed: number }
> = {
  "고독한 기사": { atkSpeed: 0, critDamage: 45, critRate: 15, moveSpeed: 0 },
  "전투 태세": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  "광기": { atkSpeed: 15, critDamage: 0, critRate: 30, moveSpeed: 15 },
  "광전사의 비기": { atkSpeed: 20, critDamage: 0, critRate: 30, moveSpeed: 20 },
  "분노의 망치": { atkSpeed: 0, critDamage: 51, critRate: 18, moveSpeed: 0 },
  "중력 수련": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  "처단자": { atkSpeed: 20, critDamage: 0, critRate: 30, moveSpeed: 20 },
  "포식자": { atkSpeed: 20, critDamage: 51, critRate: 30, moveSpeed: 20 },
  "심판자": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 15 },
  "빛의 기사": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 30 },
  "충격 단련": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  "극의 : 체술": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  "오의 강화": { atkSpeed: 8, critDamage: 0, critRate: 30, moveSpeed: 16 },
  "초심": { atkSpeed: 8, critDamage: 0, critRate: 30, moveSpeed: 16 },
  역천지체: { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  세맥타통: { atkSpeed: 0, critDamage: 75, critRate: 0, moveSpeed: 0 },
  절제: { atkSpeed: 0, critDamage: 0, critRate: 20, moveSpeed: 0 },
  절정: { atkSpeed: 15, critDamage: 70, critRate: 20, moveSpeed: 15 },
  일격필살: { atkSpeed: 0, critDamage: 0, critRate: 20, moveSpeed: 0 },
  오의난무: { atkSpeed: 8, critDamage: 0, critRate: 20, moveSpeed: 0 },
  권왕파천무: { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  "수라의 길": { atkSpeed: 15, critDamage: 0, critRate: 0, moveSpeed: 15 },
  "전술 탄환": { atkSpeed: 0, critDamage: 14, critRate: 34, moveSpeed: 0 },
  핸드거너: { atkSpeed: 8, critDamage: 0, critRate: 10, moveSpeed: 8 },
  "두 번째 동료": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 8 },
  "죽음의 습격": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  "포격 강화": { atkSpeed: 0, critDamage: 0, critRate: 40, moveSpeed: 0 },
  "화력 강화": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  "아르데타인의 기술": { atkSpeed: 19.2, critDamage: 0, critRate: 9, moveSpeed: 19.2 },
  "진화의 유산": { atkSpeed: 15, critDamage: 0, critRate: 0, moveSpeed: 30 },
  피스메이커: { atkSpeed: 16, critDamage: 0, critRate: 25, moveSpeed: 0 },
  "사냥의 시간": { atkSpeed: 0, critDamage: 0, critRate: 55, moveSpeed: 0 },
  "황후의 은총": { atkSpeed: 19.2, critDamage: 0, critRate: 10, moveSpeed: 30 },
  "황제의 칙령": { atkSpeed: 0, critDamage: 0, critRate: 10, moveSpeed: 0 },
  "넘치는 교감": { atkSpeed: 0, critDamage: 0, critRate: 11.8, moveSpeed: 0 },
  "상급 소환사": { atkSpeed: 0, critDamage: 0, critRate: 27.8, moveSpeed: 0 },
  "진실된 용맹": { atkSpeed: 8, critDamage: 0, critRate: 30, moveSpeed: 0 },
  점화: { atkSpeed: 0, critDamage: 55, critRate: 30, moveSpeed: 0 },
  환류: { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 0 },
  버스트: { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 22.8 },
  "잔재된 기운": { atkSpeed: 24.8, critDamage: 0, critRate: 0, moveSpeed: 24.8 },
  "멈출 수 없는 충동": { atkSpeed: 0, critDamage: 0, critRate: 30, moveSpeed: 20 },
  "완벽한 억제": { atkSpeed: 0, critDamage: 0, critRate: 10, moveSpeed: 0 },
  "달의 소리": { atkSpeed: 10, critDamage: 0, critRate: 10, moveSpeed: 10 },
  갈증: { atkSpeed: 10, critDamage: 0, critRate: 23, moveSpeed: 10 },
  "만월의 집행자": { atkSpeed: 0, critDamage: 0, critRate: 34, moveSpeed: 39.2 },
  "그믐의 경계": { atkSpeed: 0, critDamage: 0, critRate: 0, moveSpeed: 19.2 },
  회귀: { atkSpeed: 0, critDamage: 0, critRate: 25, moveSpeed: 0 },
  질풍노도: { atkSpeed: 12, critDamage: 0, critRate: 10, moveSpeed: 12 },
  이슬비: { atkSpeed: 0, critDamage: 0, critRate: 10, moveSpeed: 0 },
  야성: { atkSpeed: 0, critDamage: 0, critRate: 30, moveSpeed: 0 },
  "환수 각성": { atkSpeed: 20, critDamage: 60, critRate: 0, moveSpeed: 20 },
  "업화의 계승자": { atkSpeed: 15, critDamage: 0, critRate: 20, moveSpeed: 15 },
  "드레드 로어": { atkSpeed: 15, critDamage: 0, critRate: 15, moveSpeed: 0 }
};

export function calculateExactLopecReplacement(
  character: CharacterState,
  replacedSlot: AccessorySlot,
  candidate: AccessoryCandidate,
  scoringMode?: AccessoryScoringMode,
  metricMode: AccessoryMetricMode = "lopec"
): ExactLopecReplacementScore | null {
  return calculateExactLopecReplacementSet(
    character,
    [{ replacedSlot, candidate }],
    scoringMode,
    metricMode
  );
}

export function calculateExactLopecReplacementSet(
  character: CharacterState,
  replacements: ExactLopecReplacementInput[],
  scoringMode?: AccessoryScoringMode,
  metricMode: AccessoryMetricMode = "lopec"
): ExactLopecReplacementScore | null {
  const simulator = character.lopec?.simulator;
  const loadedBaseScore = readBaseMetricValue(character, metricMode);

  if (!simulator || !loadedBaseScore || replacements.length === 0) {
    return null;
  }

  const nextSimulator = replaceAccessories(simulator, replacements);

  if (!nextSimulator) {
    return null;
  }

  const mode = scoringMode ?? (simulator.profile.supportCheck ? "support" : "dealer");
  const baseScore = readFormulaBaseMetricValue(loadedBaseScore, metricMode, mode);
  const rawNextScore =
    metricMode === "combatPower"
      ? readCombatPowerReplacementScore(simulator, nextSimulator, baseScore, mode)
      : baseScore * calculateSpecPointReplacementRatio(simulator, nextSimulator, mode);
  const nextScore = round2(rawNextScore);
  const scoreRatio = baseScore > 0 ? rawNextScore / baseScore : 1;
  const deltaScore = round2(rawNextScore - baseScore);

  return {
    baseScore,
    nextScore,
    deltaScore,
    scoreRatio,
    deltaEfficiency: round3((scoreRatio - 1) * 100),
    metricMode
  };
}

export function createLopecWeaponAttackSimulation(
  character: CharacterState,
  weaponAttack: number,
  scoringMode?: AccessoryScoringMode
): { score: number; simulator: LopecSimulatorData } | null {
  return createLopecEquipmentSimulation(character, { weaponAttack }, scoringMode);
}

export function readExactLopecDisplayCombatPower(
  character: CharacterState,
  scoringMode?: AccessoryScoringMode
): number {
  const baseCombatPower = readBaseMetricValue(character, "combatPower");

  if (!baseCombatPower) {
    return character.combatPower;
  }

  const mode = scoringMode ?? (character.lopec?.simulator?.profile.supportCheck ? "support" : "dealer");

  return readFormulaBaseMetricValue(baseCombatPower, "combatPower", mode);
}

export function createLopecEquipmentSimulation(
  character: CharacterState,
  target: {
    weaponAttack?: number | null;
    armorMainStats?: ArmorMainStats | null;
  },
  scoringMode?: AccessoryScoringMode
): { score: number; combatPower: number | null; simulator: LopecSimulatorData } | null {
  const simulator = character.lopec?.simulator;
  const baseScore = character.lopec?.score;

  if (!simulator || !baseScore) {
    return null;
  }

  const nextSimulator = replaceEquipmentStats(simulator, target);
  const mode = scoringMode ?? (simulator.profile.supportCheck ? "support" : "dealer");
  const scoreRatio = calculateSpecPointReplacementRatio(simulator, nextSimulator, mode);
  const loadedBaseCombatPower = readBaseMetricValue(character, "combatPower");
  const baseCombatPower = loadedBaseCombatPower
    ? readFormulaBaseMetricValue(loadedBaseCombatPower, "combatPower", mode)
    : null;

  return {
    score: round2(baseScore * scoreRatio),
    combatPower: baseCombatPower
      ? readCombatPowerReplacementScore(simulator, nextSimulator, baseCombatPower, mode)
      : null,
    simulator: nextSimulator
  };
}

export function createExactLopecReplacementSimulator(
  character: Pick<CharacterState, "lopec">,
  replacements: ExactLopecReplacementInput[]
): LopecSimulatorData | null {
  const simulator = character.lopec?.simulator;

  if (!simulator || replacements.length === 0) {
    return null;
  }

  return replaceAccessories(simulator, replacements);
}

function replaceAccessories(
  simulator: LopecSimulatorData,
  replacements: ExactLopecReplacementInput[]
): LopecSimulatorData | null {
  const next = structuredClone(simulator);
  const potionPoints = readEnlightenmentPotionPoints(simulator);

  for (const replacement of replacements) {
    const lopecSlot = ACCESSORY_SLOT_TO_LOPEC[replacement.replacedSlot];
    const currentAccessory = readLopecAccessory(next, lopecSlot);

    if (!currentAccessory) {
      return null;
    }

    next.armory.accessory[lopecSlot] = createLopecAccessory(
      replacement.candidate,
      currentAccessory
    );
  }

  if (next.arkPassive.enlightenment) {
    next.arkPassive.enlightenment.points =
      readBaseEnlightenmentPoints(next) + potionPoints;
  }

  return next;
}

function replaceEquipmentStats(
  simulator: LopecSimulatorData,
  target: {
    weaponAttack?: number | null;
    armorMainStats?: ArmorMainStats | null;
  }
): LopecSimulatorData {
  const nextEquipment = {
    ...simulator.armory.equipment
  };

  if (target.weaponAttack && target.weaponAttack > 0) {
    const currentWeapon = simulator.armory.equipment.weapon;

    nextEquipment.weapon = {
      ...(currentWeapon ?? {}),
      stat: target.weaponAttack
    };
  }

  if (target.armorMainStats) {
    for (const slot of ARMOR_SLOTS) {
      const currentArmor = simulator.armory.equipment[slot];

      nextEquipment[slot] = {
        ...(currentArmor ?? {}),
        stat: target.armorMainStats[slot]
      };
    }
  }

  return {
    ...simulator,
    armory: {
      ...simulator.armory,
      equipment: nextEquipment
    }
  };
}

function createLopecAccessory(
  candidate: AccessoryCandidate,
  currentAccessory: LopecSimulatorAccessory
): LopecSimulatorAccessory {
  return {
    ...currentAccessory,
    grade: candidate.grade,
    tier: 4,
    stat: readMainStat(candidate),
    health: candidate.stats.health || currentAccessory.health || 0,
    option: buildLopecAccessoryOptions(candidate),
    enlightPoint: readEnlightPoint(candidate, currentAccessory),
    icon: candidate.icon ?? currentAccessory.icon,
    tradeAble: currentAccessory.tradeAble
  };
}

function readBaseMetricValue(
  character: CharacterState,
  metricMode: AccessoryMetricMode
): number | null {
  if (metricMode === "combatPower") {
    return character.lopec?.combatPower ?? character.combatPower ?? null;
  }

  return character.lopec?.score ?? null;
}

function readFormulaBaseMetricValue(
  baseScore: number,
  metricMode: AccessoryMetricMode,
  mode: AccessoryScoringMode
): number {
  return metricMode === "combatPower" && mode === "support"
    ? round2(readSupportCombatPowerCalibrationBase(baseScore))
    : baseScore;
}

function calculateSpecPointReplacementRatio(
  current: LopecSimulatorData,
  next: LopecSimulatorData,
  mode: AccessoryScoringMode
): number {
  return mode === "support"
    ? calculateSupportReplacementRatio(current, next)
    : calculateDealerReplacementRatio(current, next);
}

function calculateDealerReplacementRatio(
  current: LopecSimulatorData,
  next: LopecSimulatorData
): number {
  return (
    readAttackFactor(next) / readAttackFactor(current) *
    readAdditionalDamageFactor(next) / readAdditionalDamageFactor(current) *
    readEnemyAndCritFactor(next) / readEnemyAndCritFactor(current) *
    readEnlightenmentFactor(next) / readEnlightenmentFactor(current) *
    readDealerBangleMultiplier(next) / readDealerBangleMultiplier(current)
  );
}

function calculateSupportReplacementRatio(
  current: LopecSimulatorData,
  next: LopecSimulatorData
): number {
  const currentScore = readSupportSpecPoint(current);
  const nextScore = readSupportSpecPoint(next);

  return currentScore > 0 && nextScore > 0 ? nextScore / currentScore : 1;
}

function readCombatPowerReplacementScore(
  current: LopecSimulatorData,
  next: LopecSimulatorData,
  currentCombatPower: number,
  mode: AccessoryScoringMode
): number {
  if (mode === "support") {
    return readSupportCombatPowerReplacementScore(current, next, currentCombatPower);
  }

  const currentVariable = readDealerCombatPowerVariable(current);
  const nextVariable = readDealerCombatPowerVariable(next);

  return currentVariable > 0 && nextVariable > 0
    ? round2(currentCombatPower * (nextVariable / currentVariable))
    : round2(currentCombatPower);
}

function readDealerCombatPowerVariable(data: LopecSimulatorData): number {
  return (
    readDealerBaseAttackCombat(data) *
    readDealerCombatAccessoryFactor(data) *
    readDealerCombatStatFactor(data)
  );
}

function readSupportCombatPowerReplacementScore(
  current: LopecSimulatorData,
  next: LopecSimulatorData,
  currentCombatPower: number
): number {
  const currentCare = readSupportCareCombatPower(current);
  const nextCare = readSupportCareCombatPower(next);
  const currentVariable = readSupportCombatPowerVariable(current);
  const nextVariable = readSupportCombatPowerVariable(next);

  if (currentVariable <= 0 || nextVariable <= 0) {
    return round2(currentCombatPower);
  }

  const fixedMultiplier = Math.max(currentCombatPower - currentCare, 0) / currentVariable;

  return round2(fixedMultiplier * nextVariable + nextCare);
}

function readSupportCombatPowerCalibrationBase(currentCombatPower: number): number {
  return currentCombatPower;
}

function readSupportCombatPowerVariable(data: LopecSimulatorData): number {
  return (
    readSupportBaseAttackCombat(data) *
    readSupportCombatAccessoryFactor(data) *
    readSupportCombatStatFactor(data)
  );
}

function readDealerBaseAttackCombat(data: LopecSimulatorData): number {
  const attackBonus = readAttackBonus(data);
  const powerStat = readCombatPowerStat(data);
  const weaponAttack = readCombatWeaponAttack(data);

  return Math.sqrt((powerStat * weaponAttack) / 6) * attackBonus.baseAtkBonus;
}

function readSupportBaseAttackCombat(data: LopecSimulatorData): number {
  const attackBonus =
    ((data.armory.abilityStone?.attackbonus ?? 0) + (data.gem.attackBonus ?? 0)) / 100 + 1;
  const powerStat = readCombatPowerStat(data);
  const weaponAttack = readCombatWeaponAttack(data);

  return Math.floor(Math.sqrt((powerStat * weaponAttack) / 6) * attackBonus);
}

function readCombatPowerStat(data: LopecSimulatorData): number {
  return Math.floor(
    (
      sumEquipmentStat(data) +
      sumAccessoryStat(data) +
      sumBangleMainStat(data) +
      (data.stats.powerIndex_combat ?? 0)
    ) *
      (
        1 +
        (data.avatar.avatarStats ?? 0) / 100 +
        (data.baseEffect.petStat ?? 1) / 100
      )
  );
}

function readCombatWeaponAttack(data: LopecSimulatorData): number {
  const weaponBase = data.armory.equipment.weapon?.stat ?? 0;
  const accessoryWeapon = sumAccessoryWeaponOptions(data);
  const weaponCore = readArkGridWeaponCore(data);
  const enlightenmentKarma = (data.arkPassive.enlightenment?.karmalevel ?? 0) * 0.1;

  return Math.floor(
    (
      weaponBase +
      accessoryWeapon.flat +
      sumBangleWeaponAttackOrigin(data) +
      weaponCore.weaponAtkPlus
    ) *
      (
        1 +
        accessoryWeapon.percent / 100 +
        enlightenmentKarma / 100 +
        weaponCore.weaponAtkPer / 100
      )
  );
}

function readDealerCombatAccessoryFactor(data: LopecSimulatorData): number {
  return LOPEC_ACCESSORY_SLOTS.reduce((factor, slot) => {
    const accessory = readLopecAccessory(data, slot);

    if (!accessory) {
      return factor;
    }

    return accessory.option.reduce(
      (optionFactor, option) => optionFactor * readDealerCombatAccessoryOptionFactor(option),
      factor
    );
  }, 1);
}

function readDealerCombatAccessoryOptionFactor(option: string): number {
  if (option.includes("무기 공격력")) {
    return 1;
  }

  const attackPercent = readOptionPercent(option, "공격력");

  if (attackPercent > 0) {
    return 1 + attackPercent * 0.01;
  }

  const attackFlat = readOptionFlat(option, "공격력");

  if (attackFlat > 0) {
    return 1 + attackFlat * 0.000007;
  }

  const additionalDamage = readOptionPercent(option, "추가 피해");

  if (additionalDamage > 0) {
    return 1 + additionalDamage * 0.007692;
  }

  const critRate = readOptionPercent(option, "치명타 적중률");

  if (critRate > 0) {
    return 1 + critRate * 0.007742;
  }

  const critDamage = readOptionPercent(option, "치명타 피해");

  if (critDamage > 0) {
    return 1 + critDamage * 0.003;
  }

  const enemyDamage = readOptionPercent(option, "적에게 주는 피해");

  if (enemyDamage > 0) {
    return 1 + enemyDamage * 0.01;
  }

  return 1;
}

function readDealerCombatStatFactor(data: LopecSimulatorData): number {
  const bangleStats = readBangleCombatStats(data);
  const statTotal =
    (data.stats.critical ?? 0) +
    (data.stats.haste ?? 0) +
    (data.stats.special ?? 0) +
    bangleStats.critical +
    bangleStats.haste +
    bangleStats.special;

  return (statTotal * 3) / 10000 + 1;
}

function readSupportCombatAccessoryFactor(data: LopecSimulatorData): number {
  const configs: Array<{ label: string; value: number }> = [
    { label: "아군 공격력 강화 효과", value: 0.0075 },
    { label: "아군 피해량 강화 효과", value: 0.005 },
    { label: "낙인력", value: 0.006 },
    { label: "세레나데, 신앙, 조화 게이지 획득량", value: 0.005 }
  ];

  return LOPEC_ACCESSORY_SLOTS.reduce((factor, slot) => {
    const accessory = readLopecAccessory(data, slot);

    if (!accessory) {
      return factor;
    }

    return accessory.option.reduce((optionFactor, option) => {
      const entry = configs.find((config) => readOptionPercent(option, config.label) > 0);

      return entry
        ? optionFactor * (1 + readOptionPercent(option, entry.label) * entry.value)
        : optionFactor;
    }, factor);
  }, 1);
}

function readSupportCombatStatFactor(data: LopecSimulatorData): number {
  const bangleStats = readBangleCombatStats(data);
  const statTotal =
    (data.stats.haste ?? 0) +
    (data.stats.special ?? 0) +
    bangleStats.haste +
    bangleStats.special;

  return (statTotal * 4) / 10000 + 1;
}

function readSupportCareCombatPower(data: LopecSimulatorData): number {
  const combatMaxHealth = readSupportCombatMaxHealth(data);

  if (combatMaxHealth <= 0) {
    return 0;
  }

  const baseCarePower = (12 * combatMaxHealth) / 10000;

  return (
    baseCarePower *
    readSupportCareAccessoryFactor(data) *
    readSupportCareBangleFactor(data) *
    readSupportEngravingDefenseFactor(data) *
    readSupportCareCoreFactor(data) *
    readSupportCareOrbFactor(data)
  );
}

function readSupportCareAccessoryFactor(data: LopecSimulatorData): number {
  return (["earing1", "earing2"] as LopecAccessorySlot[]).reduce((factor, slot) => {
    const accessory = readLopecAccessory(data, slot);

    if (!accessory) {
      return factor;
    }

    return accessory.option.reduce((optionFactor, option) => {
      const partyShield = readOptionPercent(option, "파티원 보호막 효과");

      if (partyShield > 0) {
        return optionFactor * (1 + partyShield * 0.007);
      }

      const partyHeal = readOptionPercent(option, "파티원 회복 효과");

      if (partyHeal > 0) {
        return optionFactor * (1 + partyHeal * 0.007);
      }

      return optionFactor;
    }, factor);
  }, 1);
}

function readSupportCombatMaxHealth(data: LopecSimulatorData): number {
  const apiMaxHealth = readOptionalNumber(data.baseEffect, "apiMaxHealth");
  const baseHealth = readSupportBaseHealth(data);
  const dinnerHealth = readOptionalNumber(data.baseEffect, "dinner") ?? 0;
  const calibrationHealth = baseHealth + dinnerHealth;
  const hidden = readSupportHiddenHealth(data, apiMaxHealth, calibrationHealth);

  return calculateSupportMaxHealth(data, hidden, false, baseHealth);
}

function readSupportBaseHealth(data: LopecSimulatorData): number {
  const abilityStone = data.armory.abilityStone as
    | ({ health?: number | null; healthBonus?: number | null } & Record<string, unknown>)
    | null
    | undefined;

  return (
    716 +
    sumEquipmentHealth(data) +
    sumAccessoryHealth(data) +
    (abilityStone?.health ?? 0) +
    (abilityStone?.healthBonus ?? 0) +
    sumBangleHealth(data) +
    readArkGridLifeCoreValue(data, "health")
  );
}

function readSupportHiddenHealth(
  data: LopecSimulatorData,
  apiMaxHealth: number | null,
  calibrationHealth: number
): number {
  if (!apiMaxHealth || !Number.isFinite(apiMaxHealth)) {
    return 1200;
  }

  let hiddenHealth = 1200;
  let usesAzena = false;
  let bestDiff = Number.POSITIVE_INFINITY;
  const prefersAzena = readOptionalBoolean(data.baseEffect, "isAzena") === true;

  for (let value = 1200; value <= 2400; value += 1) {
    const normalHealth = calculateSupportMaxHealth(data, value, false, calibrationHealth);
    const azenaHealth = calculateSupportMaxHealth(data, value, true, calibrationHealth);
    const normalDiff = Math.abs(apiMaxHealth - normalHealth);
    const azenaDiff = Math.abs(apiMaxHealth - azenaHealth);

    if (normalDiff < bestDiff || (normalDiff === bestDiff && !prefersAzena && usesAzena)) {
      hiddenHealth = value;
      usesAzena = false;
      bestDiff = normalDiff;
    }

    if (azenaDiff < bestDiff || (azenaDiff === bestDiff && prefersAzena && !usesAzena)) {
      hiddenHealth = value;
      usesAzena = true;
      bestDiff = azenaDiff;
    }
  }

  return hiddenHealth;
}

function calculateSupportMaxHealth(
  data: LopecSimulatorData,
  hiddenHealth: number,
  includeAzena: boolean,
  baseHealth: number
): number {
  const multiplier =
    1 +
    (readOptionalNumber(data.baseEffect, "petHpEffect") ?? 0) / 100 +
    (readOptionalNumber(data.baseEffect, "petHpPatrol") ?? 0) / 100 +
    readSupportEvolutionHealthFactor(data);
  const classFactor = readSupportClassHealthFactor(data);
  const armorQualityFactor = readArmorQualityHealthFactor(data);
  const fixedHealth =
    sumMaxHealthOptions(data) +
    (data.arkPassive.evolution?.karmalevel ?? 0) * 400 +
    readArkGridLifeCoreValue(data, "statHP");
  const healthWithoutAzena = Math.floor(
    (Math.floor((baseHealth + hiddenHealth) * classFactor) + fixedHealth) *
      armorQualityFactor *
      multiplier
  );
  const azenaHealth = Math.floor(12000 * armorQualityFactor * multiplier);

  return includeAzena ? healthWithoutAzena + azenaHealth : healthWithoutAzena;
}

function sumEquipmentHealth(data: LopecSimulatorData): number {
  return Object.values(data.armory.equipment).reduce(
    (sum, item) => sum + (item?.health ?? 0),
    0
  );
}

function sumAccessoryHealth(data: LopecSimulatorData): number {
  return LOPEC_ACCESSORY_SLOTS.reduce((sum, slot) => {
    const accessory = readLopecAccessory(data, slot);

    return sum + (accessory?.health ?? 0);
  }, 0);
}

function sumBangleHealth(data: LopecSimulatorData): number {
  return readBangleOptions(data).reduce((sum, option) => {
    const match = option.match(/체력\s*\+([\d,]+)/);

    return match ? sum + Number(match[1].replaceAll(",", "")) : sum;
  }, 0);
}

function sumMaxHealthOptions(data: LopecSimulatorData): number {
  const accessoryHealth = LOPEC_ACCESSORY_SLOTS.reduce((sum, slot) => {
    const options = readLopecAccessory(data, slot)?.option ?? [];

    return (
      sum +
      options.reduce((optionSum, option) => {
        const match = option.match(/최대\s*생명력\s*\+([\d,]+)/);

        return match ? optionSum + Number(match[1].replaceAll(",", "")) : optionSum;
      }, 0)
    );
  }, 0);
  const bangleHealth = readBangleOptions(data).reduce((sum, option) => {
    const match = option.match(/최대\s*생명력\s*\+([\d,]+)/);

    return match ? sum + Number(match[1].replaceAll(",", "")) : sum;
  }, 0);

  return accessoryHealth + bangleHealth;
}

function readArkGridLifeCoreValue(
  data: LopecSimulatorData,
  key: "health" | "statHP"
): number {
  const core = readArkGridCore(data, "혼돈의 별 코어 : 생명");

  if (!core) {
    return 0;
  }

  const entry =
    ARK_GRID_LIFE_CORE[core.point]?.[readArkGridGrade(core.grade)];

  return entry?.[key] ?? 0;
}

function readArmorQualityHealthFactor(data: LopecSimulatorData): number {
  const totalVitality = Object.entries(data.armory.equipment).reduce((sum, [slot, item]) => {
    if (slot === "weapon") {
      return sum;
    }

    const quality = item?.quality ?? 0;

    return sum + Math.ceil(Number((0.14 * quality ** 2).toFixed(10)));
  }, 0);

  return 1 + totalVitality / 14000.03;
}

function readSupportClassHealthFactor(data: LopecSimulatorData): number {
  switch (readProfileClass(data)) {
    case "바드":
    case "도화가":
      return 2;
    case "홀리나이트":
    case "발키리":
      return 2.1;
    case "스트라이커":
      return 2.2;
    case "브레이커":
      return 2.3;
    default:
      return 0;
  }
}

function readSupportEvolutionHealthFactor(data: LopecSimulatorData): number {
  const supportNodes = new Set(["기원", "선각자", "진군"]);

  return (
    0.06 *
    readEvolutionNodes(data).reduce(
      (count, node) => (supportNodes.has(node.name) ? count + 1 : count),
      0
    )
  );
}

function readSupportCareBangleFactor(data: LopecSimulatorData): number {
  return readBangleOptions(data).reduce((factor, option) => {
    const match = option.match(/보호\s*및\s*회복\s*효과\s*\+([\d.]+)%/);

    return match ? factor * (1 + 0.014 * Number(match[1])) : factor;
  }, 1);
}

function readSupportEngravingDefenseFactor(data: LopecSimulatorData): number {
  return readEngravings(data).reduce((factor, engraving) => {
    if (engraving.name !== "전문의") {
      return factor;
    }

    const gradeCode = engraving.grade === "유물" ? 9 : 5;
    const stone = engraving.stone ?? 0;
    const key = 20 * stone + engraving.level + gradeCode;
    const value = EXPERT_DEFENSE_FACTOR[key] ?? 1;

    return value === 1 ? factor : factor * (value / 10000 + 1);
  }, 1);
}

function readSupportCareCoreFactor(data: LopecSimulatorData): number {
  const core = readArkGridCore(data, "혼돈의 별 코어 : 구원");

  if (!core) {
    return 1;
  }

  return (
    ARK_GRID_SUPPORT_CARE_CORE[core.point]?.[
      readArkGridGrade(core.grade)
    ] ?? 1
  );
}

function readSupportCareOrbFactor(data: LopecSimulatorData): number {
  const orbName = data.armory.orb?.name;

  return orbName === "신성한 자연의 보주" || orbName === "온화한 투영의 보주"
    ? 1.013
    : 1;
}

interface SupportScoreInput {
  attack: number;
  stats: {
    haste: number;
    special: number;
    specialDamageFactor: number;
  };
  cooldown: {
    haste: number;
    engraving: {
      cooldown: number;
      awakeningCooldown: number;
    };
    arkPassive: number;
    core: number;
    averageGemCooldown: number;
  };
  attackBuffUptime: {
    total: number;
    attackA: number;
    attackB: number;
  };
  allyAttackBuff: {
    A: number;
    B: number;
  };
  allyDamageBuff: {
    total: number;
    hyperOnly: number;
  };
  evolutionBuff: number;
  brandPower: number;
  identity: {
    accessory: number;
    core: number;
  };
  damage: {
    always: number;
    final: number;
  };
  orderCore: number;
  other: {
    enlightenment: number;
  };
}

interface DealerBangleEntry {
  addDmg?: number;
  atkBuffPlus?: number;
  atkSpeed?: number;
  critDmg?: number;
  critFinalDmg?: number;
  critRate?: number;
  finalDmg?: number;
  moveSpeed?: number;
  specCritFinalDmg?: number;
  weaponAtkPlus?: number;
}

function readSupportSpecPoint(data: LopecSimulatorData): number {
  const input = readSupportScoreInput(data);
  const totalBuffPower = readSupportTotalBuffPower(input);

  return totalBuffPower ** 4.35 * input.orderCore * 124;
}

function readSupportTotalBuffPower(input: SupportScoreInput): number {
  const attackAAvailability = input.attackBuffUptime.attackA / 100;
  const supportAttackBuff = Math.floor(
    0.22 * input.attack * attackAAvailability * (input.allyAttackBuff.A / 100 + 1) +
      0.22 * input.attack * (1 - attackAAvailability) * (input.allyAttackBuff.B / 100 + 1)
  );
  const awakeningCycleFactor =
    (1 /
      ((1 - input.cooldown.engraving.awakeningCooldown) *
        (1 - 0.0214739 * input.stats.haste / 100) *
        (1 - input.cooldown.engraving.cooldown)) *
      (1 - input.cooldown.core) -
      1) *
      0.15 +
    1;
  const specialFactor = input.stats.special / 30.2 / 100 + 1;
  const averageCooldownReduction =
    1 -
    (1 - 0.0214739 * input.stats.haste / 100) *
      (1 - input.cooldown.averageGemCooldown / 100) *
      (1 - input.cooldown.engraving.cooldown) *
      (1 - input.cooldown.arkPassive) *
      (1 - input.cooldown.core);
  const awakeningCooldownReduction =
    1 -
    (1 - input.cooldown.arkPassive) *
      (1 - input.cooldown.engraving.cooldown) *
      (1 - input.cooldown.core) *
      (1 - 0.0214739 * input.stats.haste / 100);
  const identityUptime =
    (20.05 *
      ((input.identity.accessory + input.identity.core) * specialFactor) *
      awakeningCycleFactor) /
    (1 - averageCooldownReduction) /
    100;
  const awakeningUptime = 24.45 / (1 - awakeningCooldownReduction) / 100;
  const attackBuffPower = (170000 + supportAttackBuff * input.attackBuffUptime.total) / 170000;
  const allyDamageBuffFactor = input.allyDamageBuff.total / 100 + 1;
  const alwaysBuffPower =
    attackBuffPower *
    (input.brandPower / 100 + 1) *
    ((1.45 + input.evolutionBuff) / 1.45) *
    input.damage.always *
    input.damage.final;
  const identityBuffPower =
    (13 * input.other.enlightenment * allyDamageBuffFactor * input.stats.specialDamageFactor) /
      100 +
    input.damage.final;
  const hyperBuffPower =
    (10 * (input.allyDamageBuff.hyperOnly / 100 + 1) / 100 + 1) * input.damage.final;
  const fullBuffPower =
    (alwaysBuffPower / input.damage.final) *
    (identityBuffPower / input.damage.final) *
    (hyperBuffPower / input.damage.final) *
    input.damage.final;

  return (
    identityUptime * awakeningUptime * fullBuffPower +
    identityUptime *
      (1 - awakeningUptime) *
      ((alwaysBuffPower / input.damage.final) *
        (identityBuffPower / input.damage.final) *
        input.damage.final) +
    awakeningUptime *
      (1 - identityUptime) *
      ((alwaysBuffPower / input.damage.final) *
        (hyperBuffPower / input.damage.final) *
        input.damage.final) +
    (1 - identityUptime) * (1 - awakeningUptime) * alwaysBuffPower
  );
}

function readSupportScoreInput(data: LopecSimulatorData): SupportScoreInput {
  const stats = readSupportStats(data);
  const cooldown = readSupportCooldown(data, stats.haste);

  return {
    attack: readSupportAttack(data),
    stats,
    cooldown,
    attackBuffUptime: readSupportAttackBuffUptime(data, cooldown),
    allyAttackBuff: readSupportAllyAttackBuff(data),
    allyDamageBuff: readSupportAllyDamageBuff(data),
    evolutionBuff: readSupportEvolutionBuff(data),
    brandPower: readSupportBrandPower(data),
    identity: readSupportIdentity(data),
    damage: readSupportDamage(data),
    orderCore: readSupportOrderCoreFactor(),
    other: {
      enlightenment: readSupportEnlightenmentFactor(data)
    }
  };
}

function readSupportAttack(data: LopecSimulatorData): number {
  const attackBonus =
    ((data.armory.abilityStone?.attackbonus ?? 0) + (data.gem.attackBonus ?? 0)) / 100 + 1;
  const armorStat = sumEquipmentStat(data);
  const accessoryStat = sumAccessoryStat(data);
  const bangleStat = sumBangleMainStat(data);
  const powerStat =
    (armorStat + accessoryStat + bangleStat) * ((data.avatar.avatarStats ?? 0) / 100 + 1);
  const weaponBase = data.armory.equipment.weapon?.stat ?? 0;
  const accessoryWeapon = sumAccessoryWeaponOptions(data);
  const weaponCore = readArkGridWeaponCore(data);
  const enlightenmentKarma = (data.arkPassive.enlightenment?.karmalevel ?? 0) * 0.001;
  const weaponAttack =
    (weaponBase +
      accessoryWeapon.flat +
      sumBangleWeaponAttackOrigin(data) +
      weaponCore.weaponAtkPlus) *
    (1 + enlightenmentKarma + accessoryWeapon.percent / 100 + weaponCore.weaponAtkPer / 100);

  return Math.floor(Math.sqrt((powerStat * weaponAttack) / 6) * attackBonus);
}

function readSupportStats(data: LopecSimulatorData): SupportScoreInput["stats"] {
  const bangleStats = readBangleCombatStats(data);
  const haste = (data.stats.haste ?? 0) + bangleStats.haste;
  const special = Math.min((data.stats.special ?? 0) + bangleStats.special, 1200);
  const blendedSpecial = (haste + special) * 0.25;

  return {
    haste: (haste + special) * 0.75,
    special: blendedSpecial,
    specialDamageFactor: blendedSpecial / 20.791 / 100 + 1
  };
}

function readSupportCooldown(
  data: LopecSimulatorData,
  haste: number
): SupportScoreInput["cooldown"] {
  return {
    haste,
    engraving: readSupportEngravingCooldown(data),
    arkPassive: readEvolutionNodeNames(data).includes("선각자") ? 0.05 : 0,
    core: readArkGridCoreEffect(data, "혼돈의 해 코어 : 흐르는 마나", "cdrPercent", 0),
    averageGemCooldown: readAverageSupportGemCooldown(data)
  };
}

function readSupportEngravingCooldown(
  data: LopecSimulatorData
): SupportScoreInput["cooldown"]["engraving"] {
  const result = {
    cooldown: 0,
    awakeningCooldown: 0
  };

  for (const engraving of readEngravings(data)) {
    const grade = engraving.grade;
    const level = String(engraving.level);

    if (engraving.name === "마나의 흐름") {
      result.cooldown = MANA_FLOW_COOLDOWN[grade]?.[level] ?? result.cooldown;
      continue;
    }

    if (engraving.name === "각성") {
      const stoneBonus = engraving.stone ? (AWAKENING_STONE_COOLDOWN[engraving.stone] ?? 0) : 0;
      result.awakeningCooldown =
        (AWAKENING_COOLDOWN[grade]?.[level] ?? 0) + stoneBonus;
    }
  }

  return result;
}

function readAverageSupportGemCooldown(data: LopecSimulatorData): number {
  const excludedSkills = new Set([
    "수호의 연주",
    "신성한 보호",
    "빛의 광시곡",
    "구원의 은총",
    "구원의 터"
  ]);
  const gems = readGems(data).filter(
    (gem) =>
      gem.type === "cooldown" &&
      gem.valid !== false &&
      !excludedSkills.has(gem.skill)
  );

  if (gems.length === 0) {
    return 0;
  }

  return gems.reduce((sum, gem) => sum + readCooldownGemEffect(gem), 0) / gems.length;
}

function readSupportAttackBuffUptime(
  data: LopecSimulatorData,
  cooldown: SupportScoreInput["cooldown"]
): SupportScoreInput["attackBuffUptime"] {
  const className = readProfileClass(data);
  const timings = {
    durationA: 8,
    durationB: 0,
    cooldownA: 0,
    cooldownB: 0
  };

  if (className === "도화가") {
    timings.cooldownA = 27;
    timings.cooldownB = hasSkillTripod(data, "묵법 : 해우물", "빠른 준비") ? 24 : 30;
    timings.durationB = 6;
  } else if (className === "홀리나이트") {
    timings.cooldownA = 27;
    timings.cooldownB = 35;
    timings.durationB = 8;
  } else if (className === "바드") {
    timings.cooldownA = hasSkillTripod(data, "천상의 연주", "빠른 준비") ? 24 : 30;
    timings.cooldownB = 24;
    timings.durationB = 5;
  } else if (className === "발키리") {
    timings.cooldownA = 27;
    timings.cooldownB = 36;
    timings.durationB = 8;
  }

  if (timings.cooldownA <= 0 || timings.cooldownB <= 0) {
    return {
      total: 0,
      attackA: 0,
      attackB: 0
    };
  }

  const gemCooldowns = readSupportAttackBuffGemCooldowns(data);
  const cooldownA =
    timings.cooldownA *
    (1 - 0.0214739 * cooldown.haste / 100) *
    (1 - cooldown.engraving.cooldown) *
    (1 - cooldown.arkPassive) *
    (1 - cooldown.core) *
    (1 - gemCooldowns.attackA / 100);
  const cooldownB =
    timings.cooldownB *
    (1 - 0.0214739 * cooldown.haste / 100) *
    (1 - cooldown.engraving.cooldown) *
    (1 - cooldown.arkPassive) *
    (1 - cooldown.core) *
    (1 - gemCooldowns.attackB / 100);
  const duration = timings.durationA + timings.durationB;
  const cycle = Math.max(duration, cooldownA, cooldownB);

  return {
    total: duration / cycle,
    attackA: (timings.durationA / cooldownA) * 100,
    attackB: (timings.durationB / cooldownB) * 100
  };
}

function readSupportAttackBuffGemCooldowns(data: LopecSimulatorData): {
  attackA: number;
  attackB: number;
} {
  const result = {
    attackA: 0,
    attackB: 0
  };

  for (const gem of readGems(data)) {
    if (gem.type !== "cooldown" || gem.valid === false) {
      continue;
    }

    if (["천상의 연주", "신의 분노", "묵법 : 해그리기", "숭고한 맹세"].includes(gem.skill)) {
      result.attackA = readCooldownGemEffect(gem);
    } else if (
      ["음파 진동", "천상의 축복", "묵법 : 해우물", "숭고한 도약"].includes(gem.skill)
    ) {
      result.attackB = readCooldownGemEffect(gem);
    }
  }

  return result;
}

function readSupportAllyAttackBuff(data: LopecSimulatorData): SupportScoreInput["allyAttackBuff"] {
  const ringBuff = sumSupportOptionPercent(
    data,
    ["ring1", "ring2"],
    "아군 공격력 강화 효과"
  );
  const commonBuff =
    ringBuff +
    readSupportBangleAllyAttackBuff(data) +
    readSupportAllyAttackEvolutionBuff(data) +
    readArkGridGemEffect(data, "아군 공격 강화");

  return {
    A: commonBuff + readMaxDamageGemLevel(data, [
      "신의 분노",
      "천상의 연주",
      "묵법 : 해그리기",
      "숭고한 맹세"
    ]),
    B: commonBuff + readMaxDamageGemLevel(data, [
      "천상의 축복",
      "음파 진동",
      "묵법 : 해우물",
      "숭고한 도약"
    ])
  };
}

function readSupportAllyDamageBuff(data: LopecSimulatorData): SupportScoreInput["allyDamageBuff"] {
  const ringBuff = sumSupportOptionPercent(
    data,
    ["ring1", "ring2"],
    "아군 피해량 강화 효과"
  );
  const commonBuff =
    ringBuff +
    readSupportBangleAllyDamageBuff(data) +
    readArkGridGemEffect(data, "아군 피해 강화") +
    readArkGridCoreEffect(data, "혼돈의 해 코어 : 신념의 강화", "damageBuff", 0);
  const identityGemBuff = readMaxDamageGemLevel(data, [
    "신앙 스킬",
    "세레나데 스킬",
    "음양 스킬"
  ]);

  return {
    total: commonBuff + identityGemBuff,
    hyperOnly: commonBuff
  };
}

function readSupportBangleAllyAttackBuff(data: LopecSimulatorData): number {
  return readBangleOptions(data).reduce(
    (sum, option) => sum + readCompactPercent(option, "아군공격력강화효과가"),
    0
  );
}

function readSupportBangleAllyDamageBuff(data: LopecSimulatorData): number {
  return readBangleOptions(data).reduce(
    (sum, option) => sum + readCompactPercent(option, "아군피해량강화효과가"),
    0
  );
}

function readSupportEvolutionBuff(data: LopecSimulatorData): number {
  return readEvolutionNodes(data).reduce(
    (sum, node) => (node.name.includes("정열의 춤사위") ? sum + 7 * node.level : sum),
    0
  ) / 100;
}

function readSupportBrandPower(data: LopecSimulatorData): number {
  const necklaceBrand = sumSupportOptionPercent(data, ["necklace"], "낙인력");
  const evolutionBrand = readEvolutionNodes(data).reduce((sum, node) => {
    if (node.name.includes("기원")) {
      return sum + 4;
    }

    if (
      node.name.includes("입식 타격가") ||
      node.name.includes("마나 용광로") ||
      node.name.includes("안정된 관리자")
    ) {
      return sum + 10 * node.level;
    }

    return sum;
  }, 0);
  const enlightenmentBrand = (data.arkPassive.enlightenment?.nodes ?? []).reduce((sum, node) => {
    if (
      [
        "빠른 구원",
        "빛의 흔적",
        "포용의 세레나데",
        "낙인의 세레나데",
        "오누이",
        "낙인 강화",
        "해방자의 흔적",
        "빛의 검기"
      ].includes(node.name)
    ) {
      return sum + node.level - 1;
    }

    return sum;
  }, 0);
  const totalBrandBonus =
    necklaceBrand +
    evolutionBrand +
    readArkGridGemEffect(data, "낙인력") +
    (data.arkPassive.evolution?.karmaRank ?? 0) +
    enlightenmentBrand +
    readArkGridCoreEffect(data, "혼돈의 달 코어 : 낙인의 흔적", "stigmaPer", 0);

  return 10 * (totalBrandBonus / 100 + 1);
}

function readSupportIdentity(data: LopecSimulatorData): SupportScoreInput["identity"] {
  const necklace = readLopecAccessory(data, "necklace");
  const identityOption = necklace?.option.find((option) =>
    option.includes("세레나데, 신앙, 조화 게이지 획득량")
  );
  const accessoryIdentity =
    identityOption
      ? readOptionPercent(identityOption, "세레나데, 신앙, 조화 게이지 획득량") ||
        readOptionPercent(identityOption, "세레나데, 신앙, 조화 게이지 획득량 증가")
      : 0;

  return {
    accessory: accessoryIdentity / 100 + 1,
    core: readArkGridCoreEffect(data, "혼돈의 해 코어 : 신념의 강화", "identityUptime", 0)
  };
}

function readSupportDamage(data: LopecSimulatorData): SupportScoreInput["damage"] {
  const traceCores = (data.arkGrid.core ?? []).filter((core) =>
    /혼돈의 달 코어 : 강철의 흔적|혼돈의 달 코어 : 치명적인 흔적/.test(core.name)
  );
  const coreAlways = traceCores.reduce(
    (factor, core) => factor * readSupportCoreEffectEntry(core, "atkBuffPlus", 1),
    1
  );

  return {
    always: readSupportBangleAttackBuffPlus(data) * coreAlways,
    final: readArkGridCoreEffect(data, "혼돈의 달 코어 : 낙인의 흔적", "finalDamageBuff", 1)
  };
}

function readSupportBangleAttackBuffPlus(data: LopecSimulatorData): number {
  return readBangleOptions(data).reduce(
    (factor, option) => factor * readSupportBangleAttackBuffPlusOption(option),
    1
  );
}

function readSupportBangleAttackBuffPlusOption(option: string): number {
  const compact = option.replace(/\s/g, "");
  const defense = readCompactNumber(compact, "대상의방어력을", "%감소");

  if (defense !== null) {
    return readMappedFactor(defense, {
      1.5: 1.0075,
      1.8: 1.007,
      2.1: 1.0106,
      2.5: 1.0143
    });
  }

  const critRate = readCompactNumber(compact, "대상의치명타저항을", "%감소");

  if (critRate !== null) {
    return readMappedFactor(critRate, {
      1.5: 1.010875,
      1.8: 1.01305,
      2.1: 1.015225,
      2.5: 1.0176
    });
  }

  const critDamage = readCompactNumber(compact, "대상의치명타피해저항을", "%감소");

  if (critDamage !== null) {
    return readMappedFactor(critDamage, {
      3: 1.010875,
      3.6: 1.01305,
      4.2: 1.015225,
      4.8: 1.0176
    });
  }

  const shieldDamage = readCompactNumber(compact, "대상이5초동안적에게주는피해가", "%증가");

  if (shieldDamage !== null) {
    return readMappedFactor(shieldDamage, {
      0.7: 1.007,
      0.9: 1.011,
      1.1: 1.011,
      1.3: 1.013
    });
  }

  return 1;
}

function readSupportEnlightenmentFactor(data: LopecSimulatorData): number {
  const node = data.arkPassive.enlightenment?.nodes?.find((item) =>
    ["신성 해방", "세레나데 코드", "묵법 : 접무", "해방의 날개"].includes(item.name)
  );

  return node ? ([1.1, 1.1, 1.2][node.level - 1] ?? 1) : 1;
}

function readSupportOrderCoreFactor(): number {
  return 1;
}

function readAttackFactor(data: LopecSimulatorData): number {
  const attackBonus = readAttackBonus(data);
  const weaponAttack = readDealerWeaponAttack(data);
  const powerStat = Math.floor(
    (sumEquipmentStat(data) + sumAccessoryStat(data)) *
      (1 + (data.avatar.avatarStats ?? 0) / 100 + (data.baseEffect.petStat ?? 1) / 100)
  );

  return Math.round(
    (Math.floor(Math.sqrt((powerStat * weaponAttack) / 6) * attackBonus.baseAtkBonus) +
      attackBonus.atkPlus) *
      attackBonus.atkPer
  );
}

function readAttackBonus(data: LopecSimulatorData): {
  baseAtkBonus: number;
  atkPlus: number;
  atkPer: number;
} {
  const accessoryAttack = sumAccessoryAttackOptions(data);
  const attackCore = readArkGridAttackCore(data);
  const abilityStoneAttack = data.armory.abilityStone?.attackbonus ?? 0;
  const gemAttack = data.gem.attackBonus ?? 0;
  const arkGridGemAttack = readArkGridGemEffect(data, "공격력");

  return {
    baseAtkBonus: (abilityStoneAttack + gemAttack) / 100 + 1,
    atkPlus: accessoryAttack.flat + attackCore.atkPlus,
    atkPer: (accessoryAttack.percent + attackCore.atkPer + arkGridGemAttack) / 100 + 1
  };
}

function readDealerWeaponAttack(data: LopecSimulatorData): number {
  const weaponBase = data.armory.equipment.weapon?.stat ?? 0;
  const accessoryWeapon = sumAccessoryWeaponOptions(data);
  const weaponCore = readArkGridWeaponCore(data);
  const enlightenmentKarma = (data.arkPassive.enlightenment?.karmalevel ?? 0) * 0.1;

  return Math.floor(
    (weaponBase + accessoryWeapon.flat + weaponCore.weaponAtkPlus) *
      (1 + accessoryWeapon.percent / 100 + enlightenmentKarma / 100 + weaponCore.weaponAtkPer / 100)
  );
}

function readAdditionalDamageFactor(data: LopecSimulatorData): number {
  const weaponQuality = data.armory.equipment.weapon?.quality ?? 0;
  const weaponQualityDamage = weaponQuality ? 10 + 0.002 * weaponQuality ** 2 : 0;
  const necklace = readLopecAccessory(data, "necklace");
  const necklaceDamage = necklace ? sumOptionPercent(necklace.option, "추가 피해") : 0;
  const arkGridGemDamage = readArkGridGemEffect(data, "추가 피해");
  const arkGridCoreDamage = readArkGridAdditionalDamageCore(data);

  return (weaponQualityDamage + necklaceDamage + arkGridGemDamage + arkGridCoreDamage) / 100 + 1;
}

function readEnemyAndCritFactor(data: LopecSimulatorData): number {
  return (["necklace", "ring1", "ring2"] as LopecAccessorySlot[]).reduce((factor, slot) => {
    const accessory = readLopecAccessory(data, slot);

    if (!accessory) {
      return factor;
    }

    return factor * accessory.option.reduce((optionFactor, option) => optionFactor * readDealerOptionFactor(option), 1);
  }, 1);
}

function readDealerOptionFactor(option: string): number {
  const enemyDamage = readOptionPercent(option, "적에게 주는 피해");

  if (enemyDamage > 0) {
    return 1 + enemyDamage / 100;
  }

  const critRate = readOptionPercent(option, "치명타 적중률");

  if (critRate > 0) {
    return 1 + critRate * 0.00684;
  }

  const critDamage = readOptionPercent(option, "치명타 피해");

  if (critDamage > 0) {
    return 1 + critDamage * 0.003625;
  }

  return 1;
}

function readDealerBangleMultiplier(data: LopecSimulatorData): number {
  const bangle = data.armory.accessory.bangle;

  if (!bangle?.tier || !Array.isArray(bangle.option) || bangle.option.length === 0) {
    return 1;
  }

  const entries = readDealerBangleEntries(data);

  return (
    readDealerBangleAttackRatio(data, entries) *
    readDealerBangleAdditionalDamageRatio(data, entries) *
    readDealerBangleStatRatio(data) *
    readDealerBangleCritRatio(data, entries) *
    readDealerBangleSpeedRatio(data, entries) *
    readDealerBangleFinalDamageRatio(entries)
  );
}

function readDealerBangleEntries(data: LopecSimulatorData): DealerBangleEntry[] {
  return readBangleOptions(data).map(readDealerBangleEntry);
}

function readDealerBangleEntry(option: string): DealerBangleEntry {
  const compact = option.replace(/\s/g, "");
  const entry: DealerBangleEntry = {};
  const directCritRate = compact.match(/^치명타적중률\+([0-9,.]+)%$/);
  const directCritDamage = compact.match(/^치명타피해\+([0-9,.]+)%$/);
  const comboCritRate = compact.match(/치명타적중률이([0-9,.]+)%증가한다\./);
  const comboCritDamage = compact.match(/치명타피해가([0-9,.]+)%증가한다\./);
  const directFinalDamage = compact.match(/^적에게주는피해가([0-9,.]+)%증가/);
  const cooldownFinalDamage = compact.match(/재사용대기시간이2%증가하지만,적에게주는피해가([0-9,.]+)%증가/);
  const addDamage = compact.match(/추가피해(?:가|\+)([0-9,.]+)%/);
  const weaponAttackFlat = compact.match(/^무기공격력\+([0-9,]+)$/);
  const weaponAttackStack = compact.match(/공격적중시매초마다10초동안무기공격력이([0-9,]+),공격및이동속도가1%증가/);
  const weaponAttackConditional = compact.match(/무기공격력이([0-9,]+)증가한다\.자신의생명력이50%이상일경우적에게공격적중시5초동안무기공격력이([0-9,]+)증가/);
  const weaponAttackLongStack = compact.match(/무기공격력이([0-9,]+)증가한다\.공격적중시30초마다120초동안무기공격력이([0-9,]+)증가/);
  const attackMoveSpeed = compact.match(/^공격및이동속도가([0-9,.]+)%증가한다\.$/);
  const defenseReduction = readCompactNumber(compact, "대상의방어력을", "%감소");
  const critResistanceReduction = readCompactNumber(compact, "대상의치명타저항을", "%감소");
  const shieldDamage = readCompactNumber(compact, "대상이5초동안적에게주는피해가", "%증가");

  if (directCritRate) {
    entry.critRate = readNumberMatch(directCritRate[1]);
  }

  if (directCritDamage) {
    entry.critDmg = readNumberMatch(directCritDamage[1]);
  }

  if (comboCritRate) {
    entry.critRate = readNumberMatch(comboCritRate[1]);
    entry.critFinalDmg = 1.015;
    entry.specCritFinalDmg = 1.01;
  }

  if (comboCritDamage) {
    entry.critDmg = readNumberMatch(comboCritDamage[1]);
    entry.critFinalDmg = 1.015;
    entry.specCritFinalDmg = 1.01;
  }

  if (directFinalDamage) {
    entry.finalDmg = 1 + readNumberMatch(directFinalDamage[1]) / 100;
  }

  if (cooldownFinalDamage) {
    entry.finalDmg = 1 + readNumberMatch(cooldownFinalDamage[1]) / 100;
  }

  if (addDamage) {
    entry.addDmg = readNumberMatch(addDamage[1]);
  }

  if (weaponAttackFlat) {
    entry.weaponAtkPlus = readNumberMatch(weaponAttackFlat[1]);
  }

  if (weaponAttackStack) {
    entry.weaponAtkPlus = readNumberMatch(weaponAttackStack[1]) * 6;
    entry.atkSpeed = 6;
    entry.moveSpeed = 6;
  }

  if (weaponAttackConditional) {
    entry.weaponAtkPlus =
      readNumberMatch(weaponAttackConditional[1]) + readNumberMatch(weaponAttackConditional[2]);
  }

  if (weaponAttackLongStack) {
    entry.weaponAtkPlus =
      readNumberMatch(weaponAttackLongStack[1]) +
      Math.floor(readNumberMatch(weaponAttackLongStack[2]) * 8.5);
  }

  if (attackMoveSpeed) {
    entry.atkSpeed = readNumberMatch(attackMoveSpeed[1]);
    entry.moveSpeed = readNumberMatch(attackMoveSpeed[1]);
  }

  if (defenseReduction !== null) {
    entry.atkBuffPlus = readMappedFactor(defenseReduction, {
      1.5: 1.0075,
      1.8: 1.007,
      2.1: 1.0106,
      2.5: 1.0143
    });
    entry.finalDmg = readMappedFactor(defenseReduction, {
      1.5: 1.0075,
      1.8: 1.007,
      2.1: 1.0106,
      2.5: 1.0126
    });
  }

  if (critResistanceReduction !== null) {
    entry.critRate = critResistanceReduction;
    entry.atkBuffPlus = readMappedFactor(critResistanceReduction, {
      1.5: 1.010875,
      1.8: 1.01305,
      2.1: 1.015225,
      2.5: 1.0176
    });
  }

  if (shieldDamage !== null) {
    entry.atkBuffPlus = readMappedFactor(shieldDamage, {
      0.7: 1.007,
      0.9: 1.009,
      1.1: 1.011,
      1.3: 1.013
    });
    entry.finalDmg = entry.atkBuffPlus;
  }

  return entry;
}

function readDealerBangleAttackRatio(
  data: LopecSimulatorData,
  entries: DealerBangleEntry[]
): number {
  const bangleMainStat = sumBangleMainStat(data);
  const bangleWeaponAttack = entries.reduce((sum, entry) => sum + (entry.weaponAtkPlus ?? 0), 0);

  if (bangleMainStat === 0 && bangleWeaponAttack === 0) {
    return 1;
  }

  const withoutBangle = readDealerAttackForBangle(data, 0, 0);
  const withBangle = readDealerAttackForBangle(data, bangleMainStat, bangleWeaponAttack);

  return withoutBangle > 0 && withBangle > 0 ? withBangle / withoutBangle : 1;
}

function readDealerAttackForBangle(
  data: LopecSimulatorData,
  bangleMainStat: number,
  bangleWeaponAttack: number
): number {
  const attackBonus = readAttackBonus(data);
  const accessoryWeapon = sumAccessoryWeaponOptions(data);
  const weaponCore = readArkGridWeaponCore(data);
  const enlightenmentKarma = (data.arkPassive.enlightenment?.karmalevel ?? 0) * 0.1;
  const weaponAttack = Math.floor(
    (
      (data.armory.equipment.weapon?.stat ?? 0) +
      accessoryWeapon.flat +
      weaponCore.weaponAtkPlus +
      bangleWeaponAttack
    ) *
      (1 + accessoryWeapon.percent / 100 + enlightenmentKarma / 100 + weaponCore.weaponAtkPer / 100)
  );
  const powerStat = Math.floor(
    (sumEquipmentStat(data) + sumAccessoryStat(data) + bangleMainStat) *
      (1 + (data.avatar.avatarStats ?? 0) / 100 + (data.baseEffect.petStat ?? 1) / 100)
  );

  return Math.floor(
    (Math.sqrt((powerStat * weaponAttack) / 6) * attackBonus.baseAtkBonus +
      attackBonus.atkPlus) *
      attackBonus.atkPer
  );
}

function readDealerBangleAdditionalDamageRatio(
  data: LopecSimulatorData,
  entries: DealerBangleEntry[]
): number {
  const bangleAdditionalDamage = entries.reduce((sum, entry) => sum + (entry.addDmg ?? 0), 0);

  if (bangleAdditionalDamage === 0) {
    return 1;
  }

  const withoutBangle = readAdditionalDamageFactor(data);
  const withBangle = withoutBangle + bangleAdditionalDamage / 100;

  return withBangle / withoutBangle;
}

function readDealerBangleStatRatio(data: LopecSimulatorData): number {
  const bangleStats = readBangleCombatStats(data);
  const bangleStatTotal = bangleStats.critical + bangleStats.haste + bangleStats.special;

  if (bangleStatTotal === 0) {
    return 1;
  }

  const baseStatTotal = (data.stats.critical ?? 0) + (data.stats.haste ?? 0) + (data.stats.special ?? 0);
  const withoutBangle = readDealerStatFactor(baseStatTotal);
  const withBangle = readDealerStatFactor(baseStatTotal + bangleStatTotal);

  return withoutBangle > 0 ? withBangle / withoutBangle : 1;
}

function readDealerBangleCritRatio(
  data: LopecSimulatorData,
  entries: DealerBangleEntry[]
): number {
  const bangleCritRate = entries.reduce((sum, entry) => sum + (entry.critRate ?? 0), 0);
  const bangleCritDamage = entries.reduce((sum, entry) => sum + (entry.critDmg ?? 0), 0);
  const bangleCritFinalDamage = entries.reduce(
    (factor, entry) => factor * (entry.specCritFinalDmg ?? entry.critFinalDmg ?? 1),
    1
  );
  const bangleAttackBuffPlus = entries.reduce(
    (factor, entry) => factor * (entry.atkBuffPlus ?? 1),
    1
  );

  if (
    bangleCritRate === 0 &&
    bangleCritDamage === 0 &&
    bangleCritFinalDamage === 1 &&
    bangleAttackBuffPlus === 1
  ) {
    return 1;
  }

  const bluntSpikeLevel = readEvolutionNodes(data).find((node) => node.name === "뭉툭한 가시")?.level ?? 0;
  const critRateCap = bluntSpikeLevel === 1 ? 116 : bluntSpikeLevel >= 2 ? 120 : 100;
  const baseCritRate = Math.min(readDealerFinalCritRateWithoutBangle(data), critRateCap);
  const baseCritDamage = readDealerCritDamageWithoutBangle(data);
  const baseCritFinalDamage = readDealerCritFinalDamageWithoutBangle(data);
  const baseCritExpectedDamage = readCritExpectedDamage(
    baseCritRate,
    baseCritDamage,
    baseCritFinalDamage,
    bluntSpikeLevel
  );

  if (baseCritExpectedDamage <= 0) {
    return bangleCritFinalDamage * bangleAttackBuffPlus;
  }

  const critRateStep =
    readCritExpectedDamage(
      Math.min(baseCritRate + 1, critRateCap),
      baseCritDamage,
      baseCritFinalDamage,
      bluntSpikeLevel
    ) /
      baseCritExpectedDamage -
    1;
  const critDamageStep =
    readCritExpectedDamage(
      baseCritRate,
      baseCritDamage + 1,
      baseCritFinalDamage,
      bluntSpikeLevel
    ) /
      baseCritExpectedDamage -
    1;
  const critBias = readCritBias(critRateStep, critDamageStep);
  const critRateGain = Math.max(0, Math.min(baseCritRate + bangleCritRate, critRateCap) - baseCritRate);

  return (
    (1 + 0.007 * (1 + 0.024 * critBias) * critRateGain) *
    (1 + 0.0035 * (1 - 0.024 * critBias) * bangleCritDamage) *
    bangleCritFinalDamage *
    bangleAttackBuffPlus
  );
}

function readDealerBangleSpeedRatio(
  data: LopecSimulatorData,
  entries: DealerBangleEntry[]
): number {
  const bangleAttackSpeed = entries.reduce((sum, entry) => sum + (entry.atkSpeed ?? 0), 0);

  if (bangleAttackSpeed === 0) {
    return 1;
  }

  const attackSpeedWithoutBangle = readDealerAttackSpeedWithoutBangle(data);
  const effectiveGain = Math.max(
    0,
    Math.min(attackSpeedWithoutBangle + bangleAttackSpeed, 140) - attackSpeedWithoutBangle
  );

  return effectiveGain === 0
    ? 1
    : 1 + (effectiveGain / bangleAttackSpeed) * (1 + bangleAttackSpeed * (0.017 / 6) - 1);
}

function readDealerBangleFinalDamageRatio(entries: DealerBangleEntry[]): number {
  return entries.reduce((factor, entry) => {
    if (entry.finalDmg === undefined) {
      return factor;
    }

    if (
      entry.critRate !== undefined ||
      entry.critDmg !== undefined ||
      entry.critFinalDmg !== undefined ||
      entry.addDmg !== undefined
    ) {
      return factor;
    }

    return factor * entry.finalDmg;
  }, 1);
}

function readDealerFinalCritRateWithoutBangle(data: LopecSimulatorData): number {
  const statCritRate = Math.floor((data.stats.critical ?? 0) / 0.2794) / 100;
  const accessoryCritRate = sumOptionPercent(readRingOptions(data), "치명타 적중률");
  const evolutionCritRate = readEvolutionNodes(data).reduce((sum, node) => {
    if (node.name === "예리한 감각") return sum + 4 * node.level;
    if (node.name === "혼신의 강타") return sum + 12 * node.level;
    if (node.name === "일격") return sum + 10 * node.level;
    if (node.name === "달인") return sum + 7 * node.level;
    return sum;
  }, 0);
  const enlightenmentCritRate = readEnlightenmentNodes(data).reduce((sum, node) => {
    if (node.name === "전술 훈련") return sum + 1.6 * node.level;
    if (node.name === "전환난무") return sum + 0.8 * node.level;
    if (node.name === "체술 강화") return sum + 1.2 * node.level;
    if (node.name === "퀵 드로우") return sum + node.level;
    if (node.name === "교감 강화") return sum + 1.4 * node.level;
    if (node.name === "단련" && data.profile.secondClass !== "이슬비") return sum + node.level;
    if (node.name === "자연체" && data.arkGrid.core?.some((core) => core.name === "질서의 해 코어 : 적수공권")) {
      return sum + 3 * node.level;
    }
    return sum;
  }, 0);
  const classCritRate = readDealerClassCritRate(data);
  const engravingCritRate = readDealerEngravingCritRate(data);

  return round2(
    statCritRate +
      accessoryCritRate +
      evolutionCritRate +
      enlightenmentCritRate +
      classCritRate +
      engravingCritRate
  );
}

function readDealerCritDamageWithoutBangle(data: LopecSimulatorData): number {
  const accessoryCritDamage = sumOptionPercent(readRingOptions(data), "치명타 피해");
  const enlightenmentCritDamage = readEnlightenmentNodes(data).reduce((sum, node) => {
    if (["분노 자극", "치명적인 체술", "곡예사"].includes(node.name)) return sum + 3 * node.level;
    if (["날카로운 기공", "치명적인 오의", "페일 노트", "격노의 악장"].includes(node.name)) {
      return sum + 4 * node.level;
    }
    if (node.name === "오버히트") return sum + (node.level - 1) * 3;
    if (node.name === "단련" && data.profile.secondClass === "이슬비") return sum + 4 * node.level;
    if (node.name === "할버드의 대가") return sum + 4 + 4 * Math.floor(node.level / 2) - (node.level % 2 === 0 ? 1 : 0);
    return sum;
  }, 0);
  const classCritDamage = readDealerClassCritDamage(data);
  const engravingCritDamage = readDealerEngravingCritDamage(data);

  return 200 + accessoryCritDamage + enlightenmentCritDamage + classCritDamage + engravingCritDamage;
}

function readDealerCritFinalDamageWithoutBangle(data: LopecSimulatorData): number {
  const hasKeenStrike = readEvolutionNodes(data).some((node) => node.name === "회심");

  return (hasKeenStrike ? 1.12 : 1) * readDealerCoreCritFinalDamage(data);
}

function readDealerCoreCritFinalDamage(data: LopecSimulatorData): number {
  return (data.arkGrid.core ?? []).reduce((factor, core) => {
    const entry =
      ARK_GRID_CRIT_FINAL_DAMAGE_CORE[core.name]?.[readArkGridPoint(core.point)]?.[
        readArkGridGrade(core.grade)
      ];

    return factor * (entry ?? 1);
  }, 1);
}

function readDealerAttackSpeedWithoutBangle(data: LopecSimulatorData): number {
  const hasteAttackSpeed = Math.floor((data.stats.haste ?? 0) / 0.5821) / 100;
  const classAttackSpeed = readDealerClassSpeedEffect(data, "atkSpeed", data.stats.special ?? 0);
  const enlightenmentAttackSpeed = readEnlightenmentNodes(data).reduce(
    (sum, node) => (node.name === "징벌의 서막" ? sum + 5 : sum),
    0
  );
  const evolutionAttackSpeed = readEvolutionNodes(data).reduce(
    (sum, node) => (node.name === "파괴 전차" ? sum + 4 * node.level : sum),
    0
  );
  const engravingAttackSpeed = readEngravings(data).reduce((sum, engraving) => {
    if (engraving.name !== "질량 증가") {
      return sum;
    }

    return sum - 10;
  }, 0);
  const abilityStoneAttackSpeedPenalty = readAbilityStoneSpeedPenalty(data, "공격속도 감소");

  return Math.floor(
    (
      14 +
      hasteAttackSpeed +
      classAttackSpeed +
      enlightenmentAttackSpeed +
      evolutionAttackSpeed +
      engravingAttackSpeed -
      abilityStoneAttackSpeedPenalty
    ) * 100
  ) / 100;
}

function readDealerMoveSpeedWithBangle(data: LopecSimulatorData): number {
  const bangleStats = readBangleCombatStats(data);
  const hasteMoveSpeed = Math.floor(((data.stats.haste ?? 0) + bangleStats.haste) / 0.5821) / 100;
  const classMoveSpeed = readDealerClassSpeedEffect(
    data,
    "moveSpeed",
    (data.stats.special ?? 0) + bangleStats.special
  );
  const bangleMoveSpeed = readDealerBangleEntries(data).reduce(
    (sum, entry) => sum + (entry.moveSpeed ?? 0),
    0
  );
  const enlightenmentMoveSpeed = readEnlightenmentNodes(data).reduce(
    (sum, node) => (node.name === "고대의 바람" ? sum + 10 : sum),
    0
  );
  const abilityStoneMoveSpeedPenalty = readAbilityStoneSpeedPenalty(data, "이동속도 감소");

  return Math.floor(
    (14 + hasteMoveSpeed + classMoveSpeed + bangleMoveSpeed + enlightenmentMoveSpeed - abilityStoneMoveSpeedPenalty) *
      100
  ) / 100;
}

function readDealerClassCritRate(data: LopecSimulatorData): number {
  if (readProfileClass(data) === "소서리스" && data.arkGrid.core?.some((core) => core.name.includes("불완전 연소"))) {
    return 0;
  }

  const base = readDealerClassBaseEffect(data, "critRate");

  if (data.profile.secondClass === "광전사의 비기") {
    return readBerserkerTechniqueScaledEffect(base, data.stats.special ?? 0);
  }

  if (data.profile.secondClass === "질풍노도") {
    return base + Math.floor(0.3 * Math.min(Math.max(readDealerMoveSpeedWithBangle(data), 0), 40) * 100) / 100;
  }

  return base;
}

function readDealerClassCritDamage(data: LopecSimulatorData): number {
  if (readProfileClass(data) === "소서리스" && data.arkGrid.core?.some((core) => core.name.includes("불완전 연소"))) {
    return 0;
  }

  const base = readDealerClassBaseEffect(data, "critDamage");

  if (data.profile.secondClass === "질풍노도") {
    return base + Math.floor(1.2 * Math.min(Math.max(readDealerMoveSpeedWithBangle(data), 0), 40) * 100) / 100;
  }

  return base;
}

function readDealerClassSpeedEffect(
  data: LopecSimulatorData,
  key: "atkSpeed" | "moveSpeed",
  special: number
): number {
  const base = readDealerClassBaseEffect(data, key);

  return data.profile.secondClass === "광전사의 비기"
    ? readBerserkerTechniqueScaledEffect(base, special)
    : base;
}

function readDealerClassBaseEffect(
  data: LopecSimulatorData,
  key: "atkSpeed" | "critDamage" | "critRate" | "moveSpeed"
): number {
  return DEALER_CLASS_BASE_EFFECTS[data.profile.secondClass]?.[key] ?? 0;
}

function readBerserkerTechniqueScaledEffect(effect: number, special: number): number {
  return Math.floor(effect * (1 + Math.floor((special / 0.0699) * 0.26) / 10000) * 100) / 100;
}

function readDealerEngravingCritRate(data: LopecSimulatorData): number {
  return readEngravings(data).reduce((sum, engraving) => {
    const grade = engraving.grade;
    const level = engraving.level;

    if (engraving.name === "아드레날린") {
      return sum + 8 + (grade === "유물" ? ([6, 7.5, 9, 10.5, 12][level] ?? 0) : 0) +
        (grade === "전설" ? ([0, 1.5, 3, 4.5][level] ?? 0) : 0);
    }

    if (engraving.name === "정밀 단도") {
      const stoneBonus = engraving.stone ? ({ 1: 3, 2: 3.75, 3: 5.25, 4: 6 }[engraving.stone] ?? 0) : 0;
      return sum + 18 + stoneBonus +
        (grade === "유물" ? ([3, 3.75, 4.5, 5.25, 6][level] ?? 0) : 0) +
        (grade === "전설" ? ([0, 0.75, 1.5, 2.25][level] ?? 0) : 0);
    }

    return sum;
  }, 0);
}

function readDealerEngravingCritDamage(data: LopecSimulatorData): number {
  return readRawEngravings(data).filter(isRecord).reduce((sum, engraving) => {
    const name = typeof engraving.name === "string" ? engraving.name.replace(/\s/g, "") : "";
    const tooltip = typeof engraving.tooltip === "string" ? engraving.tooltip : "";

    if (name === "예리한둔기") {
      return sum + (readTooltipPercent(tooltip, "치명타 피해량") ?? readKeenBluntCritDamage(engraving));
    }

    if (name === "정밀단도") {
      return sum + (readTooltipPercent(tooltip, "치명타 피해량") ?? 0);
    }

    return sum;
  }, 0);
}

function readKeenBluntCritDamage(engraving: Record<string, unknown>): number {
  const grade = typeof engraving.grade === "string" ? engraving.grade : "";
  const level = typeof engraving.level === "number" ? engraving.level : 0;
  const stone = typeof engraving.stone === "number" ? engraving.stone : null;
  const base = grade === "유물" ? ([44, 47, 50, 53, 56][level] ?? 0) : 0;
  const stoneBonus = stone ? ({ 1: 7.5, 2: 9.4, 3: 13.2, 4: 15 }[stone] ?? 0) : 0;

  return base + stoneBonus;
}

function readTooltipPercent(tooltip: string, label: string): number | null {
  const text = tooltip.replace(/<[^>]+>/g, "");
  const match = text.match(new RegExp(`${escapeRegExp(label)}[^0-9+-]*([0-9,.]+)%`));

  return match ? readNumberMatch(match[1]) : null;
}

function readCritExpectedDamage(
  critRate: number,
  critDamage: number,
  critFinalDamage: number,
  bluntSpikeLevel: number
): number {
  const cappedCritRate = Math.min(critRate, 100) / 100;
  const bluntSpikeDamage =
    bluntSpikeLevel > 0
      ? 1 + readBluntSpikeDamage(critRate, bluntSpikeLevel) / 100
      : 1;

  return (1 - cappedCritRate + (critDamage / 100) * cappedCritRate * critFinalDamage) * bluntSpikeDamage;
}

function readBluntSpikeDamage(critRate: number, bluntSpikeLevel: number): number {
  if (bluntSpikeLevel === 1) {
    return Math.min(7.5 + Math.max(0, Math.min(critRate, 120) - 80) * 1.25, 52.5);
  }

  if (bluntSpikeLevel >= 2) {
    return Math.min(15 + Math.max(0, Math.min(critRate, 120) - 80) * 1.5, 75);
  }

  return 0;
}

function readCritBias(critRateStep: number, critDamageStep: number): number {
  const total = Math.abs(critRateStep) + Math.abs(critDamageStep);

  if (total === 0) {
    return 0;
  }

  return Math.min(Math.max((critRateStep - critDamageStep) / total, -1), 1);
}

function readDealerStatFactor(totalStat: number): number {
  return (totalStat / 100) * 4.1 / 100 + 1.3;
}

function readRingOptions(data: LopecSimulatorData): string[] {
  return (["ring1", "ring2"] as LopecAccessorySlot[]).flatMap((slot) => {
    const accessory = readLopecAccessory(data, slot);

    return accessory?.option ?? [];
  });
}

function readEnlightenmentNodes(data: LopecSimulatorData): Array<{ name: string; level: number }> {
  return data.arkPassive.enlightenment?.nodes ?? [];
}

function readEnlightenmentFactor(data: LopecSimulatorData): number {
  const points = data.arkPassive.enlightenment?.points ?? 0;

  if (points >= 100) return 1.42;
  if (points >= 98) return 1.4;
  if (points >= 96) return 1.37;
  if (points >= 94) return 1.36;
  if (points >= 92) return 1.35;
  if (points >= 90) return 1.34;
  if (points >= 88) return 1.33;
  if (points >= 86) return 1.28;
  if (points >= 84) return 1.27;
  if (points >= 82) return 1.26;
  if (points >= 80) return 1.25;
  if (points >= 78) return 1.18;
  if (points >= 76) return 1.17;
  if (points >= 74) return 1.16;
  if (points >= 72) return 1.15;
  if (points >= 64) return 1.13;
  if (points >= 56) return 1.125;
  if (points >= 48) return 1.12;
  if (points >= 40) return 1.115;
  if (points >= 32) return 1.11;
  if (points >= 24) return 1.1;
  return 1;
}

function readEnlightenmentPotionPoints(data: LopecSimulatorData): number {
  return (data.arkPassive.enlightenment?.points ?? 0) - readBaseEnlightenmentPoints(data);
}

function readBaseEnlightenmentPoints(data: LopecSimulatorData): number {
  const baseLevelPoints = Math.max(data.profile.level - 50, 0);
  const karmaRank = data.arkPassive.enlightenment?.karmaRank ?? 0;
  const accessoryPoints = LOPEC_ACCESSORY_SLOTS.reduce((sum, slot) => {
    const accessory = readLopecAccessory(data, slot);
    return sum + (accessory?.enlightPoint ?? 0);
  }, 0);

  return baseLevelPoints + karmaRank + accessoryPoints;
}

function sumEquipmentStat(data: LopecSimulatorData): number {
  return Object.entries(data.armory.equipment).reduce((sum, [slot, item]) => {
    if (slot === "weapon") {
      return sum;
    }

    return sum + (item?.stat ?? 0);
  }, 0);
}

function sumAccessoryStat(data: LopecSimulatorData): number {
  return LOPEC_ACCESSORY_SLOTS.reduce((sum, slot) => {
    const accessory = readLopecAccessory(data, slot);
    return sum + (accessory?.stat ?? 0);
  }, 0);
}

function sumAccessoryAttackOptions(data: LopecSimulatorData): { flat: number; percent: number } {
  return LOPEC_ACCESSORY_SLOTS.reduce(
    (total, slot) => {
      const accessory = readLopecAccessory(data, slot);

      if (!accessory) {
        return total;
      }

      for (const option of accessory.option) {
        if (!option.includes("공격력") || option.includes("무기 공격력")) {
          continue;
        }

        if (option.includes("%")) {
          total.percent += readOptionPercent(option, "공격력");
        } else {
          total.flat += readOptionFlat(option, "공격력");
        }
      }

      return total;
    },
    { flat: 0, percent: 0 }
  );
}

function sumAccessoryWeaponOptions(data: LopecSimulatorData): { flat: number; percent: number } {
  return LOPEC_ACCESSORY_SLOTS.reduce(
    (total, slot) => {
      const accessory = readLopecAccessory(data, slot);

      if (!accessory) {
        return total;
      }

      for (const option of accessory.option) {
        if (!option.includes("무기 공격력")) {
          continue;
        }

        if (option.includes("%")) {
          total.percent += readOptionPercent(option, "무기 공격력");
        } else {
          total.flat += readOptionFlat(option, "무기 공격력");
        }
      }

      return total;
    },
    { flat: 0, percent: 0 }
  );
}

function sumBangleWeaponAttackOrigin(data: LopecSimulatorData): number {
  const bangle = data.armory.accessory.bangle;
  const options = bangle?.option ?? [];

  return options.reduce((sum, option) => {
    const compact = option.replace(/\s/g, "");
    const direct = compact.match(/^무기공격력\+([0-9,]+)$/);

    if (direct) {
      return sum + Number(direct[1].replaceAll(",", ""));
    }

    const sentence = compact.match(/무기공격력이([0-9,]+)증가/);

    return sentence ? sum + Number(sentence[1].replaceAll(",", "")) : sum;
  }, 0);
}

function readArkGridGemEffect(data: LopecSimulatorData, name: string): number {
  return data.arkGrid.gemEffects?.find((effect) => effect.name === name)?.effect ?? 0;
}

function readArkGridAttackCore(data: LopecSimulatorData): { atkPlus: number; atkPer: number } {
  const core = readArkGridCore(data, "혼돈의 별 코어 : 공격");

  if (!core) {
    return { atkPlus: 0, atkPer: 0 };
  }

  return ARK_GRID_ATTACK_CORE[readArkGridPoint(core.point)]?.[readArkGridGrade(core.grade)] ?? {
    atkPlus: 0,
    atkPer: 0
  };
}

function readArkGridWeaponCore(data: LopecSimulatorData): {
  weaponAtkPlus: number;
  weaponAtkPer: number;
} {
  const core = readArkGridCore(data, "혼돈의 별 코어 : 무기");

  if (!core) {
    return { weaponAtkPlus: 0, weaponAtkPer: 0 };
  }

  return ARK_GRID_WEAPON_CORE[readArkGridPoint(core.point)]?.[readArkGridGrade(core.grade)] ?? {
    weaponAtkPlus: 0,
    weaponAtkPer: 0
  };
}

function readArkGridAdditionalDamageCore(data: LopecSimulatorData): number {
  const core = readArkGridCore(data, "혼돈의 해 코어 : 안정적인 공격");

  if (!core) {
    return 0;
  }

  return ARK_GRID_ADDITIONAL_DAMAGE_CORE[readArkGridPoint(core.point)]?.[readArkGridGrade(core.grade)] ?? 0;
}

function readArkGridCore(data: LopecSimulatorData, name: string) {
  return data.arkGrid.core?.find((core) => core.name === name) ?? null;
}

function readArkGridPoint(point: number): number {
  let currentPoint = 10;

  for (const threshold of [10, 14, 17, 18, 19, 20]) {
    if (point >= threshold) {
      currentPoint = threshold;
    }
  }

  return currentPoint;
}

function readArkGridGrade(grade: string): "유물" | "고대" {
  return grade === "고대" ? "고대" : "유물";
}

function buildLopecAccessoryOptions(candidate: AccessoryCandidate): string[] {
  const options = candidate.refinementOptions.map((option) => {
    const value = option.suffix === "%" ? option.value.toFixed(2) : String(Math.round(option.value));
    return `${option.label} +${value}${option.suffix}`;
  });

  if (options.length > 0) {
    return options.slice(0, 3);
  }

  return candidate.effectSummary.slice(0, 3);
}

function readEnlightPoint(
  candidate: AccessoryCandidate,
  currentAccessory: LopecSimulatorAccessory
): number {
  if (candidate.effects.enlightenment > 0) {
    return candidate.effects.enlightenment;
  }

  if (currentAccessory.enlightPoint > 0) {
    return currentAccessory.enlightPoint;
  }

  if (candidate.type === "necklace") {
    return candidate.grade === "유물" ? 10 : 13;
  }

  return candidate.grade === "유물" ? 9 : 12;
}

function readMainStat(accessory: Pick<AccessoryState, "stats">): number {
  return Math.max(
    accessory.stats.strength,
    accessory.stats.dexterity,
    accessory.stats.intelligence
  );
}

function readLopecAccessory(
  data: LopecSimulatorData,
  slot: LopecAccessorySlot
): LopecSimulatorAccessory | null {
  const accessory = data.armory.accessory[slot];

  if (!accessory || !("stat" in accessory) || !Array.isArray(accessory.option)) {
    return null;
  }

  return accessory as LopecSimulatorAccessory;
}

interface LopecEngraving {
  name: string;
  grade: string;
  level: number;
  stone?: number | null;
}

interface LopecSkill {
  name: string;
  tripods?: Array<{ name: string }>;
}

interface LopecGemEntry {
  level: number;
  type: string;
  skill: string;
  attackBonus?: boolean | number | null;
  valid?: boolean;
}

type SupportCoreEffectKey =
  | "cdrPercent"
  | "damageBuff"
  | "identityUptime"
  | "stigmaPer"
  | "finalDamageBuff"
  | "atkBuffPlus";

type SupportCoreEffectEntry = Partial<Record<SupportCoreEffectKey, number>>;

const MANA_FLOW_COOLDOWN: Record<string, Record<string, number>> = {
  영웅: { "0": 0.04, "1": 0.04, "2": 0.04, "3": 0.04 },
  전설: { "0": 0.04, "1": 0.0475, "2": 0.055, "3": 0.0625 },
  유물: { "0": 0.07, "1": 0.0775, "2": 0.085, "3": 0.0925, "4": 0.1 }
};

const AWAKENING_COOLDOWN: Record<string, Record<string, number>> = {
  영웅: { "0": 0.06, "1": 0.045, "2": 0.03, "3": 0.015 },
  전설: { "0": 0, "1": 0, "2": 0, "3": 0 },
  유물: { "0": 0, "1": 0.015, "2": 0.03, "3": 0.045, "4": 0.06 }
};

const AWAKENING_STONE_COOLDOWN: Record<number, number> = {
  1: 0.06,
  2: 0.075,
  3: 0.105,
  4: 0.12
};

const EXPERT_DEFENSE_FACTOR: Record<number, number> = {
  5: 3360,
  6: 3500,
  7: 3640,
  8: 3780,
  9: 3920,
  10: 4060,
  11: 4200,
  12: 4340,
  13: 4480,
  21: 3080,
  22: 3220,
  23: 3360,
  24: 3500,
  25: 3640,
  26: 3780,
  27: 3920,
  28: 4060,
  29: 4200,
  30: 4340,
  31: 4480,
  32: 4620,
  33: 4760,
  41: 3150,
  42: 3290,
  43: 3430,
  44: 3570,
  45: 3710,
  46: 3850,
  47: 3990,
  48: 4130,
  49: 4270,
  50: 4410,
  51: 4550,
  52: 4690,
  53: 4830,
  61: 3290,
  62: 3430,
  63: 3570,
  64: 3710,
  65: 3850,
  66: 3990,
  67: 4130,
  68: 4270,
  69: 4410,
  70: 4550,
  71: 4690,
  72: 4830,
  73: 4970,
  81: 3360,
  82: 3500,
  83: 3640,
  84: 3780,
  85: 3920,
  86: 4060,
  87: 4200,
  88: 4340,
  89: 4480,
  90: 4620,
  91: 4760,
  92: 4900,
  93: 5040
};

const SUPPORT_CORE_EFFECTS: Record<
  string,
  Record<number, Record<"유물" | "고대", SupportCoreEffectEntry>>
> = {
  "혼돈의 해 코어 : 신념의 강화": {
    10: { 유물: { identityUptime: 0.006 }, 고대: { identityUptime: 0.006 } },
    14: {
      유물: { identityUptime: 0.006, damageBuff: 0.7 },
      고대: { identityUptime: 0.006, damageBuff: 0.7 }
    },
    17: {
      유물: { identityUptime: 0.02, damageBuff: 1.9 },
      고대: { identityUptime: 0.024, damageBuff: 3.5 }
    },
    18: {
      유물: { identityUptime: 0.02, damageBuff: 2.1 },
      고대: { identityUptime: 0.024, damageBuff: 3.7 }
    },
    19: {
      유물: { identityUptime: 0.02, damageBuff: 2.3 },
      고대: { identityUptime: 0.024, damageBuff: 3.9 }
    },
    20: {
      유물: { identityUptime: 0.02, damageBuff: 2.5 },
      고대: { identityUptime: 0.024, damageBuff: 4.1 }
    }
  },
  "혼돈의 해 코어 : 흐르는 마나": {
    10: { 유물: { cdrPercent: 0 }, 고대: { cdrPercent: 0 } },
    14: { 유물: { cdrPercent: 0.004 }, 고대: { cdrPercent: 0.004 } },
    17: { 유물: { cdrPercent: 0.012 }, 고대: { cdrPercent: 0.02 } },
    18: { 유물: { cdrPercent: 0.0133 }, 고대: { cdrPercent: 0.0213 } },
    19: { 유물: { cdrPercent: 0.0146 }, 고대: { cdrPercent: 0.0226 } },
    20: { 유물: { cdrPercent: 0.0159 }, 고대: { cdrPercent: 0.0239 } }
  },
  "혼돈의 달 코어 : 낙인의 흔적": {
    10: { 유물: { finalDamageBuff: 1.001 }, 고대: { finalDamageBuff: 1.001 } },
    14: {
      유물: { finalDamageBuff: 1.001, stigmaPer: 1.2 },
      고대: { finalDamageBuff: 1.001, stigmaPer: 1.2 }
    },
    17: {
      유물: { finalDamageBuff: 1.003, stigmaPer: 3.6 },
      고대: { finalDamageBuff: 1.005, stigmaPer: 4.8 }
    },
    18: {
      유물: { finalDamageBuff: 1.003, stigmaPer: 4 },
      고대: { finalDamageBuff: 1.005, stigmaPer: 5.2 }
    },
    19: {
      유물: { finalDamageBuff: 1.003, stigmaPer: 4.4 },
      고대: { finalDamageBuff: 1.005, stigmaPer: 5.6 }
    },
    20: {
      유물: { finalDamageBuff: 1.003, stigmaPer: 4.8 },
      고대: { finalDamageBuff: 1.005, stigmaPer: 6 }
    }
  },
  "혼돈의 달 코어 : 강철의 흔적": {
    10: { 유물: { atkBuffPlus: 1.001 }, 고대: { atkBuffPlus: 1.001 } },
    14: { 유물: { atkBuffPlus: 1.001 }, 고대: { atkBuffPlus: 1.001 } },
    17: { 유물: { atkBuffPlus: 1.003 }, 고대: { atkBuffPlus: 1.005 } },
    18: { 유물: { atkBuffPlus: 1.003 }, 고대: { atkBuffPlus: 1.005 } },
    19: { 유물: { atkBuffPlus: 1.003 }, 고대: { atkBuffPlus: 1.005 } },
    20: { 유물: { atkBuffPlus: 1.003 }, 고대: { atkBuffPlus: 1.005 } }
  },
  "혼돈의 달 코어 : 치명적인 흔적": {
    10: { 유물: { atkBuffPlus: 1.00108 }, 고대: { atkBuffPlus: 1.00108 } },
    14: { 유물: { atkBuffPlus: 1.00108 }, 고대: { atkBuffPlus: 1.00108 } },
    17: { 유물: { atkBuffPlus: 1.00326 }, 고대: { atkBuffPlus: 1.00543 } },
    18: { 유물: { atkBuffPlus: 1.00326 }, 고대: { atkBuffPlus: 1.00543 } },
    19: { 유물: { atkBuffPlus: 1.00326 }, 고대: { atkBuffPlus: 1.00543 } },
    20: { 유물: { atkBuffPlus: 1.00326 }, 고대: { atkBuffPlus: 1.00543 } }
  }
};

function readEngravings(data: LopecSimulatorData): LopecEngraving[] {
  const raw = readRawEngravings(data);

  return Array.isArray(raw)
    ? raw.filter(isRecord).map((item) => ({
        name: typeof item.name === "string" ? item.name : "",
        grade: typeof item.grade === "string" ? item.grade : "",
        level: typeof item.level === "number" ? item.level : 0,
        stone: typeof item.stone === "number" ? item.stone : null
      }))
    : [];
}

function readRawEngravings(data: LopecSimulatorData): unknown[] {
  const raw = (data as LopecSimulatorData & { engraving?: unknown }).engraving;

  return Array.isArray(raw) ? raw : [];
}

function readAbilityStoneSpeedPenalty(data: LopecSimulatorData, label: string): number {
  const options = (data.armory.abilityStone as { option?: unknown } | null | undefined)?.option;

  if (!Array.isArray(options)) {
    return 0;
  }

  return options.reduce((sum, option) => {
    if (typeof option !== "string") {
      return sum;
    }

    const match = option.match(new RegExp(`${escapeRegExp(label)}\\s*Lv\\.(\\d+)`));

    return match ? sum + 2 * Number(match[1]) : sum;
  }, 0);
}

function readSkills(data: LopecSimulatorData): LopecSkill[] {
  const raw = (data as LopecSimulatorData & { skills?: unknown }).skills;

  return Array.isArray(raw)
    ? raw.filter(isRecord).map((item) => ({
        name: typeof item.name === "string" ? item.name : "",
        tripods: Array.isArray(item.tripods)
          ? item.tripods.filter(isRecord).map((tripod) => ({
              name: typeof tripod.name === "string" ? tripod.name : ""
            }))
          : []
      }))
    : [];
}

function readGems(data: LopecSimulatorData): LopecGemEntry[] {
  return (data.gem.gems ?? []).map((gem) => ({
    level: gem.level,
    type: gem.type,
    skill: gem.skill,
    attackBonus: gem.attackBonus,
    valid: gem.valid
  }));
}

function readProfileClass(data: LopecSimulatorData): string {
  return data.profile.class ?? data.profile.secondClass;
}

function readEvolutionNodes(data: LopecSimulatorData): Array<{ name: string; level: number }> {
  return data.arkPassive.evolution?.nodes ?? [];
}

function readEvolutionNodeNames(data: LopecSimulatorData): string[] {
  return readEvolutionNodes(data).map((node) => node.name);
}

function hasSkillTripod(data: LopecSimulatorData, skillName: string, tripodName: string): boolean {
  return readSkills(data).some(
    (skill) =>
      skill.name === skillName &&
      (skill.tripods ?? []).some((tripod) => tripod.name === tripodName)
  );
}

function readCooldownGemEffect(gem: LopecGemEntry): number {
  const cooldownValues = gem.attackBonus
    ? [6, 8, 10, 12, 14, 16, 18, 20, 22, 24]
    : [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

  return cooldownValues[gem.level - 1] ?? 0;
}

function readMaxDamageGemLevel(data: LopecSimulatorData, skills: string[]): number {
  return readGems(data).reduce((max, gem) => {
    if (gem.type !== "damage" || gem.valid === false || !skills.includes(gem.skill)) {
      return max;
    }

    return Math.max(max, gem.level);
  }, 0);
}

function readSupportAllyAttackEvolutionBuff(data: LopecSimulatorData): number {
  return readEvolutionNodes(data).reduce((sum, node) => {
    if (/선각자|기원/.test(node.name)) {
      return sum + 22;
    }

    if (/진군/.test(node.name)) {
      return sum + 21;
    }

    return sum;
  }, 0);
}

function sumSupportOptionPercent(
  data: LopecSimulatorData,
  slots: LopecAccessorySlot[],
  label: string
): number {
  return slots.reduce((sum, slot) => {
    const accessory = readLopecAccessory(data, slot);

    return accessory ? sum + sumOptionPercent(accessory.option, label) : sum;
  }, 0);
}

function sumBangleMainStat(data: LopecSimulatorData): number {
  return readBangleOptions(data).reduce((sum, option) => {
    const matches = option.match(/(?:힘|민첩|지능)\s*\+[\d,]+/g);

    if (!matches) {
      return sum;
    }

    return matches.reduce((innerSum, match) => {
      const value = match.match(/\+([\d,]+)/);
      return value ? innerSum + Number(value[1].replaceAll(",", "")) : innerSum;
    }, sum);
  }, 0);
}

function readBangleCombatStats(data: LopecSimulatorData): {
  critical: number;
  special: number;
  haste: number;
} {
  return readBangleOptions(data).reduce(
    (stats, option) => {
      const match = option.match(/(치명|특화|신속)\s*\+([\d,]+(?:\.\d+)?)/);

      if (!match) {
        return stats;
      }

      const value = Number(match[2].replaceAll(",", ""));

      if (match[1] === "치명") {
        stats.critical += value;
      } else if (match[1] === "특화") {
        stats.special += value;
      } else if (match[1] === "신속") {
        stats.haste += value;
      }

      return stats;
    },
    { critical: 0, special: 0, haste: 0 }
  );
}

function readBangleOptions(data: LopecSimulatorData): string[] {
  const bangle = data.armory.accessory.bangle;
  const options = bangle?.option;

  return Array.isArray(options) ? options : [];
}

function readOptionalNumber(source: object, key: string): number | null {
  const value = (source as Record<string, unknown>)[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOptionalBoolean(source: object, key: string): boolean | null {
  const value = (source as Record<string, unknown>)[key];

  return typeof value === "boolean" ? value : null;
}

function readArkGridCoreEffect(
  data: LopecSimulatorData,
  name: string,
  key: SupportCoreEffectKey,
  fallback: number
): number {
  const core = readArkGridCore(data, name);

  return core ? readSupportCoreEffectEntry(core, key, fallback) : fallback;
}

function readSupportCoreEffectEntry(
  core: { name: string; grade: string; point: number },
  key: SupportCoreEffectKey,
  fallback: number
): number {
  const entry =
    SUPPORT_CORE_EFFECTS[core.name]?.[readArkGridPoint(core.point)]?.[
      readArkGridGrade(core.grade)
    ];

  return entry?.[key] ?? fallback;
}

function sumOptionPercent(options: string[], label: string): number {
  return options.reduce((sum, option) => sum + readOptionPercent(option, label), 0);
}

function readOptionPercent(option: string, label: string): number {
  const match = option.match(new RegExp(`${escapeRegExp(label)}\\s*\\+([0-9,.]+)%`));
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function readOptionFlat(option: string, label: string): number {
  const match = option.match(new RegExp(`${escapeRegExp(label)}\\s*\\+([0-9,.]+)(?!%)`));
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function readNumberMatch(value: string): number {
  return Number(value.replaceAll(",", ""));
}

function readCompactPercent(option: string, compactLabel: string): number {
  const compact = option.replace(/\s/g, "");
  const match = compact.match(new RegExp(`${escapeRegExp(compactLabel)}([0-9,.]+)%증가`));

  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function readCompactNumber(option: string, prefix: string, suffix: string): number | null {
  const match = option.match(
    new RegExp(`${escapeRegExp(prefix)}([0-9,.]+)${escapeRegExp(suffix)}`)
  );

  return match ? Number(match[1].replaceAll(",", "")) : null;
}

function readMappedFactor(value: number, factors: Record<number, number>): number {
  return factors[value] ?? 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
