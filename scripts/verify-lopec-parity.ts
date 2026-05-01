import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import type {
  AccessoryCandidate,
  AccessoryEffects,
  AccessoryRefinementOption,
  AccessoryScoringMode,
  AccessorySlot,
  AccessoryType
} from "../src/lib/domain/accessory";
import type { CharacterState } from "../src/lib/domain/character";
import {
  calculateExactLopecReplacement,
  createExactLopecReplacementSimulator
} from "../src/lib/lopec/exact-score";
import {
  fetchLopecSnapshot,
  type LopecSimulatorData
} from "../src/lib/lopec/snapshot";

const LOPEC_BASE_URL = "https://lopec.kr";
const BASELINE_PATH = "specifications/lopec-formula-fingerprints.json";
const SCORE_TOLERANCE = 0.01;
const SUPPORT_CLASS_NAMES = ["도화가", "홀리나이트", "바드", "발키리"];

interface WebpackModule {
  exports: Record<string, unknown>;
}

interface WebpackRequire {
  (id: number | string): Record<string, unknown>;
  d(exports: Record<string, unknown> | Function, definition: Record<string, () => unknown>): void;
  n(module: Record<string, unknown>): Function;
  o(obj: object, prop: string): boolean;
  r(exports: Record<string, unknown>): void;
}

type WebpackModuleFunction = (
  module: WebpackModule,
  exports: Record<string, unknown>,
  require: WebpackRequire
) => void;

interface LopecRuntime {
  modules: Record<string, WebpackModuleFunction>;
  require: WebpackRequire;
}

interface FormulaSignature {
  key: string;
  description: string;
  contains: string[];
}

interface FormulaFingerprint {
  key: string;
  description: string;
  moduleId: string;
  sha256: string;
  length: number;
}

interface FormulaBaseline {
  source: string;
  updatedAt: string;
  modules: FormulaFingerprint[];
}

interface ParityCase {
  key: string;
  mode: AccessoryScoringMode;
  characterName: string;
  replacedSlot: AccessorySlot;
  candidate: AccessoryCandidate;
}

interface OptionParityConfig {
  mode: AccessoryScoringMode;
  type: AccessoryType;
  replacedSlot: AccessorySlot;
  characterName: string;
  label: string;
  slug: string;
  suffix: string;
  effectKey: keyof AccessoryEffects;
  values: Array<{ grade: "하" | "중" | "상"; value: number }>;
  stats: Partial<AccessoryCandidate["stats"]>;
}

interface RuntimeDealerScore {
  withGem: number;
}

interface RuntimeSupportScore {
  supportSpecPoint: number;
}

interface RuntimeClassBaseEffects {
  W: Record<string, unknown>;
}

const ACCESSORY_SLOT_TO_LOPEC: Record<AccessorySlot, "necklace" | "earing1" | "earing2" | "ring1" | "ring2"> = {
  necklace: "necklace",
  earring1: "earing1",
  earring2: "earing2",
  ring1: "ring1",
  ring2: "ring2"
};

const FORMULA_SIGNATURES: FormulaSignature[] = [
  {
    key: "dealer-score-wrapper",
    description: "딜러 최종 점수 래퍼",
    contains: ["깨달음", "도약", "보석딜증", "보석쿨감", "1930"]
  },
  {
    key: "dealer-score-input",
    description: "딜러 점수 입력값 생성",
    contains: ["공격력_팔찌제외", "혼돈의 해 코어 : 안정적인 공격", "추가 피해"]
  },
  {
    key: "dealer-attack",
    description: "딜러 공격력 계산",
    contains: ["공격력_팔찌제외", "기본_공격력_전투력", "powerIndex_combat"]
  },
  {
    key: "support-score-input",
    description: "서포터 점수 입력값 생성",
    contains: ["공증가동률", "아군 공격력 강화 효과", "혼돈의 해 코어 : 흐르는 마나"]
  },
  {
    key: "support-score",
    description: "서포터 최종 점수 계산",
    contains: ["supportSpecPoint", "totalBuffPower", "4.35"]
  },
  {
    key: "formula-constants",
    description: "악세/각인/아크그리드 상수 테이블",
    contains: ["적에게 주는 피해 +0.55%", "아군피해량강화효과+7.50%", "혼돈의 별 코어 : 공격"]
  }
];

