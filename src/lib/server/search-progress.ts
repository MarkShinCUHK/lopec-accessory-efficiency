export type SearchProgressStatus = "running" | "waiting" | "done" | "error";

export interface SearchProgressSnapshot {
  id: string;
  status: SearchProgressStatus;
  completedRequests: number;
  totalRequests: number;
  percent: number;
  message: string;
  updatedAt: number;
  retryAttempt?: number;
  retryDelayMs?: number;
  retryStartedAt?: number;
  result?: unknown;
}

type ProgressPatch = Partial<
  Omit<SearchProgressSnapshot, "id" | "percent" | "updatedAt">
>;

type ProgressStore = Map<string, SearchProgressSnapshot>;

declare global {
  var __lopecAccessorySearchProgress: ProgressStore | undefined;
}

function readStore(): ProgressStore {
  globalThis.__lopecAccessorySearchProgress ??= new Map<string, SearchProgressSnapshot>();
  return globalThis.__lopecAccessorySearchProgress;
}

export function initSearchProgress(
  id: string | null | undefined,
  totalRequests: number,
  message: string
): void {
  if (!id) {
    return;
  }

  readStore().set(id, {
    id,
    status: "running",
    completedRequests: 0,
    totalRequests: Math.max(totalRequests, 1),
    percent: 0,
    message,
    updatedAt: Date.now()
  });
}

export function updateSearchProgress(
  id: string | null | undefined,
  patch: ProgressPatch
): void {
  if (!id) {
    return;
  }

  const store = readStore();
  const current =
    store.get(id) ??
    ({
      id,
      status: "running",
      completedRequests: 0,
      totalRequests: 1,
      percent: 0,
      message: "검색 준비 중",
      updatedAt: Date.now()
    } satisfies SearchProgressSnapshot);
  const completedRequests = Math.max(
    0,
    patch.completedRequests ?? current.completedRequests
  );
  const totalRequests = Math.max(
    completedRequests,
    patch.totalRequests ?? current.totalRequests,
    1
  );
  const status = patch.status ?? current.status;
  const nextUpdatedAt = Date.now();
  const percent =
    status === "done"
      ? 100
      : Math.min(99, Math.floor((completedRequests / totalRequests) * 100));
  const retryStartedAt =
    status === "waiting" && patch.retryDelayMs !== undefined
      ? nextUpdatedAt
      : status === "waiting"
        ? current.retryStartedAt
        : undefined;

  store.set(id, {
    ...current,
    ...patch,
    completedRequests,
    totalRequests,
    status,
    percent,
    retryStartedAt,
    updatedAt: nextUpdatedAt
  });
}

export function finishSearchProgress(
  id: string | null | undefined,
  message = "검색 완료",
  result?: unknown
): void {
  if (!id) {
    return;
  }

  const current = readStore().get(id);

  updateSearchProgress(id, {
    status: "done",
    completedRequests: current?.totalRequests ?? 1,
    totalRequests: current?.totalRequests ?? 1,
    message,
    result
  });
}

export function failSearchProgress(
  id: string | null | undefined,
  message: string
): void {
  updateSearchProgress(id, {
    status: "error",
    message
  });
}

export function readSearchProgress(id: string): SearchProgressSnapshot | null {
  const snapshot = readStore().get(id) ?? null;

  if (!snapshot) {
    return null;
  }

  return snapshot;
}
