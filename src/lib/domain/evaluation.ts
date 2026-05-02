import {
  getReplaceableSlots,
  totalMainStat,
  type AccessoryCandidate,
  type AccessoryScoringMode,
  type AccessorySlot,
  type AccessoryType,
  type AccessoryState
} from "@/lib/domain/accessory";
import { sumArmorMainStats, type ArmorMainStats } from "@/lib/domain/armor";
import type { CharacterState } from "@/lib/domain/character";
import {
  calculateExactLopecReplacement,
  calculateExactLopecReplacementSet,
  createLopecEquipmentSimulation
} from "@/lib/lopec/exact-score";

export interface EvaluationResult {
  candidate: AccessoryCandidate;
  replacedSlot: AccessorySlot;
  replacedAccessory: AccessoryState;
  baseScore: number;
  nextScore: number;
  deltaScore: number;
  candidateEfficiency: number;
  replacedEfficiency: number;
  deltaEfficiency: number;
  buyPrice: number;
  scorePerGold: number;
  goldPerScore: number;
}

export interface EvaluationCombinationReplacement {
  candidate: AccessoryCandidate;
  replacedSlot: AccessorySlot;
  replacedAccessory: AccessoryState;
  buyPrice: number;
  deltaScore: number;
}

export interface EvaluationCombinationResult {
  replacements: EvaluationCombinationReplacement[];
  baseScore: number;
  nextScore: number;
  deltaScore: number;
  deltaEfficiency: number;
  buyPrice: number;
  scorePerGold: number;
  goldPerScore: number;
}

const MAX_CANDIDATES_PER_SLOT = 80;
const MAX_COMBINATION_BEAM = 700;
const MAX_EXHAUSTIVE_COMBINATION_SLOTS = 2;
const SWAPPABLE_SLOT_GROUPS: AccessorySlot[][] = [
  ["earring1", "earring2"],
  ["ring1", "ring2"]
];

export function evaluateCandidate(
  character: CharacterState,
  candidate: AccessoryCandidate,
  scoringMode?: AccessoryScoringMode,
  targetWeaponAttack?: number | null,
  targetArmorMainStats?: ArmorMainStats | null
): EvaluationResult | null {
  const scoringCharacter = createScoringCharacter(
    character,
    scoringMode,
    targetWeaponAttack,
    targetArmorMainStats
  );
  const buyPrice = candidate.buyPrice ?? 0;

  if (buyPrice <= 0) {
    return null;
  }

  const results = getReplaceableSlots(candidate.type)
    .map((slot) => evaluateCandidateForSlot(scoringCharacter, slot, candidate, scoringMode))
    .filter((result): result is EvaluationResult => Boolean(result));

  return results.sort((a, b) => b.deltaScore - a.deltaScore)[0] ?? null;
}

export function evaluateCandidateForSlot(
  character: CharacterState,
  slot: AccessorySlot,
  candidate: AccessoryCandidate,
  scoringMode?: AccessoryScoringMode
): EvaluationResult | null {
  const buyPrice = candidate.buyPrice ?? 0;

  if (buyPrice <= 0 || slotToAccessoryType(slot) !== candidate.type) {
    return null;
  }

  const baseScore = character.lopec?.score ?? character.combatPower;
  const currentAccessory = character.accessories[slot];
  const exactScore = calculateExactLopecReplacement(character, slot, candidate, scoringMode);
  const scoreRatio =
    exactScore?.scoreRatio ?? scoreReplacementRatio(character, slot, candidate, scoringMode);
  const nextScore = exactScore?.nextScore ?? round2(baseScore * scoreRatio);
  const deltaScore = exactScore?.deltaScore ?? round2(nextScore - baseScore);
  const candidateEfficiency = exactScore?.deltaEfficiency ?? round3((scoreRatio - 1) * 100);
  const replacedEfficiency = 0;
  const deltaEfficiency = candidateEfficiency;

  return {
    candidate,
    replacedSlot: slot,
    replacedAccessory: currentAccessory,
    baseScore,
    nextScore,
    deltaScore,
    candidateEfficiency,
    replacedEfficiency,
    deltaEfficiency,
    buyPrice,
    scorePerGold: deltaScore > 0 ? deltaScore / buyPrice : 0,
    goldPerScore: deltaScore > 0 ? buyPrice / deltaScore : Number.POSITIVE_INFINITY
  };
}

