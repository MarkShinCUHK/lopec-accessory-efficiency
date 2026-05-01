import type {
  LostarkAuctionItem,
  LostarkEquipmentItem
} from "@/lib/lostark/types";

export type AccessoryType = "necklace" | "earring" | "ring";
export type AccessoryScoringMode = "dealer" | "support";
export type AccessorySlot =
  | "necklace"
  | "earring1"
  | "earring2"
  | "ring1"
  | "ring2";

export interface AccessoryEffects {
  additionalDamage: number;
  enemyDamage: number;
  attackPowerPercent: number;
  attackPowerFlat: number;
  weaponAttackPercent: number;
  weaponAttackFlat: number;
  critRate: number;
  critDamage: number;
  brandPower: number;
  identityGauge: number;
  allyAttackBuff: number;
  allyDamageBuff: number;
  partyShield: number;
  partyHeal: number;
  enlightenment: number;
  health: number;
}

export interface AccessoryStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  health: number;
}

export interface AccessoryEffectGrade {
  label: string;
  grade: "상" | "중" | "하" | null;
  value: number;
  suffix: string;
}

export interface AccessoryRefinementOption {
  label: string;
  grade: "상" | "중" | "하" | null;
  value: number;
  suffix: string;
  isEffective: boolean;
}

export interface AccessoryState {
  slot: AccessorySlot;
  type: AccessoryType;
  name: string;
  grade: string;
  quality: number;
  icon?: string;
  stats: AccessoryStats;
  effects: AccessoryEffects;
  effectSummary: string[];
  effectGrades: AccessoryEffectGrade[];
  refinementOptions: AccessoryRefinementOption[];
}

export interface AccessoryCandidate extends Omit<AccessoryState, "slot"> {
  auctionId: string;
  level: number;
  buyPrice: number | null;
  bidStartPrice: number | null;
  endDate: string;
  tradeAllowCount: number;
}

export const ACCESSORY_CATEGORY_CODES: Record<AccessoryType, number> = {
  necklace: 200010,
  earring: 200020,
  ring: 200030
};

const ACCESSORY_TYPE_BY_KOREAN: Record<string, AccessoryType | undefined> = {
  목걸이: "necklace",
  귀걸이: "earring",
  반지: "ring"
};

const BASE_STAT_OPTION_NAMES = new Set(["힘", "민첩", "지능", "체력", "깨달음"]);

const EMPTY_EFFECTS: AccessoryEffects = {
  additionalDamage: 0,
  enemyDamage: 0,
  attackPowerPercent: 0,
  attackPowerFlat: 0,
  weaponAttackPercent: 0,
  weaponAttackFlat: 0,
  critRate: 0,
  critDamage: 0,
  brandPower: 0,
  identityGauge: 0,
  allyAttackBuff: 0,
  allyDamageBuff: 0,
  partyShield: 0,
  partyHeal: 0,
  enlightenment: 0,
  health: 0
};

const EMPTY_STATS: AccessoryStats = {
  strength: 0,
  dexterity: 0,
  intelligence: 0,
  health: 0
};

export function emptyEffects(): AccessoryEffects {
  return { ...EMPTY_EFFECTS };
}

export function emptyStats(): AccessoryStats {
  return { ...EMPTY_STATS };
}

export function totalMainStat(stats: Pick<AccessoryStats, "strength" | "dexterity" | "intelligence">): number {
  return stats.strength + stats.dexterity + stats.intelligence;
}

export function getReplaceableSlots(type: AccessoryType): AccessorySlot[] {
  if (type === "necklace") {
    return ["necklace"];
  }

  if (type === "earring") {
    return ["earring1", "earring2"];
  }

  return ["ring1", "ring2"];
}

export function accessoryTypeLabel(type: AccessoryType): string {
  if (type === "necklace") {
    return "목걸이";
  }

  if (type === "earring") {
    return "귀걸이";
  }

  return "반지";
}

