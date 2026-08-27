import type { AreaMark, PuzzleDescriptor } from "./types";

export interface RetainedRunState {
  misses: number;
  areas: AreaMark[];
}

export function shouldCarryRunState(
  previousPuzzle: PuzzleDescriptor | undefined,
  nextPuzzle: PuzzleDescriptor,
  resetRequested: boolean
): boolean {
  if (resetRequested || !previousPuzzle) return false;
  return (
    previousPuzzle.stage === nextPuzzle.stage &&
    previousPuzzle.wave === nextPuzzle.wave
  );
}

export function retainRunState(
  misses: number,
  areas: AreaMark[]
): RetainedRunState {
  return {
    misses,
    areas: areas.map(area => ({ ...area })),
  };
}