export function evaluateCandidates(
  character: CharacterState,
  candidates: AccessoryCandidate[],
  scoringMode?: AccessoryScoringMode,
  targetWeaponAttack?: number | null,
  targetArmorMainStats?: ArmorMainStats | null
): EvaluationResult[] {
  const scoringCharacter = createScoringCharacter(
    character,
    scoringMode,
    targetWeaponAttack,
    targetArmorMainStats
  );

  return candidates
    .map((candidate) => evaluateCandidate(scoringCharacter, candidate, scoringMode))
    .filter((result): result is EvaluationResult => Boolean(result))
    .sort((a, b) => {
      if (a.goldPerScore !== b.goldPerScore) {
        return a.goldPerScore - b.goldPerScore;
      }

      if (a.deltaScore !== b.deltaScore) {
        return b.deltaScore - a.deltaScore;
      }

      return a.buyPrice - b.buyPrice;
    });
}

export function evaluatePriceTargetCombinations(
  character: CharacterState,
  candidatesByType: Partial<Record<AccessoryType, AccessoryCandidate[]>>,
  targetSlots: AccessorySlot[],
  maxBudget: number,
  scoringMode?: AccessoryScoringMode,
  targetWeaponAttack?: number | null,
  targetArmorMainStats?: ArmorMainStats | null
): EvaluationCombinationResult[] {
  const scoringCharacter = createScoringCharacter(
    character,
    scoringMode,
    targetWeaponAttack,
    targetArmorMainStats
  );
  const normalizedSlots = normalizeTargetSlots(scoringCharacter, targetSlots);

  if (normalizedSlots.length === 0 || maxBudget <= 0) {
    return [];
  }

  const candidatesBySlot: SlotCandidateSet[] = normalizedSlots.map((slot) => {
    const type = slotToAccessoryType(slot);
    const candidates = candidatesByType[type] ?? [];

    return {
      slot,
      candidates: candidates
        .map((candidate) => evaluateCandidateForSlot(scoringCharacter, slot, candidate, scoringMode))
        .filter(
          (result): result is EvaluationResult =>
            result !== null && result.deltaScore > 0 && result.buyPrice <= maxBudget
        )
        .sort(compareSingleReplacementForCombination)
    };
  });
  const combinationBeams =
    normalizedSlots.length <= MAX_EXHAUSTIVE_COMBINATION_SLOTS
      ? buildExhaustiveCombinationBeams(candidatesBySlot, maxBudget)
      : buildBeamCombinationBeams(candidatesBySlot, maxBudget);
  const singleReplacementBeams = buildSingleReplacementBeams(candidatesBySlot);

  const results = [...singleReplacementBeams, ...combinationBeams]
    .filter((combo) => combo.replacements.length > 0)
    .map((combo) => buildCombinationResult(scoringCharacter, combo, scoringMode))
    .filter(
      (result): result is EvaluationCombinationResult =>
        result !== null && result.deltaScore > 0 && result.buyPrice <= maxBudget
    );

  return dedupeCombinationResults(results)
    .sort(compareCombinationResult);
}

