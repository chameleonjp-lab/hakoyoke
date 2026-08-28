import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "./types";

describe("difficulty movement consistency", () => {
  it("keeps player movement speed identical across every difficulty", () => {
    const speeds = Object.values(DIFFICULTIES).map(config => config.playerSpeed);
    expect(new Set(speeds).size).toBe(1);
    expect(speeds[0]).toBe(4.45);
  });

  it("changes pressure through cube timing instead of slowing the player", () => {
    expect(DIFFICULTIES.BEGINNER.rollSeconds).toBeGreaterThan(
      DIFFICULTIES.EXTREME.rollSeconds
    );
    expect(DIFFICULTIES.BEGINNER.settleSeconds).toBeGreaterThan(
      DIFFICULTIES.EXTREME.settleSeconds
    );
    expect(DIFFICULTIES.BEGINNER.captureSeconds).toBeGreaterThan(
      DIFFICULTIES.EXTREME.captureSeconds
    );
  });
});
