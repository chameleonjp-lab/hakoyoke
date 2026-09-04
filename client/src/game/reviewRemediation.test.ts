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
