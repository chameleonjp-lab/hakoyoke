import { describe, expect, it } from "vitest";
import {
  consumeStorageRateLimit,
  configuredStorageAssetKeys,
  isAllowedStorageKey,
  isSafeStorageRedirect,
  normalizeStorageKey,
  pruneStorageRateLimits,
} from "./storagePolicy";

describe("public storage proxy policy", () => {
  it("accepts only an explicitly allowlisted asset key", () => {
    const allowlist = configuredStorageAssetKeys("");
    expect(
      isAllowedStorageKey("cubic-ordeal-logo_b0288b12.png", allowlist)
    ).toBe(true);
    expect(isAllowedStorageKey("private/report.json", allowlist)).toBe(false);
    expect(isAllowedStorageKey("other-public.png", allowlist)).toBe(false);
  });

  it("normalizes encoded paths without allowing traversal or nested paths", () => {
    expect(
      normalizeStorageKey("/manus-storage/cubic-ordeal-logo_b0288b12.png")
    ).toBe("cubic-ordeal-logo_b0288b12.png");
    expect(
      normalizeStorageKey("/manus-storage/cubic-ordeal-logo%5Fb0288b12.png")
    ).toBe("cubic-ordeal-logo_b0288b12.png");
    expect(normalizeStorageKey("/manus-storage/%2e%2e/private.txt")).toBeNull();
    expect(normalizeStorageKey("/manus-storage/nested/file.png")).toBeNull();
    expect(normalizeStorageKey("/manus-storage/%E0%A4%A")).toBeNull();
  });

  it("only permits credential-free HTTPS redirects", () => {
    expect(isSafeStorageRedirect("https://storage.example.test/signed")).toBe(
      true
    );
    expect(isSafeStorageRedirect("http://storage.example.test/signed")).toBe(
      false
    );
    expect(
      isSafeStorageRedirect("https://user:password@storage.example.test/signed")
    ).toBe(false);
    expect(isSafeStorageRedirect("javascript:alert(1)")).toBe(false);
    expect(
      isSafeStorageRedirect("https://storage.example.test/signed#fragment")
    ).toBe(false);
    expect(
      isSafeStorageRedirect(
        "https://storage.example.test/signed",
        new Set(["other.test"])
      )
    ).toBe(false);
  });

  it("limits bursts and prunes expired identities", () => {
    const state = new Map();
    for (let index = 0; index < 3; index += 1)
      expect(
        consumeStorageRateLimit(state, "client", 1_000, 10_000, 3).allowed
      ).toBe(true);
    const blocked = consumeStorageRateLimit(state, "client", 1_000, 10_000, 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(10);
    expect(
      consumeStorageRateLimit(state, "client", 11_000, 10_000, 3).allowed
    ).toBe(true);
    pruneStorageRateLimits(state, 21_000);
    expect(state.has("client")).toBe(false);
  });
});
