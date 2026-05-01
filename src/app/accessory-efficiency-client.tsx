"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type AccessoryType = "necklace" | "earring" | "ring";
type AccessorySlot = "necklace" | "earring1" | "earring2" | "ring1" | "ring2";
type OptionGrade = "상" | "중" | "하";
type SearchOptionGrade = "선택" | OptionGrade;
type ResultViewMode = "card" | "table";
type CardSortMode = "goldPerScoreAsc" | "priceAsc" | "deltaScoreDesc";
type TradeCountFilter = "0" | "1" | "2";
type SortDirection = "asc" | "desc";
type SearchMode = "optionTarget" | "priceTarget";
type ScoringMode = "dealer" | "support";
type GraphMode = "priceScore" | "efficiencyScore";
type ThemeMode = "light" | "dark";
type ApiKeyStatus = "idle" | "checking" | "valid" | "invalid";
type TableSortKey = "price" | "tradeCount" | "stat" | "deltaScore" | "goldPerScore" | "efficiency";
type GuideStepId = 1 | 2 | 3 | 4;
type EffectOption =
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

interface AccessoryEffectGrade {
  label: string;
  grade: "상" | "중" | "하" | null;
  value: number;
  suffix: string;
}

interface AccessoryRefinementOption {
  label: string;
  grade: "상" | "중" | "하" | null;
  value: number;
  suffix: string;
  isEffective: boolean;
}

interface AccessoryStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  health: number;
}

interface AccessorySummary {
  slot: string;
  type: AccessoryType;
  name: string;
  grade: string;
  quality: number;
  stats: AccessoryStats;
  effectSummary: string[];
  effectGrades: AccessoryEffectGrade[];
  refinementOptions: AccessoryRefinementOption[];
}

interface CharacterSummary {
  characterName: string;
  serverName: string;
  className: string;
  itemAvgLevel: number;
  combatPower: number;
  lopecScore?: number | null;
  isSupport?: boolean;
  imageUrl?: string | null;
  accessories: Record<string, AccessorySummary>;
}

interface CharacterResponse {
  ok: boolean;
  message?: string;
  data?: CharacterSummary;
}

interface LostarkHealthResponse {
  ok: boolean;
  message?: string;
  rateLimit?: {
    limit: number | null;
    remaining: number | null;
    reset: number | null;
  };
}

interface LopecVerificationStatus {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastDurationMs: number | null;
  lastMessage: string;
  isFresh: boolean;
  isRunning: boolean;
  canVerify: boolean;
  freshUntil: string | null;
}

interface LopecVerificationResponse {
  ok: boolean;
  message?: string;
  data?: LopecVerificationStatus;
}

interface EvaluationResponse {
  ok: boolean;
  message?: string;
  data?: {
    character: CharacterSummary;
    searchedCount: number;
    resultCount: number;
    note: string;
    results: EvaluationResult[];
    combinationResults?: EvaluationCombinationResult[];
  };
}

interface EvaluationResult {
  candidate: {
    name: string;
    grade: string;
    quality: number;
    level: number;
    buyPrice: number;
    endDate: string;
    tradeAllowCount: number;
    stats: AccessoryStats;
    effectSummary: string[];
    effectGrades: AccessoryEffectGrade[];
    refinementOptions: AccessoryRefinementOption[];
  };
  replacedSlot: string;
  replacedAccessory: AccessorySummary;
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

interface EvaluationCombinationReplacement {
  candidate: EvaluationResult["candidate"];
  replacedSlot: AccessorySlot;
  replacedAccessory: AccessorySummary;
  buyPrice: number;
  deltaScore: number;
}

interface EvaluationCombinationResult {
  replacements: EvaluationCombinationReplacement[];
  baseScore: number;
  nextScore: number;
  deltaScore: number;
  deltaEfficiency: number;
  buyPrice: number;
  scorePerGold: number;
  goldPerScore: number;
}

interface GraphItem {
  id: string;
  label: string;
  slotLabel: string;
  price: number;
  deltaScore: number;
  goldPerScore: number;
  tradeCount: number;
  details: string;
}

interface GraphAxisRange {
  min: number;
  max: number;
}

interface GraphRangeSelection {
  x: GraphAxisRange;
  y: GraphAxisRange;
}

interface GraphRangeInput {
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
}

interface SearchProgressState {
  percent: number;
  message: string;
  isWaiting: boolean;
  isIndeterminate?: boolean;
  completedRequests: number;
  totalRequests: number;
  retryAttempt?: number;
  retryDelayMs?: number;
  retryStartedAt?: number;
}

interface SearchProgressResponse {
  ok: boolean;
  message?: string;
  data?: {
    status: "running" | "waiting" | "done" | "error";
    completedRequests: number;
    totalRequests: number;
    percent: number;
    message: string;
    retryAttempt?: number;
    retryDelayMs?: number;
    retryStartedAt?: number;
    result?: EvaluationResponse;
  };
}

const ACCESSORY_OPTIONS: Array<{ value: AccessoryType; label: string }> = [
  { value: "necklace", label: "목걸이" },
  { value: "earring", label: "귀걸이" },
  { value: "ring", label: "반지" }
];

const EFFECT_OPTIONS: Record<
  ScoringMode,
  Record<AccessoryType, Array<{ value: EffectOption; label: string }>>
> = {
  dealer: {
    necklace: [
      { value: "enemyDamage", label: "적에게 주는 피해" },
      { value: "additionalDamage", label: "추가 피해" }
    ],
    earring: [
      { value: "attackPowerPercent", label: "공격력 %" },
      { value: "weaponAttackPercent", label: "무기 공격력 %" }
    ],
    ring: [
      { value: "critDamage", label: "치명타 피해" },
      { value: "critRate", label: "치명타 적중률" }
    ]
  },
  support: {
    necklace: [
      { value: "brandPower", label: "낙인력" },
      { value: "identityGauge", label: "세레나데, 신앙, 조화 게이지 획득량" }
    ],
    earring: [
      { value: "weaponAttackPercent", label: "무기 공격력 %" },
      { value: "weaponAttackFlat", label: "무기 공격력" }
    ],
    ring: [
      { value: "allyAttackBuff", label: "아군 공격력 강화 효과" },
      { value: "allyDamageBuff", label: "아군 피해량 강화 효과" }
    ]
  }
};

const GRADE_OPTIONS: SearchOptionGrade[] = ["선택", "상", "중", "하"];
const RESULT_PAGE_SIZE = 10;
const DEFAULT_MIN_QUALITY = 67;

const CARD_SORT_OPTIONS: Array<{ value: CardSortMode; label: string }> = [
  { value: "goldPerScoreAsc", label: "1점당 골드 낮은 순" },
  { value: "priceAsc", label: "가격 낮은 순" },
  { value: "deltaScoreDesc", label: "점수 상승량 높은 순" }
];

const TRADE_COUNT_OPTIONS: Array<{ value: TradeCountFilter; label: string }> = [
  { value: "0", label: "0회 이상" },
  { value: "1", label: "1회 이상" },
  { value: "2", label: "2회" }
];

const SEARCH_MODE_OPTIONS: Array<{ value: SearchMode; label: string }> = [
  { value: "optionTarget", label: "옵션 타겟" },
  { value: "priceTarget", label: "가격 타겟" }
];

const DEFAULT_API_KEY_MESSAGE =
  "기본 API 키는 공용이라 이용자가 몰리면 느릴 수 있습니다.";

const GRAPH_MODE_OPTIONS: Array<{ value: GraphMode; label: string }> = [
  { value: "priceScore", label: "가격 / 점수" },
  { value: "efficiencyScore", label: "효율 / 점수" }
];

const EFFECTIVE_REFINEMENT_KEYS: Record<
  ScoringMode,
  Record<AccessoryType, Set<string>>
> = {
  dealer: {
    necklace: new Set(["추가 피해%", "적에게 주는 피해%", "공격력", "무기 공격력"]),
    earring: new Set(["공격력%", "무기 공격력%", "공격력", "무기 공격력"]),
    ring: new Set(["치명타 적중률%", "치명타 피해%", "공격력", "무기 공격력"])
  },
  support: {
    necklace: new Set([
      "낙인력%",
      "세레나데, 신앙, 조화 게이지 획득량%",
      "무기 공격력"
    ]),
    earring: new Set(["무기 공격력%", "무기 공격력"]),
    ring: new Set(["아군 공격력 강화 효과%", "아군 피해량 강화 효과%", "무기 공격력"])
  }
};

const DEFAULT_EFFECT_GRADES: Record<EffectOption, SearchOptionGrade> = {
  additionalDamage: "선택",
  enemyDamage: "선택",
  attackPowerPercent: "선택",
  weaponAttackPercent: "선택",
  weaponAttackFlat: "선택",
  critRate: "선택",
  critDamage: "선택",
  brandPower: "선택",
  identityGauge: "선택",
  allyAttackBuff: "선택",
  allyDamageBuff: "선택",
  partyShield: "선택",
  partyHeal: "선택"
};

const SLOT_LABELS: Record<string, string> = {
  necklace: "목걸이",
  earring1: "귀걸이 1",
  earring2: "귀걸이 2",
  ring1: "반지 1",
  ring2: "반지 2"
};

const ACCESSORY_SLOT_ORDER: AccessorySlot[] = [
  "necklace",
  "earring1",
  "earring2",
  "ring1",
  "ring2"
];

const ACCESSORY_STAT_RANGES: Record<AccessoryType, { min: number; range: number }> = {
  necklace: { min: 15178, range: 2679 },
  earring: { min: 11806, range: 2083 },
  ring: { min: 10962, range: 1935 }
};

interface GradeCriteriaRow {
  label: string;
  values: string[];
  source: string;
}

const LOPEC_EFFICIENCY_ROWS: Record<ScoringMode, GradeCriteriaRow[]> = {
  dealer: [
    {
      label: "목걸이",
      values: ["추가 피해 0.70/1.60/2.60", "적에게 주는 피해 0.55/1.20/2.00"],
      source: "고대 하/중/상 기준"
    },
    {
      label: "귀걸이",
      values: ["공격력 % 0.40/0.95/1.55", "무기 공격력 % 0.80/1.80/3.00"],
      source: "고대 하/중/상 기준"
    },
    {
      label: "반지",
      values: ["치명타 피해 1.10/2.40/4.00", "치명타 적중률 0.40/0.95/1.55"],
      source: "고대 하/중/상 기준"
    },
    {
      label: "공용옵",
      values: ["공격력 80/195/390", "무기 공격력 195/480/960"],
      source: "고대 기준, 효율 계산 반영"
    }
  ],
  support: [
    {
      label: "목걸이",
      values: ["낙인력 2.15/4.80/8.00", "세레나데, 신앙, 조화 게이지 획득량 1.60/3.60/6.00"],
      source: "고대 하/중/상 기준"
    },
    {
      label: "귀걸이",
      values: ["무기 공격력 % 0.80/1.80/3.00", "무기 공격력 195/480/960"],
      source: "고대 하/중/상 기준"
    },
    {
      label: "반지",
      values: ["아군 공격력 강화 효과 1.35/3.00/5.00", "아군 피해량 강화 효과 2.00/4.50/7.50"],
      source: "고대 하/중/상 기준"
    }
  ]
};

export default function AccessoryEfficiencyClient() {
  const [characterName, setCharacterName] = useState("");
  const [personalApiKey, setPersonalApiKey] = useState("");
  const [usableApiKey, setUsableApiKey] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>("idle");
  const [apiKeyMessage, setApiKeyMessage] = useState(DEFAULT_API_KEY_MESSAGE);
  const [loadedCharacter, setLoadedCharacter] = useState<CharacterSummary | null>(null);
  const [accessoryType, setAccessoryType] = useState<AccessoryType>("necklace");
  const [selectedGrades, setSelectedGrades] = useState<Record<EffectOption, SearchOptionGrade>>(
    DEFAULT_EFFECT_GRADES
  );
  const [itemGrade, setItemGrade] = useState("고대");
  const [minQuality, setMinQuality] = useState(DEFAULT_MIN_QUALITY);
  const [maxPrice, setMaxPrice] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("optionTarget");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("dealer");
  const [targetSlots, setTargetSlots] = useState<AccessorySlot[]>(ACCESSORY_SLOT_ORDER);
  const [response, setResponse] = useState<EvaluationResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [resultPage, setResultPage] = useState(1);
  const [resultViewMode, setResultViewMode] = useState<ResultViewMode>("table");
  const [showPositiveOnly, setShowPositiveOnly] = useState(true);
  const [cardSortMode, setCardSortMode] = useState<CardSortMode>("goldPerScoreAsc");
  const [tradeCountFilter, setTradeCountFilter] = useState<TradeCountFilter>("0");
  const [tableSort, setTableSort] = useState<{
    key: TableSortKey;
    direction: SortDirection;
  }>({
    key: "goldPerScore",
    direction: "asc"
  });
  const [searchProgress, setSearchProgress] = useState<SearchProgressState>({
    percent: 0,
    message: "",
    isWaiting: false,
    completedRequests: 0,
    totalRequests: 1
  });
  const [currentProgressId, setCurrentProgressId] = useState<string | null>(null);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphMode>("priceScore");
  const [focusedResultId, setFocusedResultId] = useState<string | null>(null);
  const [pendingScrollResultId, setPendingScrollResultId] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [focusedGuideStep, setFocusedGuideStep] = useState<GuideStepId | null>(null);
  const [lopecVerification, setLopecVerification] = useState<LopecVerificationStatus | null>(null);
  const [isLopecVerificationLoading, setIsLopecVerificationLoading] = useState(false);
  const [lopecVerificationError, setLopecVerificationError] = useState<string | null>(null);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const loadPanelRef = useRef<HTMLFormElement>(null);
  const searchPanelRef = useRef<HTMLFormElement>(null);
  const resultsPanelRef = useRef<HTMLElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const graphButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isSearching || !currentProgressId) {
      return;
    }

