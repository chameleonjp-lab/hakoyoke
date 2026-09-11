import { describe, expect, it } from "vitest";
import {
  GRID_REPEAT_DELAY_TICKS,
  GRID_STEP_TICKS,
  beginPlayerStep,
  createPlayerStep,
  directionFromVector,
  isCellInBounds,
  playerPosition,
  queuePlayerDirection,
  tickPlayerStep,
} from "./gridMovement";

describe("grid movement rules", () => {
  it("quantizes every device vector to one cardinal direction", () => {
    expect(directionFromVector(0, 1)).toBe("up");
    expect(directionFromVector(0, -1)).toBe("down");
    expect(directionFromVector(-1, 0)).toBe("left");
    expect(directionFromVector(1, 0)).toBe("right");
    expect(directionFromVector(1, 1, "left")).toBe("left");
    expect(directionFromVector(0, 0)).toBeNull();
  });

  it("interpolates exactly one cell over seven fixed updates", () => {
    const state = createPlayerStep({ x: 2, z: 0 });
    expect(
      beginPlayerStep(state, "right", cell => isCellInBounds(cell, 4, 12))
    ).toBe(true);
    expect(playerPosition(state)).toEqual({ x: 2, z: 0 });
    for (let tick = 1; tick < GRID_STEP_TICKS; tick += 1) {
      expect(tickPlayerStep(state)).toBe(false);
      expect(playerPosition(state).x).toBeCloseTo(2 + tick / GRID_STEP_TICKS);
    }
    expect(tickPlayerStep(state)).toBe(true);
    expect(playerPosition(state).x).toBe(3);
  });

  it("keeps one latest queued direction while a step is active", () => {
    const state = createPlayerStep({ x: 2, z: 0 });
    expect(
      beginPlayerStep(state, "right", cell => isCellInBounds(cell, 4, 12))
    ).toBe(true);
    queuePlayerDirection(state, "up");
    queuePlayerDirection(state, "left");
    expect(state.queuedDirection).toBe("left");
  });

  it("exposes the repeat delay as a fixed-tick contract", () => {
    expect(GRID_REPEAT_DELAY_TICKS).toBe(10);
    expect(GRID_STEP_TICKS).toBe(7);
  });
});
