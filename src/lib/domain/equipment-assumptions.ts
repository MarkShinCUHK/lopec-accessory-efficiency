import type { AccessoryScoringMode } from "@/lib/domain/accessory";
import { sumArmorMainStats, type ArmorMainStats } from "@/lib/domain/armor";
import type { CharacterState } from "@/lib/domain/character";
import {
  calculateArmorMainStatsForTarget,
  calculateEquipmentStats,
  createCurrentEquipmentTarget,
  decodeEquipmentTarget,
  encodeEquipmentTarget
} from "@/lib/domain/equipment";
import {
  createLopecEquipmentSimulation,
  readExactLopecDisplayCombatPower
} from "@/lib/lopec/exact-score";

export interface EquipmentAssumptionInput {
  targetWeaponLevel?: string | number | null;
  targetArmorLevel?: string | number | null;
}

export interface EquipmentAssumptionTargets {
  targetWeaponAttack: number | null;
  targetArmorMainStats: ArmorMainStats | null;
}

export interface EquipmentAssumptionPreview {
  available: boolean;
  message?: string;
  hasAssumption: boolean;
  baseScore: number | null;
  nextScore: number | null;
  deltaScore: number | null;
  deltaPercent: number | null;
  baseCombatPower: number | null;
  nextCombatPower: number | null;
  deltaCombatPower: number | null;
}

export function readEquipmentAssumptionTargets(
  character: CharacterState,
  input: EquipmentAssumptionInput
): EquipmentAssumptionTargets {
  return {
    targetWeaponAttack: readTargetWeaponAttack(character, input.targetWeaponLevel),
    targetArmorMainStats: readTargetArmorMainStats(character, input.targetArmorLevel)
  };
}

export function createEquipmentAssumptionPreview(
  character: CharacterState,
  input: EquipmentAssumptionInput,
  scoringMode?: AccessoryScoringMode | null
): EquipmentAssumptionPreview {
  const baseScore = character.lopec?.score ?? null;
  const baseCombatPower = readExactLopecDisplayCombatPower(
    character,
    scoringMode ?? undefined
  );
  const targets = readEquipmentAssumptionTargets(character, input);
  const hasAssumption =
    targets.targetWeaponAttack !== null || targets.targetArmorMainStats !== null;

  if (baseScore === null) {
    return {
      available: false,
      message: "로펙 시뮬레이터 점수를 불러오지 못해 강화 가정 미리보기를 계산할 수 없습니다.",
      hasAssumption,
      baseScore,
      nextScore: null,
      deltaScore: null,
      deltaPercent: null,
      baseCombatPower,
      nextCombatPower: null,
      deltaCombatPower: null
    };
  }

  if (!hasAssumption) {
    return {
      available: true,
      hasAssumption: false,
      baseScore,
      nextScore: baseScore,
      deltaScore: 0,
      deltaPercent: 0,
      baseCombatPower,
      nextCombatPower: baseCombatPower,
      deltaCombatPower: 0
    };
  }

  const simulation = createLopecEquipmentSimulation(
    character,
    {
      weaponAttack: targets.targetWeaponAttack,
      armorMainStats: targets.targetArmorMainStats
    },
    scoringMode ?? undefined
  );

  if (!simulation) {
    return {
      available: false,
      message: "선택한 강화 단계의 로펙 계산 데이터를 찾지 못했습니다.",
      hasAssumption,
      baseScore,
      nextScore: null,
      deltaScore: null,
      deltaPercent: null,
      baseCombatPower,
      nextCombatPower: null,
      deltaCombatPower: null
    };
  }

  const nextCombatPower = simulation.combatPower ?? baseCombatPower;

  return {
    available: true,
    hasAssumption,
    baseScore,
    nextScore: simulation.score,
    deltaScore: round2(simulation.score - baseScore),
    deltaPercent: baseScore > 0 ? round3(((simulation.score - baseScore) / baseScore) * 100) : 0,
    baseCombatPower,
    nextCombatPower,
    deltaCombatPower:
      nextCombatPower !== null && baseCombatPower !== null
        ? round2(nextCombatPower - baseCombatPower)
        : null
  };
}

function readTargetWeaponAttack(
  character: CharacterState,
  targetWeaponLevel: string | number | null | undefined
): number | null {
  const target = decodeEquipmentTarget(targetWeaponLevel);

  if (!target) {
    return null;
  }

  const current = createCurrentEquipmentTarget(character.weapon);

  if (current && encodeEquipmentTarget(current) === encodeEquipmentTarget(target)) {
    return null;
  }

  const stats = calculateEquipmentStats("weapon", target);

  if (!stats || stats.stat === character.weapon.attack) {
    return null;
  }

  return stats.stat;
}

function readTargetArmorMainStats(
  character: CharacterState,
  targetArmorLevel: string | number | null | undefined
): ArmorMainStats | null {
  const target = decodeEquipmentTarget(targetArmorLevel);

  if (!target) {
    return null;
  }

  const targetStats = calculateArmorMainStatsForTarget(target);

  if (!targetStats) {
    return null;
  }

  const armorPieces = Object.values(character.armor.pieces).filter(
    (piece): piece is NonNullable<typeof piece> => Boolean(piece)
  );
  const isAlreadyAllTarget =
    armorPieces.length > 0 &&
    armorPieces.every((piece) => {
      const current = createCurrentEquipmentTarget(piece);

      return current && encodeEquipmentTarget(current) === encodeEquipmentTarget(target);
    });
  const targetMainStat = sumArmorMainStats(targetStats);

  return isAlreadyAllTarget || targetMainStat === character.scoreContext.armorMainStat
    ? null
    : targetStats;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
