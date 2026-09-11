import { describe, expect, it } from "vitest";
import { summarizeResult } from "./resultSummary";
import type { GameSnapshot } from "./types";

const snapshot = (overrides: Partial<GameSnapshot> = {}): GameSnapshot =>
  ({
    phase: "GAME_OVER",
    mode: "PRACTICE",
    difficulty: "NORMAL",
    player: { x: 1, z: 0, heading: 0 },
    cubes: [],
    marker: null,
    areas: [],
    stats: {
      score: 420,
      rotations: 8,
      captureRotations: 5,
      requiredRolls: 4,
      misses: 1,
      missLimit: 3,
      platformRows: 11,
      areaMarks: 0,
      perfect: false,
      normalCaptured: 2,
      veilCaptured: 1,
      voidCaptured: 0,
      scoreBreakdown: {
        manualCapture: 200,
        areaCapture: 200,
        perfectBonus: 0,
        stageBonus: 0,
        finalBonus: 0,
      },
    },
    stage: 1,
    wave: 1,
    puzzleIndex: 0,
    boardWidth: 4,
    boardDepth: 2,
    countdown: 0,
    banner: "FALL INTO VOID",
    hint: "",
    rollProgress: 0,
    debug: false,
    duelTurn: 0,
    duelScore: [0, 0],
    tutorialStep: 0,
    captureProgress: 0,
    crushProgress: 0,
    ...overrides,
  }) as GameSnapshot;

describe("result summary", () => {
  it("keeps the loss guidance and capture metrics readable", () => {
    const result = summarizeResult(snapshot());

    expect(result.detail).toContain("足場の外");
    expect(result.nextStep).toContain("RETRY");
    expect(result.captured).toBe(3);
    expect(result.captureRotations).toBe(5);
    expect(result.scoreBreakdown.areaCapture).toBe(200);
  });

  it("falls back to safe zeroes for legacy result snapshots", () => {
    const result = summarizeResult(
      snapshot({
        phase: "PUZZLE_RESULT",
        banner: "ORDEAL RESOLVED",
        stats: {} as GameSnapshot["stats"],
      })
    );

    expect(result.score).toBe(0);
    expect(result.captureRotations).toBe(0);
    expect(result.requiredRolls).toBe(0);
    expect(result.headline).toBe("ORDEAL RESOLVED");
  });
});