export function scoreReplacementRatio(
  character: CharacterState,
  replacedSlot: AccessorySlot,
  candidate: AccessoryCandidate,
  scoringMode?: AccessoryScoringMode
): number {
  const nextAccessories = {
    ...character.accessories,
    [replacedSlot]: {
      ...candidate,
      slot: replacedSlot
    }
  };

  if ((scoringMode ?? (character.lopec?.simulator?.profile.supportCheck ? "support" : "dealer")) === "support") {
    return (
      scoreAttackRatio(character, nextAccessories) *
      scoreSupportBuffRatio(character.accessories, nextAccessories)
    );
  }

  return (
    scoreAttackRatio(character, nextAccessories) *
    scoreAdditionalDamageRatio(character, nextAccessories) *
    scoreEnemyAndCritRatio(character, nextAccessories) *
    scoreEnlightenmentRatio(character, replacedSlot, candidate)
  );
}

interface CombinationBeam {
  replacements: EvaluationCombinationReplacement[];
  buyPrice: number;
  estimatedDeltaScore: number;
  usedCandidateKeys: Set<string>;
}

interface SlotCandidateSet {
  slot: AccessorySlot;
  candidates: EvaluationResult[];
}

function createScoringCharacter(
  character: CharacterState,
  scoringMode?: AccessoryScoringMode,
  targetWeaponAttack?: number | null,
  targetArmorMainStats?: ArmorMainStats | null
): CharacterState {
  const nextWeaponAttack =
    targetWeaponAttack && targetWeaponAttack > 0 ? targetWeaponAttack : null;
  const nextArmorMainStat = targetArmorMainStats
    ? sumArmorMainStats(targetArmorMainStats)
    : null;
  const hasWeaponChange =
    nextWeaponAttack !== null && nextWeaponAttack !== character.scoreContext.weaponAttack;
  const hasArmorChange =
    nextArmorMainStat !== null &&
    nextArmorMainStat > 0 &&
    nextArmorMainStat !== character.scoreContext.armorMainStat;

  if (!hasWeaponChange && !hasArmorChange) {
    return character;
  }

  const equipmentSimulation = createLopecEquipmentSimulation(
    character,
    {
      weaponAttack: hasWeaponChange ? nextWeaponAttack : null,
      armorMainStats: hasArmorChange ? targetArmorMainStats : null
    },
    scoringMode
  );

  return {
    ...character,
    profileAttack: character.profileAttack,
    scoreContext: {
      ...character.scoreContext,
      weaponAttack:
        hasWeaponChange && nextWeaponAttack
          ? nextWeaponAttack
          : character.scoreContext.weaponAttack,
      armorMainStat:
        hasArmorChange && nextArmorMainStat
          ? nextArmorMainStat
          : character.scoreContext.armorMainStat
    },
    lopec:
      equipmentSimulation && character.lopec
        ? {
            ...character.lopec,
            score: equipmentSimulation.score,
            simulator: equipmentSimulation.simulator
          }
        : character.lopec
  };
}

function buildSingleReplacementBeams(candidatesBySlot: SlotCandidateSet[]): CombinationBeam[] {
  return candidatesBySlot.flatMap((slotCandidates) =>
    slotCandidates.candidates.map((candidateResult) =>
      appendCandidateToCombination(createEmptyCombinationBeam(), candidateResult)
    )
  );
}

function buildExhaustiveCombinationBeams(
  candidatesBySlot: SlotCandidateSet[],
  maxBudget: number
): CombinationBeam[] {
  let combinations: CombinationBeam[] = [createEmptyCombinationBeam()];

  for (const slotCandidates of candidatesBySlot) {
    combinations = expandCombinationBeams(
      combinations,
      readCombinationCandidates(slotCandidates),
      maxBudget
    );
  }

  return combinations;
}

function buildBeamCombinationBeams(
  candidatesBySlot: SlotCandidateSet[],
  maxBudget: number
): CombinationBeam[] {
  let beam: CombinationBeam[] = [createEmptyCombinationBeam()];

  for (const slotCandidates of candidatesBySlot) {
    beam = expandCombinationBeams(beam, readCombinationCandidates(slotCandidates), maxBudget)
      .sort(compareCombinationBeam)
      .slice(0, MAX_COMBINATION_BEAM);
  }

  return beam;
}

