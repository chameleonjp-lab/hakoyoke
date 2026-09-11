/** Renderer-free, deterministic one-cell movement rules. */
import type { Cell, Direction, PlayerStepState } from "./types";
export type { Direction } from "./types";

/** Initial value from the PR04 plan: seven fixed updates per cell. */
export const GRID_STEP_TICKS = 7;
/** A held direction starts repeating on this fixed update. */
export const GRID_REPEAT_DELAY_TICKS = 10;
/** Repeated steps after the first held step use the same cell duration. */
export const GRID_REPEAT_INTERVAL_TICKS = GRID_STEP_TICKS;

export function createPlayerStep(
  cell: Cell,
  stepTicks = GRID_STEP_TICKS
): PlayerStepState {
  return {
    from: { ...cell },
    to: null,
    elapsedTicks: 0,
    stepTicks,
    queuedDirection: null,
    heldDirection: null,
    heldTicks: 0,
    nextRepeatTick: null,
  };
}

export function isPlayerMoving(state: PlayerStepState): boolean {
  return state.to !== null;
}

export function directionVector(direction: Direction): Cell {
  switch (direction) {
    case "up":
      return { x: 0, z: 1 };
    case "down":
      return { x: 0, z: -1 };
    case "left":
      return { x: -1, z: 0 };
    case "right":
      return { x: 1, z: 0 };
  }
}

export function directionFromVector(
  x: number,
  z: number,
  previous: Direction | null = null
): Direction | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (Math.abs(x) < 0.01 && Math.abs(z) < 0.01) return null;
  if (Math.abs(x) === Math.abs(z) && previous) return previous;
  if (Math.abs(x) > Math.abs(z)) return x < 0 ? "left" : "right";
  return z < 0 ? "down" : "up";
}

export function cellForDirection(cell: Cell, direction: Direction): Cell {
  const vector = directionVector(direction);
  return { x: cell.x + vector.x, z: cell.z + vector.z };
}

export function isCellInBounds(
  cell: Cell,
  width: number,
  rows: number
): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.x < width &&
    cell.z >= 0 &&
    cell.z < rows
  );
}

export function playerPosition(state: PlayerStepState): Cell {
  if (!state.to) return { ...state.from };
  const progress = Math.max(
    0,
    Math.min(1, state.elapsedTicks / Math.max(1, state.stepTicks))
  );
  return {
    x: state.from.x + (state.to.x - state.from.x) * progress,
    z: state.from.z + (state.to.z - state.from.z) * progress,
  };
}

export function beginPlayerStep(
  state: PlayerStepState,
  direction: Direction,
  canEnter: (cell: Cell) => boolean
): boolean {
  if (state.to) return false;
  const target = cellForDirection(state.from, direction);
  if (!canEnter(target)) return false;
  state.to = target;
  state.elapsedTicks = 0;
  state.nextRepeatTick = null;
  return true;
}

export function queuePlayerDirection(
  state: PlayerStepState,
  direction: Direction
): void {
  state.queuedDirection = direction;
}

export function completePlayerStep(state: PlayerStepState): Cell | null {
  if (!state.to) return null;
  state.from = { ...state.to };
  state.to = null;
  state.elapsedTicks = 0;
  return { ...state.from };
}

export function tickPlayerStep(state: PlayerStepState): boolean {
  if (!state.to) return false;
  state.elapsedTicks = Math.min(state.stepTicks, state.elapsedTicks + 1);
  return state.elapsedTicks >= state.stepTicks;
}
