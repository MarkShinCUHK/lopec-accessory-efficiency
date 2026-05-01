import {
  ACCESSORY_CATEGORY_CODES,
  parseAccessoryFromAuctionItem,
  type AccessoryCandidate,
  type AccessoryScoringMode,
  type AccessoryType
} from "@/lib/domain/accessory";
import { requestLostarkApi } from "@/lib/lostark/client";
import type {
  LostarkAuctionSearchRequest,
  LostarkAuctionSearchResponse
} from "@/lib/lostark/types";

export interface AuctionAccessorySearchParams {
  type: AccessoryType;
  itemTier: number;
  itemGrade: string;
  minQuality: number | null;
  maxPrice: number | null;
  selectedEffectGrades: AuctionEffectGradeFilter[];
  excludedEffectOptions: AuctionEffectOptionId[];
  searchMode: "optionTarget" | "priceTarget";
  scoringMode?: AccessoryScoringMode;
  apiKey?: string | null;
  progress?: AuctionSearchProgress;
}

export interface AuctionSearchProgress {
  progressId?: string | null;
  completedRequests: number;
  totalRequests: number;
  totalSearchPlans?: number;
  planEstimates?: Map<string, number>;
  onEstimate?: (event: AuctionSearchProgressEvent) => void;
  onPageComplete?: (event: AuctionSearchProgressEvent) => void;
  onRateLimit?: (event: AuctionSearchRateLimitEvent) => void;
}

export interface AuctionSearchProgressEvent {
  progressId?: string | null;
  completedRequests: number;
  totalRequests: number;
  type: AccessoryType;
  pageNo: number;
}

export interface AuctionSearchRateLimitEvent extends AuctionSearchProgressEvent {
  retryAttempt: number;
  retryDelayMs: number;
}

export type AuctionEffectOptionId =
  | "additionalDamage"
  | "enemyDamage"
  | "attackPowerPercent"
  | "weaponAttackPercent"
  | "weaponAttackFlat"
  | "critRate"
  | "critDamage"
  | "brandPower"
  | "identityGauge"
  | "allyAttackBuff"
  | "allyDamageBuff"
  | "partyShield"
  | "partyHeal";

export type AuctionEffectGrade = "상" | "중" | "하";

export interface AuctionEffectGradeFilter {
  effect: AuctionEffectOptionId;
  grade: AuctionEffectGrade;
}

const EFFECT_OPTION_FILTERS: Record<
  AuctionEffectOptionId,
  {
    firstOption: number;
    secondOption: number;
  }
> = {
  additionalDamage: {
    firstOption: 7,
    secondOption: 41
  },
  enemyDamage: {
    firstOption: 7,
    secondOption: 42
  },
  attackPowerPercent: {
    firstOption: 7,
    secondOption: 45
  },
  weaponAttackPercent: {
    firstOption: 7,
    secondOption: 46
  },
  weaponAttackFlat: {
    firstOption: 7,
    secondOption: 54
  },
  critRate: {
    firstOption: 7,
    secondOption: 49
  },
  critDamage: {
    firstOption: 7,
    secondOption: 50
  },
  brandPower: {
    firstOption: 7,
    secondOption: 44
  },
  identityGauge: {
    firstOption: 7,
    secondOption: 43
  },
  allyAttackBuff: {
    firstOption: 7,
    secondOption: 51
  },
  allyDamageBuff: {
    firstOption: 7,
    secondOption: 52
  },
  partyShield: {
    firstOption: 7,
    secondOption: 48
  },
  partyHeal: {
    firstOption: 7,
    secondOption: 47
  }
};

