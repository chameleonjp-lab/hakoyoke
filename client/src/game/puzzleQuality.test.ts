import { describe, expect, it } from "vitest";
import { generatePuzzles } from "./puzzles";
import {
  auditRepresentativePuzzles,
  QUALITY_REPRESENTATIVES,
  qualityDifficultyOrder,
} from "./puzzleQuality";
import { validatePuzzleArchive } from "./puzzleValidation";

describe("authored puzzle quality gate", () => {
  it("covers the teaching curve with five-difficulty 30Hz replays", () => {
    const puzzles = generatePuzzles();
    const audit = auditRepresentativePuzzles(puzzles);

    expect(audit.valid).toBe(true);
    expect(audit.issues).toEqual([]);
    expect(audit.results).toHaveLength(QUALITY_REPRESENTATIVES.length);
    expect(new Set(audit.results.map(result => result.stage))).toHaveLength(9);
    expect(
      audit.results.every(result =>
        qualityDifficultyOrder().every(
          difficulty =>
            result.replayByDifficulty[difficulty] &&
            Number.isFinite(result.minimumMarginByDifficulty[difficulty])
        )
      )
    ).toBe(true);
  });

  it("is part of the archive validation result, not only a unit test", () => {
    const archive = validatePuzzleArchive(generatePuzzles());

    expect(archive.quality.valid).toBe(true);
    expect(archive.quality.results.map(result => result.id)).toEqual(
      expect.arrayContaining(["FINAL-W4-P01", "STAGE-6-W3-P01"])
    );
  });

  it("reports a representative drift with an actionable issue", () => {
    const puzzles = generatePuzzles().map(puzzle => ({ ...puzzle }));
    const drifted = puzzles.find(
      puzzle => puzzle.stage === 1 && puzzle.wave === 1 && puzzle.ordinal === 1
    );
    if (!drifted) throw new Error("representative fixture is missing");
    drifted.difficultyTag = "route-drift";

    const audit = auditRepresentativePuzzles(puzzles);

    expect(audit.valid).toBe(false);
    expect(audit.issues).toContain(
      "STAGE-1-W1-P01: expected tag intro-read, got route-drift"
    );
  });
});
