export interface LopecSnapshot {
  score: number;
  attack: number | null;
  combatPower: number | null;
  powerIndex: number | null;
  powerIndexCombat: number | null;
  enlightenmentPoints: number | null;
  simulator: LopecSimulatorData | null;
}

const LOPEC_BASE_URL = "https://lopec.kr";

export interface LopecSimulatorAccessory {
  grade: string;
  tier: number;
  stat: number;
  health: number;
  option: string[];
  enlightPoint: number;
  icon?: string;
  tradeAble?: boolean;
}

export interface LopecSimulatorData {
  schemaVersion?: number;
  avatar: {
    avatarStats?: number;
  };
  armory: {
    equipment: Record<string, { grade?: string; quality?: number; stat?: number } | null>;
    accessory: Record<string, LopecSimulatorAccessory | { option?: string[]; tier?: number; grade?: string } | null>;
    abilityStone?: {
      attackbonus?: number | null;
    } | null;
    orb?: {
      name?: string;
      trinity?: number;
    } | null;
  };
  arkPassive: {
    evolution?: {
      points?: number;
      karmaRank?: number;
      nodes?: Array<{ name: string; level: number }>;
    };
    enlightenment?: {
      points?: number;
      karmaRank?: number;
      karmalevel?: number;
      nodes?: Array<{ name: string; level: number }>;
    };
    leap?: {
      points?: number;
      karmaRank?: number;
      karmalevel?: number;
    };
  };
  arkGrid: {
    gemEffects?: Array<{ name: string; level?: number; effect?: number }>;
    core?: Array<{ name: string; grade: string; point: number }>;
  };
  baseEffect: {
    petDamage: number;
    petStat: number;
  };
  gem: {
    attackBonus?: number;
    gems?: Array<{ level: number; type: string; skill: string; attackBonus?: number | null; valid?: boolean }>;
  };
  stats: {
    critical: number;
    special: number;
    haste: number;
    combatPower: number;
    attack: number;
    powerIndex: number;
    powerIndex_combat: number;
  };
  profile: {
    class?: string;
    level: number;
    secondClass: string;
    supportCheck: boolean;
  };
}

export async function fetchLopecSnapshot(characterName: string): Promise<LopecSnapshot | null> {
  const response = await fetch(
    `${LOPEC_BASE_URL}/character/simulator/${encodeURIComponent(characterName)}`,
    {
      cache: "no-store",
      next: {
        revalidate: 0
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const props = readSimulatorProps(html);
  const score = props?.dbScore ?? readNumber(html, "dbScore") ?? readNumber(html, "specPoint");

  if (!score || score <= 0) {
    return null;
  }

  return {
    score,
    attack: props?.lostarkParser.stats.attack ?? readNumber(html, "attack"),
    combatPower: props?.lostarkParser.stats.combatPower ?? readNumber(html, "combatPower"),
    powerIndex: props?.lostarkParser.stats.powerIndex ?? readNumber(html, "powerIndex"),
    powerIndexCombat: props?.lostarkParser.stats.powerIndex_combat ?? readNumber(html, "powerIndex_combat"),
    enlightenmentPoints:
      props?.lostarkParser.arkPassive.enlightenment?.points ?? readNestedPoint(html, "enlightenment"),
    simulator: props?.lostarkParser ?? null
  };
}

function readSimulatorProps(
  html: string
): { lostarkParser: LopecSimulatorData; dbScore: number } | null {
  const flightText = readNextFlightText(html);
  const marker = "{\"lostarkParser\"";
  const start = flightText.indexOf(marker);

  if (start < 0) {
    return null;
  }

  const end = findMatchingBraceEnd(flightText, start);

  if (end < 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(flightText.slice(start, end)) as {
      lostarkParser?: LopecSimulatorData;
      dbScore?: number;
    };

    if (!parsed.lostarkParser || typeof parsed.dbScore !== "number") {
      return null;
    }

    return {
      lostarkParser: parsed.lostarkParser,
      dbScore: parsed.dbScore
    };
  } catch {
    return null;
  }
}

function readNextFlightText(html: string): string {
  const pattern = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)<\/script>/g;
  let text = "";

  for (const match of html.matchAll(pattern)) {
    try {
      text += JSON.parse(`"${match[1]}"`) as string;
    } catch {
      // Ignore malformed chunks and keep the older direct-number fallback alive.
    }
  }

  return text;
}

function findMatchingBraceEnd(value: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return -1;
}

function readNumber(html: string, key: string): number | null {
  const parsed = readNumberAfter(html, `\\"${key}\\":`) ?? readNumberAfter(html, `"${key}":`);

  return parsed;
}

function readNestedPoint(html: string, key: string): number | null {
  const escaped = readNumberAfter(html, `\\"${key}\\":{\\"points\\":`);
  const plain = readNumberAfter(html, `"${key}":{"points":`);

  return escaped ?? plain;
}

function readNumberAfter(html: string, marker: string): number | null {
  const index = html.indexOf(marker);

  if (index < 0) {
    return null;
  }

  const rest = html.slice(index + marker.length);
  const match = rest.match(/^-?[0-9]+(?:\.[0-9]+)?/);
  const parsed = match ? Number(match[0]) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}
