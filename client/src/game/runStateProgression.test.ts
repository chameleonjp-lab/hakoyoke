import { describe, expect, it } from "vitest";
import { retainRunState, shouldCarryRunState } from "./runStateProgression";
import type { AreaMark, PuzzleDescriptor } from "./types";

const puzzle = (
  stage: number,
  wave: number,
  ordinal: number
): PuzzleDescriptor => ({
  id: `S${stage}-W${wave}-P${ordinal}`,
  stage,
  wave,
  ordinal,
  width: 4,
  depth: 2,
  requiredRolls: 1,
  difficultyTag: "test",
  seed: ordinal,
  layout: [{ x: 1, z: 5, type: "normal" }],
  solution: [],
  validation: {
    valid: true,
    normal: 1,
    veil: 0,
    void: 0,
    travelBudget: 4,
  },
  featured: false,
});

describe("run-state progression", () => {
  it("carries misses and unused AREA to the next puzzle in the same wave", () => {
    expect(shouldCarryRunState(puzzle(1, 1, 1), puzzle(1, 1, 2), false)).toBe(
      true
    );
  });

  it("clears carried state when the wave or stage changes", () => {
    expect(shouldCarryRunState(puzzle(1, 1, 1), puzzle(1, 2, 1), false)).toBe(
      false
    );
    expect(shouldCarryRunState(puzzle(1, 2, 1), puzzle(2, 1, 1), false)).toBe(
      false
    );
  });

  it("clears carried state on an explicit run reset", () => {
    expect(shouldCarryRunState(puzzle(1, 1, 1), puzzle(1, 1, 2), true)).toBe(
      false
    );
  });

  it("copies AREA anchors so a later load cannot mutate the saved state", () => {
    const areas: AreaMark[] = [{ id: "area-1", x: 2, z: 3, armed: true }];
    const retained = retainRunState(2, areas);

    areas[0]!.z = 99;
    expect(retained.misses).toBe(2);
    expect(retained.areas).toEqual([
      { id: "area-1", x: 2, z: 3, armed: true },
    ]);
  });
});