const EFFECT_GRADE_VALUES: Record<AuctionEffectOptionId, Record<AuctionEffectGrade, number>> = {
  additionalDamage: {
    하: 0.7,
    중: 1.6,
    상: 2.6
  },
  enemyDamage: {
    하: 0.55,
    중: 1.2,
    상: 2
  },
  attackPowerPercent: {
    하: 0.4,
    중: 0.95,
    상: 1.55
  },
  weaponAttackPercent: {
    하: 0.8,
    중: 1.8,
    상: 3
  },
  weaponAttackFlat: {
    하: 195,
    중: 480,
    상: 960
  },
  critRate: {
    하: 0.4,
    중: 0.95,
    상: 1.55
  },
  critDamage: {
    하: 1.1,
    중: 2.4,
    상: 4
  },
  brandPower: {
    하: 2.15,
    중: 4.8,
    상: 8
  },
  identityGauge: {
    하: 1.6,
    중: 3.6,
    상: 6
  },
  allyAttackBuff: {
    하: 1.35,
    중: 3,
    상: 5
  },
  allyDamageBuff: {
    하: 2,
    중: 4.5,
    상: 7.5
  },
  partyShield: {
    하: 0.95,
    중: 2.1,
    상: 3.5
  },
  partyHeal: {
    하: 0.95,
    중: 2.1,
    상: 3.5
  }
};

const CORE_EFFECTS_BY_SCORING_MODE: Record<
  AccessoryScoringMode,
  Record<AccessoryType, AuctionEffectOptionId[]>
> = {
  dealer: {
    necklace: ["enemyDamage", "additionalDamage"],
    earring: ["attackPowerPercent", "weaponAttackPercent"],
    ring: ["critDamage", "critRate"]
  },
  support: {
    necklace: ["brandPower", "identityGauge"],
    earring: ["weaponAttackPercent", "weaponAttackFlat"],
    ring: ["allyAttackBuff", "allyDamageBuff"]
  }
};

interface AuctionEffectFilter {
  firstOption: number;
  secondOption: number;
  value: number;
}

interface AuctionSearchPlan {
  selectedEffectGrades: AuctionEffectGradeFilter[];
  excludedEffectOptions: AuctionEffectOptionId[];
  effectFilters: AuctionEffectFilter[];
}

export async function searchAccessoryCandidates(
  params: AuctionAccessorySearchParams
): Promise<AccessoryCandidate[]> {
  const results: AccessoryCandidate[] = [];
  const seenCandidateKeys = new Set<string>();
  const searchPlans = buildSearchPlans(params);

  for (const searchPlan of searchPlans) {
    const candidates = await searchAccessoryCandidatesByPlan(params, searchPlan);

    for (const candidate of candidates) {
      const key = createCandidateKey(candidate);

      if (seenCandidateKeys.has(key)) {
        continue;
      }

      seenCandidateKeys.add(key);
      results.push(candidate);
    }
  }

  return results;
}

