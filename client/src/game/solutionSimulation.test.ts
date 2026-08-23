import { describe, expect, it } from "vitest";
import {
  deriveDirectSolution,
  simulatePuzzleSolution,
} from "./solutionSimulation";
import type { PuzzleDescriptor } from "./types";

function puzzle(
  layout: PuzzleDescriptor["layout"],
  requiredRolls = 0
): PuzzleDescriptor {
  const base = {
    id: "SIM",
    stage: 1,
    wave: 1,
    ordinal: 1,
    width: 4,
    depth: 3,
    difficultyTag: "test",
    seed: 1,
    layout,
    validation: { valid: true, normal: 0, veil: 0, void: 0, travelBudget: 20 },
    featured: false,
  };
  const solution = deriveDirectSolution(base);
  const captures = solution
    .filter(step => step.action === "capture")
    .map(step => step.rotation);
  return {
    ...base,
    requiredRolls:
      captures.length < 2 ? 0 : Math.max(...captures) - Math.min(...captures),
    solution,
    ...(requiredRolls ? { requiredRolls } : {}),
  };
}

describe("headless registered solution replay", () => {
  it("proves a direct solution captures every required cube at NORMAL movement speed", () =>
    expect(
      simulatePuzzleSolution(
        puzzle([
          { x: 1, z: 1, type: "normal" },
          { x: 3, z: 3, type: "normal" },
        ])
      ).valid
    ).toBe(true));
  it("rejects a solution whose declared required rolls do not match replay", () =>
    expect(
      simulatePuzzleSolution(
        puzzle(
          [
            { x: 1, z: 1, type: "normal" },
            { x: 3, z: 3, type: "normal" },
          ],
          9
        )
      ).reason
    ).toBe("requiredRolls differs from replay"));
  it("rejects a direct schedule that asks one player to cross too far without time", () =>
    expect(
      simulatePuzzleSolution({
        ...puzzle([
          { x: 0, z: 1, type: "normal" },
          { x: 3, z: 1, type: "normal" },
        ]),
        solution: [
          { rotation: 0, action: "mark", x: 0, z: 0 },
          { rotation: 1, action: "capture", x: 0, z: 0 },
          { rotation: 1, action: "mark", x: 3, z: 0 },
          { rotation: 1, action: "capture", x: 3, z: 0 },
        ],
        requiredRolls: 0,
      }).valid
    ).toBe(false));
});