const PARITY_CASES: ParityCase[] = createParityCases();

function createParityCases(): ParityCase[] {
  const dealerCharacter = "중사진심지수";
  const supportCharacter = "채욘";
  const dealerCommonOptions = [
    {
      label: "공격력",
      slug: "attack-flat",
      suffix: "",
      effectKey: "attackPowerFlat" as const,
      values: gradeValues([80, 195, 390])
    },
    {
      label: "무기 공격력",
      slug: "weapon-attack-flat",
      suffix: "",
      effectKey: "weaponAttackFlat" as const,
      values: gradeValues([195, 480, 960])
    }
  ];
  const supportWeaponFlatOption = {
    label: "무기 공격력",
    slug: "weapon-attack-flat",
    suffix: "",
    effectKey: "weaponAttackFlat" as const,
    values: gradeValues([195, 480, 960])
  };
  const configs: OptionParityConfig[] = [
    ...[
      {
        mode: "dealer" as const,
        type: "necklace" as const,
        replacedSlot: "necklace" as const,
        characterName: dealerCharacter,
        stats: { dexterity: 15688, health: 4034 },
        options: [
          {
            label: "추가 피해",
            slug: "additional-damage",
            suffix: "%",
            effectKey: "additionalDamage" as const,
            values: gradeValues([0.7, 1.6, 2.6])
          },
          {
            label: "적에게 주는 피해",
            slug: "enemy-damage",
            suffix: "%",
            effectKey: "enemyDamage" as const,
            values: gradeValues([0.55, 1.2, 2])
          },
          ...dealerCommonOptions
        ]
      },
      {
        mode: "dealer" as const,
        type: "earring" as const,
        replacedSlot: "earring1" as const,
        characterName: dealerCharacter,
        stats: { dexterity: 13723 },
        options: [
          {
            label: "공격력",
            slug: "attack-percent",
            suffix: "%",
            effectKey: "attackPowerPercent" as const,
            values: gradeValues([0.4, 0.95, 1.55])
          },
          {
            label: "무기 공격력",
            slug: "weapon-attack-percent",
            suffix: "%",
            effectKey: "weaponAttackPercent" as const,
            values: gradeValues([0.8, 1.8, 3])
          },
          ...dealerCommonOptions
        ]
      },
      {
        mode: "dealer" as const,
        type: "ring" as const,
        replacedSlot: "ring1" as const,
        characterName: dealerCharacter,
        stats: { dexterity: 12569 },
        options: [
          {
            label: "치명타 피해",
            slug: "crit-damage",
            suffix: "%",
            effectKey: "critDamage" as const,
            values: gradeValues([1.1, 2.4, 4])
          },
          {
            label: "치명타 적중률",
            slug: "crit-rate",
            suffix: "%",
            effectKey: "critRate" as const,
            values: gradeValues([0.4, 0.95, 1.55])
          },
          ...dealerCommonOptions
        ]
      },
      {
        mode: "support" as const,
        type: "necklace" as const,
        replacedSlot: "necklace" as const,
        characterName: supportCharacter,
        stats: { intelligence: 15688, health: 4034 },
        options: [
          {
            label: "낙인력",
            slug: "brand-power",
            suffix: "%",
            effectKey: "brandPower" as const,
            values: gradeValues([2.15, 4.8, 8])
          },
          {
            label: "세레나데, 신앙, 조화 게이지 획득량",
            slug: "identity-gauge",
            suffix: "%",
            effectKey: "identityGauge" as const,
            values: gradeValues([1.6, 3.6, 6])
          },
          supportWeaponFlatOption
        ]
      },
      {
        mode: "support" as const,
        type: "earring" as const,
        replacedSlot: "earring1" as const,
        characterName: supportCharacter,
        stats: { intelligence: 13723 },
        options: [
          {
            label: "무기 공격력",
            slug: "weapon-attack-percent",
            suffix: "%",
            effectKey: "weaponAttackPercent" as const,
            values: gradeValues([0.8, 1.8, 3])
          },
          supportWeaponFlatOption
        ]
      },
      {
        mode: "support" as const,
        type: "ring" as const,
        replacedSlot: "ring2" as const,
        characterName: supportCharacter,
        stats: { intelligence: 12182 },
        options: [
          {
            label: "아군 공격력 강화 효과",
            slug: "ally-attack-buff",
            suffix: "%",
            effectKey: "allyAttackBuff" as const,
            values: gradeValues([1.35, 3, 5])
          },
          {
            label: "아군 피해량 강화 효과",
            slug: "ally-damage-buff",
            suffix: "%",
            effectKey: "allyDamageBuff" as const,
            values: gradeValues([2, 4.5, 7.5])
          },
          supportWeaponFlatOption
        ]
      }
    ].flatMap((group) =>
      group.options.map((item) => ({
        mode: group.mode,
        type: group.type,
        replacedSlot: group.replacedSlot,
        characterName: group.characterName,
        stats: group.stats,
        ...item
      }))
    )
  ];

  return configs.flatMap(createSingleOptionCases);
}

