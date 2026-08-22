/** Deterministic 88-puzzle archive generated from the documented stage plan. */
import { STAGE_PLAN } from "./stagePlan";
import type { CubeType, PuzzleDescriptor, SolutionStep } from "./types";

export async function loadPuzzles(): Promise<PuzzleDescriptor[]> {
  return generatePuzzles();
}

export function generatePuzzles(): PuzzleDescriptor[] {
  const puzzles: PuzzleDescriptor[] = [];
  const stages = Object.keys(STAGE_PLAN).map(Number).sort((a, b) => a - b);
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
  ordinal: number,
): PuzzleDescriptor | undefined {
  return puzzles.find((puzzle) => puzzle.stage === stage && puzzle.wave === wave && puzzle.ordinal === ordinal);
}

export function puzzleOrdinals(puzzles: PuzzleDescriptor[], stage: number, wave: number): number[] {
  return puzzles
    .filter((puzzle) => puzzle.stage === stage && puzzle.wave === wave)
    .map((puzzle) => puzzle.ordinal)
    .sort((a, b) => a - b);
}

function buildPuzzle(
  stage: number,
  wave: number,
  ordinal: number,
  width: number,
  depth: number,
): PuzzleDescriptor {
  const seed = stage * 100_000 + wave * 1_000 + ordinal * 17;
  const spawnRow = 5 + ((stage + wave + ordinal) % 2);
  const pairCount = Math.ceil(depth / 2);
  const center = 1 + (seed % Math.max(1, width - 2));
  const protectVoid = stage >= 2 && ordinal === 1;
  const protectionX = center + (((stage + wave) % 2 === 0) ? 1 : -1);
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

  const routeTargets: Array<{ x: number; offset: number }> = [];
  if (ordinal > 1 || stage >= 2) {
    routeTargets.push({ x: center === 1 ? width - 1 : 0, offset: depth - 1 });
  }
  if (stage >= 5) {
    const otherEdge = routeTargets[0]?.x === width - 1 ? 0 : width - 1;
    if (Math.abs(otherEdge - center) > 1) routeTargets.push({ x: otherEdge, offset: Math.max(1, depth - 2) });
  }
  for (const target of routeTargets) {
    const cube = layout.find((item) => item.x === target.x && item.z === spawnRow + target.offset);
    if (cube) cube.type = "normal";
  }

  const solution: SolutionStep[] = [
    { rotation: Math.max(0, spawnRow - 1), action: "mark", x: center, z: 0 },
    { rotation: spawnRow, action: "capture", x: center, z: 0 },
  ];
  if (protectVoid) solution.push({ rotation: spawnRow, action: "mark", x: protectionX, z: 0 });
  for (let pair = 0; pair < pairCount; pair += 1) {
    solution.push({ rotation: spawnRow + pair, action: "area" });
  }
  for (const target of routeTargets) {
    solution.push({ rotation: spawnRow + target.offset - 1, action: "mark", x: target.x, z: 0 });
    solution.push({ rotation: spawnRow + target.offset, action: "capture", x: target.x, z: 0 });
  }

  const finalRequiredRotation = Math.max(
    spawnRow + pairCount - 1,
    ...routeTargets.map((target) => spawnRow + target.offset),
  );
  const normal = layout.filter((cube) => cube.type === "normal").length;
  const veil = layout.filter((cube) => cube.type === "veil").length;
  const voids = layout.length - normal - veil;
  const difficultyTag = stage >= 6 ? "chain-protect" : stage >= 4 ? "chain" : stage >= 2 ? "route" : "read";
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
