/** Obsidian Observatory: authoritative cube-roll geometry shared by collision and rendering. */
import type { CubeState } from "./types";

export const ROLL_SIZE = 0.98;
export const ROLL_HALF = ROLL_SIZE / 2;

export interface AxisBounds {
  min: number;
  max: number;
}
export interface RollBounds {
  x: AxisBounds;
  z: AxisBounds;
}

/** The cube rotates around its lower player-side edge and advances toward decreasing z. */
export function rollingCubeBounds(
  cube: Pick<CubeState, "x" | "z">,
  progress: number
): RollBounds {
  const angle = (clamp01(progress) * Math.PI) / 2;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const pivotZ = cube.z - ROLL_HALF;
  const zCorners = [0, ROLL_SIZE].flatMap(y =>
    [0, ROLL_SIZE].map(localZ => pivotZ - y * sin + localZ * cos)
  );
  return {
    x: { min: cube.x - ROLL_HALF, max: cube.x + ROLL_HALF },
    z: { min: Math.min(...zCorners), max: Math.max(...zCorners) },
  };
}

/** Samples the actual rotation arc, so collision covers the volume traversed during the current fixed step. */
export function rollingCubeSweepBounds(
  cube: Pick<CubeState, "x" | "z">,
  fromProgress: number,
  toProgress: number
): RollBounds {
  const start = clamp01(Math.min(fromProgress, toProgress));
  const end = clamp01(Math.max(fromProgress, toProgress));
  const samples = Math.max(2, Math.ceil((end - start) * 12) + 1);
  const bounds = Array.from({ length: samples }, (_, index) =>
    rollingCubeBounds(cube, start + ((end - start) * index) / (samples - 1))
  );
  return {
    x: {
      min: Math.min(...bounds.map(value => value.x.min)),
      max: Math.max(...bounds.map(value => value.x.max)),
    },
    z: {
      min: Math.min(...bounds.map(value => value.z.min)),
      max: Math.max(...bounds.map(value => value.z.max)),
    },
  };
}

export function playerIntersectsRollSweep(
  cube: Pick<CubeState, "x" | "z">,
  player: { x: number; z: number },
  fromProgress: number,
  toProgress: number,
  radius = 0.22
): boolean {
  const bounds = rollingCubeSweepBounds(cube, fromProgress, toProgress);
  return (
    player.x >= bounds.x.min - radius &&
    player.x <= bounds.x.max + radius &&
    player.z >= bounds.z.min - radius &&
    player.z <= bounds.z.max + radius
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