function createSingleOptionCases(config: OptionParityConfig): ParityCase[] {
  return config.values.map((value) => {
    const effects: Partial<AccessoryEffects> = {
      [config.effectKey]: value.value
    };

    return {
      key: `${config.mode}-${config.type}-${config.slug}-${value.grade}`,
      mode: config.mode,
      characterName: config.characterName,
      replacedSlot: config.replacedSlot,
      candidate: createCandidate({
        type: config.type,
        name: `${config.mode} ${config.type} ${config.label} ${value.grade}`,
        grade: "고대",
        stats: config.stats,
        refinementOptions: [
          option(config.label, value.value, config.suffix, value.grade, true)
        ],
        effects
      })
    };
  });
}

function gradeValues(values: [number, number, number]): Array<{ grade: "하" | "중" | "상"; value: number }> {
  return [
    { grade: "하", value: values[0] },
    { grade: "중", value: values[1] },
    { grade: "상", value: values[2] }
  ];
}

async function main(): Promise<void> {
  const shouldUpdateBaseline = process.argv.includes("--update-baseline");
  const runtime = await loadLopecRuntime();
  const fingerprints = readFormulaFingerprints(runtime.modules);

  await verifyFormulaFingerprints(fingerprints, shouldUpdateBaseline);
  await verifyParityCases(runtime);
}

async function loadLopecRuntime(): Promise<LopecRuntime> {
  const pageUrl = `${LOPEC_BASE_URL}/character/simulator/${encodeURIComponent("중사진심지수")}`;
  const html = await fetchText(pageUrl);
  const scriptUrls = Array.from(html.matchAll(/<script[^>]+src="([^"]+\.js)"/g), (match) =>
    new URL(match[1], pageUrl).href
  );
  const modules: Record<string, WebpackModuleFunction> = {};
  const context = {
    self: {
      webpackChunk_N_E: [] as unknown[]
    },
    window: {},
    console,
    setTimeout,
    clearTimeout
  };

  context.self.webpackChunk_N_E.push = ((chunk: unknown) => {
    if (Array.isArray(chunk) && isRecord(chunk[1])) {
      Object.assign(modules, chunk[1] as Record<string, WebpackModuleFunction>);
    }

    return context.self.webpackChunk_N_E.length;
  }) as typeof context.self.webpackChunk_N_E.push;

  vm.createContext(context);

  for (const scriptUrl of scriptUrls) {
    const script = await fetchText(scriptUrl);

    try {
      vm.runInContext(script, context, {
        timeout: 2000
      });
    } catch {
      // Some Next chunks assume a browser runtime. Formula chunks are still collected
      // through webpackChunk_N_E before any application code is executed.
    }
  }

  return {
    modules,
    require: createWebpackRequire(modules)
  };
}