export function parseAccessoryFromEquipment(
  item: LostarkEquipmentItem,
  slot: AccessorySlot
): AccessoryState | null {
  const type = ACCESSORY_TYPE_BY_KOREAN[item.Type];

  if (!type) {
    return null;
  }

  const tooltip = parseTooltip(item.Tooltip);
  const quality = readQuality(tooltip);
  const partBoxes = readPartBoxes(tooltip);
  const partTexts = partBoxes.flatMap((partBox) => [partBox.title, partBox.text]);
  const partText = partTexts.join("\n");
  const refinementText = partBoxes
    .filter((partBox) => partBox.title.includes("연마 효과"))
    .map((partBox) => partBox.text)
    .join(" ");
  const effects = parseEffectsFromText(partText);

  return {
    slot,
    type,
    name: item.Name,
    grade: item.Grade,
    quality,
    icon: item.Icon,
    stats: parseStatsFromText(partText),
    effects,
    effectSummary: summarizeEffects(effects),
    effectGrades: gradeEffects(effects),
    refinementOptions: parseRefinementOptionsFromText(refinementText)
  };
}

export function parseAccessoryFromAuctionItem(
  item: LostarkAuctionItem,
  type: AccessoryType
): AccessoryCandidate {
  const effects = emptyEffects();
  const stats = emptyStats();

  for (const option of item.Options ?? []) {
    const value = option.Value;
    const name = option.OptionName.trim();

    if (name === "추가 피해") {
      effects.additionalDamage += value;
    } else if (name === "적에게 주는 피해 증가") {
      effects.enemyDamage += value;
    } else if (name === "공격력 %" || (name === "공격력" && option.IsValuePercentage)) {
      effects.attackPowerPercent += value;
    } else if (name === "공격력 +" || (name === "공격력" && !option.IsValuePercentage)) {
      effects.attackPowerFlat += value;
    } else if (name === "무기 공격력 %" || (name === "무기 공격력" && option.IsValuePercentage)) {
      effects.weaponAttackPercent += value;
    } else if (name === "무기 공격력 +" || (name === "무기 공격력" && !option.IsValuePercentage)) {
      effects.weaponAttackFlat += value;
    } else if (name === "치명타 적중률") {
      effects.critRate += value;
    } else if (name === "치명타 피해") {
      effects.critDamage += value;
    } else if (name === "낙인력") {
      effects.brandPower += value;
    } else if (name === "세레나데, 신앙, 조화 게이지 획득량 증가") {
      effects.identityGauge += value;
    } else if (name === "아군 공격력 강화 효과") {
      effects.allyAttackBuff += value;
    } else if (name === "아군 피해량 강화 효과") {
      effects.allyDamageBuff += value;
    } else if (name === "파티원 보호막 효과") {
      effects.partyShield += value;
    } else if (name === "파티원 회복 효과") {
      effects.partyHeal += value;
    } else if (name === "깨달음") {
      effects.enlightenment += value;
    } else if (name === "체력") {
      effects.health += value;
      stats.health += value;
    } else if (name === "힘") {
      stats.strength += value;
    } else if (name === "민첩") {
      stats.dexterity += value;
    } else if (name === "지능") {
      stats.intelligence += value;
    }
  }

  return {
    auctionId: `${item.Name}-${item.AuctionInfo.EndDate}-${item.AuctionInfo.BuyPrice ?? "bid"}`,
    type,
    name: item.Name,
    grade: item.Grade,
    quality: item.GradeQuality,
    icon: item.Icon,
    level: item.Level,
    buyPrice: item.AuctionInfo.BuyPrice,
    bidStartPrice: item.AuctionInfo.BidStartPrice,
    endDate: item.AuctionInfo.EndDate,
    tradeAllowCount: item.AuctionInfo.TradeAllowCount,
    stats,
    effects,
    effectSummary: summarizeEffects(effects),
    effectGrades: gradeEffects(effects),
    refinementOptions: parseRefinementOptionsFromAuctionItem(item)
  };
}

