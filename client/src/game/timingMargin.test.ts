import { describe, expect, it } from "vitest";
import { generatePuzzles } from "./puzzles";
import {
  HUMAN_MARGIN_TARGET_TICKS,
  INPUT_LAG_BUDGET_TICKS,
  measureArchiveTimingMargins,
} from "./timingMargin";
import type { Difficulty } from "./types";

const difficulties: Difficulty[] = [
  "BEGINNER",
  "EASY",
  "NORMAL",
  "HARD",
  "EXTREME",
];

describe("grid timing margin audit", () => {
  it("measures every authored puzzle at every difficulty", () => {
    const reports = measureArchiveTimingMargins(generatePuzzles());
    expect(reports).toHaveLength(88 * difficulties.length);
    expect(new Set(reports.map(report => report.puzzleId)).size).toBe(88);
    expect(new Set(reports.map(report => report.difficulty))).toEqual(
      new Set(difficulties)
    );
    expect(
      reports.every(report =>
        report.windows.every(window => Number.isInteger(window.marginTicks))
      )
    ).toBe(true);
  });

  it("keeps grid travel and input-lag accounting explicit", () => {
    const reports = measureArchiveTimingMargins(generatePuzzles());
    for (const difficulty of difficulties) {
      const difficultyReports = reports.filter(
        report => report.difficulty === difficulty
      );
      const minimum = Math.min(
        ...difficultyReports.map(
          report => report.minimumMarginAfterInputBudgetTicks
        )
      );
      expect(difficultyReports.every(report => report.meetsTarget)).toBe(true);
      expect(minimum).toBeGreaterThanOrEqual(
        -INPUT_LAG_BUDGET_TICKS - HUMAN_MARGIN_TARGET_TICKS[difficulty]
      );
    }
  });
});
