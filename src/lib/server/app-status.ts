import { execFile } from "node:child_process";
import { promisify } from "node:util";
import packageJson from "../../../package.json";
import {
  readLopecVerificationView,
  type LopecVerificationView
} from "@/lib/server/lopec-verification";

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 1200;

export type VersionComparison = "same" | "behind" | "ahead" | "diverged" | "unknown";
export type VersionSource = "vercel" | "git" | "unknown";

export interface AppVersionMetadata {
  packageName: string;
  packageVersion: string;
  environment: string;
  source: VersionSource;
  commitSha: string | null;
  shortCommitSha: string | null;
  commitRef: string | null;
  latestMainSha: string | null;
  latestMainShortSha: string | null;
  comparison: VersionComparison;
  deploymentUrl: string | null;
  vercelEnv: string | null;
}

export interface AppStatusView {
  verification: LopecVerificationView;
  version: AppVersionMetadata;
}

export async function readAppStatusView(): Promise<AppStatusView> {
  const [verification, version] = await Promise.all([
    readLopecVerificationView(),
    readAppVersionMetadata()
  ]);

  return {
    verification,
    version
  };
}

async function readAppVersionMetadata(): Promise<AppVersionMetadata> {
  const vercelCommitSha = normalizeSha(process.env.VERCEL_GIT_COMMIT_SHA);
  const gitCommitSha = vercelCommitSha ?? (await readGitValue(["rev-parse", "HEAD"]));
  const commitSha = gitCommitSha ? normalizeSha(gitCommitSha) : null;
  const commitRef =
    process.env.VERCEL_GIT_COMMIT_REF ??
    (vercelCommitSha ? null : await readGitValue(["rev-parse", "--abbrev-ref", "HEAD"])) ??
    null;
  const latestMainSha = vercelCommitSha ? null : await readGitValue(["rev-parse", "origin/main"]);
  const normalizedLatestMainSha = latestMainSha ? normalizeSha(latestMainSha) : null;

  return {
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local",
    source: vercelCommitSha ? "vercel" : commitSha ? "git" : "unknown",
    commitSha,
    shortCommitSha: shortenSha(commitSha),
    commitRef,
    latestMainSha: normalizedLatestMainSha,
    latestMainShortSha: shortenSha(normalizedLatestMainSha),
    comparison: await compareWithMain(commitSha, normalizedLatestMainSha),
    deploymentUrl: readDeploymentUrl(),
    vercelEnv: process.env.VERCEL_ENV ?? null
  };
}

async function compareWithMain(
  commitSha: string | null,
  latestMainSha: string | null
): Promise<VersionComparison> {
  if (!commitSha || !latestMainSha) {
    return "unknown";
  }

  if (commitSha === latestMainSha) {
    return "same";
  }

  const mergeBase = await readGitValue(["merge-base", commitSha, latestMainSha]);

  if (!mergeBase) {
    return "unknown";
  }

  const normalizedMergeBase = normalizeSha(mergeBase);

  if (normalizedMergeBase === commitSha) {
    return "behind";
  }

  if (normalizedMergeBase === latestMainSha) {
    return "ahead";
  }

  return "diverged";
}

async function readGitValue(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: process.cwd(),
      timeout: GIT_TIMEOUT_MS
    });
    const value = stdout.trim();

    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function normalizeSha(value: string | undefined | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return /^[a-f0-9]{7,40}$/i.test(trimmed) ? trimmed : null;
}

function shortenSha(value: string | null): string | null {
  return value ? value.slice(0, 7) : null;
}

function readDeploymentUrl(): string | null {
  const rawUrl = process.env.VERCEL_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (!rawUrl) {
    return null;
  }

  return rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
}
