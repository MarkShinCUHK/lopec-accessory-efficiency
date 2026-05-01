const LOSTARK_API_BASE_URL = "https://developer-lostark.game.onstove.com";

type LostarkRequestMethod = "GET" | "POST";

interface LostarkRequestOptions {
  method?: LostarkRequestMethod;
  body?: unknown;
  next?: RequestInit["next"];
  maxRetries?: number;
  maxRetryMs?: number;
  apiKey?: string | null;
  rotateApiKeysOnRateLimit?: boolean;
  onRateLimit?: (event: LostarkRateLimitRetryEvent) => void;
}

export interface LostarkRateLimit {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

export interface LostarkApiResult<T> {
  data: T;
  rateLimit: LostarkRateLimit;
  status: number;
}

export interface LostarkRateLimitRetryEvent {
  attempt: number;
  delayMs: number;
  path: string;
}

export class LostarkApiError extends Error {
  status: number;
  rateLimit: LostarkRateLimit;
  payload: unknown;

  constructor(message: string, status: number, rateLimit: LostarkRateLimit, payload: unknown) {
    super(message);
    this.name = "LostarkApiError";
    this.status = status;
    this.rateLimit = rateLimit;
    this.payload = payload;
  }
}

export async function requestLostarkApi<T>(
  path: `/${string}`,
  options: LostarkRequestOptions = {}
): Promise<LostarkApiResult<T>> {
  const method = options.method ?? "GET";
  const maxRetries = options.maxRetries ?? 100;
  const retryUntil = Date.now() + (options.maxRetryMs ?? 10 * 60 * 1000);
  const credentials = buildCredentialChain(options.apiKey, options.rotateApiKeysOnRateLimit);
  const rateLimitDelayByCredential = new Map<string, number>();

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const credential = credentials[attempt % credentials.length];
    const response = await fetch(`${LOSTARK_API_BASE_URL}${path}`, {
      method,
      headers: buildHeaders(options.body, credential.value),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      next: options.next
    });
    const rateLimit = readRateLimit(response.headers);

    if (response.status === 429 && attempt < maxRetries) {
      const delayMs = readRateLimitDelayMs(response.headers, attempt);
      rateLimitDelayByCredential.set(credential.id, delayMs);
      await discardPayload(response);

      if (credentials.length > 1 && (attempt + 1) % credentials.length !== 0) {
        continue;
      }

      const rotatedDelayMs =
        credentials.length > 1
          ? Math.min(...Array.from(rateLimitDelayByCredential.values()))
          : delayMs;

      if (Date.now() + rotatedDelayMs <= retryUntil) {
        options.onRateLimit?.({
          attempt: attempt + 1,
          delayMs: rotatedDelayMs,
          path
        });
        await sleep(rotatedDelayMs);
        continue;
      }

      throw new LostarkApiError(
        "Lostark API rate limit wait exceeded",
        response.status,
        rateLimit,
        null
      );
    }

    const payload = await readPayload(response);

    if (!response.ok) {
      throw new LostarkApiError(
        `Lostark API request failed with ${response.status}`,
        response.status,
        rateLimit,
        payload
      );
    }

    rateLimitDelayByCredential.delete(credential.id);

    return {
      data: payload as T,
      rateLimit,
      status: response.status
    };
  }

  throw new Error("Lostark API request retry loop ended unexpectedly.");
}

function buildHeaders(body: unknown, apiKey: string): HeadersInit {
  const headers: HeadersInit = {
    accept: "application/json",
    authorization: getAuthorizationHeader(apiKey)
  };

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  return headers;
}

function getAuthorizationHeader(jwt: string): string {
  return jwt.toLowerCase().startsWith("bearer ") ? jwt : `bearer ${jwt}`;
}

function buildCredentialChain(
  preferredApiKey?: string | null,
  rotateApiKeysOnRateLimit = false
): Array<{ id: string; value: string }> {
  const preferred = preferredApiKey?.trim();
  const fallback = process.env.LOSTARK_API_JWT?.trim();
  const credentials: Array<{ id: string; value: string }> = [];

  if (preferred) {
    credentials.push({
      id: "provided",
      value: preferred
    });
  }

  if (
    fallback &&
    (!preferred || normalizeAuthorizationKey(fallback) !== normalizeAuthorizationKey(preferred))
  ) {
    credentials.push({
      id: "default",
      value: fallback
    });
  }

  if (!rotateApiKeysOnRateLimit && preferred) {
    return [credentials[0]];
  }

  if (credentials.length === 0) {
    throw new Error("LOSTARK_API_JWT is not configured.");
  }

  return credentials;
}

function normalizeAuthorizationKey(apiKey: string): string {
  return apiKey.toLowerCase().startsWith("bearer ")
    ? apiKey.slice("bearer ".length).trim()
    : apiKey.trim();
}

function readRateLimit(headers: Headers): LostarkRateLimit {
  return {
    limit: readNumberHeader(headers, "x-ratelimit-limit"),
    remaining: readNumberHeader(headers, "x-ratelimit-remaining"),
    reset: readNumberHeader(headers, "x-ratelimit-reset")
  };
}

function readNumberHeader(headers: Headers, key: string): number | null {
  const value = headers.get(key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function discardPayload(response: Response): Promise<void> {
  try {
    await response.text();
  } catch {
    // Ignore payload drain failures while waiting for a retry.
  }
}

function readRateLimitDelayMs(headers: Headers, attempt: number): number {
  const retryAfter = headers.get("retry-after");

  if (retryAfter) {
    const parsedSeconds = Number(retryAfter);

    if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
      return Math.min(parsedSeconds * 1000, 60000);
    }

    const parsedDate = Date.parse(retryAfter);

    if (Number.isFinite(parsedDate)) {
      return Math.min(Math.max(parsedDate - Date.now(), 1000), 60000);
    }
  }

  const reset = readNumberHeader(headers, "x-ratelimit-reset");

  if (reset && reset > 0) {
    const resetMs = reset > 10_000_000_000 ? reset - Date.now() : reset * 1000;

    if (resetMs > 0) {
      return Math.min(Math.max(resetMs, 1000), 60000);
    }
  }

  return Math.min(1500 * 1.6 ** attempt, 20000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
