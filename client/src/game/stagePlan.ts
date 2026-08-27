export interface WavePlan {
  width: number;
  depth: number;
  puzzles: number;
}

export const STAGE_PLAN: Readonly<Record<number, readonly WavePlan[]>> = {
  1: [
    { width: 4, depth: 2, puzzles: 3 },
    { width: 4, depth: 2, puzzles: 3 },
    { width: 4, depth: 3, puzzles: 3 },
    { width: 4, depth: 4, puzzles: 3 },
  ],
  2: [
    { width: 4, depth: 5, puzzles: 3 },
    { width: 4, depth: 5, puzzles: 3 },
    { width: 4, depth: 6, puzzles: 3 },
    { width: 4, depth: 6, puzzles: 3 },
  ],
  3: [
    { width: 5, depth: 4, puzzles: 3 },
    { width: 5, depth: 5, puzzles: 3 },
    { width: 5, depth: 6, puzzles: 3 },
    { width: 5, depth: 6, puzzles: 3 },
  ],
  4: [
    { width: 5, depth: 7, puzzles: 2 },
    { width: 5, depth: 7, puzzles: 2 },
    { width: 5, depth: 8, puzzles: 2 },
    { width: 5, depth: 8, puzzles: 2 },
  ],
  5: [
    { width: 6, depth: 6, puzzles: 3 },
    { width: 6, depth: 6, puzzles: 3 },
    { width: 6, depth: 7, puzzles: 3 },
    { width: 6, depth: 7, puzzles: 3 },
  ],
  6: [
    { width: 6, depth: 8, puzzles: 2 },
    { width: 6, depth: 8, puzzles: 2 },
    { width: 6, depth: 9, puzzles: 2 },
    { width: 6, depth: 9, puzzles: 2 },
  ],
  7: [
    { width: 7, depth: 7, puzzles: 3 },
    { width: 7, depth: 7, puzzles: 3 },
    { width: 7, depth: 8, puzzles: 3 },
    { width: 7, depth: 8, puzzles: 3 },
  ],
  8: [
    { width: 7, depth: 8, puzzles: 2 },
    { width: 7, depth: 9, puzzles: 2 },
    { width: 7, depth: 9, puzzles: 2 },
    { width: 7, depth: 9, puzzles: 2 },
  ],
  9: [
    { width: 7, depth: 9, puzzles: 1 },
    { width: 7, depth: 9, puzzles: 1 },
    { width: 7, depth: 9, puzzles: 1 },
    { width: 7, depth: 9, puzzles: 1 },
  ],
};

/**
 * Independent visual/gameplay baseline for each stage.
 * Keeping the current value at 12 preserves mobile readability while allowing
 * PERFECT/loss adjustments to matter inside a stage without growing across all 88 puzzles.
 */
export const STAGE_BASE_PLATFORM_ROWS: Readonly<Record<number, number>> = {
  1: 12,
  2: 12,
  3: 12,
  4: 12,
  5: 12,
  6: 12,
  7: 12,
  8: 12,
  9: 12,
};

export const EXPECTED_PUZZLE_COUNT = Object.values(STAGE_PLAN)
  .flat()
  .reduce((total, wave) => total + wave.puzzles, 0);

export function wavePlan(stage: number, wave: number): WavePlan | undefined {
  return STAGE_PLAN[stage]?.[wave - 1];
}

export function puzzleCountFor(stage: number, wave: number): number {
  return wavePlan(stage, wave)?.puzzles ?? 0;
}
