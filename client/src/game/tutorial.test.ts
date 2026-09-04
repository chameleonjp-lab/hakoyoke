import { describe, expect, it } from "vitest";
import {
  getTutorialPuzzle,
  TUTORIAL_HINTS,
  TUTORIAL_STAGE_COUNT,
  tutorialActionEnabled,
  tutorialHint,
} from "./tutorial";

describe("authored tutorial gates", () => {
  it("contains eight focused puzzles in the intended learning order", () => {
    const puzzles = Array.from({ length: TUTORIAL_STAGE_COUNT }, (_, index) =>
      getTutorialPuzzle(index)
    );

    expect(puzzles.every(Boolean)).toBe(true);
    expect(puzzles.map(puzzle => puzzle?.id)).toEqual([
      "TUTORIAL-GATE-01-MOVE",
      "TUTORIAL-GATE-02-MARK",
      "TUTORIAL-GATE-03-CAPTURE",
      "TUTORIAL-GATE-04-VEIL",
      "TUTORIAL-GATE-05-PROTECT",
      "TUTORIAL-GATE-06-AREA",
      "TUTORIAL-GATE-07-LOSS",
      "TUTORIAL-GATE-08-PERFECT",
    ]);
    expect(puzzles.map(puzzle => puzzle?.layout.length)).toEqual([
      0, 0, 1, 1, 1, 2, 1, 1,
    ]);
    expect(getTutorialPuzzle(TUTORIAL_STAGE_COUNT)).toBeUndefined();
  });

  it("exposes only the action needed at each gate", () => {
    expect(tutorialActionEnabled(0, "mark")).toBe(false);
    expect(tutorialActionEnabled(1, "mark")).toBe(true);
    expect(tutorialActionEnabled(2, "clear")).toBe(true);
    expect(tutorialActionEnabled(4, "area")).toBe(false);
    expect(tutorialActionEnabled(5, "area")).toBe(true);
    expect(tutorialActionEnabled(6, "mark")).toBe(false);
    expect(tutorialActionEnabled(7, "mark")).toBe(true);
  });

  it("keeps the final hint stable after all gates are complete", () => {
    expect(TUTORIAL_HINTS).toHaveLength(TUTORIAL_STAGE_COUNT);
    expect(tutorialHint(0)).toBe(TUTORIAL_HINTS[0]);
    expect(tutorialHint(TUTORIAL_STAGE_COUNT)).toBe(TUTORIAL_HINTS.at(-1));
  });
});
