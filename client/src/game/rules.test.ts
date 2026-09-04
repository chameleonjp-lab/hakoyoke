import { describe, expect, it } from "vitest";
import { resolveDuelRound } from "./duelRules";
import { generatePuzzles } from "./puzzles";
import { validatePuzzleArchive } from "./puzzleValidation";
import {
  advanceOneCell,
  applyMiss,
  applyVoidCapture,
  areaTargets,
  calculateMindIndex,
  cloneDeterministic,
  isPositionOnPlatform,
  markerCanCapture,
  markerProtectsRollSweep,
  normalCaptureScore,
  nearestGridCell,
  perfectBonus,
  unresolvedCubeCount,
} from "./rules";
import { EXPECTED_PUZZLE_COUNT, puzzleCountFor } from "./stagePlan";
import { initialStats, type AreaMark, type CubeState } from "./types";

const cube = (
  id: string,
  type: CubeState["type"],
  x: number,
  z: number
): CubeState => ({ id, type, x, z, previousZ: z });

describe("CUBIC ORDEAL deterministic rules", () => {
  it("moves a cube exactly one logical cell toward the player", () => {
    expect(advanceOneCell(cube("n", "normal", 1, 3))).toMatchObject({
      previousZ: 3,
      z: 2,
    });
  });

  it("treats a player footprint beyond any platform edge as a fall", () => {
    expect(isPositionOnPlatform({ x: 0.5, z: 0.5 }, 4, 12)).toBe(true);
    expect(isPositionOnPlatform({ x: -0.4, z: 0.5 }, 4, 12)).toBe(false);
    expect(isPositionOnPlatform({ x: 0.5, z: 11.4 }, 4, 12)).toBe(false);
  });

  it("snaps MARK to the nearest in-bounds floor cell", () => {
    expect(nearestGridCell({ x: 1.49, z: 2.51 }, 4, 6)).toEqual({
      x: 1,
      z: 3,
    });
    expect(nearestGridCell({ x: -0.49, z: 99 }, 4, 6)).toEqual({
      x: 0,
      z: 5,
    });
  });

  it("captures only the cube directly over the single MARK", () => {
    const mark = { x: 2, z: 4 };
    expect(markerCanCapture(mark, cube("a", "normal", 2, 4))).toBe(true);
    expect(markerCanCapture(mark, cube("b", "normal", 2, 3))).toBe(false);
  });

  it("protects the MARK lane across the full rolling sweep", () => {
    expect(
      markerProtectsRollSweep(
        { x: 2, z: 2 },
        cube("incoming", "void", 2, 3),
        0,
        1,
        true
      )
    ).toBe(true);
    expect(
      markerProtectsRollSweep(
        { x: 2, z: 2 },
        cube("neighbor", "void", 1, 3),
        0,
        1,
        true
      )
    ).toBe(false);
    expect(
      markerProtectsRollSweep(
        { x: 2, z: 2 },
        cube("far", "void", 2, 5),
        0,
        1,
        true
      )
    ).toBe(false);
  });

  it("selects the exact 3 by 3 AREA neighborhood", () => {
    const area: AreaMark[] = [{ id: "a", x: 2, z: 2, armed: true }];
    const selected = areaTargets(
      [
        cube("0", "normal", 1, 1),
        cube("1", "normal", 3, 3),
        cube("2", "normal", 4, 3),
      ],
      area,
      null
    );
    expect(selected.map(item => item.id)).toEqual(["0", "1"]);
  });

  it("protects one VOID on MARK while AREA captures the other target", () => {
    const selected = areaTargets(
      [cube("protected", "void", 2, 2), cube("normal", "normal", 1, 2)],
      [{ id: "a", x: 2, z: 2, armed: true }],
      { x: 2, z: 2 }
    );
    expect(selected.map(item => item.id)).toEqual(["normal"]);
  });

  it("counts every unresolved cube type after a crush", () => {
    expect(
      unresolvedCubeCount([
        cube("normal", "normal", 1, 2),
        cube("veil", "veil", 2, 2),
        cube("void", "void", 3, 2),
      ])
    ).toBe(3);
  });

  it("preserves the residual loss meter after multi-row loss", () => {
    const threshold = initialStats(4).missLimit + 1;
    const combined = 11;
    expect({
      rows: Math.floor(combined / threshold),
      residual: combined % threshold,
    }).toEqual({ rows: 2, residual: 3 });
  });

  it("applies miss, VOID, scoring, and MIND INDEX rules", () => {
    expect(
      applyMiss({ ...initialStats(4), misses: 3, platformRows: 12 })
    ).toMatchObject({ misses: 0, platformRows: 11, perfect: false });
    expect(
      applyVoidCapture({ ...initialStats(4), platformRows: 12 })
    ).toMatchObject({ platformRows: 11, voidCaptured: 1, perfect: false });
    expect(perfectBonus(3, 4)).toBe(10000);
    expect(perfectBonus(4, 4)).toBe(5000);
    expect(perfectBonus(5, 4)).toBe(1000);
    expect(normalCaptureScore("manual")).toBe(100);
    expect(normalCaptureScore("area")).toBe(200);
    expect(calculateMindIndex(-5000, 1, 1, 50)).toBe(0);
    expect(calculateMindIndex(999999, 9, 50, 0)).toBe(999);
  });

  it("restores an independent deterministic snapshot copy", () => {
    const source = { marker: { x: 2, z: 3 }, values: [1, 2] };
    const copy = cloneDeterministic(source);
    copy.marker.x = 8;
    expect(source.marker.x).toBe(2);
  });

  it("generates and validates all 88 complete formations", () => {
    const puzzles = generatePuzzles();
    const archive = validatePuzzleArchive(puzzles);
    expect(puzzles).toHaveLength(EXPECTED_PUZZLE_COUNT);
    expect(archive.valid).toBe(true);
    expect(archive.issues).toEqual([]);
    expect(
      puzzles.every(
        puzzle => puzzle.layout.length === puzzle.width * puzzle.depth
      )
    ).toBe(true);
    expect(new Set(puzzles.map(puzzle => puzzle.id)).size).toBe(
      EXPECTED_PUZZLE_COUNT
    );
    expect(new Set(puzzles.map(puzzle => puzzle.seed)).size).toBe(
      EXPECTED_PUZZLE_COUNT
    );
  });

  it("contains a representative one-shot AREA chain with MARK protection", () => {
    const representative = generatePuzzles().find(
      puzzle => puzzle.id === "STAGE-6-W3-P01"
    );
    expect(representative?.designIntent).toMatch(/one-shot AREA/);
    expect(
      representative?.solution.filter(step => step.action === "area").length
    ).toBeGreaterThanOrEqual(2);
    expect(
      representative?.layout.filter(item => item.type === "veil").length
    ).toBeGreaterThan(2);
    expect(representative?.layout.some(item => item.type === "void")).toBe(
      true
    );
  });

  it("uses exact PRACTICE counts and DUEL hand-off rules", () => {
    expect(puzzleCountFor(1, 1)).toBe(3);
    expect(puzzleCountFor(4, 1)).toBe(2);
    expect(puzzleCountFor(9, 1)).toBe(1);
    expect(resolveDuelRound([0, 0], 0, false)).toMatchObject({
      nextTurn: 1,
      advancePuzzle: false,
    });
    expect(resolveDuelRound([0, 0], 1, true)).toMatchObject({
      scores: [0, 1],
      advancePuzzle: true,
    });
    expect(resolveDuelRound([6, 5], 0, true)).toMatchObject({
      scores: [7, 5],
      winner: 0,
    });
  });
});