    let isCancelled = false;

    async function pollProgress() {
      try {
        const result = await fetch(`/api/evaluate/progress/${currentProgressId}`, {
          cache: "no-store"
        });
        const payload = (await result.json()) as SearchProgressResponse;

        if (isCancelled || !payload.ok || !payload.data) {
          return;
        }

        setSearchProgress({
          percent: payload.data.percent,
          message: payload.data.message,
          isWaiting: payload.data.status === "waiting",
          isIndeterminate: false,
          completedRequests: payload.data.completedRequests,
          totalRequests: payload.data.totalRequests,
          retryAttempt: payload.data.retryAttempt,
          retryDelayMs: payload.data.retryDelayMs,
          retryStartedAt: payload.data.retryStartedAt
        });

        if (payload.data.status === "done") {
          setResponse(
            payload.data.result ?? {
              ok: false,
              message: "검색은 완료됐지만 결과를 불러오지 못했습니다."
            }
          );
          setResultPage(1);
          setIsSearching(false);
          setCurrentProgressId(null);
          return;
        }

        if (payload.data.status === "error") {
          setResponse({
            ok: false,
            message: payload.data.message || "검색에 실패했습니다."
          });
          setIsSearching(false);
          setCurrentProgressId(null);
        }
      } catch {
        if (!isCancelled) {
          setSearchProgress((current) => ({
            ...current,
            message: current.message || "진행 상태 확인 중"
          }));
        }
      }
    }

    void pollProgress();
    const timer = window.setInterval(() => void pollProgress(), 700);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [isSearching, currentProgressId]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("lopec-accessory-theme");

