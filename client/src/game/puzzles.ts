/** Deterministic 88-puzzle archive generated from the documented stage plan. */
import {
  parsePuzzleDescriptor,
  validatePuzzleArchive,
} from "./puzzleValidation";
import { STAGE_PLAN } from "./stagePlan";
import type { CubeType, PuzzleDescriptor, SolutionStep } from "./types";

export async function loadPuzzles(): Promise<PuzzleDescriptor[]> {
  const response = await fetch("/data/puzzles.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Puzzle archive could not be loaded.");
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Puzzle archive has an invalid format.");
  }

  const parsed = payload.map(parsePuzzleDescriptor);
  const invalidIndex = parsed.findIndex(
    result => !result.valid || !result.puzzle
  );
  if (invalidIndex >= 0) {
    throw new Error(
      `Puzzle archive entry ${invalidIndex + 1} invalid: ${parsed[invalidIndex]?.reason}`
    );
  }

  const puzzles = parsed.map(result => result.puzzle as PuzzleDescriptor);
  const validation = validatePuzzleArchive(puzzles);
  if (!validation.valid) {
    throw new Error(
      `Puzzle archive failed validation: ${validation.issues[0] ?? "unknown error"}`
    );
  }
  return puzzles;
}

export function generatePuzzles(): PuzzleDescriptor[] {
  const puzzles: PuzzleDescriptor[] = [];
  const stages = Object.keys(STAGE_PLAN)
    .map(Number)
    .sort((a, b) => a - b);
  for (const stage of stages) {
    const waves = STAGE_PLAN[stage] ?? [];
    waves.forEach((plan, waveIndex) => {
      const wave = waveIndex + 1;
      for (let ordinal = 1; ordinal <= plan.puzzles; ordinal += 1) {
        puzzles.push(buildPuzzle(stage, wave, ordinal, plan.width, plan.depth));
      }
    });
  }
  return puzzles;
}

export function findPuzzle(
  puzzles: PuzzleDescriptor[],
  stage: number,
  wave: number,
  ordinal: number
): PuzzleDescriptor | undefined {
  return puzzles.find(
    puzzle =>
      puzzle.stage === stage &&
      puzzle.wave === wave &&
      puzzle.ordinal === ordinal
  );
}

export function puzzleOrdinals(
  puzzles: PuzzleDescriptor[],
  stage: number,
  wave: number
): number[] {
  return puzzles
    .filter(puzzle => puzzle.stage === stage && puzzle.wave === wave)
    .map(puzzle => puzzle.ordinal)
    .sort((a, b) => a - b);
}

function buildPuzzle(
  stage: number,
  wave: number,
  ordinal: number,
  width: number,
  depth: number
): PuzzleDescriptor {
  const seed = stage * 100_000 + wave * 1_000 + ordinal * 17;
  const spawnRow = 5 + ((stage + wave + ordinal) % 2);
  const pairCount = Math.ceil(depth / 2);
  const pattern = (stage * 7 + wave * 3 + ordinal * 2) % 6;
  const center =
    1 + ((seed + wave * 37 + ordinal * 17) % Math.max(1, width - 2));
  const protectVoid =
    stage >= 2
      ? ordinal === 1 || pattern % 3 === 0
      : ordinal === 3 || pattern === 0;
  const protectionX = center + (ordinal % 3 === 0 ? -1 : 1);
  const layout: Array<{ x: number; z: number; type: CubeType }> = [];

  for (let offset = 0; offset < depth; offset += 1) {
    for (let x = 0; x < width; x += 1) {
      let type: CubeType = Math.abs(x - center) <= 1 ? "normal" : "void";
      if (offset === 0 && x === center) type = "veil";
      if (offset % 2 === 1 && offset + 1 < depth && x === center) type = "veil";
      if (protectVoid && offset === 0 && x === protectionX) type = "void";
      layout.push({ x, z: spawnRow + offset, type });
    }
  }

  const routeCandidates = [0, width - 1].filter(x => Math.abs(x - center) > 1);
  const routeNeeded =
    ordinal > 1 || stage >= 2 || (stage === 1 && pattern % 2 === 0);
  const routeCount = routeNeeded
    ? Math.min(stage >= 5 ? 2 : 1, routeCandidates.length)
    : 0;
  const routeTargets: Array<{ x: number; offset: number }> = [];
  for (let index = 0; index < routeCount; index += 1) {
    const x =
      routeCandidates[(pattern + index + ordinal) % routeCandidates.length];
    let offset = 1 + ((pattern + ordinal + index * 2) % Math.max(1, depth - 1));
    while (routeTargets.some(target => target.offset === offset)) {
      offset = offset === depth - 1 ? 1 : offset + 1;
    }
    routeTargets.push({ x, offset });
  }
  for (const target of routeTargets) {
    const cube = layout.find(
      item => item.x === target.x && item.z === spawnRow + target.offset
    );
    if (cube) cube.type = "normal";
  }

  let sequence = 0;
  const solution: SolutionStep[] = [
    {
      rotation: Math.max(0, spawnRow - 1),
      action: "mark",
      x: center,
      z: 0,
      sequence: sequence++,
    },
    {
      rotation: spawnRow,
      action: "capture",
      x: center,
      z: 0,
      sequence: sequence++,
    },
  ];
  if (protectVoid)
    solution.push({
      rotation: spawnRow,
      action: "mark",
      x: protectionX,
      z: 0,
      sequence: sequence++,
    });
  for (let pair = 0; pair < pairCount; pair += 1) {
    solution.push({
      rotation: spawnRow + pair,
      action: "area",
      sequence: sequence++,
    });
  }
  for (const target of routeTargets) {
    solution.push({
      rotation: spawnRow + target.offset - 1,
      action: "mark",
      x: target.x,
      z: 0,
      sequence: sequence++,
    });
    solution.push({
      rotation: spawnRow + target.offset,
      action: "capture",
      x: target.x,
      z: 0,
      sequence: sequence++,
    });
  }

  const finalRequiredRotation = Math.max(
    spawnRow + pairCount - 1,
    ...routeTargets.map(target => spawnRow + target.offset)
  );
  const normal = layout.filter(cube => cube.type === "normal").length;
  const veil = layout.filter(cube => cube.type === "veil").length;
  const voids = layout.length - normal - veil;
  const difficultyTag =
    stage >= 6
      ? "chain-protect"
      : stage >= 4
        ? "chain"
        : stage >= 2
          ? "route"
          : "read";
  const prefix = stage === 9 ? "FINAL" : `STAGE-${stage}`;

  return {
    id: `${prefix}-W${wave}-P${String(ordinal).padStart(2, "0")}`,
    stage,
    wave,
    ordinal,
    width,
    depth,
    spawnRow,
    requiredRolls: Math.max(0, finalRequiredRotation - spawnRow),
    difficultyTag,
    seed,
    layout,
    solution,
    validation: {
      valid: true,
      normal,
      veil,
      void: voids,
      travelBudget: width + depth + pairCount + routeTargets.length * 2 + 4,
    },
    featured: ordinal === 1,
    designIntent: protectVoid
      ? "Complete formation with a one-shot AREA chain, MARK-protected VOID, and isolated route captures."
      : "Complete formation with a one-shot AREA chain and isolated route captures.",
  };
}
