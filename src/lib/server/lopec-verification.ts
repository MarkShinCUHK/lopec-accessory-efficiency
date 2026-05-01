import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyLatestLopecFormula } from "@/lib/server/lopec-formula-verifier";

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const STATUS_PATH = process.env.VERCEL
  ? path.join("/tmp", "lopec-verification-status.json")
  : path.join(process.cwd(), ".cache", "lopec-verification-status.json");

export interface LopecVerificationStatus {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastDurationMs: number | null;
  lastMessage: string;
  lastOutputTail: string | null;
}

export interface LopecVerificationView extends LopecVerificationStatus {
  isFresh: boolean;
  isRunning: boolean;
  canVerify: boolean;
  ageMs: number | null;
  freshUntil: string | null;
}

const EMPTY_STATUS: LopecVerificationStatus = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastDurationMs: null,
  lastMessage: "로펙 수식 일치 확인 이력이 없습니다.",
  lastOutputTail: null
};

let runningVerification: Promise<LopecVerificationStatus> | null = null;

export async function readLopecVerificationView(): Promise<LopecVerificationView> {
  return toView(await readLopecVerificationStatus(), Boolean(runningVerification));
}

export async function runLopecVerificationIfStale(): Promise<LopecVerificationView> {
  const current = await readLopecVerificationStatus();

  if (isFresh(current.lastSuccessAt)) {
    return toView(
      {
        ...current,
        lastMessage: "최신 로펙 수식과 일치합니다."
      },
      Boolean(runningVerification)
    );
  }

  if (!runningVerification) {
    runningVerification = runLopecVerification().finally(() => {
      runningVerification = null;
    });
  }

  return toView(await runningVerification, Boolean(runningVerification));
}

async function runLopecVerification(): Promise<LopecVerificationStatus> {
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();

  try {
    const verification = await verifyLatestLopecFormula();
    const finishedAt = new Date();
    const status: LopecVerificationStatus = {
      lastAttemptAt: startedAtIso,
      lastSuccessAt: verification.ok ? finishedAt.toISOString() : null,
      lastFailureAt: verification.ok ? null : finishedAt.toISOString(),
      lastDurationMs: finishedAt.getTime() - startedAt.getTime(),
      lastMessage: verification.ok
        ? "최신 로펙 수식 일치 확인을 완료했습니다."
        : "로펙 수식이 저장된 기준과 다릅니다. 개발자 검토가 필요합니다.",
      lastOutputTail: tailLines(verification.output, 24)
    };

    await writeLopecVerificationStatus(status);
    return status;
  } catch (error) {
    const previous = await readLopecVerificationStatus();
    const finishedAt = new Date();
    const output = readExecErrorOutput(error);
    const status: LopecVerificationStatus = {
      ...previous,
      lastAttemptAt: startedAtIso,
      lastFailureAt: finishedAt.toISOString(),
      lastDurationMs: finishedAt.getTime() - startedAt.getTime(),
      lastMessage: "로펙 수식 일치 확인에 실패했습니다.",
      lastOutputTail: output ? tailLines(output, 24) : null
    };

    await writeLopecVerificationStatus(status);
    return status;
  }
}

async function readLopecVerificationStatus(): Promise<LopecVerificationStatus> {
  try {
    return normalizeVerificationStatus({
      ...EMPTY_STATUS,
      ...(JSON.parse(await readFile(STATUS_PATH, "utf8")) as Partial<LopecVerificationStatus>)
    });
  } catch {
    return EMPTY_STATUS;
  }
}

function normalizeVerificationStatus(status: LopecVerificationStatus): LopecVerificationStatus {
  return {
    ...status,
    lastMessage: status.lastMessage
      .replace("LOPEC 공식 검증이 최신 상태입니다.", "최신 로펙 수식과 일치합니다.")
      .replace("LOPEC 공식 검증을 완료했습니다.", "최신 로펙 수식 일치 확인을 완료했습니다.")
      .replace("LOPEC 공식 검증에 실패했습니다.", "로펙 수식 일치 확인에 실패했습니다.")
      .replace("LOPEC 검증 이력이 없습니다.", "로펙 수식 일치 확인 이력이 없습니다.")
  };
}

async function writeLopecVerificationStatus(status: LopecVerificationStatus): Promise<void> {
  try {
    await mkdir(path.dirname(STATUS_PATH), { recursive: true });
    await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  } catch {
    // Vercel serverless storage is ephemeral and may reject writes in some cases.
    // Verification should still return the live result to the caller.
  }
}

function toView(
  status: LopecVerificationStatus,
  isRunning: boolean
): LopecVerificationView {
  const ageMs = status.lastSuccessAt ? Date.now() - new Date(status.lastSuccessAt).getTime() : null;
  const freshUntil = status.lastSuccessAt
    ? new Date(new Date(status.lastSuccessAt).getTime() + FRESH_WINDOW_MS).toISOString()
    : null;
  const fresh = isFresh(status.lastSuccessAt);

  return {
    ...status,
    isFresh: fresh,
    isRunning,
    canVerify: !fresh && !isRunning,
    ageMs,
    freshUntil
  };
}

function isFresh(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return Date.now() - new Date(value).getTime() <= FRESH_WINDOW_MS;
}

function tailLines(value: string, lineCount: number): string {
  return value.split(/\r?\n/).filter(Boolean).slice(-lineCount).join("\n");
}

function readExecErrorOutput(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  const record = error as { stdout?: unknown; stderr?: unknown; message?: unknown };

  return [record.stdout, record.stderr, record.message]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");
}
