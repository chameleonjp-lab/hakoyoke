/** Obsidian Observatory: pure validation for independently stored puzzle JSON. */
import type { PuzzleDescriptor } from "./types";
import { simulatePuzzleSolution } from "./solutionSimulation";

export interface PuzzleValidationResult {
  valid: boolean;
  reason: string;
  required: number;
  voids: number;
  travelBudget: number;
}

export function validatePuzzle(puzzle: PuzzleDescriptor): PuzzleValidationResult {
  const normalOrVeil = puzzle.layout.filter((cube) => cube.type !== "void");
  const voids = puzzle.layout.filter((cube) => cube.type === "void").length;
  const positions = new Set<string>();
  const duplicate = puzzle.layout.some((cube) => {
    const key = `${cube.x}:${cube.z}`;
    if (positions.has(key)) return true;
    positions.add(key);
    return false;
  });
  const platformRows = Math.max(12, (puzzle.spawnRow ?? 0) + puzzle.depth);
  const isInBounds = puzzle.layout.every(
    (cube) => cube.x >= 0 && cube.x < puzzle.width && cube.z >= 0 && cube.z < platformRows,
  );
  const replay = simulatePuzzleSolution(puzzle);
  const solutionComplete = replay.valid;
  const travelBudget = puzzle.validation?.travelBudget ?? puzzle.width + puzzle.depth + 4;
  return {
    valid: !duplicate && isInBounds && normalOrVeil.length > 0 && solutionComplete && puzzle.requiredRolls >= 0,
    reason: duplicate ? "duplicate grid position" : !isInBounds ? "out of bounds" : !solutionComplete ? replay.reason : "ok",
    required: normalOrVeil.length,
    voids,
    travelBudget,
  };
}

export function validateAllPuzzles(puzzles: PuzzleDescriptor[]): PuzzleValidationResult[] {
  return puzzles.map(validatePuzzle);
}
