import { describe, expect, it } from "vitest";
import {
  platformRowsForStage,
  projectPuzzleCubesToPlatform,
  shouldResetPlatformAtLoad,
} from "./platformProgression";
import type { CubeState, PuzzleDescriptor } from "./types";

const puzzle = (): PuzzleDescriptor => ({
  id: "PLATFORM-PROGRESSION",
  stage: 1,
  wave: 1,
  ordinal: 1,
  width: 4,
  depth: 2,
  spawnRow: 5,
  requiredRolls: 1,
  difficultyTag: "test",
  seed: 1,
  layout: [
    { x: 1, z: 5, type: "normal" },
    { x: 2, z: 6, type: "void" },
  ],
  solution: [],
  validation: {
    valid: true,
    normal: 1,
    veil: 0,
    void: 1,
    travelBudget: 4,
  },
  featured: false,
});

const runtimeCubes = (source: PuzzleDescriptor): CubeState[] =>
  source.layout.map((cube, index) => ({
    ...cube,
    id: `cube-${index}`,
    previousZ: cube.z,
  }));

describe("platform progression", () => {
  it("projects a formation against the far edge of the current platform", () => {
    const source = puzzle();
    const projected = projectPuzzleCubesToPlatform(
      source,
      runtimeCubes(source),
      12
    );

    expect(projected.map(cube => cube.z)).toEqual([10, 11]);
    expect(projected.map(cube => cube.previousZ)).toEqual([10, 11]);
  });

  it("adds exactly one roll of arrival distance when one platform row is gained", () => {
    const source = puzzle();
    const normal = projectPuzzleCubesToPlatform(
      source,
      runtimeCubes(source),
      12
    );
    const perfect = projectPuzzleCubesToPlatform(
      source,
      runtimeCubes(source),
      13
    );

    expect(perfect.map((cube, index) => cube.z - normal[index]!.z)).toEqual([
      1, 1,
    ]);
  });

  it("removes exactly one roll of arrival distance when one platform row is lost", () => {
    const source = puzzle();
    const normal = projectPuzzleCubesToPlatform(
      source,
      runtimeCubes(source),
      12
    );
    const damaged = projectPuzzleCubesToPlatform(
      source,
      runtimeCubes(source),
      11
    );

    expect(normal.map((cube, index) => cube.z - damaged[index]!.z)).toEqual([
      1, 1,
    ]);
  });

  it("resets the platform at campaign stage boundaries but not between puzzles", () => {
    expect(shouldResetPlatformAtLoad("CAMPAIGN", 1, 1, false)).toBe(false);
    expect(shouldResetPlatformAtLoad("CAMPAIGN", 1, 2, false)).toBe(true);
    expect(shouldResetPlatformAtLoad("PRACTICE", 1, 2, false)).toBe(false);
    expect(shouldResetPlatformAtLoad("CAMPAIGN", 1, 1, true)).toBe(true);
  });

  it("keeps every stage baseline large enough for the deepest puzzle plus safety rows", () => {
    expect(platformRowsForStage(1, 2)).toBe(12);
    expect(platformRowsForStage(9, 9)).toBe(12);
    expect(platformRowsForStage(99, 12)).toBe(15);
  });
});