function expandCombinationBeams(
  combinations: CombinationBeam[],
  candidates: EvaluationResult[],
  maxBudget: number
): CombinationBeam[] {
  const nextCombinations: CombinationBeam[] = [...combinations];

  for (const combo of combinations) {
    for (const candidateResult of candidates) {
      const candidateKey = readCandidateKey(candidateResult.candidate);

      if (
        combo.usedCandidateKeys.has(candidateKey) ||
        combo.buyPrice + candidateResult.buyPrice > maxBudget
      ) {
        continue;
      }

      nextCombinations.push(appendCandidateToCombination(combo, candidateResult));
    }
  }

  return dedupeCombinationBeams(nextCombinations);
}

function readCombinationCandidates(slotCandidates: SlotCandidateSet): EvaluationResult[] {
  return slotCandidates.candidates.slice(0, MAX_CANDIDATES_PER_SLOT);
}

function createEmptyCombinationBeam(): CombinationBeam {
  return {
    replacements: [],
    buyPrice: 0,
    estimatedDeltaScore: 0,
    usedCandidateKeys: new Set()
  };
}

function appendCandidateToCombination(
  combo: CombinationBeam,
  candidateResult: EvaluationResult
): CombinationBeam {
  const candidateKey = readCandidateKey(candidateResult.candidate);

  return {
    replacements: [
      ...combo.replacements,
      {
        candidate: candidateResult.candidate,
        replacedSlot: candidateResult.replacedSlot,
        replacedAccessory: candidateResult.replacedAccessory,
        buyPrice: candidateResult.buyPrice,
        deltaScore: candidateResult.deltaScore
      }
    ],
    buyPrice: combo.buyPrice + candidateResult.buyPrice,
    estimatedDeltaScore: combo.estimatedDeltaScore + candidateResult.deltaScore,
    usedCandidateKeys: new Set([...combo.usedCandidateKeys, candidateKey])
  };
}

function buildCombinationResult(
  character: CharacterState,
  combo: CombinationBeam,
  scoringMode?: AccessoryScoringMode
): EvaluationCombinationResult | null {
  const baseScore = character.lopec?.score ?? character.combatPower;
  const exactScore = calculateExactLopecReplacementSet(
    character,
    combo.replacements.map((replacement) => ({
      replacedSlot: replacement.replacedSlot,
      candidate: replacement.candidate
    })),
    scoringMode
  );
  const nextScore =
    exactScore?.nextScore ?? round2(baseScore + combo.estimatedDeltaScore);
  const deltaScore = exactScore?.deltaScore ?? round2(nextScore - baseScore);
  const deltaEfficiency =
    exactScore?.deltaEfficiency ?? round3((deltaScore / baseScore) * 100);

  if (combo.buyPrice <= 0) {
    return null;
  }

  return {
    replacements: combo.replacements,
    baseScore,
    nextScore,
    deltaScore,
    deltaEfficiency,
    buyPrice: combo.buyPrice,
    scorePerGold: deltaScore > 0 ? deltaScore / combo.buyPrice : 0,
    goldPerScore: deltaScore > 0 ? combo.buyPrice / deltaScore : Number.POSITIVE_INFINITY
  };
}

function normalizeTargetSlots(
  character: CharacterState,
  targetSlots: AccessorySlot[]
): AccessorySlot[] {
  const seen = new Set<AccessorySlot>();

  return targetSlots.filter((slot) => {
    if (seen.has(slot) || !character.accessories[slot]) {
      return false;
    }

    seen.add(slot);
    return true;
  });
}

function slotToAccessoryType(slot: AccessorySlot): AccessoryType {
  if (slot === "necklace") {
    return "necklace";
  }

  if (slot === "earring1" || slot === "earring2") {
    return "earring";
  }

  return "ring";
}

