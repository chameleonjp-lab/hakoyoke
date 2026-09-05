import { describe, expect, it } from "vitest";
import { resolveDuelRound } from "./duelRules";
import { generatePuzzles } from "./puzzles";
import { validatePuzzleArchive } from "./puzzleValidation";
import { areaTargets } from "./rules";
import { EXPECTED_PUZZLE_COUNT, puzzleCountFor } from "./stagePlan";
import type { AreaMark, CubeState } from "./types";

const cube = (
  id: string,
  type: CubeState["type"],
  x: number,
  z: number
): CubeState => ({ id, type, x, z, previousZ: z });

describe("post-review regressions", () => {
  it("treats AREA anchors as a one-shot caller-owned snapshot", () => {
    const active: AreaMark[] = [{ id: "old", x: 1, z: 0, armed: true }];
    const targets = areaTargets(
      [cube("veil", "veil", 1, 0), cube("normal", "normal", 2, 0)],
      active,
      null
    );
    expect(targets.map(item => item.id)).toEqual(["veil", "normal"]);
    expect(active).toHaveLength(1);
  });

  it("allows MARK to protect one VOID without removing another AREA target", () => {
    const targets = areaTargets(
      [cube("protected", "void", 1, 0), cube("normal", "normal", 2, 0)],
      [{ id: "a", x: 1, z: 0, armed: true }],
      { x: 1, z: 0 }
    );
    expect(targets.map(item => item.id)).toEqual(["normal"]);
  });

  it("uses the exact stage plan for PRACTICE ordinals", () => {
    expect(puzzleCountFor(1, 1)).toBe(3);
    expect(puzzleCountFor(4, 1)).toBe(2);
    expect(puzzleCountFor(8, 4)).toBe(2);
    expect(puzzleCountFor(9, 1)).toBe(1);
  });

  it("keeps the same DUEL puzzle after failure and advances only after success", () => {
    expect(resolveDuelRound([0, 0], 0, false)).toMatchObject({
      scores: [0, 0],
      nextTurn: 1,
      advancePuzzle: false,
      winner: null,
    });
    expect(resolveDuelRound([0, 0], 1, true)).toMatchObject({
      scores: [0, 1],
      nextTurn: 0,
      advancePuzzle: true,
      winner: null,
    });
  });

  it("opens the campaign with authored learning beats before generated chains", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    const records = puzzles.map((puzzle, index) => ({
      puzzle,
      result: archive.results[index]!,
    }));
    const waveOne = records.filter(
      ({ puzzle }) => puzzle.stage === 1 && puzzle.wave === 1
    );
    const waveTwo = records.filter(
      ({ puzzle }) => puzzle.stage === 1 && puzzle.wave === 2
    );

    expect(waveOne.map(({ puzzle }) => puzzle.difficultyTag)).toEqual([
      "intro-read",
      "intro-shift",
      "intro-avoid",
    ]);
    expect(waveOne.map(({ puzzle }) => puzzle.requiredRolls)).toEqual([
      1, 1, 1,
    ]);
    expect(waveOne.map(({ result }) => result.areaUses)).toEqual([0, 0, 0]);
    expect(
      waveOne.every(({ puzzle }) =>
        puzzle.designIntent?.startsWith("Hand-authored")
      )
    ).toBe(true);
    expect(
      new Set(waveOne.map(({ puzzle }) => JSON.stringify(puzzle.layout)))
    ).toHaveLength(3);

    expect(waveTwo.map(({ puzzle }) => puzzle.difficultyTag)).toEqual([
      "area-intro-range",
      "area-intro-timing",
      "area-intro-edge",
    ]);
    expect(waveTwo.map(({ result }) => result.areaUses)).toEqual([1, 1, 1]);
  });

  it("adds authored route variety before the scalable AREA chains", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    const stageTwoOpening = puzzles
      .map((puzzle, index) => ({ puzzle, result: archive.results[index]! }))
      .filter(({ puzzle }) => puzzle.stage === 2 && puzzle.wave <= 2);

    expect(stageTwoOpening.map(({ puzzle }) => puzzle.difficultyTag)).toEqual([
      "route-stagger",
      "route-split",
      "route-thread",
      "route-weave",
      "route-gate",
      "route-return",
    ]);
    expect(
      stageTwoOpening.every(({ puzzle }) =>
        puzzle.designIntent?.startsWith("Hand-authored")
      )
    ).toBe(true);
    expect(stageTwoOpening.map(({ result }) => result.areaUses)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(
      new Set(
        stageTwoOpening.map(({ puzzle }) => JSON.stringify(puzzle.layout))
      )
    ).toHaveLength(6);
    expect(
      stageTwoOpening.every(
        ({ puzzle }) =>
          puzzle.layout.some(cube => cube.type === "veil") &&
          puzzle.layout.some(cube => cube.type === "void")
      )
    ).toBe(true);
  });

  it("adds authored AREA chains after the Stage 2 route lessons", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    const stageTwoChains = puzzles
      .map((puzzle, index) => ({ puzzle, result: archive.results[index]! }))
      .filter(({ puzzle }) => puzzle.stage === 2 && puzzle.wave >= 3);

    expect(stageTwoChains.map(({ puzzle }) => puzzle.difficultyTag)).toEqual([
      "area-ribbon",
      "area-edge",
      "area-reverse",
      "chain-pulse",
      "chain-switch",
      "chain-ladder",
    ]);
    expect(stageTwoChains.map(({ puzzle }) => puzzle.requiredRolls)).toEqual([
      5, 4, 5, 4, 4, 5,
    ]);
    expect(stageTwoChains.map(({ result }) => result.areaUses)).toEqual([
      3, 3, 3, 3, 3, 3,
    ]);
    expect(
      stageTwoChains.every(({ puzzle }) =>
        puzzle.designIntent?.startsWith("Hand-authored")
      )
    ).toBe(true);
    expect(
      new Set(stageTwoChains.map(({ puzzle }) => JSON.stringify(puzzle.layout)))
    ).toHaveLength(6);
    expect(
      stageTwoChains.every(
        ({ puzzle }) =>
          puzzle.layout.some(cube => cube.type === "veil") &&
          puzzle.layout.some(cube => cube.type === "void")
      )
    ).toBe(true);
  });

  it("widens the authored route language in the opening of Stage 3", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    const stageThreeOpening = puzzles
      .map((puzzle, index) => ({ puzzle, result: archive.results[index]! }))
      .filter(({ puzzle }) => puzzle.stage === 3 && puzzle.wave <= 2);

    expect(stageThreeOpening.map(({ puzzle }) => puzzle.difficultyTag)).toEqual(
      [
        "wide-center",
        "wide-split",
        "wide-cross",
        "long-braid",
        "long-gate",
        "long-return",
      ]
    );
    expect(stageThreeOpening.map(({ puzzle }) => puzzle.requiredRolls)).toEqual(
      [3, 3, 3, 4, 4, 4]
    );
    expect(stageThreeOpening.map(({ result }) => result.areaUses)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(
      stageThreeOpening.every(({ puzzle }) =>
        puzzle.designIntent?.startsWith("Hand-authored")
      )
    ).toBe(true);
    expect(
      new Set(
        stageThreeOpening.map(({ puzzle }) => JSON.stringify(puzzle.layout))
      )
    ).toHaveLength(6);
    expect(
      stageThreeOpening.every(
        ({ puzzle }) =>
          puzzle.layout.some(cube => cube.type === "veil") &&
          puzzle.layout.some(cube => cube.type === "void")
      )
    ).toBe(true);
  });

  it("adds wide authored AREA chains after the Stage 3 route lessons", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    const stageThreeChains = puzzles
      .map((puzzle, index) => ({ puzzle, result: archive.results[index]! }))
      .filter(({ puzzle }) => puzzle.stage === 3 && puzzle.wave >= 3);

    expect(stageThreeChains.map(({ puzzle }) => puzzle.difficultyTag)).toEqual([
      "wide-area-ribbon",
      "wide-area-edge",
      "wide-area-switch",
      "wide-area-pulse",
      "wide-area-return",
      "wide-area-ladder",
    ]);
    expect(stageThreeChains.map(({ puzzle }) => puzzle.requiredRolls)).toEqual([
      5, 4, 5, 4, 4, 4,
    ]);
    expect(stageThreeChains.map(({ result }) => result.areaUses)).toEqual([
      3, 3, 3, 3, 3, 3,
    ]);
    expect(
      stageThreeChains.every(({ puzzle }) =>
        puzzle.designIntent?.startsWith("Hand-authored")
      )
    ).toBe(true);
    expect(
      new Set(
        stageThreeChains.map(({ puzzle }) => JSON.stringify(puzzle.layout))
      )
    ).toHaveLength(6);
    expect(
      stageThreeChains.every(
        ({ puzzle }) =>
          puzzle.layout.some(cube => cube.type === "veil") &&
          puzzle.layout.some(cube => cube.type === "void")
      )
    ).toBe(true);
  });

  it("extends authored AREA chains into the long Stage 4 opening", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    const stageFourOpening = puzzles
      .map((puzzle, index) => ({ puzzle, result: archive.results[index]! }))
      .filter(({ puzzle }) => puzzle.stage === 4 && puzzle.wave <= 2);

    expect(stageFourOpening.map(({ puzzle }) => puzzle.difficultyTag)).toEqual([
      "long-chain-ribbon",
      "long-chain-mirror",
      "long-chain-pulse",
      "long-chain-return",
    ]);
    expect(stageFourOpening.map(({ puzzle }) => puzzle.requiredRolls)).toEqual([
      6, 6, 6, 6,
    ]);
    expect(stageFourOpening.map(({ result }) => result.areaUses)).toEqual([
      4, 4, 4, 4,
    ]);
    expect(
      stageFourOpening.every(({ puzzle }) =>
        puzzle.designIntent?.startsWith("Hand-authored")
      )
    ).toBe(true);
    expect(
      new Set(
        stageFourOpening.map(({ puzzle }) => JSON.stringify(puzzle.layout))
      )
    ).toHaveLength(4);
    expect(
      stageFourOpening.every(
        ({ puzzle }) =>
          puzzle.layout.some(cube => cube.type === "veil") &&
          puzzle.layout.some(cube => cube.type === "void")
      )
    ).toBe(true);
  });

  it("keeps all of Stage 1 authored while shifting from AREA to route reading", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    const stageOneRoutes = puzzles
      .map((puzzle, index) => ({ puzzle, result: archive.results[index]! }))
      .filter(({ puzzle }) => puzzle.stage === 1 && puzzle.wave >= 3);

    expect(stageOneRoutes.map(({ puzzle }) => puzzle.difficultyTag)).toEqual([
      "read-branch",
      "read-cross",
      "read-corner",
      "read-braid",
      "read-return",
      "read-ring",
    ]);
    expect(stageOneRoutes.map(({ puzzle }) => puzzle.requiredRolls)).toEqual([
      2, 2, 2, 3, 3, 3,
    ]);
    expect(stageOneRoutes.map(({ result }) => result.areaUses)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(
      stageOneRoutes.every(({ puzzle }) =>
        puzzle.designIntent?.startsWith("Hand-authored")
      )
    ).toBe(true);
    expect(
      new Set(stageOneRoutes.map(({ puzzle }) => JSON.stringify(puzzle.layout)))
    ).toHaveLength(6);
    expect(
      stageOneRoutes.every(
        ({ puzzle }) =>
          puzzle.layout.some(cube => cube.type === "veil") &&
          puzzle.layout.some(cube => cube.type === "void")
      )
    ).toBe(true);
  });

  it("validates all 88 complete formations with registered solution replay", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    expect(puzzles).toHaveLength(EXPECTED_PUZZLE_COUNT);
    expect(archive.issues).toEqual([]);
    expect(archive.valid).toBe(true);
    expect(
      archive.results.filter(result => result.areaUses >= 2).length
    ).toBeGreaterThan(40);
  });
});
