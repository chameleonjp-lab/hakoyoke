import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePuzzles, loadPuzzles } from "./puzzles";

function response(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

describe("puzzle archive runtime boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the complete generated archive only after validation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(generatePuzzles()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadPuzzles()).resolves.toHaveLength(88);
    expect(fetchMock).toHaveBeenCalledWith("/data/puzzles.json", {
      cache: "no-cache",
    });
  });

  it("fails closed when an archive entry is malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([null])));

    await expect(loadPuzzles()).rejects.toThrow(
      "Puzzle archive entry 1 invalid"
    );
  });

  it("fails closed when gameplay patterns are duplicated", async () => {
    const archive = generatePuzzles();
    archive[1] = {
      ...archive[0],
      id: "DUPLICATE-GAMEPLAY",
      seed: 999_999,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(archive)));

    await expect(loadPuzzles()).rejects.toThrow("duplicate gameplay pattern");
  });

  it("reports an unavailable archive response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(null, false)));

    await expect(loadPuzzles()).rejects.toThrow(
      "Puzzle archive could not be loaded"
    );
  });
});
