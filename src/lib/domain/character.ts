import {
  parseEquipmentMainStat,
  parseEquipmentQuality,
  parseEquipmentWeaponAttack,
  parseAccessoryFromEquipment,
  type AccessorySlot,
  type AccessoryState
} from "@/lib/domain/accessory";
import type { LopecSnapshot } from "@/lib/lopec/snapshot";
import type { LostarkArmory } from "@/lib/lostark/types";

export interface CharacterState {
  characterName: string;
  serverName: string;
  className: string;
  characterLevel: number;
  itemAvgLevel: number;
  combatPower: number;
  profileAttack: number;
  imageUrl: string | null;
  accessories: Record<AccessorySlot, AccessoryState>;
  weapon: CharacterWeaponContext;
  scoreContext: CharacterScoreContext;
  lopec: LopecSnapshot | null;
  raw: LostarkArmory;
}

export interface CharacterWeaponContext {
  name: string | null;
  enhancementLevel: number | null;
  attack: number;
  quality: number;
}

export interface CharacterScoreContext {
  armorMainStat: number;
  weaponAttack: number;
  weaponQuality: number;
  arkGridAttackPercent: number;
  arkGridAdditionalDamage: number;
  enlightenmentPoints: number;
}

const ACCESSORY_SLOT_ORDER: AccessorySlot[] = [
  "necklace",
  "earring1",
  "earring2",
  "ring1",
  "ring2"
];

export function createCharacterState(armory: LostarkArmory): CharacterState {
  const profile = armory.ArmoryProfile;

  if (!profile) {
    throw new Error("캐릭터 프로필을 찾을 수 없습니다.");
  }

  const accessories = parseAccessories(armory);

  return {
    characterName: profile.CharacterName,
    serverName: profile.ServerName,
    className: profile.CharacterClassName,
    characterLevel: profile.CharacterLevel,
    itemAvgLevel: parseNumber(profile.ItemAvgLevel),
    combatPower: parseNumber(profile.CombatPower ?? "0"),
    profileAttack: readProfileStat(profile, "공격력"),
    imageUrl: profile.CharacterImage,
    accessories,
    weapon: createWeaponContext(armory),
    scoreContext: createScoreContext(armory),
    lopec: null,
    raw: armory
  };
}

function parseAccessories(armory: LostarkArmory): Record<AccessorySlot, AccessoryState> {
  const equipment = armory.ArmoryEquipment ?? [];
  const accessoryItems = equipment.filter((item) =>
    ["목걸이", "귀걸이", "반지"].includes(item.Type)
  );

  const entries = accessoryItems
    .slice(0, ACCESSORY_SLOT_ORDER.length)
    .map((item, index) => parseAccessoryFromEquipment(item, ACCESSORY_SLOT_ORDER[index]))
    .filter((item): item is AccessoryState => Boolean(item));

  if (entries.length !== ACCESSORY_SLOT_ORDER.length) {
    throw new Error("악세사리 5개를 모두 파싱하지 못했습니다.");
  }

  return Object.fromEntries(entries.map((item) => [item.slot, item])) as Record<
    AccessorySlot,
    AccessoryState
  >;
}

function parseNumber(value: string): number {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function createScoreContext(armory: LostarkArmory): CharacterScoreContext {
  const equipment = armory.ArmoryEquipment ?? [];
  const weapon = equipment.find((item) => item.Type === "무기") ?? null;
  const armorMainStat = equipment
    .filter((item) => ["투구", "상의", "하의", "장갑", "어깨"].includes(item.Type))
    .reduce((sum, item) => sum + parseEquipmentMainStat(item), 0);

  return {
    armorMainStat,
    weaponAttack: weapon ? parseEquipmentWeaponAttack(weapon) : 0,
    weaponQuality: weapon ? parseEquipmentQuality(weapon) : 0,
    arkGridAttackPercent: readArkGridEffectPercent(armory.ArkGrid, "공격력"),
    arkGridAdditionalDamage: readArkGridEffectPercent(armory.ArkGrid, "추가 피해"),
    enlightenmentPoints: readArkPassivePoint(armory.ArkPassive, "깨달음")
  };
}

function createWeaponContext(armory: LostarkArmory): CharacterWeaponContext {
  const weapon = armory.ArmoryEquipment?.find((item) => item.Type === "무기") ?? null;

  return {
    name: weapon?.Name ?? null,
    enhancementLevel: weapon ? parseWeaponEnhancementLevel(weapon.Name) : null,
    attack: weapon ? parseEquipmentWeaponAttack(weapon) : 0,
    quality: weapon ? parseEquipmentQuality(weapon) : 0
  };
}

function parseWeaponEnhancementLevel(name: string): number | null {
  const match = name.match(/\+(\d+)/);
  const parsed = match ? Number(match[1]) : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function readProfileStat(profile: NonNullable<LostarkArmory["ArmoryProfile"]>, type: string): number {
  const stat = profile.Stats.find((item) => item.Type === type);
  return stat ? parseNumber(stat.Value) : 0;
}

function readArkPassivePoint(raw: unknown, name: string): number {
  if (!isRecord(raw) || !Array.isArray(raw.Points)) {
    return 0;
  }

  const point = raw.Points.find((item) => isRecord(item) && item.Name === name);
  return isRecord(point) && typeof point.Value === "number" ? point.Value : 0;
}

function readArkGridEffectPercent(raw: unknown, name: string): number {
  if (!isRecord(raw) || !Array.isArray(raw.Effects)) {
    return 0;
  }

  const effect = raw.Effects.find((item) => isRecord(item) && item.Name === name);

  if (!isRecord(effect) || typeof effect.Tooltip !== "string") {
    return 0;
  }

  const match = effect.Tooltip.match(/\+([0-9][0-9,.]*(?:\.[0-9]+)?)%/);
  const parsed = match ? Number(match[1].replaceAll(",", "")) : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
