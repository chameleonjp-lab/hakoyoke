import { describe, expect, it } from "vitest";
import {
  playerIntersectsRollSweep,
  rollingCubeBounds,
  rollingCubeSweepBounds,
} from "./rollPhysics";

describe("edge-pivot cube roll geometry", () => {
  const cube = {
    id: "cube",
    type: "normal" as const,
    x: 2,
    z: 4,
    previousZ: 4,
  };
  it("starts at the current cell and ends at the next front cell", () => {
    const start = rollingCubeBounds(cube, 0);
    const end = rollingCubeBounds(cube, 1);
    expect(start.z.min).toBeCloseTo(3.51, 2);
    expect(start.z.max).toBeCloseTo(4.49, 2);
    expect(end.z.min).toBeCloseTo(2.53, 2);
    expect(end.z.max).toBeCloseTo(3.51, 2);
  });
  it("includes the traversed edge-pivot volume during a fixed step", () => {
    const sweep = rollingCubeSweepBounds(cube, 0.2, 0.8);
    expect(sweep.z.min).toBeLessThan(3);
    expect(sweep.z.max).toBeGreaterThan(4);
  });
  it("detects a player in the cube sweep but not one outside the width", () => {
    expect(playerIntersectsRollSweep(cube, { x: 2, z: 3.2 }, 0.2, 0.8)).toBe(
      true
    );
    expect(playerIntersectsRollSweep(cube, { x: 3.2, z: 3.2 }, 0.2, 0.8)).toBe(
      false
    );
  });
});
