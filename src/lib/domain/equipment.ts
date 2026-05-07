import { ARMOR_SLOTS, type ArmorMainStats, type ArmorSlot } from "@/lib/domain/armor";
import {
  LOPEC_EQUIPMENT_HEALTH_TABLE,
  LOPEC_EQUIPMENT_STAT_TABLE
} from "@/lib/domain/equipment-stat-tables";

export type EquipmentSystem = "kazeros" | "shadow" | "unknown";
export type EquipmentSlot = ArmorSlot | "weapon";

export interface EquipmentContext {
  name: string | null;
  grade: string | null;
  enhancementLevel: number | null;
  highReforgeLevel: number | null;
  equipmentSystem: EquipmentSystem;
  itemLevel: number | null;
  mainStat: number;
  health: number;
  quality: number;
}

export interface EquipmentTarget {
  system: EquipmentSystem;
  enhancementLevel: number;
  highReforgeLevel: number | null;
}

export interface EquipmentCalculatedStats {
  itemLevel: number;
  stat: number;
  health: number;
}

const SHADOW_GRADE_KEYWORD = "전율";

export function readEquipmentSystem(item: {
  name?: string | null;
  grade?: string | null;
  tier?: number | null;
  highReforge?: number | null;
}): EquipmentSystem {
  if (item.tier !== 4) {
    return "unknown";
  }

  const name = item.name ?? "";
  const grade = item.grade ?? "";

  if (name.includes(SHADOW_GRADE_KEYWORD) || grade.includes(SHADOW_GRADE_KEYWORD)) {
    return "shadow";
  }

  if (item.highReforge === null && grade.includes("고대")) {
    return "shadow";
  }

  if (item.highReforge !== null && /유물|고대/.test(grade)) {
    return "kazeros";
  }

  return "unknown";
}

export function equipmentSystemLabel(system: EquipmentSystem): string {
  if (system === "kazeros") {
    return "카제로스";
  }

  if (system === "shadow") {
    return "그림자";
  }

  return "장비";
}

export function encodeEquipmentTarget(target: EquipmentTarget): string {
  return [
    target.system,
    target.enhancementLevel,
    target.highReforgeLevel ?? "none"
  ].join(":");
}

export function decodeEquipmentTarget(value: unknown): EquipmentTarget | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      system: "shadow",
      enhancementLevel: value,
      highReforgeLevel: null
    };
  }

  if (typeof value !== "string" || value === "current") {
    return null;
  }

  const [system, levelText, highReforgeText] = value.split(":");
  const enhancementLevel = Number(levelText);

  if (
    (system !== "kazeros" && system !== "shadow") ||
    !Number.isFinite(enhancementLevel)
  ) {
    return null;
  }

  const highReforgeLevel =
    highReforgeText === "none" || highReforgeText === undefined
      ? null
      : Number(highReforgeText);

  return {
    system,
    enhancementLevel,
    highReforgeLevel: Number.isFinite(highReforgeLevel) ? highReforgeLevel : null
  };
}

export function createCurrentEquipmentTarget(
  context: Pick<EquipmentContext, "equipmentSystem" | "enhancementLevel" | "highReforgeLevel">
): EquipmentTarget | null {
  if (context.equipmentSystem === "unknown" || context.enhancementLevel === null) {
    return null;
  }

  return {
    system: context.equipmentSystem,
    enhancementLevel: context.enhancementLevel,
    highReforgeLevel: context.highReforgeLevel
  };
}

export function formatEquipmentTargetLabel(target: EquipmentTarget): string {
  const highReforge =
    target.system === "kazeros" && target.highReforgeLevel !== null
      ? ` · 상재 ${target.highReforgeLevel}`
      : "";

  return `${equipmentSystemLabel(target.system)} +${target.enhancementLevel}${highReforge}`;
}

export function readEquipmentTargetOptions(
  context: Pick<EquipmentContext, "equipmentSystem" | "enhancementLevel" | "highReforgeLevel">
): EquipmentTarget[] {
  const current = createCurrentEquipmentTarget(context);

  if (!current) {
    return [];
  }

  const minimumLevel = current.enhancementLevel;
  const levels = Array.from(
    { length: Math.max(25 - minimumLevel + 1, 0) },
    (_, index) => minimumLevel + index
  );

  return levels.map((enhancementLevel) => ({
    system: current.system,
    enhancementLevel,
    highReforgeLevel: current.system === "kazeros" ? 40 : current.highReforgeLevel
  }));
}

export function calculateEquipmentStats(
  slot: EquipmentSlot,
  target: EquipmentTarget
): EquipmentCalculatedStats | null {
  const itemLevel =
    target.system === "kazeros"
      ? 1590 + target.enhancementLevel * 5 + (target.highReforgeLevel ?? 0)
      : 1675 + target.enhancementLevel * 5;
  const rawStat = readStatTableValue(slot, itemLevel);

  if (rawStat === null) {
    return null;
  }

  const stat =
    target.system === "kazeros"
      ? readKazerosStat(rawStat, target.highReforgeLevel)
      : readShadowStat(rawStat, itemLevel);
  const health = slot === "weapon" ? 0 : (readHealthTableValue(slot, itemLevel) ?? 0);

  return {
    itemLevel,
    stat,
    health
  };
}

export function calculateArmorMainStatsForTarget(target: EquipmentTarget): ArmorMainStats | null {
  const entries = ARMOR_SLOTS.map((slot) => {
    const stats = calculateEquipmentStats(slot, target);

    return stats ? ([slot, stats.stat] as const) : null;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(entries as Array<readonly [ArmorSlot, number]>) as ArmorMainStats;
}

function readKazerosStat(rawStat: number, highReforgeLevel: number | null): number {
  if (highReforgeLevel === 40) {
    return rawStat * 1.05;
  }

  if ((highReforgeLevel ?? 0) >= 30) {
    return rawStat * 1.02;
  }

  return rawStat;
}

function readShadowStat(rawStat: number, itemLevel: number): number {
  return itemLevel >= 1760 ? rawStat : Math.floor(1.05 * rawStat);
}

function readStatTableValue(slot: EquipmentSlot, itemLevel: number): number | null {
  const table = LOPEC_EQUIPMENT_STAT_TABLE[slot] as Record<number, number | undefined>;
  const value = table[itemLevel];

  return typeof value === "number" ? value : null;
}

function readHealthTableValue(slot: ArmorSlot, itemLevel: number): number | null {
  const table = LOPEC_EQUIPMENT_HEALTH_TABLE[slot] as Record<number, number | undefined>;
  const value = table[itemLevel];

  return typeof value === "number" ? value : null;
}
