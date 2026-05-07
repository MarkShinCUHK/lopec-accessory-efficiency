import { NextResponse } from "next/server";
import {
  evaluateCandidates,
  evaluatePriceTargetCombinations
} from "@/lib/domain/evaluation";
import {
  estimateInitialAuctionRequestCount,
  searchAccessoryCandidates,
  type AuctionSearchProgress
} from "@/lib/lostark/auction";
import { getCharacterState } from "@/lib/lostark/armory";
import { LostarkApiError } from "@/lib/lostark/client";
import {
  calculateArmorMainStatsForTarget,
  calculateEquipmentStats,
  createCurrentEquipmentTarget,
  decodeEquipmentTarget,
  encodeEquipmentTarget
} from "@/lib/domain/equipment";
import { readExactLopecDisplayCombatPower } from "@/lib/lopec/exact-score";
import type {
  AccessoryScoringMode,
  AccessorySlot,
  AccessoryType
} from "@/lib/domain/accessory";
import {
  failSearchProgress,
  finishSearchProgress,
  initSearchProgress,
  updateSearchProgress
} from "@/lib/server/search-progress";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface EvaluationApiResponse {
  ok: boolean;
  status?: number;
  message?: string;
  data?: {
    character: ReturnType<typeof buildCharacterSummary>;
    searchedCount: number;
    resultCount: number;
    results: ReturnType<typeof evaluateCandidates>;
    combinationResults?: ReturnType<typeof evaluatePriceTargetCombinations>;
    note: string;
  };
}

interface EvaluateRequestBody {
  characterName?: string;
  accessoryType?: AccessoryType;
  itemTier?: number;
  itemGrade?: string;
  minQuality?: number | null;
  maxPrice?: number | null;
  selectedEffectGrades?: Parameters<typeof searchAccessoryCandidates>[0]["selectedEffectGrades"];
  excludedEffectOptions?: Parameters<typeof searchAccessoryCandidates>[0]["excludedEffectOptions"];
  searchMode?: "optionTarget" | "priceTarget";
  scoringMode?: AccessoryScoringMode;
  targetSlots?: AccessorySlot[];
  targetWeaponLevel?: string | number | null;
  targetArmorLevel?: string | number | null;
  progressId?: string;
  apiKey?: string;
}