    if (savedTheme === "light" || savedTheme === "dark") {
      setThemeMode(savedTheme);
      return;
    }

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setThemeMode("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("lopec-accessory-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    void refreshLopecVerificationStatus();
  }, []);

  const allResults = useMemo(() => response?.data?.results ?? [], [response?.data?.results]);
  const allCombinationResults = useMemo(
    () => response?.data?.combinationResults ?? [],
    [response?.data?.combinationResults]
  );
  const positiveResultCount = useMemo(
    () => allResults.filter((result) => result.deltaScore > 0).length,
    [allResults]
  );
  const positiveCombinationCount = useMemo(
    () => allCombinationResults.filter((result) => result.deltaScore > 0).length,
    [allCombinationResults]
  );
  const displayResults = useMemo(
    () =>
      allResults.filter((result) => {
        if (showPositiveOnly && result.deltaScore <= 0) {
          return false;
        }

        return result.candidate.tradeAllowCount >= Number(tradeCountFilter);
      }),
    [allResults, showPositiveOnly, tradeCountFilter]
  );
  const displayCombinationResults = useMemo(
    () =>
      allCombinationResults.filter((result) => {
        if (showPositiveOnly && result.deltaScore <= 0) {
          return false;
        }

        return result.replacements.every(
          (replacement) => replacement.candidate.tradeAllowCount >= Number(tradeCountFilter)
        );
      }),
    [allCombinationResults, showPositiveOnly, tradeCountFilter]
  );
  const tradeCountFilterLabel =
    TRADE_COUNT_OPTIONS.find((option) => option.value === tradeCountFilter)?.label ?? "";
  const sortedDisplayResults = useMemo(
    () =>
      resultViewMode === "card"
        ? sortCardResults(displayResults, cardSortMode)
        : sortTableResults(displayResults, tableSort.key, tableSort.direction),
    [cardSortMode, displayResults, resultViewMode, tableSort.direction, tableSort.key]
  );
  const sortedCombinationResults = useMemo(
    () =>
      resultViewMode === "card"
        ? sortCombinationCardResults(displayCombinationResults, cardSortMode)
        : sortCombinationTableResults(displayCombinationResults, tableSort.key, tableSort.direction),
    [cardSortMode, displayCombinationResults, resultViewMode, tableSort.direction, tableSort.key]
  );
  const activeResultCount =
    searchMode === "priceTarget" ? sortedCombinationResults.length : sortedDisplayResults.length;
  const totalResultPages = Math.max(1, Math.ceil(activeResultCount / RESULT_PAGE_SIZE));
  const currentResultPage = Math.min(resultPage, totalResultPages);
  const visibleResults = useMemo(
    () =>
      sortedDisplayResults.slice(
        (currentResultPage - 1) * RESULT_PAGE_SIZE,
        currentResultPage * RESULT_PAGE_SIZE
      ),
    [sortedDisplayResults, currentResultPage]
  );
  const visibleCombinationResults = useMemo(
    () =>
      sortedCombinationResults.slice(
        (currentResultPage - 1) * RESULT_PAGE_SIZE,
        currentResultPage * RESULT_PAGE_SIZE
      ),
    [sortedCombinationResults, currentResultPage]
  );
  const paginationItems = useMemo(
    () => buildPaginationItems(currentResultPage, totalResultPages),
    [currentResultPage, totalResultPages]
  );
  const graphItems = useMemo(
    () =>
      searchMode === "priceTarget"
        ? buildCombinationGraphItems(displayCombinationResults)
        : buildResultGraphItems(displayResults),
    [displayCombinationResults, displayResults, searchMode]
  );
  const currentGuideStep: GuideStepId = useMemo(() => {
    if (!loadedCharacter || isLoadingCharacter) {
      return 1;
    }

    if (isSearching) {
      return 3;
    }

    if (response?.ok && graphItems.length > 0) {
      return 4;
    }

    return 2;
  }, [graphItems.length, isLoadingCharacter, isSearching, loadedCharacter, response?.ok]);

  useEffect(() => {
    if (!pendingScrollResultId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const element = document.getElementById(resultElementId(pendingScrollResultId));

      if (!element) {
        return;
      }

      element.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      element.focus({
        preventScroll: true
      });
      setPendingScrollResultId(null);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [
    pendingScrollResultId,
    resultViewMode,
    currentResultPage,
    visibleResults,
    visibleCombinationResults
  ]);

  async function refreshLopecVerificationStatus() {
    try {
      const result = await fetch("/api/lopec/verification", {
        cache: "no-store"
      });
      const payload = (await result.json()) as LopecVerificationResponse;

      if (!payload.ok || !payload.data) {
        throw new Error(payload.message ?? "로펙 수식 확인 상태를 불러오지 못했습니다.");
      }

      setLopecVerification(payload.data);
      setLopecVerificationError(null);
    } catch (error) {
      setLopecVerificationError(
        error instanceof Error ? error.message : "로펙 수식 확인 상태를 불러오지 못했습니다."
      );
    }
  }

  async function handleLopecVerification() {
    if (lopecVerification?.isFresh || isLopecVerificationLoading) {
      return;
    }

    setIsLopecVerificationLoading(true);
    setLopecVerificationError(null);

    try {
      const result = await fetch("/api/lopec/verification", {
        method: "POST",
        cache: "no-store"
      });
      const payload = (await result.json()) as LopecVerificationResponse;

      if (!payload.data) {
        throw new Error(payload.message ?? "로펙 수식 일치 확인에 실패했습니다.");
      }

      setLopecVerification(payload.data);

      if (!payload.ok) {
        setLopecVerificationError(payload.message ?? payload.data.lastMessage);
      }
    } catch (error) {
      setLopecVerificationError(
        error instanceof Error ? error.message : "로펙 수식 일치 확인에 실패했습니다."
      );
    } finally {
      setIsLopecVerificationLoading(false);
    }
  }

  async function handleLoadCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoadingCharacter(true);
    setLoadError(null);
    setResponse(null);
    setResultPage(1);

    try {
      const activeApiKey = await validatePersonalApiKeyIfNeeded();
      const result = await fetch(`/api/lostark/character/${encodeURIComponent(characterName)}`, {
        headers: createApiKeyHeaders(activeApiKey)
      });
      const payload = (await result.json()) as CharacterResponse;

      if (!payload.ok || !payload.data) {
        throw new Error(payload.message ?? "캐릭터를 불러오지 못했습니다.");
      }

      setLoadedCharacter(payload.data);
      setScoringMode(payload.data.isSupport ? "support" : "dealer");
      setSelectedGrades({ ...DEFAULT_EFFECT_GRADES });
      setTargetSlots(
        ACCESSORY_SLOT_ORDER.filter((slot) => Boolean(payload.data?.accessories[slot]))
      );
    } catch (error) {
      setLoadedCharacter(null);
      setLoadError(error instanceof Error ? error.message : "캐릭터 조회에 실패했습니다.");
    } finally {
      setIsLoadingCharacter(false);
    }
  }

  async function validatePersonalApiKeyIfNeeded(): Promise<string> {
    const trimmedApiKey = personalApiKey.trim();

    if (!trimmedApiKey) {
      setUsableApiKey("");
      setApiKeyStatus("idle");
      setApiKeyMessage(DEFAULT_API_KEY_MESSAGE);
      return "";
    }

    setApiKeyStatus("checking");
    setApiKeyMessage("개인 API 키 확인 중");

    const result = await fetch("/api/lostark/health", {
      headers: createApiKeyHeaders(trimmedApiKey)
    });
    const payload = (await result.json()) as LostarkHealthResponse;

    if (!payload.ok) {
      setUsableApiKey("");
      setApiKeyStatus("invalid");
      setApiKeyMessage(payload.message ?? "개인 API 키를 사용할 수 없습니다.");
      throw new Error("개인 API 키를 확인해 주세요.");
    }

    setUsableApiKey(trimmedApiKey);
    setApiKeyStatus("valid");
    setApiKeyMessage(formatApiKeySuccessMessage());

    return trimmedApiKey;
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loadedCharacter) {
      setLoadError("먼저 캐릭터를 불러오세요.");
      return;
    }

    const activeApiKey = readActiveApiKey();

    if (personalApiKey.trim() && !activeApiKey) {
      setResponse({
        ok: false,
        message: "개인 API 키를 입력했다면 불러오기로 먼저 사용 가능 여부를 확인하세요."
      });
      setResultPage(1);
      return;
    }

    const selectedEffectGradeFilters =
      searchMode === "optionTarget"
        ? getSelectedEffectGrades(accessoryType, scoringMode, selectedGrades)
        : [];
    const parsedMaxPrice = parseNullableNumberInput(maxPrice);

    if (searchMode === "optionTarget" && selectedEffectGradeFilters.length === 0) {
      setResponse({
        ok: false,
        message: "검색할 핵심 옵션을 하나 이상 상/중/하로 선택하세요."
      });
      setResultPage(1);
      return;
    }

    if (searchMode === "priceTarget" && targetSlots.length === 0) {
      setResponse({
        ok: false,
        message: "교체 후보로 볼 장착 슬롯을 하나 이상 선택하세요."
      });
      setResultPage(1);
      return;
    }

    if (searchMode === "priceTarget" && (!parsedMaxPrice || parsedMaxPrice <= 0)) {
      setResponse({
        ok: false,
        message: "가격 타겟 검색은 목표 가격을 입력해야 합니다."
      });
      setResultPage(1);
      return;
    }

    setCurrentProgressId(null);
    setSearchProgress({
      percent: 0,
      message: "경매장 검색 중 · 완료될 때까지 기다려 주세요",
      isWaiting: false,
      isIndeterminate: true,
      completedRequests: 0,
      totalRequests: 1
    });
    setIsSearching(true);
    setResponse(null);
    setResultPage(1);
    setCardSortMode("goldPerScoreAsc");
    setTableSort({
      key: "goldPerScore",
      direction: "asc"
    });

    try {
      const result = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          characterName: loadedCharacter.characterName,
          accessoryType,
          itemGrade,
          itemTier: 4,
          minQuality,
          maxPrice: parsedMaxPrice,
          selectedEffectGrades: selectedEffectGradeFilters,
          excludedEffectOptions:
            searchMode === "optionTarget"
              ? getExcludedEffectOptions(accessoryType, scoringMode, selectedGrades)
              : [],
          targetSlots: searchMode === "priceTarget" ? targetSlots : undefined,
          searchMode,
          scoringMode,
          apiKey: activeApiKey || undefined
        })
      });

      const payload = (await result.json()) as EvaluationResponse;

      if (!payload.ok) {
        throw new Error(payload.message ?? "검색을 시작하지 못했습니다.");
      }

      setResponse(payload);
      setResultPage(1);
      setSearchProgress({
        percent: 100,
        message: "검색 완료",
        isWaiting: false,
        isIndeterminate: false,
        completedRequests: 1,
        totalRequests: 1
      });
      setIsSearching(false);
    } catch (error) {
      setSearchProgress((current) => ({
        ...current,
        message: error instanceof Error ? error.message : "요청에 실패했습니다.",
        isWaiting: false,
        isIndeterminate: false
      }));
      setResponse({
        ok: false,
        message: error instanceof Error ? error.message : "요청에 실패했습니다."
      });
      setIsSearching(false);
      setCurrentProgressId(null);
    }
  }

  function changeAccessoryType(nextType: AccessoryType) {
    setAccessoryType(nextType);
    setSelectedGrades({ ...DEFAULT_EFFECT_GRADES });
    setResponse(null);
    setResultPage(1);
  }

  function toggleTargetSlot(slot: AccessorySlot) {
    setTargetSlots((current) =>
      current.includes(slot)
        ? current.filter((currentSlot) => currentSlot !== slot)
        : ACCESSORY_SLOT_ORDER.filter((currentSlot) =>
            currentSlot === slot || current.includes(currentSlot)
          )
    );
    setResponse(null);
    setResultPage(1);
  }

  function changeSearchMode(nextMode: SearchMode) {
    setSearchMode(nextMode);
    setResponse(null);
    setResultPage(1);
    setCardSortMode("goldPerScoreAsc");
    setTableSort({
      key: "goldPerScore",
      direction: "asc"
    });
  }

  function changeScoringMode(nextMode: ScoringMode) {
    setScoringMode(nextMode);
    setSelectedGrades({ ...DEFAULT_EFFECT_GRADES });
    setResponse(null);
    setResultPage(1);
  }

  function changeEffectGrade(effect: EffectOption, grade: SearchOptionGrade) {
    setSelectedGrades((current) => ({
      ...current,
      [effect]: grade
    }));
    setResponse(null);
    setResultPage(1);
  }

  function changePersonalApiKey(value: string) {
    setPersonalApiKey(value);
    setUsableApiKey("");
    setApiKeyStatus(value.trim() ? "idle" : "idle");
    setApiKeyMessage(
      value.trim() ? "불러오기를 누르면 사용 가능 여부를 확인합니다." : DEFAULT_API_KEY_MESSAGE
    );
  }

  function readActiveApiKey(): string {
    const trimmedApiKey = personalApiKey.trim();

    return trimmedApiKey && trimmedApiKey === usableApiKey ? usableApiKey : "";
  }

  function changeTableSort(key: TableSortKey) {
    setTableSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc"
        };
      }

      return {
        key,
        direction: getDefaultTableSortDirection(key)
      };
    });
    setResultPage(1);
  }

  function handleGraphItemSelect(itemId: string) {
    const orderedIds =
      searchMode === "priceTarget"
        ? sortedCombinationResults.map(combinationKey)
        : sortedDisplayResults.map(resultKey);
    const itemIndex = orderedIds.indexOf(itemId);

    if (itemIndex < 0) {
      return;
    }

    setFocusedResultId(itemId);
    setPendingScrollResultId(itemId);
    setResultPage(Math.floor(itemIndex / RESULT_PAGE_SIZE) + 1);
    setIsGraphOpen(false);
  }

  function handleGuideStepClick(step: GuideStepId) {
    if (step > currentGuideStep) {
      return;
    }

    setFocusedGuideStep(step);

    if (step === 1) {
      scrollAndFocus(loadPanelRef.current?.querySelector("input"));
      return;
    }

    if (step === 2) {
      scrollAndFocus(searchPanelRef.current);
      return;
    }

    if (step === 3) {
      scrollAndFocus(searchButtonRef.current ?? searchPanelRef.current);
      return;
    }

    if (graphItems.length > 0) {
      scrollAndFocus(graphButtonRef.current ?? resultsPanelRef.current);
      setIsGraphOpen(true);
      return;
    }

    scrollAndFocus(resultsPanelRef.current);
  }

  return (
    <main className="appShell">
      <nav className="topNav">
        <div className="topNavBrand">
          <strong>로펙 찐 악세 효율 계산기</strong>
          <span>내 캐릭에 맞는 악세 효율 찾기 - 경매장 매물별 로펙점수 상승 비교 및 시각화</span>
        </div>
        <div className="topNavActions">
          <button
            type="button"
            className="bugReportLink"
            onClick={() => setIsBugReportOpen(true)}
          >
            버그 제보
          </button>
          <LopecVerificationBadge
            status={lopecVerification}
            isLoading={isLopecVerificationLoading}
            error={lopecVerificationError}
            onVerify={handleLopecVerification}
          />
          <button
            type="button"
            className="themeToggle"
            aria-pressed={themeMode === "dark"}
            onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
          >
            <span aria-hidden="true" />
            {themeMode === "dark" ? "라이트모드" : "다크모드"}
          </button>
        </div>
      </nav>

      <section className="accessoryLayout">
        <div className="mainColumn">
          <SearchGuide
            currentStep={currentGuideStep}
            focusedStep={focusedGuideStep}
            onStepClick={handleGuideStepClick}
          />

          <form
            ref={loadPanelRef}
            className={["loadPanel", focusedGuideStep === 1 ? "sectionFocused" : ""]
              .filter(Boolean)
              .join(" ")}
            onSubmit={handleLoadCharacter}
          >
            <label className="characterNameField">
              캐릭터명
              <input
                value={characterName}
                onChange={(event) => setCharacterName(event.target.value)}
                placeholder="캐릭터명"
              />
            </label>
            <label className="apiKeyField">
              <span className="fieldLabelRow">
                개인 API 키
                <LostarkApiKeyTooltip />
              </span>
              <input
                autoComplete="off"
                spellCheck={false}
                type="password"
                value={personalApiKey}
                onChange={(event) => changePersonalApiKey(event.target.value)}
                placeholder="비워두면 공용 API 키"
              />
              <small className={["apiKeyStatus", apiKeyStatus].join(" ")}>
                {apiKeyMessage}
              </small>
            </label>
            <button type="submit" disabled={isLoadingCharacter}>
              {isLoadingCharacter ? "불러오는 중" : "불러오기"}
            </button>
          </form>

          {loadError ? <p className="errorText">{loadError}</p> : null}

          {loadedCharacter ? (
            <CharacterPanel character={loadedCharacter} scoringMode={scoringMode} />
          ) : null}

          <form
            ref={searchPanelRef}
            className={["searchPanel", focusedGuideStep === 2 ? "sectionFocused" : ""]
              .filter(Boolean)
              .join(" ")}
            onSubmit={handleSearch}
          >
            <div className="searchPanelHeader">
              <div>
                <div className="searchPanelTitleRow">
                  <h2>검색 조건</h2>
                  <ScoringModeToggle
                    disabled={!loadedCharacter || isSearching}
                    value={scoringMode}
                    onChange={changeScoringMode}
                  />
                </div>
                <p>
                  {searchMode === "optionTarget"
                    ? "원하는 악세 부위와 옵션 등급을 고른 뒤 검색하세요."
                    : "교체할 악세를 체크하고, 쓸 수 있는 총 예산을 입력하세요."}
                </p>
              </div>
              <GradeCriteriaTooltip scoringMode={scoringMode} />
            </div>

            <div className="searchModeToggle" aria-label="검색 방식">
              {SEARCH_MODE_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={searchMode === option.value ? "active" : ""}
                  key={option.value}
                  onClick={() => changeSearchMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div
              className={[
                "searchRow",
                searchMode === "priceTarget" ? "priceTargetSearchRow" : "optionTargetSearchRow"
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {searchMode === "optionTarget" ? (
                <>
                  <label>
                    악세서리
                    <select
                      value={accessoryType}
                      onChange={(event) => changeAccessoryType(event.target.value as AccessoryType)}
                      disabled={!loadedCharacter}
                    >
                      {ACCESSORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {EFFECT_OPTIONS[scoringMode][accessoryType].map((option) => (
                    <label key={option.value}>
                      {option.label}
                      <select
                        value={selectedGrades[option.value]}
                        disabled={!loadedCharacter}
                        onChange={(event) =>
                          changeEffectGrade(option.value, event.target.value as SearchOptionGrade)
                        }
                      >
                        {GRADE_OPTIONS.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </>
              ) : null}

              <label>
                등급
                <select
                  value={itemGrade}
                  onChange={(event) => setItemGrade(event.target.value)}
                  disabled={!loadedCharacter}
                >
                  <option value="고대">고대</option>
                  <option value="유물">유물</option>
                </select>
              </label>

              <label>
                최소 품질
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minQuality}
                  disabled={!loadedCharacter}
                  onChange={(event) => setMinQuality(Number(event.target.value))}
                />
              </label>

              <label>
                {searchMode === "priceTarget" ? "목표 가격" : "최대 가격"}
                <input
                  inputMode="numeric"
                  placeholder={searchMode === "priceTarget" ? "예산 골드" : "미입력시 제한 없음"}
                  value={formatNumberInput(maxPrice)}
                  disabled={!loadedCharacter}
                  onChange={(event) => setMaxPrice(normalizeNumberInput(event.target.value))}
                />
              </label>

              <button
                ref={searchButtonRef}
                type="submit"
                className={focusedGuideStep === 3 ? "buttonFocused" : ""}
                disabled={!loadedCharacter || isSearching}
              >
                {isSearching
                  ? "검색 중"
                  : searchMode === "priceTarget"
                    ? "가격 타겟 검색"
                    : "악세서리 검색"}
              </button>
            </div>

            {searchMode === "priceTarget" ? (
              <>
                {loadedCharacter ? (
                  <SlotTargetGrid
                    character={loadedCharacter}
                    selectedSlots={targetSlots}
                    onToggle={toggleTargetSlot}
                    scoringMode={scoringMode}
                  />
                ) : null}
                <p className="searchModeHint">
                  바꾸고 싶은 장착 악세서리를 체크하고, 목표 가격에 쓸 수 있는 총 골드를 입력하세요.
                  그 예산 안에서 점수가 가장 많이 오르는 조합을 찾아줍니다.
                </p>
              </>
            ) : null}

            {isSearching ? <SearchProgressIndicator progress={searchProgress} /> : null}
          </form>

          <section
            ref={resultsPanelRef}
            className={["resultsPanel", focusedGuideStep === 4 ? "sectionFocused" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            {response?.ok && response.data ? (
              <>
                <div className="resultHeader">
                  <div>
                    <p>
                      {searchMode === "priceTarget"
                        ? "가격 타겟"
                        : ACCESSORY_OPTIONS.find((item) => item.value === accessoryType)?.label}
                    </p>
                    <h1>검색 결과</h1>
                    <span>
                      검색 매물 {response.data.searchedCount}개
                      {showPositiveOnly
                        ? ` · 상승 후보 ${
                            searchMode === "priceTarget"
                              ? positiveCombinationCount
                              : positiveResultCount
                          }개`
                        : ""} ·{" "}
                      거래 가능 {tradeCountFilterLabel} ·{" "}
                      {currentResultPage}/{totalResultPages}페이지
                    </span>
                  </div>
                  <div className="resultActions">
                    <label className="positiveOnlyToggle">
                      <input
                        type="checkbox"
                        checked={showPositiveOnly}
                        onChange={(event) => {
                          setShowPositiveOnly(event.target.checked);
                          setResultPage(1);
                        }}
                      />
                      점수 상승되는 것만 보기
                    </label>
                    <label className="tradeCountControl">
                      <span>거래 가능</span>
                      <select
                        value={tradeCountFilter}
                        onChange={(event) => {
                          setTradeCountFilter(event.target.value as TradeCountFilter);
                          setResultPage(1);
                        }}
                      >
                        {TRADE_COUNT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {resultViewMode === "card" ? (
                      <label className="cardSortControl">
                        <span>정렬</span>
                        <select
                          value={cardSortMode}
                          onChange={(event) => {
                            setCardSortMode(event.target.value as CardSortMode);
                            setResultPage(1);
                          }}
                        >
                          {CARD_SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="graphActionGroup">
                      <button
                        ref={graphButtonRef}
                        type="button"
                        className={[
                          "graphOpenButton",
                          currentGuideStep === 4 || focusedGuideStep === 4 ? "graphButtonFocused" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={graphItems.length === 0}
                        onClick={() => setIsGraphOpen(true)}
                      >
                        <span className="graphButtonIcon" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        그래프로 효율 확인하기
                      </button>
                      {graphItems.length === 0 ? (
                        <small className="graphDisabledHint">
                          점수 상승 후보가 있을 때 그래프를 볼 수 있습니다.
                        </small>
                      ) : null}
                    </div>
                    <div className="resultViewControls" aria-label="결과 보기 방식">
                      <button
                        type="button"
                        className={resultViewMode === "card" ? "active" : ""}
                        onClick={() => {
                          setResultViewMode("card");
                          setResultPage(1);
                        }}
                      >
                        카드
                      </button>
                      <button
                        type="button"
                        className={resultViewMode === "table" ? "active" : ""}
                        onClick={() => {
                          setResultViewMode("table");
                          setResultPage(1);
                        }}
                      >
                        표
                      </button>
                    </div>
                  </div>
                </div>

                <p className="note">{response.data.note}</p>

                {searchMode === "priceTarget" ? (
                  visibleCombinationResults.length > 0 ? (
                    <>
                      {resultViewMode === "card" ? (
                        <div className="itemList">
                          {visibleCombinationResults.map((result) => (
                            <CombinationCard
                              key={combinationKey(result)}
                            result={result}
                            resultId={combinationKey(result)}
                            isFocused={focusedResultId === combinationKey(result)}
                            scoringMode={scoringMode}
                          />
                          ))}
                        </div>
                      ) : (
                        <CombinationTable
                          focusedResultId={focusedResultId}
                          page={currentResultPage}
                          pageSize={RESULT_PAGE_SIZE}
                          results={visibleCombinationResults}
                          sortDirection={tableSort.direction}
                          sortKey={tableSort.key}
                          scoringMode={scoringMode}
                          onSort={changeTableSort}
                        />
                      )}

                      <Pagination
                        currentPage={currentResultPage}
                        items={paginationItems}
                        onPageChange={setResultPage}
                        totalPages={totalResultPages}
                      />
                    </>
                  ) : (
                    <div className="emptyState compact">
                      <h2>검색 결과 없음</h2>
                      <p>
                        목표 가격 이하에서 선택 슬롯의 점수가 상승하는 조합이 없습니다.
                      </p>
                    </div>
                  )
                ) : visibleResults.length > 0 ? (
                  <>
                    {resultViewMode === "card" ? (
                      <div className="itemList">
                        {visibleResults.map((result) => (
                          <ResultCard
                            key={resultKey(result)}
                            result={result}
                            resultId={resultKey(result)}
                            isFocused={focusedResultId === resultKey(result)}
                            scoringMode={scoringMode}
                          />
                        ))}
                      </div>
                    ) : (
                      <ResultTable
                        focusedResultId={focusedResultId}
                        page={currentResultPage}
                        pageSize={RESULT_PAGE_SIZE}
                        results={visibleResults}
                        sortDirection={tableSort.direction}
                        sortKey={tableSort.key}
                        scoringMode={scoringMode}
                        onSort={changeTableSort}
                      />
                    )}

                    <Pagination
                      currentPage={currentResultPage}
                      items={paginationItems}
                      onPageChange={setResultPage}
                      totalPages={totalResultPages}
                    />
                  </>
                ) : (
                  <div className="emptyState compact">
                    <h2>검색 결과 없음</h2>
                    <p>
                      {showPositiveOnly
                        ? "현재 조건에서 점수가 상승하는 후보가 없습니다."
                        : "선택한 상/중/하 조합에 맞는 즉시 구매 매물이 없거나 조건이 너무 좁습니다."}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="emptyState compact">
                <h2>검색 결과 대기</h2>
                <p>캐릭터를 불러온 뒤 조건을 고르고 악세서리 검색을 누르세요.</p>
                {response?.ok === false ? <p className="errorText">{response.message}</p> : null}
              </div>
            )}
          </section>
        </div>
      </section>
      {isGraphOpen ? (
        <GraphModal
          items={graphItems}
          mode={graphMode}
          onClose={() => setIsGraphOpen(false)}
          onModeChange={setGraphMode}
          onPointSelect={handleGraphItemSelect}
        />
      ) : null}
      {isBugReportOpen ? <BugReportModal onClose={() => setIsBugReportOpen(false)} /> : null}
    </main>
  );
}

function BugReportModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const discordUsername = "alskk199";
  const discordProfileUrl = "https://discord.com/users/335770648313856001";

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function copyDiscordUsername() {
    await navigator.clipboard.writeText(discordUsername);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="bugReportModal"
        role="dialog"
        aria-modal="true"
        aria-label="버그 제보"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bugReportHeader">
          <div>
            <p>Discord</p>
            <h2>버그 제보</h2>
          </div>
          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </div>
        <div className="discordContactBox">
          <span>디스코드 아이디</span>
          <strong>@{discordUsername}</strong>
        </div>
        <div className="bugReportActions">
          <button type="button" onClick={copyDiscordUsername}>
            {copied ? "복사됨" : "아이디 복사"}
          </button>
          <a href={discordProfileUrl} target="_blank" rel="noreferrer">
            프로필 열기
          </a>
        </div>
      </section>
    </div>
  );
}

function LopecVerificationBadge({
  status,
  isLoading,
  error,
  onVerify
}: {
  status: LopecVerificationStatus | null;
  isLoading: boolean;
  error: string | null;
  onVerify: () => void;
}) {
  const isFresh = Boolean(status?.isFresh);
  const isRunning = Boolean(status?.isRunning) || isLoading;
  const canVerify = !isFresh && !isRunning;
  const stateClass = error ? "error" : isFresh ? "fresh" : "stale";

  return (
    <div className={["lopecVerification", stateClass].join(" ")} aria-live="polite">
      <div className="lopecVerificationText">
        <strong>최신 로펙 수식 일치 확인</strong>
        <span>{formatVerificationStatusText(status, isRunning, error)}</span>
      </div>
      <button type="button" onClick={onVerify} disabled={!canVerify}>
        {isRunning ? "검증 중" : isFresh ? "최신" : "검증하기"}
      </button>
    </div>
  );
}

function SearchGuide({
  currentStep,
  focusedStep,
  onStepClick
}: {
  currentStep: GuideStepId;
  focusedStep: GuideStepId | null;
  onStepClick: (step: GuideStepId) => void;
}) {
  return (
    <section className="guidePanel" aria-label="검색 단계">
      <div className="guideGrid">
        <button
          type="button"
          className={guideStepClassName(1, currentStep, focusedStep)}
          onClick={() => onStepClick(1)}
        >
          <span>1</span>
          <strong>캐릭터 불러오기</strong>
          <p>현재 장착 악세와 기준 점수를 불러옵니다.</p>
        </button>
        <button
          type="button"
          className={guideStepClassName(2, currentStep, focusedStep)}
          disabled={2 > currentStep}
          onClick={() => onStepClick(2)}
        >
          <span>2</span>
          <strong>검색 방식 선택</strong>
          <p>옵션 타겟이나 가격 타겟을 고릅니다.</p>
        </button>
        <button
          type="button"
          className={guideStepClassName(3, currentStep, focusedStep)}
          disabled={3 > currentStep}
          onClick={() => onStepClick(3)}
        >
          <span>3</span>
          <strong>조건 입력 후 검색</strong>
          <p>조건을 넣고 악세서리 검색을 실행합니다.</p>
        </button>
        <button
          type="button"
          className={guideStepClassName(4, currentStep, focusedStep, true)}
          disabled={4 > currentStep}
          onClick={() => onStepClick(4)}
        >
          <span>4</span>
          <strong>그래프로 효율 확인</strong>
          <p>검색 결과가 나오면 효율 그래프를 엽니다.</p>
        </button>
      </div>
    </section>
  );
}

function guideStepClassName(
  step: GuideStepId,
  currentStep: GuideStepId,
  focusedStep: GuideStepId | null,
  isGraphAction = false
): string {
  const state = step < currentStep ? "completed" : step === currentStep ? "active" : "locked";

  return [
    "guideStep",
    state,
    focusedStep === step ? "focused" : "",
    isGraphAction ? "graphAction" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function scrollAndFocus(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
  element.focus({
    preventScroll: true
  });
}

function ScoringModeToggle({
  value,
  disabled,
  onChange
}: {
  value: ScoringMode;
  disabled: boolean;
  onChange: (mode: ScoringMode) => void;
}) {
  return (
    <div className="scoringIconToggle" aria-label="점수 기준">
      <button
        type="button"
        className={["scoringIconButton", "dealer", value === "dealer" ? "active" : ""]
          .filter(Boolean)
          .join(" ")}
        title="딜러 기준"
        aria-label="딜러 기준"
        aria-pressed={value === "dealer"}
        disabled={disabled}
        onClick={() => onChange("dealer")}
      >
        <DealerSwordIcon />
      </button>
      <button
        type="button"
        className={["scoringIconButton", "support", value === "support" ? "active" : ""]
          .filter(Boolean)
          .join(" ")}
        title="서포터 기준"
        aria-label="서포터 기준"
        aria-pressed={value === "support"}
        disabled={disabled}
        onClick={() => onChange("support")}
      >
        <SupportCrossIcon />
      </button>
    </div>
  );
}

function DealerSwordIcon() {
  return (
    <svg className="dealerSwordIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path className="swordBlade" d="M20.9 3.1 18.8 8 9.2 17.6 6.4 17.8 6.6 15 16.2 5.4z" />
      <path className="swordGuard" d="m7.2 14.2 2.6 2.6" />
      <path className="swordGrip" d="m6.3 17.4-2.9 2.9" />
      <path className="swordPommel" d="m2.7 19.6 1.7 1.7" />
    </svg>
  );
}

function SupportCrossIcon() {
  return (
    <svg className="supportCrossIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 4.5h5v5h5v5h-5v5h-5v-5h-5v-5h5z" />
    </svg>
  );
}

function GradeCriteriaTooltip({ scoringMode }: { scoringMode: ScoringMode }) {
  const rows = LOPEC_EFFICIENCY_ROWS[scoringMode];

  return (
    <div className="infoTooltip">
      <button type="button" className="infoIcon" aria-label="하/중/상 기준 보기">
        i
      </button>
      <div className="criteriaTooltip" role="tooltip">
        <strong>{scoringMode === "support" ? "서포터" : "딜러"} 하/중/상 기준</strong>
        <div className="criteriaTooltipRows">
          {rows.map((row) => (
            <div className="criteriaTooltipRow" key={row.label}>
              <span>{row.label}</span>
              <div>
                {row.values.map((value) => (
                  <code key={value}>{value}</code>
                ))}
              </div>
              <small>{row.source}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LostarkApiKeyTooltip() {
  return (
    <span className="apiKeyInfo">
      <button type="button" className="apiInfoIcon" aria-label="Lostark API 키 발급 안내">
        i
      </button>
      <span className="apiKeyTooltip" role="tooltip">
        개인 키를 넣으면 검색 요청에 서버 기본 키 대신 사용합니다. 발급은{" "}
        <a
          href="https://developer-lostark.game.onstove.com/getting-started"
          rel="noreferrer"
          target="_blank"
        >
          Lostark Developers
        </a>
        에서 할 수 있습니다.
      </span>
    </span>
  );
}

function SearchProgressIndicator({
  progress
}: {
  progress: SearchProgressState;
}) {
  const [now, setNow] = useState(() => Date.now());
  const requestLabel = progress.isIndeterminate
    ? "결과 수집 중"
    : `완료 ${progress.completedRequests}회 · 예상 ${progress.totalRequests}회`;
  const retryRemainingSeconds = readRetryRemainingSeconds(progress, now);
  const progressMessage =
    progress.isWaiting && retryRemainingSeconds !== null
      ? `${progress.message} (${retryRemainingSeconds}초 뒤 자동 재시도)`
      : progress.message;

  useEffect(() => {
    if (!progress.isWaiting || !progress.retryStartedAt || !progress.retryDelayMs) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [progress.isWaiting, progress.retryDelayMs, progress.retryStartedAt]);

  return (
    <div
      className={[
        "searchProgress",
        progress.isWaiting ? "waiting" : "",
        progress.isIndeterminate ? "indeterminate" : ""
      ].filter(Boolean).join(" ")}
    >
      <div className="searchProgressTop">
        <span className="spinner" aria-hidden="true" />
        <strong>{progressMessage}</strong>
        <b>{progress.isIndeterminate ? requestLabel : `${requestLabel} · ${progress.percent}%`}</b>
      </div>
      <div className="progressTrack" aria-label="검색 진행률">
        <div className="progressFill" style={{ width: `${progress.percent}%` }} />
      </div>
      {progress.isWaiting ? (
        <p>
          요청 제한이 걸려도 완료 요청 수는 그대로 유지하고, 서버가 기다렸다가 같은 검색을 자동으로 다시 시도합니다.
        </p>
      ) : null}
    </div>
  );
}

function GraphModal({
  items,
  mode,
  onModeChange,
  onPointSelect,
  onClose
}: {
  items: GraphItem[];
  mode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  onPointSelect: (itemId: string) => void;
  onClose: () => void;
}) {
  const autoRange = useMemo(() => buildGraphAutoRange(items, mode), [items, mode]);
  const [rangeInput, setRangeInput] = useState<GraphRangeInput>(() =>
    formatGraphRangeInput(autoRange)
  );
  const selectedRange = useMemo(
    () => parseGraphRangeInput(rangeInput, autoRange),
    [autoRange, rangeInput]
  );
  const xAxisLabel = mode === "priceScore" ? "총 가격" : "1점당 골드";

  useEffect(() => {
    setRangeInput(formatGraphRangeInput(autoRange));
  }, [autoRange]);

  function changeRangeInput(key: keyof GraphRangeInput, value: string) {
    setRangeInput((current) => ({
      ...current,
      [key]: value
    }));
  }

  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="graphModal"
        role="dialog"
        aria-modal="true"
        aria-label="검색 결과 그래프"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="graphModalHeader">
          <div>
            <p>검색 결과 {items.length}개</p>
            <h2>그래프로 효율 확인하기</h2>
          </div>
          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </div>

        <div className="graphModeToggle" aria-label="그래프 방식">
          {GRAPH_MODE_OPTIONS.map((option) => (
            <button
              type="button"
              className={mode === option.value ? "active" : ""}
              key={option.value}
              onClick={() => onModeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="graphRangeControls">
          <label>
            <span>{xAxisLabel} 최소</span>
            <input
              inputMode="decimal"
              value={rangeInput.xMin}
              onChange={(event) => changeRangeInput("xMin", event.target.value)}
            />
          </label>
          <label>
            <span>{xAxisLabel} 최대</span>
            <input
              inputMode="decimal"
              value={rangeInput.xMax}
              onChange={(event) => changeRangeInput("xMax", event.target.value)}
            />
          </label>
          <label>
            <span>점수 최소</span>
            <input
              inputMode="decimal"
              value={rangeInput.yMin}
              onChange={(event) => changeRangeInput("yMin", event.target.value)}
            />
          </label>
          <label>
            <span>점수 최대</span>
            <input
              inputMode="decimal"
              value={rangeInput.yMax}
              onChange={(event) => changeRangeInput("yMax", event.target.value)}
            />
          </label>
          <button
            type="button"
            className="rangeResetButton"
            onClick={() => setRangeInput(formatGraphRangeInput(autoRange))}
          >
            범위 초기화
          </button>
        </div>

        <ResultScatterPlot
          items={items}
          mode={mode}
          range={selectedRange}
          onPointSelect={onPointSelect}
        />
      </section>
    </div>
  );
}

function ResultScatterPlot({
  items,
  mode,
  range,
  onPointSelect
}: {
  items: GraphItem[];
  mode: GraphMode;
  range: GraphRangeSelection;
  onPointSelect: (itemId: string) => void;
}) {
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="emptyState compact">
        <h2>그래프 대상 없음</h2>
        <p>현재 필터에서 표시할 후보가 없습니다.</p>
      </div>
    );
  }

  const width = 760;
  const height = 430;
  const margin = { top: 24, right: 24, bottom: 58, left: 78 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const visibleItems = items.filter((item) => {
    const xValue = readGraphXValue(item, mode);

    return (
      xValue >= range.x.min &&
      xValue <= range.x.max &&
      item.deltaScore >= range.y.min &&
      item.deltaScore <= range.y.max
    );
  });
  const xRange = range.x;
  const yRange = range.y;
  const points = visibleItems.map((item) => {
    const xValue = readGraphXValue(item, mode);
    const yValue = item.deltaScore;

    return {
      item,
      xValue,
      yValue,
      x: margin.left + normalizeToRange(xValue, xRange) * plotWidth,
      y: margin.top + (1 - normalizeToRange(yValue, yRange)) * plotHeight,
      color: readTradeCountPointColor(item.tradeCount)
    };
  });
  const frontier = buildFrontier(points);
  const xTicks = buildTicks(xRange, 4);
  const yTicks = buildTicks(yRange, 4);
  const hoveredPoint = points.find((point) => point.item.id === hoveredPointId) ?? null;
  const hoverXLabel = hoveredPoint ? formatCompactNumber(hoveredPoint.xValue) : "";
  const hoverYLabel = hoveredPoint ? formatCompactNumber(hoveredPoint.yValue) : "";
  const hoverXLabelWidth = Math.max(70, hoverXLabel.length * 7 + 20);
  const hoverYLabelWidth = Math.max(58, hoverYLabel.length * 7 + 20);
  const hoverXLabelX = hoveredPoint
    ? clamp(
        hoveredPoint.x - hoverXLabelWidth / 2,
        margin.left,
        margin.left + plotWidth - hoverXLabelWidth
      )
    : 0;
  const hoverYLabelY = hoveredPoint
    ? clamp(hoveredPoint.y - 11, margin.top, margin.top + plotHeight - 22)
    : 0;

  if (visibleItems.length === 0) {
    return (
      <div className="emptyState compact">
        <h2>범위 내 후보 없음</h2>
        <p>축 범위를 넓히거나 범위를 초기화하세요.</p>
      </div>
    );
  }

  return (
    <div className="graphBody">
      <svg
        aria-label={mode === "priceScore" ? "총 가격과 점수 상승량 그래프" : "1점당 골드와 점수 상승량 그래프"}
        className="scatterPlot"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
      >
        <rect
          x={margin.left}
          y={margin.top}
          width={plotWidth}
          height={plotHeight}
          className="plotArea"
        />

        {xTicks.map((tick) => {
          const x = margin.left + normalizeToRange(tick, xRange) * plotWidth;

          return (
            <g key={`x-${tick}`}>
              <line x1={x} x2={x} y1={margin.top} y2={margin.top + plotHeight} className="gridLine" />
              <text x={x} y={height - 26} className="axisTick" textAnchor="middle">
                {formatCompactNumber(tick)}
              </text>
            </g>
          );
        })}

        {yTicks.map((tick) => {
          const y = margin.top + (1 - normalizeToRange(tick, yRange)) * plotHeight;

          return (
            <g key={`y-${tick}`}>
              <line x1={margin.left} x2={margin.left + plotWidth} y1={y} y2={y} className="gridLine" />
              <text x={margin.left - 10} y={y + 4} className="axisTick" textAnchor="end">
                {formatCompactNumber(tick)}
              </text>
            </g>
          );
        })}

        {frontier.length > 1 ? (
          <polyline
            className="frontierLine"
            points={frontier.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ) : null}

        {hoveredPoint ? (
          <g className="crosshair">
            <line
              x1={hoveredPoint.x}
              x2={hoveredPoint.x}
              y1={margin.top}
              y2={margin.top + plotHeight}
              className="crosshairLine"
            />
            <line
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={hoveredPoint.y}
              y2={hoveredPoint.y}
              className="crosshairLine"
            />
            <rect
              x={hoverXLabelX}
              y={margin.top + plotHeight + 8}
              width={hoverXLabelWidth}
              height={22}
              rx={6}
              className="crosshairLabel"
            />
            <text
              x={hoverXLabelX + hoverXLabelWidth / 2}
              y={margin.top + plotHeight + 23}
              className="crosshairLabelText"
              textAnchor="middle"
            >
              {hoverXLabel}
            </text>
            <rect
              x={margin.left - hoverYLabelWidth - 12}
              y={hoverYLabelY}
              width={hoverYLabelWidth}
              height={22}
              rx={6}
              className="crosshairLabel"
            />
            <text
              x={margin.left - 12 - hoverYLabelWidth / 2}
              y={hoverYLabelY + 15}
              className="crosshairLabelText"
              textAnchor="middle"
            >
              {hoverYLabel}
            </text>
          </g>
        ) : null}

        {points.map((point) => (
          <g
            key={point.item.id}
            className={[
              "plotPoint",
              hoveredPointId === point.item.id ? "active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            tabIndex={0}
            role="button"
            aria-label={[
              point.item.label,
              point.item.slotLabel,
              `거래 가능 ${point.item.tradeCount}회`,
              `가격 ${formatNumber(point.item.price)}골드`,
              `점수 +${formatNumber(point.item.deltaScore)}`,
              `1점당 ${formatInteger(point.item.goldPerScore)}골드`,
              point.item.details
            ].join(", ")}
            onFocus={() => setHoveredPointId(point.item.id)}
            onBlur={() => setHoveredPointId(null)}
            onMouseEnter={() => setHoveredPointId(point.item.id)}
            onMouseLeave={() => setHoveredPointId(null)}
            onClick={() => onPointSelect(point.item.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return;
              }

              event.preventDefault();
              onPointSelect(point.item.id);
            }}
          >
            <circle
              cx={point.x}
              cy={point.y}
              r={13}
              fill="transparent"
              className="plotPointHitArea"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={6}
              fill={point.color}
              className="plotPointVisual"
            />
          </g>
        ))}

        <text x={margin.left + plotWidth / 2} y={height - 8} className="axisLabel" textAnchor="middle">
          {mode === "priceScore" ? "총 가격" : "1점당 골드"}
        </text>
        <text
          x={18}
          y={margin.top + plotHeight / 2}
          className="axisLabel"
          textAnchor="middle"
          transform={`rotate(-90 18 ${margin.top + plotHeight / 2})`}
        >
          점수 상승량
        </text>
      </svg>
      <div className="graphLegend">
        <span className="legendItem"><i className="legendDot trade0" />0회 가능</span>
        <span className="legendItem"><i className="legendDot trade1" />1회 가능</span>
        <span className="legendItem"><i className="legendDot trade2" />2회 가능</span>
        <span>선: 더 싸거나 효율 좋은 후보 중 점수 고점 경계</span>
      </div>
    </div>
  );
}

function CharacterPanel({
  character,
  scoringMode
}: {
  character: CharacterSummary;
  scoringMode: ScoringMode;
}) {
  const accessories = Object.values(character.accessories);

  return (
    <section className="characterPanel">
      <div className="characterSummary">
        <div>
          <p>{character.serverName}</p>
          <h1>{character.characterName}</h1>
          <span>{character.className}</span>
        </div>
        <div className="summaryNumbers">
          <Metric
            label="현재 LOPEC"
            value={formatNumber(character.lopecScore ?? character.combatPower)}
          />
          <Metric label="인게임 전투력" value={formatNumber(character.combatPower)} />
          <Metric label="아이템 레벨" value={formatNumber(character.itemAvgLevel)} />
        </div>
      </div>

      <div className="equippedGrid">
        {accessories.map((accessory) => (
          <article className="equippedCard" key={accessory.slot}>
            <span className="badge">{SLOT_LABELS[accessory.slot]}</span>
            <strong>{accessory.name}</strong>
            <p>
              <AccessoryGradeText grade={accessory.grade} /> · 품질 {accessory.quality}
            </p>
            <StatLine stats={accessory.stats} type={accessory.type} />
            <RefinementOptionList
              accessoryType={accessory.type}
              options={accessory.refinementOptions}
              fallback={accessory.effectSummary}
              scoringMode={scoringMode}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function SlotTargetGrid({
  character,
  selectedSlots,
  onToggle,
  scoringMode
}: {
  character: CharacterSummary;
  selectedSlots: AccessorySlot[];
  onToggle: (slot: AccessorySlot) => void;
  scoringMode: ScoringMode;
}) {
  return (
    <div
      className="slotTargetGrid"
      aria-label={`교체 대상 슬롯 (${scoringMode === "support" ? "서포터" : "딜러"} 기준)`}
    >
      {ACCESSORY_SLOT_ORDER.map((slot) => {
        const accessory = character.accessories[slot];

        if (!accessory) {
          return null;
        }

        return (
          <label className="slotTargetCard" key={slot}>
            <input
              type="checkbox"
              checked={selectedSlots.includes(slot)}
              onChange={() => onToggle(slot)}
            />
            <span className="badge">{SLOT_LABELS[slot]}</span>
            <strong>{accessory.name}</strong>
            <small>
              <AccessoryGradeText grade={accessory.grade} /> · 품질 {accessory.quality} ·{" "}
              {formatGradeText(accessory) || "유효 옵션 없음"}
            </small>
          </label>
        );
      })}
    </div>
  );
}

function ResultCard({
  result,
  resultId,
  isFocused,
  scoringMode
}: {
  result: EvaluationResult;
  resultId: string;
  isFocused: boolean;
  scoringMode: ScoringMode;
}) {
  const isPositive = result.deltaScore > 0;

  return (
    <article
      className={["itemCard", isFocused ? "graphSelectedCard" : ""].filter(Boolean).join(" ")}
      id={resultElementId(resultId)}
      tabIndex={-1}
    >
      <div className="itemMain">
        <div>
          <span className="badge">{replacementSlotLabel(result.replacedSlot)}</span>
          <h2>{result.candidate.name}</h2>
          <div className="itemMeta">
            <span>
              <AccessoryGradeText grade={result.candidate.grade} /> · 품질{" "}
              {result.candidate.quality}
            </span>
            <span>거래 가능 {result.candidate.tradeAllowCount}회</span>
          </div>
        </div>
        <div className="priceBlock">
          <strong>{formatNumber(result.buyPrice)}</strong>
          <span>골드</span>
        </div>
      </div>

      <div className="candidateDetails">
        <StatLine stats={result.candidate.stats} type={result.replacedAccessory.type} />
      </div>

      <RefinementOptionList
        accessoryType={result.replacedAccessory.type}
        options={result.candidate.refinementOptions}
        fallback={result.candidate.effectSummary}
        scoringMode={scoringMode}
      />

      <div className="compareLine">
        <span>기존: {formatGradeText(result.replacedAccessory)}</span>
      </div>

      <div className="metricGrid">
        <Metric
          label="점수 상승"
          value={`${isPositive ? "+" : ""}${formatNumber(result.deltaScore)}`}
          tone={isPositive ? "positive" : "negative"}
        />
        <Metric label="1점당 골드" value={formatInteger(result.goldPerScore)} />
        <Metric
          label="증가율"
          value={`${result.deltaEfficiency > 0 ? "+" : ""}${formatNumber(
            result.deltaEfficiency
          )}%`}
          tone={result.deltaEfficiency > 0 ? "positive" : "negative"}
        />
      </div>
    </article>
  );
}

function CombinationCard({
  result,
  resultId,
  isFocused,
  scoringMode
}: {
  result: EvaluationCombinationResult;
  resultId: string;
  isFocused: boolean;
  scoringMode: ScoringMode;
}) {
  const isPositive = result.deltaScore > 0;

  return (
    <article
      className={[
        "itemCard",
        "combinationCard",
        isFocused ? "graphSelectedCard" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      id={resultElementId(resultId)}
      tabIndex={-1}
    >
      <div className="itemMain">
        <div>
          <span className="badge">조합 {result.replacements.length}개</span>
          <h2>
            교체: {result.replacements.map((item) => SLOT_LABELS[item.replacedSlot]).join(" + ")}
          </h2>
          <div className="itemMeta">
            <span>총 {formatNumber(result.buyPrice)}골드</span>
            <span>최소 거래 가능 {readCombinationTradeCount(result)}회</span>
            <span>{formatCombinationTradeCounts(result)}</span>
          </div>
        </div>
        <div className="priceBlock">
          <strong>{formatNumber(result.buyPrice)}</strong>
          <span>총 골드</span>
        </div>
      </div>

      <div className="combinationItems">
        {result.replacements.map((replacement) => (
          <div className="combinationItem" key={combinationReplacementKey(replacement)}>
            <div>
              <span className="badge">{replacementSlotLabel(replacement.replacedSlot)}</span>
              <strong>{replacement.candidate.name}</strong>
              <small>
                <AccessoryGradeText grade={replacement.candidate.grade} /> · 품질{" "}
                {replacement.candidate.quality} · {formatNumber(replacement.buyPrice)}골드 · 거래 가능{" "}
                {replacement.candidate.tradeAllowCount}회
              </small>
            </div>
            <StatLine stats={replacement.candidate.stats} type={replacement.replacedAccessory.type} />
            <RefinementOptionList
              accessoryType={replacement.replacedAccessory.type}
              options={replacement.candidate.refinementOptions}
              fallback={replacement.candidate.effectSummary}
              scoringMode={scoringMode}
            />
          </div>
        ))}
      </div>

      <div className="metricGrid">
        <Metric
          label="점수 상승"
          value={`${isPositive ? "+" : ""}${formatNumber(result.deltaScore)}`}
          tone={isPositive ? "positive" : "negative"}
        />
        <Metric label="1점당 골드" value={formatInteger(result.goldPerScore)} />
        <Metric
          label="증가율"
          value={`${result.deltaEfficiency > 0 ? "+" : ""}${formatNumber(
            result.deltaEfficiency
          )}%`}
          tone={result.deltaEfficiency > 0 ? "positive" : "negative"}
        />
      </div>
    </article>
  );
}

function ResultTable({
  results,
  focusedResultId,
  page,
  pageSize,
  sortKey,
  sortDirection,
  scoringMode,
  onSort
}: {
  results: EvaluationResult[];
  focusedResultId: string | null;
  page: number;
  pageSize: number;
  sortKey: TableSortKey;
  sortDirection: SortDirection;
  scoringMode: ScoringMode;
  onSort: (key: TableSortKey) => void;
}) {
  return (
    <div className="resultTableWrap">
      <table className="resultTable">
        <thead>
          <tr>
            <th>#</th>
            <th>매물</th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="가격"
                sortKey="price"
                onSort={onSort}
              />
            </th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="거래"
                sortKey="tradeCount"
                onSort={onSort}
              />
            </th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="스탯"
                sortKey="stat"
                onSort={onSort}
              />
            </th>
            <th>옵션</th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="점수 상승"
                sortKey="deltaScore"
                onSort={onSort}
              />
            </th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="1점당 골드"
                sortKey="goldPerScore"
                onSort={onSort}
              />
            </th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="증가율"
                sortKey="efficiency"
                onSort={onSort}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => {
            const rank = (page - 1) * pageSize + index + 1;
            const isPositive = result.deltaScore > 0;
            const rowId = resultKey(result);

            return (
              <tr
                className={focusedResultId === rowId ? "graphSelectedRow" : ""}
                id={resultElementId(rowId)}
                key={rowId}
                tabIndex={-1}
              >
                <td>{rank}</td>
                <td>
                  <div className="tableItemName">
                    <span className="badge">{replacementSlotLabel(result.replacedSlot)}</span>
                    <strong>{result.candidate.name}</strong>
                    <small>
                      <AccessoryGradeText grade={result.candidate.grade} /> · 품질{" "}
                      {result.candidate.quality}
                    </small>
                  </div>
                </td>
                <td>
                  <strong>{formatNumber(result.buyPrice)}</strong>
                  <small>골드</small>
                </td>
                <td>
                  <strong>{result.candidate.tradeAllowCount}회</strong>
                  <small>거래 가능</small>
                </td>
                <td>
                  <StatLine stats={result.candidate.stats} type={result.replacedAccessory.type} />
                </td>
                <td>
                  <RefinementOptionList
                    accessoryType={result.replacedAccessory.type}
                    options={result.candidate.refinementOptions}
                    fallback={result.candidate.effectSummary}
                    scoringMode={scoringMode}
                  />
                </td>
                <td>
                  <strong className={isPositive ? "positive" : "negative"}>
                    {isPositive ? "+" : ""}
                    {formatNumber(result.deltaScore)}
                  </strong>
                  <small>{formatNumber(result.baseScore)} → {formatNumber(result.nextScore)}</small>
                </td>
                <td>
                  <strong>{formatInteger(result.goldPerScore)}</strong>
                  <small>골드/점</small>
                </td>
                <td>
                  <strong>{formatNumber(result.candidateEfficiency)}%</strong>
                  <small className={result.deltaEfficiency > 0 ? "positive" : "negative"}>
                    {result.deltaEfficiency > 0 ? "+" : ""}
                    {formatNumber(result.deltaEfficiency)}%
                  </small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CombinationTable({
  results,
  focusedResultId,
  page,
  pageSize,
  sortKey,
  sortDirection,
  scoringMode,
  onSort
}: {
  results: EvaluationCombinationResult[];
  focusedResultId: string | null;
  page: number;
  pageSize: number;
  sortKey: TableSortKey;
  sortDirection: SortDirection;
  scoringMode: ScoringMode;
  onSort: (key: TableSortKey) => void;
}) {
  return (
    <div className="resultTableWrap">
      <table className="resultTable combinationTable">
        <thead>
          <tr>
            <th>#</th>
            <th>교체 악세</th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="총 가격"
                sortKey="price"
                onSort={onSort}
              />
            </th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="점수 상승"
                sortKey="deltaScore"
                onSort={onSort}
              />
            </th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="1점당 골드"
                sortKey="goldPerScore"
                onSort={onSort}
              />
            </th>
            <th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="증가율"
                sortKey="efficiency"
                onSort={onSort}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => {
            const rank = (page - 1) * pageSize + index + 1;
            const isPositive = result.deltaScore > 0;
            const rowId = combinationKey(result);

            return (
              <tr
                className={focusedResultId === rowId ? "graphSelectedRow" : ""}
                id={resultElementId(rowId)}
                key={rowId}
                tabIndex={-1}
              >
                <td>{rank}</td>
                <td>
                  <div className="combinationDetailGrid">
                    <div className="combinationDetailHeader">
                      <span>악세</span>
                      <span>거래</span>
                      <span>힘/민/지</span>
                      <span>옵션</span>
                    </div>
                    {result.replacements.map((replacement) => (
                      <div
                        className="combinationDetailRow"
                        key={combinationReplacementKey(replacement)}
                      >
                        <div className="combinationDetailItem">
                          <span className="badge">{replacementSlotLabel(replacement.replacedSlot)}</span>
                          <strong>{replacement.candidate.name}</strong>
                          <small>
                            <AccessoryGradeText grade={replacement.candidate.grade} /> · 품질{" "}
                            {replacement.candidate.quality} · {formatNumber(replacement.buyPrice)}골드
                          </small>
                        </div>
                        <div className="combinationDetailMetric">
                          <strong>{replacement.candidate.tradeAllowCount}회</strong>
                          <small>거래 가능</small>
                        </div>
                        <div className="combinationDetailMetric">
                          <strong>{formatNumber(readMainStat(replacement.candidate.stats))}</strong>
                          <small>주 스탯</small>
                        </div>
                        <div className="combinationDetailOptions">
                          <RefinementOptionList
                            accessoryType={replacement.replacedAccessory.type}
                            options={replacement.candidate.refinementOptions}
                            fallback={replacement.candidate.effectSummary}
                            scoringMode={scoringMode}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <strong>{formatNumber(result.buyPrice)}</strong>
                  <small>총 골드</small>
                </td>
                <td>
                  <strong className={isPositive ? "positive" : "negative"}>
                    {isPositive ? "+" : ""}
                    {formatNumber(result.deltaScore)}
                  </strong>
                  <small>{formatNumber(result.baseScore)} → {formatNumber(result.nextScore)}</small>
                </td>
                <td>
                  <strong>{formatInteger(result.goldPerScore)}</strong>
                  <small>골드/점</small>
                </td>
                <td>
                  <strong>{formatNumber(result.deltaEfficiency)}%</strong>
                  <small className={result.deltaEfficiency > 0 ? "positive" : "negative"}>
                    {result.deltaEfficiency > 0 ? "+" : ""}
                    {formatNumber(result.deltaEfficiency)}%
                  </small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort
}: {
  label: string;
  sortKey: TableSortKey;
  activeKey: TableSortKey;
  direction: SortDirection;
  onSort: (key: TableSortKey) => void;
}) {
  const isActive = activeKey === sortKey;

  return (
    <button
      type="button"
      className={["tableSortButton", isActive ? "active" : ""].filter(Boolean).join(" ")}
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      <span aria-hidden="true">{isActive ? (direction === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
  );
}

function Pagination({
  currentPage,
  totalPages,
  items,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  items: Array<number | string>;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="검색 결과 페이지">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        이전
      </button>
      <div className="pageButtons">
        {items.map((item, index) =>
          typeof item === "number" ? (
            <button
              type="button"
              className={item === currentPage ? "active" : ""}
              key={item}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ) : (
            <span key={`${item}-${index}`}>{item}</span>
          )
        )}
      </div>
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        다음
      </button>
    </nav>
  );
}

function StatLine({ stats, type }: { stats: AccessoryStats; type: AccessoryType }) {
  if (!hasStats(stats)) {
    return <div className="statLine muted">기본 스탯 정보 없음</div>;
  }

  const statPercent = calculateAccessoryStatPercent(stats, type);

  return (
    <div className="statLine">
      <span>
        힘/민/지 {formatMainStats(stats)}
        {statPercent !== null ? (
          <>
            {" "}
            · <span className="statPercent">스탯 {formatNumber(statPercent)}%</span>
          </>
        ) : null}
      </span>
      {stats.health > 0 ? <span>체력 +{formatNumber(stats.health)}</span> : null}
    </div>
  );
}

function AccessoryGradeText({ grade }: { grade: string }) {
  const gradeClass =
    grade === "고대" ? "ancient" : grade === "유물" ? "relic" : "";

  return (
    <span className={["accessoryGradeText", gradeClass].filter(Boolean).join(" ")}>
      {grade}
    </span>
  );
}

function RefinementOptionList({
  accessoryType,
  options,
  fallback,
  scoringMode
}: {
  accessoryType: AccessoryType;
  options: AccessoryRefinementOption[];
  fallback: string[];
  scoringMode: ScoringMode;
}) {
  if (options.length === 0) {
    return <div className="optionLine">{fallback.length > 0 ? fallback.join(" · ") : "유효 옵션 없음"}</div>;
  }

  return (
    <div className="refinementList">
      {options.slice(0, 3).map((option, index) => {
        const isEffective = isEffectiveRefinementOption(option, scoringMode, accessoryType);

        return (
          <span
            className={[
              isEffective ? "effective" : "inactive",
              option.grade ? gradeClassName(option.grade) : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={`${option.label}-${option.value}-${index}`}
          >
            {option.grade ? <b className={gradeClassName(option.grade)}>{option.grade}</b> : null}
            {option.label} +{formatNumber(option.value)}
            {option.suffix}
          </span>
        );
      })}
    </div>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function getDefaultEffects(type: AccessoryType, scoringMode: ScoringMode): EffectOption[] {
  return EFFECT_OPTIONS[scoringMode][type].map((option) => option.value);
}

function getSelectedEffectGrades(
  type: AccessoryType,
  scoringMode: ScoringMode,
  selectedGrades: Record<EffectOption, SearchOptionGrade>
) {
  return getDefaultEffects(type, scoringMode)
    .map((effect) => ({
      effect,
      grade: selectedGrades[effect]
    }))
    .filter((item): item is { effect: EffectOption; grade: OptionGrade } =>
      isConcreteGrade(item.grade)
    );
}

function isConcreteGrade(grade: SearchOptionGrade): grade is OptionGrade {
  return grade === "상" || grade === "중" || grade === "하";
}

function getExcludedEffectOptions(
  type: AccessoryType,
  scoringMode: ScoringMode,
  selectedGrades: Record<EffectOption, SearchOptionGrade>
): EffectOption[] {
  return getDefaultEffects(type, scoringMode).filter((effect) => selectedGrades[effect] === "선택");
}

function createApiKeyHeaders(apiKey: string): HeadersInit {
  return apiKey
    ? {
        "x-lostark-api-key": apiKey
      }
    : {};
}

function formatApiKeySuccessMessage(): string {
  return "개인 API 키 사용 가능";
}

function formatVerificationStatusText(
  status: LopecVerificationStatus | null,
  isRunning: boolean,
  error: string | null
): string {
  if (isRunning) {
    return "최신 로펙 수식과 비교 중";
  }

  if (error) {
    return error;
  }

  if (!status?.lastSuccessAt) {
    return "검증 이력 없음";
  }

  const lastSuccessText = formatDateTime(status.lastSuccessAt);

  if (status.isFresh) {
    return `최신버전 · ${lastSuccessText}`;
  }

  return `마지막 검증 ${lastSuccessText}`;
}

function readRetryRemainingSeconds(progress: SearchProgressState, now: number): number | null {
  if (!progress.retryStartedAt || !progress.retryDelayMs) {
    return null;
  }

  const retryEndsAt = progress.retryStartedAt + progress.retryDelayMs;

  return Math.max(0, Math.ceil((retryEndsAt - now) / 1000));
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildPaginationItems(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);

  if (currentPage > 1) {
    pages.add(currentPage - 1);
  }

  if (currentPage < totalPages) {
    pages.add(currentPage + 1);
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  const items: Array<number | string> = [];

  sortedPages.forEach((page, index) => {
    const previous = sortedPages[index - 1];

    if (previous && page - previous > 1) {
      items.push("...");
    }

    items.push(page);
  });

  return items;
}

function sortCardResults(results: EvaluationResult[], sortMode: CardSortMode): EvaluationResult[] {
  return [...results].sort((a, b) => {
    if (sortMode === "priceAsc") {
      return (
        compareNumberAsc(a.buyPrice, b.buyPrice) ||
        compareNumberDesc(a.deltaScore, b.deltaScore) ||
        compareNumberAsc(a.goldPerScore, b.goldPerScore)
      );
    }

    if (sortMode === "deltaScoreDesc") {
      return (
        compareNumberDesc(a.deltaScore, b.deltaScore) ||
        compareNumberAsc(a.goldPerScore, b.goldPerScore) ||
        compareNumberAsc(a.buyPrice, b.buyPrice)
      );
    }

    return (
      compareNumberAsc(a.goldPerScore, b.goldPerScore) ||
      compareNumberDesc(a.deltaScore, b.deltaScore) ||
      compareNumberAsc(a.buyPrice, b.buyPrice)
    );
  });
}

function sortTableResults(
  results: EvaluationResult[],
  sortKey: TableSortKey,
  direction: SortDirection
): EvaluationResult[] {
  return [...results].sort((a, b) => {
    const comparison =
      direction === "asc"
        ? compareNumberAsc(readTableSortValue(a, sortKey), readTableSortValue(b, sortKey))
        : compareNumberDesc(readTableSortValue(a, sortKey), readTableSortValue(b, sortKey));

    return (
      comparison ||
      compareNumberAsc(a.goldPerScore, b.goldPerScore) ||
      compareNumberDesc(a.deltaScore, b.deltaScore) ||
      compareNumberAsc(a.buyPrice, b.buyPrice)
    );
  });
}

function sortCombinationCardResults(
  results: EvaluationCombinationResult[],
  sortMode: CardSortMode
): EvaluationCombinationResult[] {
  return [...results].sort((a, b) => {
    if (sortMode === "priceAsc") {
      return (
        compareNumberAsc(a.buyPrice, b.buyPrice) ||
        compareNumberDesc(a.deltaScore, b.deltaScore) ||
        compareNumberAsc(a.goldPerScore, b.goldPerScore)
      );
    }

    if (sortMode === "deltaScoreDesc") {
      return (
        compareNumberDesc(a.deltaScore, b.deltaScore) ||
        compareNumberAsc(a.goldPerScore, b.goldPerScore) ||
        compareNumberAsc(a.buyPrice, b.buyPrice)
      );
    }

    return (
      compareNumberAsc(a.goldPerScore, b.goldPerScore) ||
      compareNumberDesc(a.deltaScore, b.deltaScore) ||
      compareNumberAsc(a.buyPrice, b.buyPrice)
    );
  });
}

function sortCombinationTableResults(
  results: EvaluationCombinationResult[],
  sortKey: TableSortKey,
  direction: SortDirection
): EvaluationCombinationResult[] {
  return [...results].sort((a, b) => {
    const comparison =
      direction === "asc"
        ? compareNumberAsc(
            readCombinationSortValue(a, sortKey),
            readCombinationSortValue(b, sortKey)
          )
        : compareNumberDesc(
            readCombinationSortValue(a, sortKey),
            readCombinationSortValue(b, sortKey)
          );

    return (
      comparison ||
      compareNumberDesc(a.deltaScore, b.deltaScore) ||
      compareNumberAsc(a.goldPerScore, b.goldPerScore) ||
      compareNumberAsc(a.buyPrice, b.buyPrice)
    );
  });
}

function readTableSortValue(result: EvaluationResult, sortKey: TableSortKey): number {
  if (sortKey === "price") {
    return result.buyPrice;
  }

  if (sortKey === "tradeCount") {
    return result.candidate.tradeAllowCount;
  }

  if (sortKey === "stat") {
    return readMainStat(result.candidate.stats);
  }

  if (sortKey === "deltaScore") {
    return result.deltaScore;
  }

  if (sortKey === "efficiency") {
    return result.deltaEfficiency;
  }

  return result.goldPerScore;
}

function readCombinationSortValue(
  result: EvaluationCombinationResult,
  sortKey: TableSortKey
): number {
  if (sortKey === "price") {
    return result.buyPrice;
  }

  if (sortKey === "tradeCount") {
    return readCombinationTradeCount(result);
  }

  if (sortKey === "stat") {
    return readCombinationMainStat(result);
  }

  if (sortKey === "deltaScore") {
    return result.deltaScore;
  }

  if (sortKey === "efficiency") {
    return result.deltaEfficiency;
  }

  return result.goldPerScore;
}

function getDefaultTableSortDirection(sortKey: TableSortKey): SortDirection {
  if (sortKey === "price" || sortKey === "goldPerScore") {
    return "asc";
  }

  return "desc";
}

function buildResultGraphItems(results: EvaluationResult[]): GraphItem[] {
  return results
    .filter((result) => result.deltaScore > 0 && Number.isFinite(result.goldPerScore))
    .map((result) => ({
      id: resultKey(result),
      label: result.candidate.name,
      slotLabel: replacementSlotLabel(result.replacedSlot),
      price: result.buyPrice,
      deltaScore: result.deltaScore,
      goldPerScore: result.goldPerScore,
      tradeCount: result.candidate.tradeAllowCount,
      details: formatGradeText({
        effectGrades: result.candidate.effectGrades,
        effectSummary: result.candidate.effectSummary
      })
    }));
}

function buildCombinationGraphItems(results: EvaluationCombinationResult[]): GraphItem[] {
  return results
    .filter((result) => result.deltaScore > 0 && Number.isFinite(result.goldPerScore))
    .map((result) => ({
      id: combinationKey(result),
      label: result.replacements
        .map((replacement) => SLOT_LABELS[replacement.replacedSlot])
        .join(" + "),
      slotLabel: `교체 ${result.replacements.length}개`,
      price: result.buyPrice,
      deltaScore: result.deltaScore,
      goldPerScore: result.goldPerScore,
      tradeCount: readCombinationTradeCount(result),
      details: [
        `거래 가능 ${formatCombinationTradeCounts(result)}`,
        result.replacements
          .map(
            (replacement) =>
              `${SLOT_LABELS[replacement.replacedSlot]} ${formatGradeText({
                effectGrades: replacement.candidate.effectGrades,
                effectSummary: replacement.candidate.effectSummary
              })}`
          )
          .join(" / ")
      ].join(" · ")
    }));
}

interface PlotPoint {
  item: GraphItem;
  xValue: number;
  yValue: number;
  x: number;
  y: number;
  color: string;
}

function readGraphXValue(item: GraphItem, mode: GraphMode): number {
  return mode === "priceScore" ? item.price : item.goldPerScore;
}

function buildGraphAutoRange(items: GraphItem[], mode: GraphMode): GraphRangeSelection {
  return {
    x: buildRange(items.map((item) => readGraphXValue(item, mode))),
    y: buildRange(items.map((item) => item.deltaScore), undefined, false)
  };
}

function formatGraphRangeInput(range: GraphRangeSelection): GraphRangeInput {
  return {
    xMin: formatRangeInputValue(range.x.min),
    xMax: formatRangeInputValue(range.x.max),
    yMin: formatRangeInputValue(range.y.min),
    yMax: formatRangeInputValue(range.y.max)
  };
}

function parseGraphRangeInput(
  input: GraphRangeInput,
  fallback: GraphRangeSelection
): GraphRangeSelection {
  return {
    x: normalizeAxisRange({
      min: parseRangeInputValue(input.xMin) ?? fallback.x.min,
      max: parseRangeInputValue(input.xMax) ?? fallback.x.max
    }),
    y: normalizeAxisRange({
      min: parseRangeInputValue(input.yMin) ?? fallback.y.min,
      max: parseRangeInputValue(input.yMax) ?? fallback.y.max
    })
  };
}

function normalizeAxisRange(range: GraphAxisRange): GraphAxisRange {
  if (range.min === range.max) {
    return {
      min: range.min - 1,
      max: range.max + 1
    };
  }

  return range.min < range.max
    ? range
    : {
        min: range.max,
        max: range.min
      };
}

function parseRangeInputValue(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatRangeInputValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return String(Math.round(value * 100) / 100);
}

function buildRange(
  values: number[],
  minimumValue?: number,
  clampMinimum = true
): { min: number; max: number } {
  const finiteValues = values.filter(Number.isFinite);
  let min = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  const max = finiteValues.length > 0 ? Math.max(...finiteValues) : 1;

  if (minimumValue !== undefined) {
    min = Math.min(min, minimumValue);
  }

  if (min === max) {
    return {
      min: clampMinimum ? Math.max(0, min - 1) : min - 1,
      max: max + 1
    };
  }

  const padding = (max - min) * 0.08;

  return {
    min: clampMinimum ? Math.max(0, min - padding) : min - padding,
    max: max + padding
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeToRange(value: number, range: { min: number; max: number }): number {
  if (range.max === range.min) {
    return 0.5;
  }

  return (value - range.min) / (range.max - range.min);
}

function buildTicks(range: { min: number; max: number }, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const value = range.min + ((range.max - range.min) / count) * index;
    return value;
  });
}

function buildFrontier(points: PlotPoint[]): PlotPoint[] {
  let bestY = Number.NEGATIVE_INFINITY;

  return [...points]
    .sort((a, b) => a.xValue - b.xValue)
    .filter((point) => {
      if (point.yValue <= bestY) {
        return false;
      }

      bestY = point.yValue;
      return true;
    });
}

function readTradeCountPointColor(tradeCount: number): string {
  if (tradeCount >= 2) {
    return "#17995b";
  }

  if (tradeCount >= 1) {
    return "#e38a13";
  }

  return "#d64545";
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

function resultKey(result: EvaluationResult): string {
  return `${result.candidate.name}-${result.candidate.endDate}-${result.buyPrice}-${result.replacedSlot}`;
}

function replacementSlotLabel(slot: string): string {
  return `교체: ${SLOT_LABELS[slot] ?? slot}`;
}

function resultElementId(resultId: string): string {
  return `result-${encodeURIComponent(resultId).replace(/%/g, "_")}`;
}

function combinationKey(result: EvaluationCombinationResult): string {
  return result.replacements.map(combinationReplacementKey).join("|");
}

function combinationReplacementKey(replacement: EvaluationCombinationReplacement): string {
  return `${replacement.replacedSlot}-${replacement.candidate.name}-${replacement.candidate.endDate}-${replacement.buyPrice}`;
}

function readCombinationTradeCount(result: EvaluationCombinationResult): number {
  return Math.min(
    ...result.replacements.map((replacement) => replacement.candidate.tradeAllowCount)
  );
}

function formatCombinationTradeCounts(result: EvaluationCombinationResult): string {
  return result.replacements
    .map((replacement) => `${SLOT_LABELS[replacement.replacedSlot]} ${replacement.candidate.tradeAllowCount}회`)
    .join(" · ");
}

function readCombinationMainStat(result: EvaluationCombinationResult): number {
  return result.replacements.reduce(
    (sum, replacement) => sum + readMainStat(replacement.candidate.stats),
    0
  );
}

function calculateAccessoryStatPercent(
  stats: AccessoryStats,
  type: AccessoryType
): number | null {
  const mainStat = readMainStat(stats);
  const range = ACCESSORY_STAT_RANGES[type];

  if (mainStat <= 0 || !range) {
    return null;
  }

  return Math.round(((mainStat - range.min) / range.range) * 10000) / 100;
}

function readMainStat(stats: AccessoryStats): number {
  return Math.max(stats.strength, stats.dexterity, stats.intelligence);
}

function hasStats(stats: AccessoryStats): boolean {
  return stats.strength > 0 || stats.dexterity > 0 || stats.intelligence > 0;
}

function parseNullableNumberInput(value: string): number | null {
  const trimmedValue = normalizeNumberInput(value);

  if (!trimmedValue) {
    return null;
  }

  const numberValue = Number(trimmedValue);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeNumberInput(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function formatNumberInput(value: string): string {
  const normalizedValue = normalizeNumberInput(value);

  if (!normalizedValue) {
    return "";
  }

  return Number(normalizedValue).toLocaleString("ko-KR", {
    maximumFractionDigits: 0
  });
}

function gradeClassName(grade: OptionGrade): string {
  if (grade === "상") {
    return "gradeHigh";
  }

  if (grade === "중") {
    return "gradeMiddle";
  }

  return "gradeLow";
}

function isEffectiveRefinementOption(
  option: Pick<AccessoryRefinementOption, "label" | "suffix">,
  scoringMode: ScoringMode,
  accessoryType: AccessoryType
): boolean {
  return EFFECTIVE_REFINEMENT_KEYS[scoringMode][accessoryType].has(
    `${option.label}${option.suffix}`
  );
}

function formatMainStats(stats: AccessoryStats): string {
  const values = [stats.strength, stats.dexterity, stats.intelligence];
  const nonZeroValues = values.filter((value) => value > 0);

  if (
    nonZeroValues.length === 3 &&
    stats.strength === stats.dexterity &&
    stats.dexterity === stats.intelligence
  ) {
    return `+${formatNumber(stats.strength)}`;
  }

  return `힘 +${formatNumber(stats.strength)} · 민 +${formatNumber(
    stats.dexterity
  )} · 지 +${formatNumber(stats.intelligence)}`;
}

function formatGradeText(accessory: Pick<AccessorySummary, "effectGrades" | "effectSummary">): string {
  if (accessory.effectGrades.length === 0) {
    return accessory.effectSummary.join(" · ");
  }

  return accessory.effectGrades
    .map((grade) =>
      `${grade.grade ? `${grade.grade} ` : ""}${grade.label} +${formatNumber(grade.value)}${grade.suffix}`
    )
    .join(" · ");
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: 3
  });
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (Math.abs(value) >= 10000) {
    return value.toLocaleString("ko-KR", {
      notation: "compact",
      maximumFractionDigits: 1
    });
  }

  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: value >= 100 ? 0 : 1
  });
}

function formatInteger(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return Math.round(value).toLocaleString("ko-KR", {
    maximumFractionDigits: 0
  });
}
