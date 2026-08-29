import { describe, expect, it } from "vitest";
import { generatePuzzles } from "./puzzles";
import {
  parsePuzzleDescriptor,
  validatePuzzle,
  validatePuzzleArchive,
} from "./puzzleValidation";
import type { PuzzleDescriptor } from "./types";

function customDescriptor(): PuzzleDescriptor {
  return {
    id: "CUSTOM-TEST",
    stage: 1,
    wave: 1,
    ordinal: 1,
    width: 4,
    depth: 2,
    spawnRow: 0,
    requiredRolls: 0,
    difficultyTag: "custom",
    seed: 1,
    layout: [{ x: 1, z: 0, type: "normal" }],
    solution: [
      { rotation: 0, action: "mark", x: 1, z: 0, sequence: 0 },
      { rotation: 0, action: "capture", x: 1, z: 0, sequence: 1 },
    ],
    validation: {
      valid: false,
      normal: 1,
      veil: 0,
      void: 0,
      travelBudget: 8,
    },
    featured: true,
  };
}

describe("custom puzzle descriptor boundary", () => {
  it("accepts the exported descriptor shape and replays it", () => {
    const descriptor = customDescriptor();

    expect(parsePuzzleDescriptor(descriptor)).toMatchObject({
      valid: true,
      reason: "ok",
    });
    expect(validatePuzzle(descriptor)).toMatchObject({
      valid: true,
      reason: "ok",
    });
  });

  it.each([
    [
      "duplicate layout positions",
      {
        ...customDescriptor(),
        layout: [
          { x: 1, z: 0, type: "normal" as const },
          { x: 1, z: 0, type: "veil" as const },
        ],
      },
    ],
    [
      "unknown cube type",
      {
        ...customDescriptor(),
        layout: [{ x: 1, z: 0, type: "corrupt" as never }],
      },
    ],
    [
      "missing validation metadata",
      {
        ...customDescriptor(),
        validation: undefined,
      },
    ],
    [
      "missing spawn row",
      Object.fromEntries(
        Object.entries(customDescriptor()).filter(([key]) => key !== "spawnRow")
      ),
    ],
    [
      "capture without a position",
      {
        ...customDescriptor(),
        solution: [{ rotation: 0, action: "capture" as const }],
      },
    ],
    [
      "unknown solution timing",
      {
        ...customDescriptor(),
        solution: [
          {
            rotation: 0,
            action: "mark" as const,
            x: 1,
            z: 0,
            timing: "during-crash" as never,
          },
        ],
      },
    ],
    [
      "rolling step without progress",
      {
        ...customDescriptor(),
        solution: [
          {
            rotation: 0,
            action: "mark" as const,
            x: 1,
            z: 0,
            timing: "rolling" as const,
          },
        ],
      },
    ],
    [
      "abnormally large rotation",
      {
        ...customDescriptor(),
        solution: [{ rotation: 99999, action: "mark" as const, x: 1, z: 0 }],
      },
    ],
    [
      "duplicate sequence in one rotation",
      {
        ...customDescriptor(),
        solution: [
          { rotation: 0, action: "mark" as const, x: 1, z: 0, sequence: 0 },
          {
            rotation: 0,
            action: "capture" as const,
            x: 1,
            z: 0,
            sequence: 0,
          },
        ],
      },
    ],
  ])("rejects %s", (_reason, descriptor) => {
    expect(parsePuzzleDescriptor(descriptor).valid).toBe(false);
  });

  it("turns a malformed runtime value into a validation result instead of throwing", () => {
    expect(
      validatePuzzle({ layout: [] } as unknown as PuzzleDescriptor)
    ).toEqual(
      expect.objectContaining({
        valid: false,
        reason: expect.any(String),
      })
    );
  });

  it("keeps generated gameplay patterns unique across the archive", () => {
    const result = validatePuzzleArchive(generatePuzzles());

    expect(result.valid).toBe(true);
    expect(
      result.issues.filter(issue =>
        issue.includes("duplicate gameplay pattern")
      )
    ).toEqual([]);
  });
});