const PRICE_TARGET_DEFAULT_SLOTS: AccessorySlot[] = [
  "necklace",
  "earring1",
  "earring2",
  "ring1",
  "ring2"
];
const ACCESSORY_TYPE_LABELS: Record<AccessoryType, string> = {
  necklace: "목걸이",
  earring: "귀걸이",
  ring: "반지"
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EvaluateRequestBody;
    const characterName = body.characterName?.trim();
    const progressId = typeof body.progressId === "string" ? body.progressId : crypto.randomUUID();

    if (!characterName) {
      return NextResponse.json(
        {
          ok: false,
          message: "캐릭터명을 입력하세요."
        },
        { status: 400 }
      );
    }

    const accessoryType = body.accessoryType ?? "necklace";
    const searchMode = body.searchMode === "priceTarget" ? "priceTarget" : "optionTarget";
    const scoringMode = normalizeScoringMode(body.scoringMode);
    const targetSlots =
      searchMode === "priceTarget" ? normalizeTargetSlots(body.targetSlots) : [];
    const initialRequestCount = estimateEvaluateRequestCount(
      searchMode,
      accessoryType,
      targetSlots,
      scoringMode
    );

    initSearchProgress(progressId, initialRequestCount, "캐릭터 정보 확인 중");

    try {
      const result = await evaluateRequest(body, progressId);

      finishSearchProgress(progressId, "검색 완료", result);
      return NextResponse.json(result);
    } catch (error) {
      const message = readEvaluationErrorMessage(error);

      failSearchProgress(progressId, message);
      return NextResponse.json(
        {
          ok: false,
          message
        },
        { status: error instanceof LostarkApiError ? error.status : 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

async function evaluateRequest(
  body: EvaluateRequestBody,
  progressId: string
): Promise<EvaluationApiResponse> {
  const characterName = body.characterName?.trim();

  if (!characterName) {
    return {
      ok: false,
      message: "캐릭터명을 입력하세요."
    };
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : null;
  const accessoryType = body.accessoryType ?? "necklace";
  const searchMode = body.searchMode === "priceTarget" ? "priceTarget" : "optionTarget";
  const requestedScoringMode = normalizeScoringMode(body.scoringMode);
  const maxPrice = normalizeNullableNumber(body.maxPrice);
  const targetSlots =
    searchMode === "priceTarget" ? normalizeTargetSlots(body.targetSlots) : [];
  const initialRequestCount = estimateEvaluateRequestCount(
    searchMode,
    accessoryType,
    targetSlots,
    requestedScoringMode
  );
  const searchProgress = createAuctionProgress(progressId, initialRequestCount);
  const character = await getCharacterState(characterName, apiKey);
  const scoringMode =
    requestedScoringMode ?? (character.lopec?.simulator?.profile.supportCheck ? "support" : "dealer");
  const targetWeaponAttack = readTargetWeaponAttack(character, body.targetWeaponLevel);
  const targetArmorMainStats = readTargetArmorMainStats(character, body.targetArmorLevel);

  updateSearchProgress(progressId, {
    message:
      searchMode === "priceTarget"
        ? `경매장 검색 준비 중 · ${formatAccessoryTypeList(readUniqueAccessoryTypes(targetSlots))}`
        : `경매장 검색 준비 중 · ${ACCESSORY_TYPE_LABELS[accessoryType]}`,
    completedRequests: searchProgress.completedRequests,
    totalRequests: searchProgress.totalRequests
  });

  if (searchMode === "priceTarget") {
    const accessoryTypes = readUniqueAccessoryTypes(targetSlots);
    const candidatesByType: Partial<
      Record<AccessoryType, Awaited<ReturnType<typeof searchAccessoryCandidates>>>
    > = {};
    let searchedCount = 0;

    for (const type of accessoryTypes) {
      const candidates = await searchAccessoryCandidates({
        type,
        itemTier: body.itemTier ?? 4,
        itemGrade: body.itemGrade ?? "고대",
        minQuality: normalizeNullableNumber(body.minQuality),
        maxPrice,
        selectedEffectGrades: [],
        excludedEffectOptions: [],
        searchMode,
        scoringMode,
        apiKey,
        progress: searchProgress
      });

      candidatesByType[type] = candidates;
      searchedCount += candidates.length;
    }

    updateSearchProgress(progressId, {
      status: "running",
      message: "점수 계산 중",
      completedRequests: searchProgress.completedRequests,
      totalRequests: Math.max(
        searchProgress.totalRequests,
        searchProgress.completedRequests + 1
      )
    });

    const combinationResults = evaluatePriceTargetCombinations(
      character,
      candidatesByType,
      targetSlots,
      maxPrice ?? 0,
      scoringMode,
      targetWeaponAttack,
      targetArmorMainStats
    );

    return {
      ok: true,
      data: {
        character: buildCharacterSummary(character),
        searchedCount,
        resultCount: combinationResults.length,
        results: [],
        combinationResults,
        note:
          scoringMode === "support"
            ? "체크한 악세서리 슬롯을 서포터 LOPEC 버프력 기준으로 동시에 바꿨을 때 목표 가격 안에서 점수가 가장 많이 오르는 조합입니다."
            : "체크한 악세서리 슬롯을 바꿨을 때 목표 가격 안에서 점수가 가장 많이 오르는 조합입니다. 로펙점수와 인게임 전투력은 함께 계산됩니다."
      }
    };
  }

  const candidates = await searchAccessoryCandidates({
    type: accessoryType,
    itemTier: body.itemTier ?? 4,
    itemGrade: body.itemGrade ?? "고대",
    minQuality: normalizeNullableNumber(body.minQuality),
    maxPrice,
    selectedEffectGrades: Array.isArray(body.selectedEffectGrades)
      ? body.selectedEffectGrades
      : [],
    excludedEffectOptions: Array.isArray(body.excludedEffectOptions)
      ? body.excludedEffectOptions
      : [],
    searchMode,
    scoringMode,
    apiKey,
    progress: searchProgress
  });

  updateSearchProgress(progressId, {
    status: "running",
    message: "점수 계산 중",
    completedRequests: searchProgress.completedRequests,
    totalRequests: Math.max(searchProgress.totalRequests, searchProgress.completedRequests + 1)
  });

  const results = evaluateCandidates(
    character,
    candidates,
    scoringMode,
    targetWeaponAttack,
    targetArmorMainStats
  );

  return {
    ok: true,
    data: {
      character: buildCharacterSummary(character),
      searchedCount: candidates.length,
      resultCount: results.length,
      results,
      note:
        scoringMode === "support"
          ? "경매장 API에는 상/중/하로 선택한 서포터 핵심 옵션을 직접 넣고, 선택으로 둔 핵심 옵션은 결과에서 제외합니다. 점수는 로펙 서포터 버프력 기준으로 악세 교체 후 낙인력, 아덴 게이지, 아군 공격력/피해량 강화, 공격력 변화를 다시 계산합니다."
          : "경매장 API에는 상/중/하로 선택한 핵심 옵션을 직접 넣고, 선택으로 둔 핵심 옵션은 결과에서 제외합니다. 로펙점수와 인게임 전투력은 악세 교체 후 함께 다시 계산합니다."
    }
  };
}

function readEvaluationErrorMessage(error: unknown): string {
  if (error instanceof LostarkApiError) {
    return error.status === 429
      ? "많은 검색으로 인해 API 제한 대기가 길어졌습니다. 잠시 후 다시 검색해 주세요."
      : "Lostark API 요청에 실패했습니다.";
  }

  return error instanceof Error ? error.message : "요청에 실패했습니다.";
}

function buildCharacterSummary(character: Awaited<ReturnType<typeof getCharacterState>>) {
  return {
    characterName: character.characterName,
    serverName: character.serverName,
    className: character.className,
    itemAvgLevel: character.itemAvgLevel,
    combatPower: readExactLopecDisplayCombatPower(character),
    lopecScore: character.lopec?.score ?? null,
    isSupport: character.lopec?.simulator?.profile.supportCheck ?? false,
    imageUrl: character.imageUrl,
    weapon: character.weapon,
    armor: character.armor,
    accessories: character.accessories
  };
}

function readTargetWeaponAttack(
  character: Awaited<ReturnType<typeof getCharacterState>>,
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
  character: Awaited<ReturnType<typeof getCharacterState>>,
  targetArmorLevel: string | number | null | undefined
) {
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

  return isAlreadyAllTarget ? null : targetStats;
}

function normalizeScoringMode(value: AccessoryScoringMode | undefined): AccessoryScoringMode | null {
  if (value === "dealer" || value === "support") {
    return value;
  }

  return null;
}

function normalizeNullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTargetSlots(value: AccessorySlot[] | undefined): AccessorySlot[] {
  const rawSlots = Array.isArray(value) && value.length > 0 ? value : PRICE_TARGET_DEFAULT_SLOTS;
  const seen = new Set<AccessorySlot>();
  const normalized: AccessorySlot[] = [];

  for (const slot of rawSlots) {
    if (!PRICE_TARGET_DEFAULT_SLOTS.includes(slot) || seen.has(slot)) {
      continue;
    }

    seen.add(slot);
    normalized.push(slot);
  }

  return normalized;
}

function estimateEvaluateRequestCount(
  searchMode: "optionTarget" | "priceTarget",
  accessoryType: AccessoryType,
  targetSlots: AccessorySlot[],
  scoringMode: AccessoryScoringMode | null
): number {
  if (searchMode === "optionTarget") {
    return estimateInitialAuctionRequestCount({
      searchMode,
      type: accessoryType,
      scoringMode: scoringMode ?? "dealer"
    });
  }

  const accessoryTypes = readUniqueAccessoryTypes(targetSlots);

  return Math.max(
    accessoryTypes.reduce(
      (total, type) =>
        total +
        estimateInitialAuctionRequestCount({
          searchMode,
          type,
          scoringMode: scoringMode ?? "dealer"
        }),
      0
    ),
    1
  );
}

function createAuctionProgress(
  progressId: string | null,
  initialRequestCount: number
): AuctionSearchProgress {
  const progress: AuctionSearchProgress = {
    progressId,
    completedRequests: 0,
    totalRequests: Math.max(initialRequestCount, 1),
    totalSearchPlans: Math.max(initialRequestCount, 1),
    planEstimates: new Map<string, number>(),
    onEstimate: (event) => {
      updateSearchProgress(progressId, {
        status: "running",
        completedRequests: event.completedRequests,
        totalRequests: event.totalRequests,
        message: `${formatAuctionProgressTarget(event.type, event.pageNo)} 검색량 계산 중 · 완료 ${event.completedRequests}회, 예상 ${event.totalRequests}회`
      });
    },
    onPageComplete: (event) => {
      updateSearchProgress(progressId, {
        status: "running",
        completedRequests: event.completedRequests,
        totalRequests: event.totalRequests,
        message: `${formatAuctionProgressTarget(event.type, event.pageNo)} 검색 중 · 완료 ${event.completedRequests}회, 예상 ${event.totalRequests}회`
      });
    },
    onRateLimit: (event) => {
      updateSearchProgress(progressId, {
        status: "waiting",
        completedRequests: event.completedRequests,
        totalRequests: event.totalRequests,
        retryAttempt: event.retryAttempt,
        retryDelayMs: event.retryDelayMs,
        message: `API 대기중 · ${formatAuctionProgressTarget(event.type, event.pageNo)}`
      });
    }
  };

  return progress;
}

function readUniqueAccessoryTypes(targetSlots: AccessorySlot[]): AccessoryType[] {
  return Array.from(new Set(targetSlots.map(slotToAccessoryType)));
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

function formatAuctionProgressTarget(type: AccessoryType, pageNo: number): string {
  return `${ACCESSORY_TYPE_LABELS[type]} ${pageNo}페이지`;
}

function formatAccessoryTypeList(types: AccessoryType[]): string {
  return types.map((type) => ACCESSORY_TYPE_LABELS[type]).join(", ");
}