function compareSingleReplacementForCombination(
  a: EvaluationResult,
  b: EvaluationResult
): number {
  return (
    compareNumberDesc(a.deltaScore, b.deltaScore) ||
    compareNumberAsc(a.goldPerScore, b.goldPerScore) ||
    compareNumberAsc(a.buyPrice, b.buyPrice)
  );
}

function compareCombinationBeam(a: CombinationBeam, b: CombinationBeam): number {
  const aGoldPerScore =
    a.estimatedDeltaScore > 0 ? a.buyPrice / a.estimatedDeltaScore : Number.POSITIVE_INFINITY;
  const bGoldPerScore =
    b.estimatedDeltaScore > 0 ? b.buyPrice / b.estimatedDeltaScore : Number.POSITIVE_INFINITY;

  return (
    compareNumberDesc(a.estimatedDeltaScore, b.estimatedDeltaScore) ||
    compareNumberAsc(aGoldPerScore, bGoldPerScore) ||
    compareNumberAsc(a.buyPrice, b.buyPrice)
  );
}

function compareCombinationResult(
  a: EvaluationCombinationResult,
  b: EvaluationCombinationResult
): number {
  return (
    compareNumberDesc(a.deltaScore, b.deltaScore) ||
    compareNumberAsc(a.goldPerScore, b.goldPerScore) ||
    compareNumberAsc(a.buyPrice, b.buyPrice)
  );
}

function compareNumberAsc(a: number, b: number): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}

function compareNumberDesc(a: number, b: number): number {
  if (a === b) {
    return 0;
  }

  return a > b ? -1 : 1;
}

function dedupeCombinationBeams(combos: CombinationBeam[]): CombinationBeam[] {
  const bestByKey = new Map<string, CombinationBeam>();

  for (const combo of combos) {
    const key = createCombinationIdentityKey(combo.replacements);
    const current = bestByKey.get(key);

    if (!current || compareCombinationBeam(combo, current) < 0) {
      bestByKey.set(key, combo);
    }
  }

  return Array.from(bestByKey.values());
}

function dedupeCombinationResults(
  results: EvaluationCombinationResult[]
): EvaluationCombinationResult[] {
  const bestByKey = new Map<string, EvaluationCombinationResult>();

  for (const result of results) {
    const key = createCombinationIdentityKey(result.replacements);
    const current = bestByKey.get(key);

    if (!current || compareCombinationResult(result, current) < 0) {
      bestByKey.set(key, result);
    }
  }

  return Array.from(bestByKey.values());
}

function createCombinationIdentityKey(replacements: EvaluationCombinationReplacement[]): string {
  const consumedSlots = new Set<AccessorySlot>();
  const parts: string[] = [];

  for (const group of SWAPPABLE_SLOT_GROUPS) {
    const groupReplacements = replacements.filter((replacement) =>
      group.includes(replacement.replacedSlot)
    );

    if (groupReplacements.length !== group.length) {
      continue;
    }

    const type = slotToAccessoryType(group[0]);
    const candidateKeys = groupReplacements
      .map((replacement) => readCandidateKey(replacement.candidate))
      .sort();

    parts.push(`${type}:${candidateKeys.join("+")}`);
    group.forEach((slot) => consumedSlots.add(slot));
  }

  for (const replacement of replacements) {
    if (consumedSlots.has(replacement.replacedSlot)) {
      continue;
    }

    parts.push(`${replacement.replacedSlot}:${readCandidateKey(replacement.candidate)}`);
  }

  return parts.sort().join("|");
}

function readCandidateKey(candidate: AccessoryCandidate): string {
  return [
    candidate.auctionId,
    candidate.name,
    candidate.buyPrice ?? 0,
    candidate.endDate,
    candidate.quality,
    candidate.tradeAllowCount,
    candidate.stats.strength,
    candidate.stats.dexterity,
    candidate.stats.intelligence,
    candidate.refinementOptions
      .map((option) => `${option.label}:${option.value}${option.suffix}`)
      .join("|")
  ].join("::");
}

