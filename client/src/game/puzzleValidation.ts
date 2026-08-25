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

export interface PuzzleDescriptorParseResult {
  valid: boolean;
  reason: string;
  puzzle?: PuzzleDescriptor;
}

const CUBE_TYPES = new Set(["normal", "veil", "void"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseFailure(reason: string): PuzzleDescriptorParseResult {
  return { valid: false, reason };
}

export function parsePuzzleDescriptor(
  value: unknown,
): PuzzleDescriptorParseResult {
  if (!isRecord(value)) return parseFailure("descriptor is not an object");

  const width = value.width;
  const depth = value.depth;
  const spawnRow = value.spawnRow ?? 0;
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    value.id.length > 120 ||
    !isInteger(value.stage) ||
    value.stage < 1 ||
    !isInteger(value.wave) ||
    value.wave < 1 ||
    !isInteger(value.ordinal) ||
    value.ordinal < 1 ||
    !isInteger(width) ||
    width < 1 ||
    !isInteger(depth) ||
    depth < 1 ||
    !isInteger(spawnRow) ||
    spawnRow < 0 ||
    !isNonNegativeInteger(value.requiredRolls) ||
    typeof value.difficultyTag !== "string" ||
    value.difficultyTag.length === 0 ||
    !isFiniteNumber(value.seed) ||
    typeof value.featured !== "boolean"
  )
    return parseFailure("descriptor metadata is invalid");

  if (!Array.isArray(value.layout) || value.layout.length > width * depth)
    return parseFailure("layout size is invalid");

  const positions = new Set<string>();
  for (const cube of value.layout) {
    if (
      !isRecord(cube) ||
      !isInteger(cube.x) ||
      cube.x < 0 ||
      cube.x >= width ||
      !isInteger(cube.z) ||
      cube.z < spawnRow ||
      cube.z >= spawnRow + depth ||
      typeof cube.type !== "string" ||
      !CUBE_TYPES.has(cube.type)
    )
      return parseFailure("layout cell is invalid");
    const key = `${cube.x}:${cube.z}`;
    if (positions.has(key))
      return parseFailure("layout has duplicate positions");
    positions.add(key);
  }

  if (!Array.isArray(value.solution))
    return parseFailure("solution is invalid");
  for (const step of value.solution) {
    if (
      !isRecord(step) ||
      !isNonNegativeInteger(step.rotation) ||
      !["mark", "capture", "area"].includes(String(step.action))
    )
      return parseFailure("solution step is invalid");
    if (
      step.action === "mark" &&
      (!isInteger(step.x) ||
        !isInteger(step.z) ||
        step.x < 0 ||
        step.x >= width)
    )
      return parseFailure("MARK solution step has no valid position");
    if (
      step.x !== undefined &&
      (!isInteger(step.x) || step.x < 0 || step.x >= width)
    )
      return parseFailure("solution x position is invalid");
    if (step.z !== undefined && !isInteger(step.z))
      return parseFailure("solution z position is invalid");
    if (step.sequence !== undefined && !isNonNegativeInteger(step.sequence))
      return parseFailure("solution sequence is invalid");
  }

  if (!isRecord(value.validation))
    return parseFailure("validation metadata is invalid");
  if (
    typeof value.validation.valid !== "boolean" ||
    !isNonNegativeInteger(value.validation.normal) ||
    !isNonNegativeInteger(value.validation.veil) ||
    !isNonNegativeInteger(value.validation.void) ||
    !isFiniteNumber(value.validation.travelBudget) ||
    value.validation.travelBudget < 0
  )
    return parseFailure("validation metadata is invalid");

  return { valid: true, reason: "ok", puzzle: value as PuzzleDescriptor };
}

export function validatePuzzle(
  puzzle: PuzzleDescriptor,
): PuzzleValidationResult {
  const parsed = parsePuzzleDescriptor(puzzle);
  if (!parsed.valid || !parsed.puzzle)
    return invalidPuzzleValidation(parsed.reason);
  puzzle = parsed.puzzle;
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
  const isInBounds = puzzle.layout.every(
    (cube) =>
      cube.x >= 0 &&
      cube.x < puzzle.width &&
      cube.z >= spawnRow &&
      cube.z < spawnRow + puzzle.depth,
  );
  const expectedPositions = new Set<string>();
  for (let z = spawnRow; z < spawnRow + puzzle.depth; z += 1) {
    for (let x = 0; x < puzzle.width; x += 1)
      expectedPositions.add(`${x}:${z}`);
  }
  const fullFormation =
    puzzle.layout.length === puzzle.width * puzzle.depth &&
    puzzle.layout.every((cube) => expectedPositions.has(`${cube.x}:${cube.z}`));
  const replay = simulatePuzzleSolution(puzzle);
  const countsMatch =
    puzzle.validation.normal ===
      puzzle.layout.filter((cube) => cube.type === "normal").length &&
    puzzle.validation.veil ===
      puzzle.layout.filter((cube) => cube.type === "veil").length &&
    puzzle.validation.void === voids;
  const custom = puzzle.difficultyTag === "custom";
  const plan = wavePlan(puzzle.stage, puzzle.wave);
  const planMatches =
    custom ||
    Boolean(
      plan &&
        plan.width === puzzle.width &&
        plan.depth === puzzle.depth &&
        puzzle.ordinal >= 1 &&
        puzzle.ordinal <= plan.puzzles,
    );
  const requiredRatio =
    requiredCubes.length / Math.max(1, puzzle.layout.length);
  const enoughRequired = custom
    ? requiredCubes.length > 0
    : puzzle.stage === 1
      ? requiredRatio >= 0.25
      : requiredRatio >= 0.4;
  const enoughMechanics =
    custom || puzzle.stage === 1 || (puzzle.validation.veil > 0 && voids > 0);
  const chainRequired =
    !custom && (puzzle.difficultyTag.includes("chain") || puzzle.stage >= 6);
  const chainPresent =
    !chainRequired ||
    (replay.areaUses >= 2 && replay.regeneratedAreaAnchors > 0);
  const formationValid = custom ? isInBounds : fullFormation;
  const travelBudget =
    puzzle.validation?.travelBudget ?? puzzle.width + puzzle.depth + 4;

  const reason = duplicate
    ? "duplicate grid position"
    : !isInBounds
      ? "layout is outside the configured grid"
      : !formationValid
        ? "layout is not a full width-by-depth formation"
        : !planMatches
          ? "stage plan mismatch"
          : !countsMatch
            ? "stored validation counts differ from layout"
            : !enoughRequired
              ? "required cube density is too low"
              : !enoughMechanics
                ? "VEIL or VOID is missing"
                : !chainPresent
                  ? "chain stage lacks one-shot AREA regeneration"
                  : !replay.valid
                    ? replay.reason
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

export function validateAllPuzzles(
  puzzles: PuzzleDescriptor[],
): PuzzleValidationResult[] {
  return puzzles.map(validatePuzzle);
}

function invalidPuzzleValidation(reason: string): PuzzleValidationResult {
  return {
    valid: false,
    reason,
    required: 0,
    voids: 0,
    travelBudget: 0,
    areaUses: 0,
    fullFormation: false,
  };
}

export function validatePuzzleArchive(
  puzzles: PuzzleDescriptor[],
): PuzzleArchiveValidationResult {
  const issues: string[] = [];
  if (puzzles.length !== EXPECTED_PUZZLE_COUNT)
    issues.push(
      `expected ${EXPECTED_PUZZLE_COUNT} puzzles, got ${puzzles.length}`,
    );
  const ids = new Set<string>();
  const seeds = new Set<number>();
  for (const puzzle of puzzles) {
    if (ids.has(puzzle.id)) issues.push(`duplicate id: ${puzzle.id}`);
    ids.add(puzzle.id);
    if (seeds.has(puzzle.seed)) issues.push(`duplicate seed: ${puzzle.seed}`);
    seeds.add(puzzle.seed);
  }
  const results = validateAllPuzzles(puzzles);
  results.forEach((result, index) => {
    if (!result.valid)
      issues.push(`${puzzles[index]?.id ?? index}: ${result.reason}`);
  });
  return { valid: issues.length === 0, issues, results };
}
