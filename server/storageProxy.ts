import {
  isSafeStorageRedirect,
  STORAGE_RESOLVE_TIMEOUT_MS,
} from "./storagePolicy";

/** Resolve one allowlisted public asset without exposing the Forge credential. */
export async function resolveStorageAsset(key: string): Promise<string | null> {
  const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(
    /\/+$/,
    ""
  );
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!forgeBaseUrl || !forgeKey) return null;

  let forgeUrl: URL;
  try {
    forgeUrl = new URL("v1/storage/presign/get", `${forgeBaseUrl}/`);
    if (!["http:", "https:"].includes(forgeUrl.protocol)) return null;
  } catch {
    return null;
  }
  forgeUrl.searchParams.set("path", key);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    STORAGE_RESOLVE_TIMEOUT_MS
  );
  try {
    const response = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { url?: unknown };
    return isSafeStorageRedirect(payload.url) ? payload.url : null;
  } finally {
    clearTimeout(timeout);
  }
}
