import {
  parseEquipmentMainStat,
  parseEquipmentQuality,
  parseEquipmentWeaponAttack,
  parseAccessoryFromEquipment,
  type AccessorySlot,
  type AccessoryState
} from "@/lib/domain/accessory";
import { ARMOR_SLOTS, type ArmorSlot } from "@/lib/domain/armor";
import {
  readEquipmentSystem,
  type EquipmentSystem
} from "@/lib/domain/equipment";
import type { LopecSnapshot, LopecSimulatorData } from "@/lib/lopec/snapshot";
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
  armor: CharacterArmorContext;
  scoreContext: CharacterScoreContext;
  lopec: LopecSnapshot | null;
  raw: LostarkArmory;
}

export interface CharacterWeaponContext {
  name: string | null;
  grade: string | null;
  enhancementLevel: number | null;
  highReforgeLevel: number | null;
  equipmentSystem: EquipmentSystem;
  itemLevel: number | null;
  attack: number;
  quality: number;
}

export interface CharacterArmorPieceContext {
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

export interface CharacterArmorContext {
  pieces: Record<ArmorSlot, CharacterArmorPieceContext | null>;
  lowestEnhancementLevel: number | null;
  mainStat: number;
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
  const armor = createArmorContext(armory);

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
    armor,
    scoreContext: createScoreContext(armory, armor),
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

function createScoreContext(
  armory: LostarkArmory,
  armor: CharacterArmorContext
): CharacterScoreContext {
  const equipment = armory.ArmoryEquipment ?? [];
  const weapon = equipment.find((item) => item.Type === "무기") ?? null;

  return {
    armorMainStat: armor.mainStat,
    weaponAttack: weapon ? parseEquipmentWeaponAttack(weapon) : 0,
    weaponQuality: weapon ? parseEquipmentQuality(weapon) : 0,
    arkGridAttackPercent: readArkGridEffectPercent(armory.ArkGrid, "공격력"),
    arkGridAdditionalDamage: readArkGridEffectPercent(armory.ArkGrid, "추가 피해"),
    enlightenmentPoints: readArkPassivePoint(armory.ArkPassive, "깨달음")
  };
}

const ARMOR_TYPE_TO_SLOT: Record<string, ArmorSlot> = {
  투구: "helmet",
  상의: "armor",
  하의: "pants",
  장갑: "gloves",
  어깨: "shoulder"
};

function createArmorContext(armory: LostarkArmory): CharacterArmorContext {
  const equipment = armory.ArmoryEquipment ?? [];
  const entries: Array<[ArmorSlot, CharacterArmorPieceContext]> = [];

  for (const item of equipment) {
    const slot = ARMOR_TYPE_TO_SLOT[item.Type];

    if (!slot) {
      continue;
    }

    entries.push([
      slot,
      {
        name: item.Name,
        grade: item.Grade,
        enhancementLevel: parseEnhancementLevel(item.Name),
        highReforgeLevel: null,
        equipmentSystem: "unknown",
        itemLevel: null,
        mainStat: parseEquipmentMainStat(item),
        health: 0,
        quality: parseEquipmentQuality(item)
      }
    ]);
  }

  const pieces = Object.fromEntries(entries) as Record<
    ArmorSlot,
    CharacterArmorPieceContext | null
  >;

  for (const slot of ARMOR_SLOTS) {
    pieces[slot] ??= null;
  }

  const enhancementLevels = Object.values(pieces)
    .map((piece) => piece?.enhancementLevel ?? null)
    .filter((level): level is number => typeof level === "number");

  return {
    pieces,
    lowestEnhancementLevel:
      enhancementLevels.length > 0 ? Math.min(...enhancementLevels) : null,
    mainStat: Object.values(pieces).reduce((sum, piece) => sum + (piece?.mainStat ?? 0), 0)
  };
}

function createWeaponContext(armory: LostarkArmory): CharacterWeaponContext {
  const weapon = armory.ArmoryEquipment?.find((item) => item.Type === "무기") ?? null;

  return {
    name: weapon?.Name ?? null,
    grade: weapon?.Grade ?? null,
    enhancementLevel: weapon ? parseEnhancementLevel(weapon.Name) : null,
    highReforgeLevel: null,
    equipmentSystem: "unknown",
    itemLevel: null,
    attack: weapon ? parseEquipmentWeaponAttack(weapon) : 0,
    quality: weapon ? parseEquipmentQuality(weapon) : 0
  };
}

export function applyLopecEquipmentContext(
  character: CharacterState,
  lopec: LopecSnapshot | null
): CharacterState {
  const equipment = lopec?.simulator?.armory.equipment;

  if (!equipment) {
    return {
      ...character,
      lopec
    };
  }

  const weapon = mergeWeaponContext(character.weapon, equipment.weapon ?? null);
  const pieces = { ...character.armor.pieces };

  for (const slot of ARMOR_SLOTS) {
    pieces[slot] = mergeArmorPieceContext(
      character.armor.pieces[slot],
      equipment[slot] ?? null
    );
  }

  const armorMainStat = Object.values(pieces).reduce(
    (sum, piece) => sum + (piece?.mainStat ?? 0),
    0
  );
  const enhancementLevels = Object.values(pieces)
    .map((piece) => piece?.enhancementLevel ?? null)
    .filter((level): level is number => typeof level === "number");

  return {
    ...character,
    lopec,
    weapon,
    armor: {
      pieces,
      lowestEnhancementLevel:
        enhancementLevels.length > 0 ? Math.min(...enhancementLevels) : null,
      mainStat: armorMainStat
    },
    scoreContext: {
      ...character.scoreContext,
      armorMainStat,
      weaponAttack: weapon.attack
    }
  };
}

function mergeWeaponContext(
  current: CharacterWeaponContext,
  lopecWeapon: LopecSimulatorData["armory"]["equipment"][string] | null
): CharacterWeaponContext {
  if (!lopecWeapon) {
    return current;
  }

  return {
    ...current,
    name: lopecWeapon.name ?? current.name,
    grade: lopecWeapon.grade ?? current.grade,
    enhancementLevel: lopecWeapon.reforge ?? current.enhancementLevel,
    highReforgeLevel: lopecWeapon.highReforge ?? null,
    equipmentSystem: readEquipmentSystem(lopecWeapon),
    itemLevel: lopecWeapon.itemLevel ?? current.itemLevel,
    attack: lopecWeapon.stat ?? current.attack,
    quality: lopecWeapon.quality ?? current.quality
  };
}

function mergeArmorPieceContext(
  current: CharacterArmorPieceContext | null,
  lopecPiece: LopecSimulatorData["armory"]["equipment"][string] | null
): CharacterArmorPieceContext | null {
  if (!lopecPiece) {
    return current;
  }

  return {
    name: lopecPiece.name ?? current?.name ?? null,
    grade: lopecPiece.grade ?? current?.grade ?? null,
    enhancementLevel: lopecPiece.reforge ?? current?.enhancementLevel ?? null,
    highReforgeLevel: lopecPiece.highReforge ?? null,
    equipmentSystem: readEquipmentSystem(lopecPiece),
    itemLevel: lopecPiece.itemLevel ?? current?.itemLevel ?? null,
    mainStat: lopecPiece.stat ?? current?.mainStat ?? 0,
    health: lopecPiece.health ?? current?.health ?? 0,
    quality: lopecPiece.quality ?? current?.quality ?? 0
  };
}

function parseEnhancementLevel(name: string): number | null {
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
