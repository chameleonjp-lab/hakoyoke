/** Public storage proxy policy. Keep the compatibility route narrow and deterministic. */

export const STORAGE_RESOLVE_TIMEOUT_MS = 5_000;
export const STORAGE_RATE_LIMIT_WINDOW_MS = 60_000;
export const STORAGE_RATE_LIMIT_MAX_REQUESTS = 30;

/**
 * The game itself does not depend on Forge assets. This key is retained for
 * the production proxy smoke test and for the one archived title asset.
 */
export const DEFAULT_STORAGE_ASSET_KEYS = new Set([
  "cubic-ordeal-logo_b0288b12.png",
]);

const SAFE_STORAGE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function configuredStorageAssetKeys(
  raw = process.env.MANUS_STORAGE_ALLOWLIST
): Set<string> {
  const configured = (raw ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(value => SAFE_STORAGE_KEY.test(value));
  return new Set([...Array.from(DEFAULT_STORAGE_ASSET_KEYS), ...configured]);
}

export function normalizeStorageKey(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const key = decoded.replace(/^\/manus-storage\/?/, "");
  if (!SAFE_STORAGE_KEY.test(key) || key.includes("..")) return null;
  return key;
}

export function isAllowedStorageKey(
  key: string,
  allowlist = configuredStorageAssetKeys()
): boolean {
  return allowlist.has(key);
}

/** Only signed HTTPS locations without embedded credentials may be returned. */
export function isSafeStorageRedirect(
  value: unknown,
  allowedHosts = configuredStorageRedirectHosts()
): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const target = new URL(value);
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.hash
    )
      return false;
    return allowedHosts.size === 0 || allowedHosts.has(target.hostname);
  } catch {
    return false;
  }
}

function configuredStorageRedirectHosts(
  raw = process.env.MANUS_STORAGE_REDIRECT_HOSTS
): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export interface RateLimitState {
  count: number;
  resetAt: number;
}

export function consumeStorageRateLimit(
  state: Map<string, RateLimitState>,
  identity: string,
  now = Date.now(),
  windowMs = STORAGE_RATE_LIMIT_WINDOW_MS,
  maxRequests = STORAGE_RATE_LIMIT_MAX_REQUESTS
): { allowed: boolean; retryAfterSeconds: number } {
  const current = state.get(identity);
  if (!current || current.resetAt <= now) {
    state.set(identity, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1_000)
      ),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function pruneStorageRateLimits(
  state: Map<string, RateLimitState>,
  now = Date.now()
): void {
  state.forEach((entry, identity) => {
    if (entry.resetAt <= now) state.delete(identity);
  });
}
