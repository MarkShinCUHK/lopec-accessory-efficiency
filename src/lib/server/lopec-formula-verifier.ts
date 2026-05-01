import { createHash } from "node:crypto";
import vm from "node:vm";
import formulaBaseline from "../../../specifications/lopec-formula-fingerprints.json";

const LOPEC_BASE_URL = "https://lopec.kr";
const LOPEC_SIMULATOR_CHARACTER = "중사진심지수";
const FETCH_TIMEOUT_MS = 25_000;

interface WebpackModule {
  exports: Record<string, unknown>;
}

interface WebpackRequire {
  (id: number | string): Record<string, unknown>;
  d(
    exports: Record<string, unknown> | ((...args: never[]) => unknown),
    definition: Record<string, () => unknown>
  ): void;
  n(module: Record<string, unknown>): (...args: never[]) => unknown;
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

export interface LopecFormulaVerificationResult {
  ok: boolean;
  output: string;
}

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

export async function verifyLatestLopecFormula(): Promise<LopecFormulaVerificationResult> {
  const runtime = await loadLopecRuntime();
  const fingerprints = readFormulaFingerprints(runtime.modules);
  const baseline = formulaBaseline as FormulaBaseline;
  const mismatches = fingerprints.filter((fingerprint) => {
    const expected = baseline.modules.find((item) => item.key === fingerprint.key);

    return !expected || expected.sha256 !== fingerprint.sha256;
  });

  if (mismatches.length > 0) {
    return {
      ok: false,
      output: [
        "LOPEC formula bundle changed:",
        ...mismatches.map(
          (mismatch) => `- ${mismatch.key} module ${mismatch.moduleId} sha256=${mismatch.sha256}`
        ),
        "Run \"npm run verify:lopec\" locally, then update the formula port or baseline after auditing."
      ].join("\n")
    };
  }

  return {
    ok: true,
    output: [
      "LOPEC formula fingerprints match the stored baseline.",
      `Baseline updated at ${baseline.updatedAt}.`
    ].join("\n")
  };
}

async function loadLopecRuntime(): Promise<LopecRuntime> {
  const pageUrl = `${LOPEC_BASE_URL}/character/simulator/${encodeURIComponent(LOPEC_SIMULATOR_CHARACTER)}`;
  const html = await fetchText(pageUrl);
  const scriptUrls = readScriptUrls(html, pageUrl);
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
      // Some chunks expect the full browser runtime. Formula modules are registered
      // through webpackChunk_N_E before that application code is needed.
    }
  }

  return {
    modules
  };
}

function readScriptUrls(html: string, pageUrl: string): string[] {
  return Array.from(html.matchAll(/<script[^>]+src="([^"]+\.js)"/g), (match) => {
    try {
      const url = new URL(match[1], pageUrl);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }).filter((value): value is string => Boolean(value));
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

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