async function searchAccessoryCandidatesByPlan(
  params: AuctionAccessorySearchParams,
  searchPlan: AuctionSearchPlan
): Promise<AccessoryCandidate[]> {
  const results: AccessoryCandidate[] = [];
  let pageNo = 1;
  let totalPages: number | null = null;
  let firstObservedBuyPrice: number | null = null;
  let lastObservedBuyPrice: number | null = null;
  let observedPricedItemCount = 0;

  while (totalPages === null || pageNo <= totalPages) {
    const body: LostarkAuctionSearchRequest = {
      Sort: "BUY_PRICE",
      CategoryCode: ACCESSORY_CATEGORY_CODES[params.type],
      CharacterClass: null,
      ItemTier: params.itemTier,
      ItemGrade: params.itemGrade,
      ItemName: null,
      PageNo: pageNo,
      SortCondition: "ASC",
      ItemGradeQuality: params.minQuality,
      SkillOptions: [],
      EtcOptions: searchPlan.effectFilters.map((effectFilter) => ({
        FirstOption: effectFilter.firstOption,
        SecondOption: effectFilter.secondOption,
        MinValue: effectFilter.value,
        MaxValue: effectFilter.value
      }))
    };

    const response = await requestLostarkApi<LostarkAuctionSearchResponse>(
      "/auctions/items",
      {
        method: "POST",
        body,
        apiKey: params.apiKey,
        rotateApiKeysOnRateLimit: true,
        maxRetryMs: 10 * 60 * 1000,
        maxRetries: 1000,
        onRateLimit: (event) => {
          params.progress?.onRateLimit?.({
            progressId: params.progress.progressId,
            completedRequests: params.progress.completedRequests,
            totalRequests: params.progress.totalRequests,
            type: params.type,
            pageNo,
            retryAttempt: event.attempt,
            retryDelayMs: event.delayMs
          });
        }
      }
    );
    const items = response.data.Items ?? [];
    const pageSize = Math.max(response.data.PageSize || items.length || 1, 1);
    totalPages = Math.ceil(response.data.TotalCount / pageSize);
    const buyPrices = readPageBuyPrices(items);

    if (buyPrices.length > 0) {
      firstObservedBuyPrice ??= buyPrices[0];
      lastObservedBuyPrice = buyPrices[buyPrices.length - 1];
      observedPricedItemCount += buyPrices.length;
    }

    if (items.length === 0) {
      updateEstimatedProgressTotal(params, searchPlan, pageNo, pageNo);
      markProgressPageComplete(params, pageNo);
      break;
    }

    const shouldStopAfterPage =
      params.maxPrice !== null &&
      items.some((item) => {
        const buyPrice = item.AuctionInfo.BuyPrice;
        return buyPrice !== null && buyPrice > params.maxPrice!;
      });
    const mayRequestNextPage = !shouldStopAfterPage && pageNo < totalPages;
    const estimatedPlanRequests = estimatePlanRequestCount(params, {
      firstObservedBuyPrice,
      lastObservedBuyPrice,
      mayRequestNextPage,
      observedPricedItemCount,
      pageNo,
      pageSize,
      shouldStopAfterPage,
      totalPages
    });

    updateEstimatedProgressTotal(params, searchPlan, estimatedPlanRequests, pageNo);
    markProgressPageComplete(params, pageNo);

    const candidates = items
      .map((item) => parseAccessoryFromAuctionItem(item, params.type))
      .filter((item) => hasSelectedEffectGrades(item, searchPlan.selectedEffectGrades))
      .filter((item) => hasExcludedEffectOptions(item, searchPlan.excludedEffectOptions))
      .filter((item) => item.buyPrice !== null)
      .filter((item) =>
        params.maxPrice !== null ? (item.buyPrice ?? 0) <= params.maxPrice : true
      );

    results.push(...candidates);

    if (shouldStopAfterPage) {
      break;
    }

    pageNo += 1;
  }

  return results;
}

function buildSearchPlans(params: AuctionAccessorySearchParams): AuctionSearchPlan[] {
  if (params.searchMode === "priceTarget") {
    return getCoreEffects(params.scoringMode, params.type).map((effect) => {
      const selectedEffectGrades: AuctionEffectGradeFilter[] = [{ effect, grade: "상" }];

      return {
        selectedEffectGrades,
        excludedEffectOptions: [],
        effectFilters: buildEffectFilters(selectedEffectGrades)
      };
    });
  }

  const selectedEffectGrades = normalizeSelectedEffectGrades(params);
  const excludedEffectOptions = normalizeExcludedEffectOptions(params);

  return [{
    selectedEffectGrades,
    excludedEffectOptions,
    effectFilters: buildEffectFilters(selectedEffectGrades)
  }];
}

export function estimateInitialAuctionRequestCount(
  params: Pick<AuctionAccessorySearchParams, "searchMode" | "type" | "scoringMode">
): number {
  return params.searchMode === "priceTarget"
    ? getCoreEffects(params.scoringMode, params.type).length
    : 1;
}