function scoreAttackRatio(
  character: CharacterState,
  nextAccessories: Record<AccessorySlot, AccessoryState>
): number {
  const currentAccessories = character.accessories;
  const currentAttack = character.lopec?.attack ?? character.profileAttack;

  if (currentAttack <= 0) {
    return 1;
  }

  const currentTotals = summarizeAttackInputs(currentAccessories);
  const nextTotals = summarizeAttackInputs(nextAccessories);
  const context = character.scoreContext;
  const currentAccessoryStat = sumAccessoryMainStats(currentAccessories);
  const nextAccessoryStat = sumAccessoryMainStats(nextAccessories);
  const currentStatBase = context.armorMainStat + currentAccessoryStat;
  const nextStatBase = context.armorMainStat + nextAccessoryStat;
  const currentWeaponBase = context.weaponAttack + currentTotals.weaponAttackFlat;
  const nextWeaponBase = context.weaponAttack + nextTotals.weaponAttackFlat;

  if (currentStatBase <= 0 || nextStatBase <= 0 || currentWeaponBase <= 0 || nextWeaponBase <= 0) {
    return scoreAttackOptionRatio(currentAttack, currentTotals, nextTotals, context.arkGridAttackPercent);
  }

  const baseAttackRatio = Math.sqrt(
    (nextStatBase / currentStatBase) *
      (nextWeaponBase / currentWeaponBase) *
      (percentFactor(nextTotals.weaponAttackPercent) / percentFactor(currentTotals.weaponAttackPercent))
  );

  return scoreAttackOptionRatio(
    currentAttack,
    currentTotals,
    nextTotals,
    context.arkGridAttackPercent,
    baseAttackRatio
  );
}

function scoreAttackOptionRatio(
  currentAttack: number,
  currentTotals: AttackInputs,
  nextTotals: AttackInputs,
  constantAttackPercent: number,
  baseAttackRatio = 1
): number {
  const constantFactor = percentFactor(constantAttackPercent);
  const currentAttackPercentFactor = percentFactor(currentTotals.attackPowerPercent);
  const nextAttackPercentFactor = percentFactor(nextTotals.attackPowerPercent);
  const currentBaseAttack =
    currentAttack / constantFactor / currentAttackPercentFactor - currentTotals.attackPowerFlat;
  const nextAttack =
    (currentBaseAttack * baseAttackRatio + nextTotals.attackPowerFlat) *
    constantFactor *
    nextAttackPercentFactor;

  return nextAttack > 0 ? nextAttack / currentAttack : 1;
}

function scoreAdditionalDamageRatio(
  character: CharacterState,
  nextAccessories: Record<AccessorySlot, AccessoryState>
): number {
  const baseAdditionalDamage =
    10 +
    0.002 * character.scoreContext.weaponQuality ** 2 +
    character.scoreContext.arkGridAdditionalDamage;
  const currentValue = character.accessories.necklace.effects.additionalDamage;
  const nextValue = nextAccessories.necklace.effects.additionalDamage;

  return (
    (1 + (baseAdditionalDamage + nextValue) / 100) /
    (1 + (baseAdditionalDamage + currentValue) / 100)
  );
}

function scoreEnemyAndCritRatio(
  character: CharacterState,
  nextAccessories: Record<AccessorySlot, AccessoryState>
): number {
  const current =
    accessoryDealerDamageFactor(character.accessories.necklace) *
    accessoryDealerDamageFactor(character.accessories.ring1) *
    accessoryDealerDamageFactor(character.accessories.ring2);
  const next =
    accessoryDealerDamageFactor(nextAccessories.necklace) *
    accessoryDealerDamageFactor(nextAccessories.ring1) *
    accessoryDealerDamageFactor(nextAccessories.ring2);

  return current > 0 ? next / current : 1;
}