export function parseEquipmentMainStat(item: LostarkEquipmentItem): number {
  const tooltip = parseTooltip(item.Tooltip);
  const partText = readPartBoxes(tooltip)
    .flatMap((partBox) => [partBox.title, partBox.text])
    .join("\n");

  return totalMainStat(parseStatsFromText(partText));
}

export function parseEquipmentWeaponAttack(item: LostarkEquipmentItem): number {
  const tooltip = parseTooltip(item.Tooltip);
  const partText = readPartBoxes(tooltip)
    .flatMap((partBox) => [partBox.title, partBox.text])
    .join("\n");

  return readFlat(partText, "무기 공격력");
}

export function parseEquipmentQuality(item: LostarkEquipmentItem): number {
  return readQuality(parseTooltip(item.Tooltip));
}

function parseTooltip(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readQuality(tooltip: Record<string, unknown>): number {
  for (const value of Object.values(tooltip)) {
    if (!isRecord(value) || value.type !== "ItemTitle" || !isRecord(value.value)) {
      continue;
    }

    const quality = value.value.qualityValue;
    return typeof quality === "number" ? quality : 0;
  }

  return 0;
}

function readPartBoxes(tooltip: Record<string, unknown>): Array<{ title: string; text: string }> {
  const boxes: Array<{ title: string; text: string }> = [];

  for (const value of Object.values(tooltip)) {
    if (!isRecord(value) || value.type !== "ItemPartBox" || !isRecord(value.value)) {
      continue;
    }

    const rawTitle = value.value.Element_000;
    const rawText = value.value.Element_001;

    if (typeof rawTitle === "string" && typeof rawText === "string") {
      boxes.push({
        title: stripHtml(rawTitle),
        text: stripHtml(rawText)
      });
    }
  }

  return boxes;
}

function parseEffectsFromText(text: string): AccessoryEffects {
  const effects = emptyEffects();
  const textWithoutWeaponAttack = text.replace(
    /무기\s*공격력\s*\+\s*[0-9][0-9,.]*(?:\.[0-9]+)?\s*%?/g,
    ""
  );

  effects.additionalDamage += readPercent(text, "추가 피해");
  effects.enemyDamage += readPercent(text, "적에게 주는 피해");
  effects.weaponAttackPercent += readPercent(text, "무기 공격력");
  effects.weaponAttackFlat += readFlat(text, "무기 공격력");
  effects.attackPowerPercent += readPercent(textWithoutWeaponAttack, "공격력");
  effects.attackPowerFlat += readFlat(textWithoutWeaponAttack, "공격력");
  effects.critRate += readPercent(text, "치명타 적중률");
  effects.critDamage += readPercent(text, "치명타 피해");
  effects.brandPower += readPercent(text, "낙인력");
  effects.identityGauge +=
    readPercent(text, "세레나데, 신앙, 조화 게이지 획득량") +
    readPercent(text, "세레나데, 신앙, 조화 게이지 획득량 증가");
  effects.allyAttackBuff += readPercent(text, "아군 공격력 강화 효과");
  effects.allyDamageBuff += readPercent(text, "아군 피해량 강화 효과");
  effects.partyShield += readPercent(text, "파티원 보호막 효과");
  effects.partyHeal += readPercent(text, "파티원 회복 효과");
  effects.enlightenment += readFlat(text, "깨달음");
  effects.health += readFlat(text, "체력");

  return effects;
}

function parseStatsFromText(text: string): AccessoryStats {
  return {
    strength: readFlat(text, "힘"),
    dexterity: readFlat(text, "민첩"),
    intelligence: readFlat(text, "지능"),
    health: readFlat(text, "체력")
  };
}

function parseRefinementOptionsFromText(text: string): AccessoryRefinementOption[] {
  const options: AccessoryRefinementOption[] = [];
  const pattern = /([^+]+?)\s*\+\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(%?)/g;

  for (const match of text.matchAll(pattern)) {
    options.push(createRefinementOption(match[1], Number(match[2].replaceAll(",", "")), match[3]));
  }

  return options;
}

function parseRefinementOptionsFromAuctionItem(
  item: LostarkAuctionItem
): AccessoryRefinementOption[] {
  return (item.Options ?? [])
    .filter((option) => !BASE_STAT_OPTION_NAMES.has(option.OptionName.trim()))
    .map((option) =>
      createRefinementOption(
        option.OptionName,
        option.Value,
        option.IsValuePercentage ? "%" : ""
      )
    );
}

function createRefinementOption(
  label: string,
  value: number,
  suffix: string
): AccessoryRefinementOption {
  const normalizedSuffix = suffix.trim() === "%" ? "%" : "";
  const normalizedLabel = normalizeOptionLabel(label, normalizedSuffix);

  return {
    label: normalizedLabel,
    grade: getOptionGrade(normalizedLabel, value, normalizedSuffix),
    value,
    suffix: normalizedSuffix,
    isEffective: isEffectiveOption(normalizedLabel, normalizedSuffix)
  };
}

function readPercent(text: string, label: string): number {
  const escaped = escapeRegExp(label);
  const pattern = new RegExp(
    `${escaped}\\s*\\+\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*%`,
    "g"
  );
  let total = 0;

  for (const match of text.matchAll(pattern)) {
    total += Number(match[1].replaceAll(",", ""));
  }

  return total;
}

function readFlat(text: string, label: string): number {
  const escaped = escapeRegExp(label);
  const pattern = new RegExp(
    `${escaped}\\s*\\+\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)(?![0-9,.])(?!\\s*%)`,
    "g"
  );
  let total = 0;

  for (const match of text.matchAll(pattern)) {
    total += Number(match[1].replaceAll(",", ""));
  }

  return total;
}

function summarizeEffects(effects: AccessoryEffects): string[] {
  const entries: Array<[keyof AccessoryEffects, string, string]> = [
    ["additionalDamage", "추가 피해", "%"],
    ["enemyDamage", "적에게 주는 피해", "%"],
    ["attackPowerPercent", "공격력", "%"],
    ["attackPowerFlat", "공격력", ""],
    ["weaponAttackPercent", "무기 공격력", "%"],
    ["weaponAttackFlat", "무기 공격력", ""],
    ["critRate", "치명타 적중률", "%"],
    ["critDamage", "치명타 피해", "%"],
    ["brandPower", "낙인력", "%"],
    ["identityGauge", "세레나데, 신앙, 조화 게이지 획득량", "%"],
    ["allyAttackBuff", "아군 공격력 강화 효과", "%"],
    ["allyDamageBuff", "아군 피해량 강화 효과", "%"],
    ["partyShield", "파티원 보호막 효과", "%"],
    ["partyHeal", "파티원 회복 효과", "%"],
    ["enlightenment", "깨달음", ""]
  ];

  return entries
    .filter(([key]) => effects[key] > 0)
    .map(([key, label, suffix]) => `${label} +${formatEffectValue(effects[key])}${suffix}`);
}

function gradeEffects(effects: AccessoryEffects): AccessoryEffectGrade[] {
  const rows: Array<[keyof AccessoryEffects, string, string]> = [
    ["additionalDamage", "추가 피해", "%"],
    ["enemyDamage", "적에게 주는 피해", "%"],
    ["attackPowerPercent", "공격력", "%"],
    ["weaponAttackPercent", "무기 공격력", "%"],
    ["critRate", "치명타 적중률", "%"],
    ["critDamage", "치명타 피해", "%"],
    ["brandPower", "낙인력", "%"],
    ["identityGauge", "세레나데, 신앙, 조화 게이지 획득량", "%"],
    ["allyAttackBuff", "아군 공격력 강화 효과", "%"],
    ["allyDamageBuff", "아군 피해량 강화 효과", "%"],
    ["partyShield", "파티원 보호막 효과", "%"],
    ["partyHeal", "파티원 회복 효과", "%"],
    ["attackPowerFlat", "공격력", ""],
    ["weaponAttackFlat", "무기 공격력", ""]
  ];

  return rows
    .filter(([key]) => effects[key] > 0)
    .map(([key, label, suffix]) => ({
      label,
      grade: getOptionGrade(label, effects[key], suffix),
      value: effects[key],
      suffix
    }));
}

function normalizeOptionLabel(label: string, suffix: string): string {
  const compactLabel = label.replace(/\s+/g, " ").trim();

  if (compactLabel === "추가 피해") {
    return "추가 피해";
  }

  if (compactLabel === "적에게 주는 피해 증가" || compactLabel === "적에게 주는 피해") {
    return "적에게 주는 피해";
  }

  if (compactLabel === "공격력 %" || (compactLabel === "공격력" && suffix === "%")) {
    return "공격력";
  }

  if (compactLabel === "무기 공격력 %" || (compactLabel === "무기 공격력" && suffix === "%")) {
    return "무기 공격력";
  }

  if (compactLabel === "무기 공격력") {
    return "무기 공격력";
  }

  if (compactLabel === "치명타 적중률") {
    return "치명타 적중률";
  }

  if (compactLabel === "치명타 피해") {
    return "치명타 피해";
  }

  if (compactLabel === "낙인력") {
    return "낙인력";
  }

  if (
    compactLabel === "세레나데, 신앙, 조화 게이지 획득량 증가" ||
    compactLabel === "세레나데, 신앙, 조화 게이지 획득량"
  ) {
    return "세레나데, 신앙, 조화 게이지 획득량";
  }

  if (compactLabel === "아군 공격력 강화 효과") {
    return "아군 공격력 강화 효과";
  }

  if (compactLabel === "아군 피해량 강화 효과") {
    return "아군 피해량 강화 효과";
  }

  if (compactLabel === "파티원 보호막 효과") {
    return "파티원 보호막 효과";
  }

  if (compactLabel === "파티원 회복 효과") {
    return "파티원 회복 효과";
  }

  return compactLabel;
}

function getOptionGrade(
  label: string,
  value: number,
  suffix: string
): "상" | "중" | "하" | null {
  const grades = OPTION_GRADES[`${label}${suffix}`] ?? null;

  if (!grades) {
    return null;
  }

  const rounded = Math.round(value * 1000) / 1000;

  if (rounded === grades["상"]) {
    return "상";
  }

  if (rounded === grades["중"]) {
    return "중";
  }

  if (rounded === grades["하"]) {
    return "하";
  }

  return null;
}

function isEffectiveOption(label: string, suffix: string): boolean {
  return EFFECTIVE_OPTION_KEYS.has(`${label}${suffix}`);
}

const OPTION_GRADES: Record<string, Record<"상" | "중" | "하", number>> = {
  "추가 피해%": { 하: 0.7, 중: 1.6, 상: 2.6 },
  "적에게 주는 피해%": { 하: 0.55, 중: 1.2, 상: 2 },
  "공격력%": { 하: 0.4, 중: 0.95, 상: 1.55 },
  "무기 공격력%": { 하: 0.8, 중: 1.8, 상: 3 },
  "치명타 적중률%": { 하: 0.4, 중: 0.95, 상: 1.55 },
  "치명타 피해%": { 하: 1.1, 중: 2.4, 상: 4 },
  "낙인력%": { 하: 2.15, 중: 4.8, 상: 8 },
  "세레나데, 신앙, 조화 게이지 획득량%": { 하: 1.6, 중: 3.6, 상: 6 },
  "아군 공격력 강화 효과%": { 하: 1.35, 중: 3, 상: 5 },
  "아군 피해량 강화 효과%": { 하: 2, 중: 4.5, 상: 7.5 },
  "파티원 보호막 효과%": { 하: 0.95, 중: 2.1, 상: 3.5 },
  "파티원 회복 효과%": { 하: 0.95, 중: 2.1, 상: 3.5 },
  공격력: { 하: 80, 중: 195, 상: 390 },
  "무기 공격력": { 하: 195, 중: 480, 상: 960 }
};

const EFFECTIVE_OPTION_KEYS = new Set(Object.keys(OPTION_GRADES));

function formatEffectValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
