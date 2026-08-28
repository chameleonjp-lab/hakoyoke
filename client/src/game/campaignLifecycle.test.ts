import { describe, expect, it } from "vitest";
import {
  makeStageCheckpoint,
  shouldAwardStageCompletion,
  stageCompletionBonus,
} from "./campaignLifecycle";
import type { GameSnapshot, PuzzleDescriptor } from "./types";

const puzzle = (stage: number, id: string): PuzzleDescriptor =>
  ({ stage, id }) as PuzzleDescriptor;

describe("campaign lifecycle", () => {
  it("awards remaining platform rows at a campaign stage boundary only", () => {
    expect(stageCompletionBonus(12)).toBe(12000);
    expect(
      shouldAwardStageCompletion(
        "CAMPAIGN",
        "PUZZLE_RESULT",
        puzzle(1, "s1"),
        puzzle(2, "s2")
      )
    ).toBe(true);
    expect(
      shouldAwardStageCompletion(
        "CAMPAIGN",
        "PUZZLE_RESULT",
        puzzle(1, "s1"),
        puzzle(1, "s1-next")
      )
    ).toBe(false);
    expect(
      shouldAwardStageCompletion(
        "PRACTICE",
        "PUZZLE_RESULT",
        puzzle(1, "s1"),
        puzzle(2, "s2")
      )
    ).toBe(false);
  });

  it("normalizes a stage checkpoint to the stage intro before continuing", () => {
    const source = {
      phase: "STAGE_RESULT",
      phaseTimer: 1.5,
      pausedFromPhase: "PLAYING",
      banner: "OLD",
      stage: 4,
    } as GameSnapshot;
    expect(makeStageCheckpoint(source)).toMatchObject({
      phase: "STAGE_INTRO",
      phaseTimer: 0,
      pausedFromPhase: null,
      banner: "STAGE 4",
      stage: 4,
    });
  });
});