function scoreEnlightenmentRatio(
  character: CharacterState,
  replacedSlot: AccessorySlot,
  candidate: AccessoryCandidate
): number {
  const currentPoints =
    character.lopec?.enlightenmentPoints ?? character.scoreContext.enlightenmentPoints;

  if (currentPoints <= 0) {
    return 1;
  }

  const nextPoints =
    currentPoints -
    character.accessories[replacedSlot].effects.enlightenment +
    candidate.effects.enlightenment;

  return enlightenmentFactor(nextPoints) / enlightenmentFactor(currentPoints);
}

interface AttackInputs {
  attackPowerFlat: number;
  attackPowerPercent: number;
  weaponAttackFlat: number;
  weaponAttackPercent: number;
}

function summarizeAttackInputs(accessories: Record<AccessorySlot, AccessoryState>): AttackInputs {
  return Object.values(accessories).reduce(
    (totals, accessory) => ({
      attackPowerFlat: totals.attackPowerFlat + accessory.effects.attackPowerFlat,
      attackPowerPercent: totals.attackPowerPercent + accessory.effects.attackPowerPercent,
      weaponAttackFlat: totals.weaponAttackFlat + accessory.effects.weaponAttackFlat,
      weaponAttackPercent: totals.weaponAttackPercent + accessory.effects.weaponAttackPercent
    }),
    {
      attackPowerFlat: 0,
      attackPowerPercent: 0,
      weaponAttackFlat: 0,
      weaponAttackPercent: 0
    }
  );
}

function sumAccessoryMainStats(accessories: Record<AccessorySlot, AccessoryState>): number {
  return Object.values(accessories).reduce(
    (sum, accessory) => sum + totalMainStat(accessory.stats),
    0
  );
}

function accessoryDealerDamageFactor(accessory: Pick<AccessoryState, "effects">): number {
  return (
    (1 + accessory.effects.enemyDamage / 100) *
    (1 + accessory.effects.critRate * 0.00684) *
    (1 + accessory.effects.critDamage * 0.003625)
  );
}

function scoreSupportBuffRatio(
  currentAccessories: Record<AccessorySlot, AccessoryState>,
  nextAccessories: Record<AccessorySlot, AccessoryState>
): number {
  const currentBrand = supportBrandFactor(currentAccessories.necklace.effects.brandPower);
  const nextBrand = supportBrandFactor(nextAccessories.necklace.effects.brandPower);
  const currentIdentity = supportPercentFactor(currentAccessories.necklace.effects.identityGauge);
  const nextIdentity = supportPercentFactor(nextAccessories.necklace.effects.identityGauge);
  const currentAllyAttack =
    supportPercentFactor(currentAccessories.ring1.effects.allyAttackBuff) *
    supportPercentFactor(currentAccessories.ring2.effects.allyAttackBuff);
  const nextAllyAttack =
    supportPercentFactor(nextAccessories.ring1.effects.allyAttackBuff) *
    supportPercentFactor(nextAccessories.ring2.effects.allyAttackBuff);
  const currentAllyDamage =
    supportPercentFactor(currentAccessories.ring1.effects.allyDamageBuff) *
    supportPercentFactor(currentAccessories.ring2.effects.allyDamageBuff);
  const nextAllyDamage =
    supportPercentFactor(nextAccessories.ring1.effects.allyDamageBuff) *
    supportPercentFactor(nextAccessories.ring2.effects.allyDamageBuff);

  return (
    (nextBrand / currentBrand) *
    (nextIdentity / currentIdentity) *
    (nextAllyAttack / currentAllyAttack) *
    (nextAllyDamage / currentAllyDamage)
  );
}

function supportBrandFactor(accessoryBrandPower: number): number {
  return 1 + (10 * (1 + accessoryBrandPower / 100)) / 100;
}

function supportPercentFactor(value: number): number {
  return 1 + value / 100;
}

function enlightenmentFactor(points: number): number {
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

function percentFactor(value: number): number {
  return 1 + value / 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
