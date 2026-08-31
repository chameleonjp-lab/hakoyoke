/** Deterministic 88-puzzle archive generated from the documented stage plan. */
import {
  parsePuzzleDescriptor,
  validatePuzzleArchive,
} from "./puzzleValidation";
import { STAGE_PLAN } from "./stagePlan";
import type { CubeType, PuzzleDescriptor, SolutionStep } from "./types";

const PUZZLE_ARCHIVE_URL = `${import.meta.env.BASE_URL}data/puzzles.json`;

export async function loadPuzzles(): Promise<PuzzleDescriptor[]> {
  const response = await fetch(PUZZLE_ARCHIVE_URL, { cache: "no-cache" });
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
  const pattern = (stage * 11 + wave * 5 + ordinal * 3) % 12;
  const center =
    1 +
    ((seed + wave * 37 + ordinal * 17 + pattern * 13) % Math.max(1, width - 2));
  const protectVoid =
    stage >= 2
      ? ordinal === 1 || pattern % 3 === 0
      : ordinal === 3 || pattern === 0;
  const routeCandidates = [0, width - 1].filter(x => Math.abs(x - center) > 1);
  const routeLane =
    routeCandidates[(pattern + ordinal) % Math.max(1, routeCandidates.length)];
  const routeNeeded =
    ordinal > 1 || stage >= 2 || (stage === 1 && pattern % 2 === 0);
  const routeCount =
    routeNeeded && depth > 2
      ? Math.min(stage >= 5 ? 2 : 1, routeCandidates.length)
      : 0;
  const innerProtectionX = center + (center < width / 2 ? 1 : -1);
  const protectionX = protectVoid
    ? routeCount > 0
      ? (routeLane ?? innerProtectionX)
      : innerProtectionX
    : center + (ordinal % 3 === 0 ? -1 : 1);
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
  if (depth === 2 && pattern % 2 === 0) {
    const extraVeilColumns = [center, center - 1, center + 1].filter(
      x => x >= 0 && x < width
    );
    const extraVeilX =
      extraVeilColumns[(pattern + wave + ordinal) % extraVeilColumns.length];
    const extraVeil = layout.find(
      cube => cube.x === extraVeilX && cube.z === spawnRow + 1
    );
    if (extraVeil?.type === "normal") extraVeil.type = "veil";
  }

  const routeTargets: Array<{ x: number; offset: number }> = [];
  for (let index = 0; index < routeCount; index += 1) {
    const x = routeLane ?? center;
    const minimumOffset = Math.max(1, pairCount - 1);
    const maximumOffset =
      routeCount === 2 && index === 0 ? depth - 2 : depth - 1;
    const offsetSpan = Math.max(1, maximumOffset - minimumOffset + 1);
    let offset =
      routeCount === 2 && index === 1
        ? depth - 1
        : minimumOffset +
          ((pattern + ordinal + wave * 5 + index * 3) % offsetSpan);
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
  if (depth > 2) {
    const routePositions = new Set(
      routeTargets.map(target => `${target.x}:${spawnRow + target.offset}`)
    );
    const voidColumns = new Set(
      layout.filter(cube => cube.type === "void").map(cube => cube.x)
    );
    const extraVeilCandidates = layout.filter(
      cube =>
        cube.type === "normal" &&
        cube.z > spawnRow &&
        Math.abs(cube.x - center) <= 1 &&
        (routeLane === undefined || Math.abs(cube.x - routeLane) > 1) &&
        Array.from(voidColumns).every(voidX => Math.abs(cube.x - voidX) > 1) &&
        !routePositions.has(`${cube.x}:${cube.z}`)
    );
    const extraVeil = extraVeilCandidates.length
      ? extraVeilCandidates[
          (pattern * 7 + stage * 11 + wave * 13 + ordinal * 20) %
            extraVeilCandidates.length
        ]
      : undefined;
    if (extraVeil) extraVeil.type = "veil";
  }

  let sequence = 0;
  const solution: SolutionStep[] = [
    {
      rotation: Math.max(0, spawnRow - 1),
      action: "mark",
      x: center,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    },
    {
      rotation: spawnRow,
      action: "capture",
      x: center,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    },
  ];
  if (protectVoid)
    solution.push({
      rotation: spawnRow,
      action: "mark",
      x: protectionX,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    });
  if (routeTargets.length > 0 && !protectVoid) {
    const target = routeTargets[0]!;
    solution.push({
      rotation: spawnRow,
      action: "mark",
      x: target.x,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    });
  }
  for (let pair = 0; pair < pairCount; pair += 1) {
    solution.push({
      rotation: spawnRow + pair,
      action: "area",
      timing: "settled",
      sequence: sequence++,
    });
  }
  for (let index = 0; index < routeTargets.length; index += 1) {
    const target = routeTargets[index]!;
    solution.push({
      rotation: spawnRow + target.offset,
      action: "capture",
      x: target.x,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    });
    const nextTarget = routeTargets[index + 1];
    if (nextTarget) {
      solution.push({
        rotation: spawnRow + target.offset,
        action: "mark",
        x: nextTarget.x,
        z: 0,
        timing: "settled",
        sequence: sequence++,
      });
    }
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
