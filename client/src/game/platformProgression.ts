import { STAGE_BASE_PLATFORM_ROWS } from "./stagePlan";
import type { CubeState, PuzzleDescriptor } from "./types";

/**
 * Platform length is gameplay state, not just rendering state.
 * A puzzle stores relative formation coordinates; runtime z positions are projected
 * from the current far edge so gaining/losing one row changes arrival time by one roll.
 */
export function platformRowsForStage(stage: number, depth: number): number {
  return Math.max(STAGE_BASE_PLATFORM_ROWS[stage] ?? 12, depth + 3);
}

export function projectPuzzleCubesToPlatform(
  puzzle: PuzzleDescriptor,
  cubes: CubeState[],
  platformRows: number
): CubeState[] {
  const sourceStart =
    puzzle.spawnRow ?? Math.min(...puzzle.layout.map(cube => cube.z));
  const runtimeStart = platformRows - puzzle.depth;

  return cubes.map((cube, index) => {
    const source = puzzle.layout[index];
    if (!source) return { ...cube };
    const offset = source.z - sourceStart;
    const z = runtimeStart + offset;
    return { ...cube, z, previousZ: z };
  });
}

export function shouldResetPlatformAtLoad(
  mode: string,
  previousStage: number | undefined,
  nextStage: number,
  resetRequested: boolean
): boolean {
  if (resetRequested) return true;
  return (
    mode === "CAMPAIGN" &&
    previousStage !== undefined &&
    previousStage !== nextStage
  );
}