function createWebpackRequire(modules: Record<string, WebpackModuleFunction>): WebpackRequire {
  const cache: Record<string, WebpackModule> = {};

  const require = ((id: number | string) => {
    const moduleId = String(id);
    const cached = cache[moduleId];

    if (cached) {
      return cached.exports;
    }

    const moduleFactory = modules[moduleId];

    if (!moduleFactory) {
      throw new Error(`LOPEC webpack module ${moduleId} not found`);
    }

    const module: WebpackModule = {
      exports: {}
    };

    cache[moduleId] = module;
    moduleFactory(module, module.exports, require);

    return module.exports;
  }) as WebpackRequire;

  require.d = (exports, definition) => {
    for (const key of Object.keys(definition)) {
      if (!Object.prototype.hasOwnProperty.call(exports, key)) {
        Object.defineProperty(exports, key, {
          enumerable: true,
          get: definition[key]
        });
      }
    }
  };
  require.n = (module) => {
    const getter = module.__esModule ? () => module.default : () => module;
    require.d(getter, { a: getter });
    return getter;
  };
  require.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
  require.r = (exports) => {
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
  };

  return require;
}

function readFormulaFingerprints(
  modules: Record<string, WebpackModuleFunction>
): FormulaFingerprint[] {
  return FORMULA_SIGNATURES.map((signature) => {
    const match = Object.entries(modules).find(([, moduleFactory]) => {
      const source = moduleFactory.toString();

      return signature.contains.every((token) => source.includes(token));
    });

    if (!match) {
      throw new Error(`LOPEC formula module not found: ${signature.key}`);
    }

    const [moduleId, moduleFactory] = match;
    const source = moduleFactory.toString();

    return {
      key: signature.key,
      description: signature.description,
      moduleId,
      sha256: createHash("sha256").update(source).digest("hex"),
      length: source.length
    };
  });
}

async function verifyFormulaFingerprints(
  fingerprints: FormulaFingerprint[],
  shouldUpdateBaseline: boolean
): Promise<void> {
  const nextBaseline: FormulaBaseline = {
    source: LOPEC_BASE_URL,
    updatedAt: new Date().toISOString(),
    modules: fingerprints
  };

  if (shouldUpdateBaseline) {
    await writeFile(BASELINE_PATH, `${JSON.stringify(nextBaseline, null, 2)}\n`);
    console.log(`Updated LOPEC formula baseline: ${BASELINE_PATH}`);
    return;
  }

  const baseline = await readBaseline();
  const mismatches = fingerprints.filter((fingerprint) => {
    const expected = baseline.modules.find((item) => item.key === fingerprint.key);

    return !expected || expected.sha256 !== fingerprint.sha256;
  });

  if (mismatches.length > 0) {
    console.error("LOPEC formula bundle changed:");
    for (const mismatch of mismatches) {
      console.error(`- ${mismatch.key} module ${mismatch.moduleId} sha256=${mismatch.sha256}`);
    }
    console.error(`Run "npm run verify:lopec -- --update-baseline" after auditing the formula port.`);
    process.exitCode = 1;
    return;
  }

  console.log("LOPEC formula fingerprints match the stored baseline.");
}

async function readBaseline(): Promise<FormulaBaseline> {
  try {
    return JSON.parse(await readFile(BASELINE_PATH, "utf8")) as FormulaBaseline;
  } catch {
    throw new Error(
      `Missing LOPEC formula baseline. Run "npm run verify:lopec -- --update-baseline" first.`
    );
  }
}