function updateEstimatedProgressTotal(
  params: AuctionAccessorySearchParams,
  searchPlan: AuctionSearchPlan,
  estimatedPlanRequests: number,
  pageNo: number
): void {
  const progress = params.progress;

  if (!progress) {
    return;
  }

  progress.planEstimates ??= new Map<string, number>();

  const planKey = createSearchPlanProgressKey(params, searchPlan);
  const previousPlanEstimate = progress.planEstimates.get(planKey) ?? 1;
  const nextPlanEstimate = Math.max(Math.ceil(estimatedPlanRequests), pageNo, 1);

  progress.planEstimates.set(planKey, nextPlanEstimate);

  const observedPlanEstimates = Array.from(progress.planEstimates.values());
  const observedPlanTotal = observedPlanEstimates.reduce((total, estimate) => total + estimate, 0);
  const observedPlanCount = observedPlanEstimates.length;
  const totalSearchPlans = Math.max(
    progress.totalSearchPlans ?? progress.totalRequests,
    observedPlanCount,
    1
  );
  const unobservedPlanCount = Math.max(totalSearchPlans - observedPlanCount, 0);
  const fallbackPlanEstimate = Math.max(...observedPlanEstimates, nextPlanEstimate, previousPlanEstimate, 1);
  const estimatedTotal = Math.max(
    progress.completedRequests + 1,
    progress.totalRequests + nextPlanEstimate - previousPlanEstimate,
    observedPlanTotal + unobservedPlanCount * fallbackPlanEstimate
  );

  if (estimatedTotal === progress.totalRequests) {
    return;
  }

  progress.totalRequests = estimatedTotal;
  progress.onEstimate?.({
    progressId: progress.progressId,
    completedRequests: progress.completedRequests,
    totalRequests: progress.totalRequests,
    type: params.type,
    pageNo
  });
}

interface PlanRequestEstimateContext {
  firstObservedBuyPrice: number | null;
  lastObservedBuyPrice: number | null;
  mayRequestNextPage: boolean;
  observedPricedItemCount: number;
  pageNo: number;
  pageSize: number;
  shouldStopAfterPage: boolean;
  totalPages: number;
}

function estimatePlanRequestCount(
  params: AuctionAccessorySearchParams,
  context: PlanRequestEstimateContext
): number {
  const totalPages = Math.max(context.totalPages, context.pageNo);

  if (params.maxPrice === null) {
    return totalPages;
  }

  if (context.shouldStopAfterPage || !context.mayRequestNextPage) {
    return context.pageNo;
  }

  const { firstObservedBuyPrice, lastObservedBuyPrice, observedPricedItemCount } = context;

  if (
    firstObservedBuyPrice !== null &&
    lastObservedBuyPrice !== null &&
    lastObservedBuyPrice > firstObservedBuyPrice &&
    observedPricedItemCount > 1 &&
    params.maxPrice > lastObservedBuyPrice
  ) {
    const pricePerItem =
      (lastObservedBuyPrice - firstObservedBuyPrice) / (observedPricedItemCount - 1);
    const estimatedItemsUnderPrice =
      Math.ceil((params.maxPrice - firstObservedBuyPrice) / pricePerItem) + 1;
    const estimatedPages = Math.ceil(estimatedItemsUnderPrice / context.pageSize);

    return clampNumber(estimatedPages, context.pageNo + 1, totalPages);
  }

  return Math.min(context.pageNo + 1, totalPages);
}

function readPageBuyPrices(items: LostarkAuctionSearchResponse["Items"]): number[] {
  return (items ?? [])
    .map((item) => item.AuctionInfo.BuyPrice)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));
}

