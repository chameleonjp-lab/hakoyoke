import type { GameMode, GamePhase, GameSnapshot, PuzzleDescriptor } from "./types";

export function stageCompletionBonus(platformRows: number): number {
  return Math.max(0, platformRows) * 1000;
}

export function shouldAwardStageCompletion(
  mode: GameMode,
  phase: GamePhase,
  current: PuzzleDescriptor,
  next: PuzzleDescriptor | undefined
): boolean {
  return (
    mode === "CAMPAIGN" &&
    phase === "PUZZLE_RESULT" &&
    Boolean(next && next.stage !== current.stage)
  );
}

export function makeStageCheckpoint(snapshot: GameSnapshot): GameSnapshot {
  return {
    ...snapshot,
    phase: "STAGE_INTRO",
    phaseTimer: 0,
    pausedFromPhase: null,
    banner: `STAGE ${snapshot.stage}`,
  };
}
