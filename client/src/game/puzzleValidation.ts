/** Structural and gameplay validation for generated and custom puzzle descriptors. */
import { EXPECTED_PUZZLE_COUNT, wavePlan } from "./stagePlan";
import type { PuzzleDescriptor } from "./types";
import { simulatePuzzleSolution } from "./solutionSimulation";

export interface PuzzleValidationResult {
  valid: boolean;
  reason: string;
  required: number;
  voids: number;
  travelBudget: number;
  areaUses: number;
  fullFormation: boolean;
}

export interface PuzzleArchiveValidationResult {
  valid: boolean;
  issues: string[];
  results: PuzzleValidationResult[];
}

export function validatePuzzle(puzzle: PuzzleDescriptor): PuzzleValidationResult {
  const requiredCubes = puzzle.layout.filter((cube) => cube.type !== "void");
  const voids = puzzle.layout.filter((cube) => cube.type === "void").length;
  const positions = new Set<string>();
  const duplicate = puzzle.layout.some((cube) => {
    const key = `${cube.x}:${cube.z}`;
    if (positions.has(key)) return true;
    positions.add(key);
    return false;
  });
  const spawnRow = puzzle.spawnRow ?? 0;
  const isInBounds = puzzle.layout.every((cube) => cube.x >= 0
    && cube.x < puzzle.width
    && cube.z >= spawnRow
    && cube.z < spawnRow + puzzle.depth);
  const expectedPositions = new Set<string>();
  for (let z = spawnRow; z < spawnRow + puzzle.depth; z += 1) {
    for (let x = 0; x < puzzle.width; x += 1) expectedPositions.add(`${x}:${z}`);
  }
  const fullFormation = puzzle.layout.length === puzzle.width * puzzle.depth
    && puzzle.layout.every((cube) => expectedPositions.has(`${cube.x}:${cube.z}`));
  const replay = simulatePuzzleSolution(puzzle);
  const countsMatch = puzzle.validation.normal === puzzle.layout.filter((cube) => cube.type === "normal").length
    && puzzle.validation.veil === puzzle.layout.filter((cube) => cube.type === "veil").length
    && puzzle.validation.void === voids;
  const custom = puzzle.difficultyTag === "custom";
  const plan = wavePlan(puzzle.stage, puzzle.wave);
  const planMatches = custom || Boolean(plan
    && plan.width === puzzle.width
    && plan.depth === puzzle.depth
    && puzzle.ordinal >= 1
    && puzzle.ordinal <= plan.puzzles);
  const requiredRatio = requiredCubes.length / Math.max(1, puzzle.layout.length);
  const enoughRequired = custom ? requiredCubes.length > 0 : puzzle.stage === 1 ? requiredRatio >= 0.25 : requiredRatio >= 0.4;
  const enoughMechanics = custom || puzzle.stage === 1 || (puzzle.validation.veil > 0 && voids > 0);
  const chainRequired = !custom && (puzzle.difficultyTag.includes("chain") || puzzle.stage >= 6);
  const chainPresent = !chainRequired || (replay.areaUses >= 2 && replay.regeneratedAreaAnchors > 0);
  const formationValid = custom ? isInBounds : fullFormation;
  const travelBudget = puzzle.validation?.travelBudget ?? puzzle.width + puzzle.depth + 4;

  const reason = duplicate ? "duplicate grid position"
    : !isInBounds ? "layout is outside the configured grid"
      : !formationValid ? "layout is not a full width-by-depth formation"
        : !planMatches ? "stage plan mismatch"
          : !countsMatch ? "stored validation counts differ from layout"
            : !enoughRequired ? "required cube density is too low"
              : !enoughMechanics ? "VEIL or VOID is missing"
                : !chainPresent ? "chain stage lacks one-shot AREA regeneration"
                  : !replay.valid ? replay.reason
                    : "ok";
  return {
    valid: reason === "ok",
    reason,
    required: requiredCubes.length,
    voids,
    travelBudget,
    areaUses: replay.areaUses,
    fullFormation,
  };
}

export function validateAllPuzzles(puzzles: PuzzleDescriptor[]): PuzzleValidationResult[] {
  return puzzles.map(validatePuzzle);
}

export function validatePuzzleArchive(puzzles: PuzzleDescriptor[]): PuzzleArchiveValidationResult {
  const issues: string[] = [];
  if (puzzles.length !== EXPECTED_PUZZLE_COUNT) issues.push(`expected ${EXPECTED_PUZZLE_COUNT} puzzles, got ${puzzles.length}`);
  const ids = new Set<string>();
  const seeds = new Set<number>();
  for (const puzzle of puzzles) {
    if (ids.has(puzzle.id)) issues.push(`duplicate id: ${puzzle.id}`);
    ids.add(puzzle.id);
    if (seeds.has(puzzle.seed)) issues.push(`duplicate seed: ${puzzle.seed}`);
    seeds.add(puzzle.seed);
  }
  const results = validateAllPuzzles(puzzles);
  results.forEach((result, index) => { if (!result.valid) issues.push(`${puzzles[index]?.id ?? index}: ${result.reason}`); });
  return { valid: issues.length === 0, issues, results };
}