async function verifyParityCases(runtime: LopecRuntime): Promise<void> {
  const dealerModule = runtime.require(32142) as {
    cA(data: LopecSimulatorData): RuntimeDealerScore;
  };
  const supportModule = runtime.require(38564) as {
    PR(data: LopecSimulatorData): RuntimeSupportScore;
  };
  const classModule = runtime.require(49295) as unknown as RuntimeClassBaseEffects;
  const snapshotCache = new Map<string, Awaited<ReturnType<typeof fetchLopecSnapshot>>>();
  const failures: string[] = [];

  for (const testCase of PARITY_CASES) {
    let snapshot = snapshotCache.get(testCase.characterName);

    if (snapshot === undefined) {
      snapshot = await fetchLopecSnapshot(testCase.characterName);
      snapshotCache.set(testCase.characterName, snapshot);
    }

    if (!snapshot?.simulator) {
      failures.push(`${testCase.key}: failed to load LOPEC simulator snapshot`);
      continue;
    }

    const normalizedCase = normalizeCandidateStats(snapshot.simulator, testCase);
    const character = { lopec: snapshot } as CharacterState;
    const nextSimulator = createExactLopecReplacementSimulator(character, [
      {
        replacedSlot: normalizedCase.replacedSlot,
        candidate: normalizedCase.candidate
      }
    ]);
    const local = calculateExactLopecReplacement(
      character,
      normalizedCase.replacedSlot,
      normalizedCase.candidate,
      normalizedCase.mode
    );

    if (!nextSimulator || !local) {
      failures.push(`${normalizedCase.key}: local replacement calculation failed`);
      continue;
    }

    const runtimeBaseScore = readRuntimeScore(
      normalizedCase.mode,
      snapshot.simulator,
      dealerModule,
      supportModule
    );
    const runtimeNextScore = readRuntimeScore(
      normalizedCase.mode,
      nextSimulator,
      dealerModule,
      supportModule
    );
    const runtimeRatio = runtimeNextScore / runtimeBaseScore;
    const runtimeNextRounded = round2(snapshot.score * runtimeRatio);
    const runtimeDelta = round2(runtimeNextRounded - snapshot.score);
    const nextDiff = Math.abs(local.nextScore - runtimeNextRounded);
    const deltaDiff = Math.abs(local.deltaScore - runtimeDelta);

    console.log(
      [
        `${normalizedCase.key}:`,
        `local ${local.baseScore.toFixed(2)} -> ${local.nextScore.toFixed(2)} (${local.deltaScore.toFixed(2)})`,
        `lopec ${round2(runtimeBaseScore).toFixed(2)} -> ${runtimeNextRounded.toFixed(2)} (${runtimeDelta.toFixed(2)})`
      ].join(" ")
    );

    if (nextDiff > SCORE_TOLERANCE || deltaDiff > SCORE_TOLERANCE) {
      failures.push(
        `${normalizedCase.key}: next diff ${nextDiff.toFixed(4)}, delta diff ${deltaDiff.toFixed(4)}`
      );
    }
  }

  if (failures.length > 0) {
    console.error("LOPEC parity failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`${PARITY_CASES.length} LOPEC parity cases passed.`);
  await verifyDealerClassMutationCases(
    classModule,
    dealerModule,
    supportModule,
    snapshotCache
  );
  await verifySupportClassMutationCases(dealerModule, supportModule, snapshotCache);
}

async function verifyDealerClassMutationCases(
  classModule: RuntimeClassBaseEffects,
  dealerModule: { cA(data: LopecSimulatorData): RuntimeDealerScore },
  supportModule: { PR(data: LopecSimulatorData): RuntimeSupportScore },
  snapshotCache: Map<string, Awaited<ReturnType<typeof fetchLopecSnapshot>>>
): Promise<void> {
  const characterName = "중사진심지수";
  let snapshot = snapshotCache.get(characterName);

  if (snapshot === undefined) {
    snapshot = await fetchLopecSnapshot(characterName);
    snapshotCache.set(characterName, snapshot);
  }

  if (!snapshot?.simulator) {
    console.error("Dealer class mutation parity failed: failed to load LOPEC simulator snapshot");
    process.exitCode = 1;
    return;
  }

  const baseCase = PARITY_CASES.find((testCase) => testCase.key === "dealer-ring-crit-rate-상");

  if (!baseCase) {
    throw new Error("Missing dealer class mutation template case");
  }

  const failures: string[] = [];
  const classNames = Object.keys(classModule.W);

  for (const className of classNames) {
    const simulator = structuredClone(snapshot.simulator);
    simulator.profile.secondClass = className;
    simulator.profile.supportCheck = false;

    const mutatedSnapshot = {
      ...snapshot,
      simulator
    };
    const normalizedCase = normalizeCandidateStats(simulator, {
      ...baseCase,
      key: `dealer-class-${className}`,
      characterName
    });
    const character = { lopec: mutatedSnapshot } as CharacterState;
    const nextSimulator = createExactLopecReplacementSimulator(character, [
      {
        replacedSlot: normalizedCase.replacedSlot,
        candidate: normalizedCase.candidate
      }
    ]);
    const local = calculateExactLopecReplacement(
      character,
      normalizedCase.replacedSlot,
      normalizedCase.candidate,
      "dealer"
    );

    if (!nextSimulator || !local) {
      failures.push(`${normalizedCase.key}: local replacement calculation failed`);
      continue;
    }

    const runtimeBaseScore = readRuntimeScore("dealer", simulator, dealerModule, supportModule);
    const runtimeNextScore = readRuntimeScore("dealer", nextSimulator, dealerModule, supportModule);
    const runtimeRatio = runtimeNextScore / runtimeBaseScore;
    const runtimeNextRounded = round2(snapshot.score * runtimeRatio);
    const runtimeDelta = round2(runtimeNextRounded - snapshot.score);
    const nextDiff = Math.abs(local.nextScore - runtimeNextRounded);
    const deltaDiff = Math.abs(local.deltaScore - runtimeDelta);

    if (nextDiff > SCORE_TOLERANCE || deltaDiff > SCORE_TOLERANCE) {
      failures.push(
        `${normalizedCase.key}: next diff ${nextDiff.toFixed(4)}, delta diff ${deltaDiff.toFixed(4)}`
      );
    }
  }

  if (failures.length > 0) {
    console.error("Dealer class mutation parity failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`${classNames.length} dealer class mutation parity cases passed.`);
}

async function verifySupportClassMutationCases(
  dealerModule: { cA(data: LopecSimulatorData): RuntimeDealerScore },
  supportModule: { PR(data: LopecSimulatorData): RuntimeSupportScore },
  snapshotCache: Map<string, Awaited<ReturnType<typeof fetchLopecSnapshot>>>
): Promise<void> {
  const characterName = "채욘";
  let snapshot = snapshotCache.get(characterName);

  if (snapshot === undefined) {
    snapshot = await fetchLopecSnapshot(characterName);
    snapshotCache.set(characterName, snapshot);
  }

  if (!snapshot?.simulator) {
    console.error("Support class mutation parity failed: failed to load LOPEC simulator snapshot");
    process.exitCode = 1;
    return;
  }

  const baseCase = PARITY_CASES.find((testCase) => testCase.key === "support-ring-ally-attack-buff-상");

  if (!baseCase) {
    throw new Error("Missing support class mutation template case");
  }

  const failures: string[] = [];

  for (const className of SUPPORT_CLASS_NAMES) {
    const simulator = structuredClone(snapshot.simulator);
    simulator.profile.class = className;
    simulator.profile.supportCheck = true;

    const mutatedSnapshot = {
      ...snapshot,
      simulator
    };
    const normalizedCase = normalizeCandidateStats(simulator, {
      ...baseCase,
      key: `support-class-${className}`,
      characterName
    });
    const character = { lopec: mutatedSnapshot } as CharacterState;
    const nextSimulator = createExactLopecReplacementSimulator(character, [
      {
        replacedSlot: normalizedCase.replacedSlot,
        candidate: normalizedCase.candidate
      }
    ]);
    const local = calculateExactLopecReplacement(
      character,
      normalizedCase.replacedSlot,
      normalizedCase.candidate,
      "support"
    );

    if (!nextSimulator || !local) {
      failures.push(`${normalizedCase.key}: local replacement calculation failed`);
      continue;
    }

    const runtimeBaseScore = readRuntimeScore("support", simulator, dealerModule, supportModule);
    const runtimeNextScore = readRuntimeScore("support", nextSimulator, dealerModule, supportModule);
    const runtimeRatio = runtimeNextScore / runtimeBaseScore;
    const runtimeNextRounded = round2(snapshot.score * runtimeRatio);
    const runtimeDelta = round2(runtimeNextRounded - snapshot.score);
    const nextDiff = Math.abs(local.nextScore - runtimeNextRounded);
    const deltaDiff = Math.abs(local.deltaScore - runtimeDelta);

    if (nextDiff > SCORE_TOLERANCE || deltaDiff > SCORE_TOLERANCE) {
      failures.push(
        `${normalizedCase.key}: next diff ${nextDiff.toFixed(4)}, delta diff ${deltaDiff.toFixed(4)}`
      );
    }
  }

  if (failures.length > 0) {
    console.error("Support class mutation parity failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`${SUPPORT_CLASS_NAMES.length} support class mutation parity cases passed.`);
}

function normalizeCandidateStats(
  simulator: LopecSimulatorData,
  testCase: ParityCase
): ParityCase {
  const currentAccessory = simulator.armory.accessory[ACCESSORY_SLOT_TO_LOPEC[testCase.replacedSlot]];

  if (!currentAccessory || !("stat" in currentAccessory)) {
    return testCase;
  }

  return {
    ...testCase,
    candidate: {
      ...testCase.candidate,
      stats: {
        strength: currentAccessory.stat,
        dexterity: 0,
        intelligence: 0,
        health: currentAccessory.health ?? 0
      }
    }
  };
}

function readRuntimeScore(
  mode: AccessoryScoringMode,
  data: LopecSimulatorData,
  dealerModule: { cA(data: LopecSimulatorData): RuntimeDealerScore },
  supportModule: { PR(data: LopecSimulatorData): RuntimeSupportScore }
): number {
  if (mode === "support") {
    return supportModule.PR(data).supportSpecPoint;
  }

  return dealerModule.cA(data).withGem;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function createCandidate(params: {
  type: AccessoryType;
  name: string;
  grade: string;
  stats: Partial<AccessoryCandidate["stats"]>;
  refinementOptions: AccessoryRefinementOption[];
  effects: Partial<AccessoryEffects>;
}): AccessoryCandidate {
  const effects: AccessoryEffects = {
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
    health: 0,
    ...params.effects
  };

  return {
    auctionId: params.name,
    type: params.type,
    name: params.name,
    grade: params.grade,
    quality: 100,
    icon: undefined,
    stats: {
      strength: 0,
      dexterity: 0,
      intelligence: 0,
      health: 0,
      ...params.stats
    },
    effects,
    effectSummary: params.refinementOptions.map(
      (item) => `${item.label} +${item.value.toFixed(item.suffix === "%" ? 2 : 0)}${item.suffix}`
    ),
    effectGrades: [],
    refinementOptions: params.refinementOptions,
    level: 0,
    buyPrice: 1,
    bidStartPrice: null,
    endDate: "",
    tradeAllowCount: 2
  };
}

function option(
  label: string,
  value: number,
  suffix: string,
  grade: AccessoryRefinementOption["grade"],
  isEffective: boolean
): AccessoryRefinementOption {
  return {
    label,
    value,
    suffix,
    grade,
    isEffective
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