function createSearchPlanProgressKey(
  params: AuctionAccessorySearchParams,
  searchPlan: AuctionSearchPlan
): string {
  return [
    params.type,
    searchPlan.effectFilters
      .map((filter) => `${filter.firstOption}:${filter.secondOption}:${filter.value}`)
      .join(","),
    searchPlan.excludedEffectOptions.join(",")
  ].join("|");
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function markProgressPageComplete(params: AuctionAccessorySearchParams, pageNo: number): void {
  const progress = params.progress;

  if (!progress) {
    return;
  }

  progress.completedRequests += 1;
  progress.onPageComplete?.({
    progressId: progress.progressId,
    completedRequests: progress.completedRequests,
    totalRequests: progress.totalRequests,
    type: params.type,
    pageNo
  });
}

function buildEffectFilters(selectedEffectGrades: AuctionEffectGradeFilter[]): AuctionEffectFilter[] {
  return selectedEffectGrades.flatMap(({ effect, grade }) => {
    const option = EFFECT_OPTION_FILTERS[effect];
    const value = readAuctionEffectGradeValue(effect, grade);

    if (!option || value === undefined) {
      return [];
    }

    return [{
      ...option,
      value
    }];
  });
}

function normalizeSelectedEffectGrades(
  params: AuctionAccessorySearchParams
): AuctionEffectGradeFilter[] {
  if (Array.isArray(params.selectedEffectGrades) && params.selectedEffectGrades.length > 0) {
    return params.selectedEffectGrades.filter(
      (item) => EFFECT_OPTION_FILTERS[item.effect] && EFFECT_GRADE_VALUES[item.effect]?.[item.grade]
    );
  }

  return [];
}

function normalizeExcludedEffectOptions(
  params: AuctionAccessorySearchParams
): AuctionEffectOptionId[] {
  if (!Array.isArray(params.excludedEffectOptions)) {
    return [];
  }

  return params.excludedEffectOptions.filter((effect) => EFFECT_OPTION_FILTERS[effect]);
}

function hasSelectedEffectGrades(
  candidate: AccessoryCandidate,
  selectedEffectGrades: AuctionEffectGradeFilter[]
): boolean {
  return selectedEffectGrades.every(({ effect, grade }) =>
    isSameEffectValue(readCandidateEffectValue(candidate, effect), EFFECT_GRADE_VALUES[effect][grade])
  );
}

function hasExcludedEffectOptions(
  candidate: AccessoryCandidate,
  excludedEffectOptions: AuctionEffectOptionId[]
): boolean {
  return excludedEffectOptions.every((effect) => readCandidateEffectValue(candidate, effect) <= 0);
}

function createCandidateKey(candidate: AccessoryCandidate): string {
  return [
    candidate.auctionId,
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

function readAuctionEffectGradeValue(
  effect: AuctionEffectOptionId,
  grade: AuctionEffectGrade
): number | undefined {
  const value = EFFECT_GRADE_VALUES[effect]?.[grade];

  if (value === undefined) {
    return undefined;
  }

  return Math.round(value * 100);
}

function readCandidateEffectValue(
  candidate: AccessoryCandidate,
  effect: AuctionEffectOptionId
): number {
  if (effect === "additionalDamage") {
    return candidate.effects.additionalDamage;
  }

  if (effect === "enemyDamage") {
    return candidate.effects.enemyDamage;
  }

  if (effect === "attackPowerPercent") {
    return candidate.effects.attackPowerPercent;
  }

  if (effect === "weaponAttackPercent") {
    return candidate.effects.weaponAttackPercent;
  }

  if (effect === "weaponAttackFlat") {
    return candidate.effects.weaponAttackFlat;
  }

  if (effect === "critRate") {
    return candidate.effects.critRate;
  }

  if (effect === "critDamage") {
    return candidate.effects.critDamage;
  }

  if (effect === "brandPower") {
    return candidate.effects.brandPower;
  }

  if (effect === "identityGauge") {
    return candidate.effects.identityGauge;
  }

  if (effect === "allyAttackBuff") {
    return candidate.effects.allyAttackBuff;
  }

  if (effect === "allyDamageBuff") {
    return candidate.effects.allyDamageBuff;
  }

  if (effect === "partyShield") {
    return candidate.effects.partyShield;
  }

  return candidate.effects.partyHeal;
}

function getCoreEffects(
  scoringMode: AccessoryScoringMode | undefined,
  type: AccessoryType
): AuctionEffectOptionId[] {
  return CORE_EFFECTS_BY_SCORING_MODE[scoringMode ?? "dealer"][type];
}

function isSameEffectValue(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.001;
}
