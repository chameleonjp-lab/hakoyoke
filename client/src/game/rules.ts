/** Obsidian Observatory: renderer-free rules shared by runtime, replay, and tests. */
import { rollingCubeBounds } from "./rollPhysics";
import type { AreaMark, CubeState, GridPosition, RunStats } from "./types";

const CELL_HALF = 0.49;

/** z=0 is the player-side front edge; cubes descend from larger z values. */
export function advanceOneCell(cube: CubeState): CubeState {
  return { ...cube, previousZ: cube.z, z: cube.z - 1 };
}

export function isPositionOnPlatform(
  position: { x: number; z: number },
  width: number,
  rows: number,
  footprintRadius = 0.18
): boolean {
  return (
    position.x >= -0.5 + footprintRadius &&
    position.x <= width - 0.5 - footprintRadius &&
    position.z >= -0.5 + footprintRadius &&
    position.z <= rows - 0.5 - footprintRadius
  );
}

/**
 * MARK and AREA use the same physical occupancy as the visible roll. During a
 * roll a cube can overlap both the source and destination floor cells; either
 * cell can therefore interact with the cube while it is visibly above it.
 */
export function cubeOccupiesCell(
  cube: CubeState,
  cell: GridPosition,
  rollProgress = 0,
  isRolling = false
): boolean {
  if (cube.captured || cube.falling || cube.x !== cell.x) return false;
  if (!isRolling) return cube.z === cell.z;

  const bounds = rollingCubeBounds(cube, rollProgress);
  const cellMinZ = cell.z - CELL_HALF;
  const cellMaxZ = cell.z + CELL_HALF;
  return bounds.z.max >= cellMinZ && bounds.z.min <= cellMaxZ;
}

export function markerCanCapture(
  marker: GridPosition | null,
  cube: CubeState,
  rollProgress = 0,
  isRolling = false
): boolean {
  return Boolean(
    marker && cubeOccupiesCell(cube, marker, rollProgress, isRolling)
  );
}

export function isProtectedByMarker(
  marker: GridPosition | null,
  cube: CubeState,
  rollProgress = 0,
  isRolling = false
): boolean {
  return markerCanCapture(marker, cube, rollProgress, isRolling);
}

function areaContainsCube(
  area: AreaMark,
  cube: CubeState,
  rollProgress: number,
  isRolling: boolean
): boolean {
  if (Math.abs(cube.x - area.x) > 1) return false;
  if (!isRolling) return Math.abs(cube.z - area.z) <= 1;

  const bounds = rollingCubeBounds(cube, rollProgress);
  const areaMinZ = area.z - 1 - CELL_HALF;
  const areaMaxZ = area.z + 1 + CELL_HALF;
  return bounds.z.max >= areaMinZ && bounds.z.min <= areaMaxZ;
}

/** AREA anchors are one-shot. Callers must snapshot and clear the anchor list before capturing targets. */
export function areaTargets(
  cubes: CubeState[],
  activeAreas: AreaMark[],
  marker: GridPosition | null,
  rollProgress = 0,
  isRolling = false
): CubeState[] {
  return cubes.filter(
    cube =>
      !cube.captured &&
      !cube.falling &&
      !isProtectedByMarker(marker, cube, rollProgress, isRolling) &&
      activeAreas.some(area =>
        areaContainsCube(area, cube, rollProgress, isRolling)
      )
  );
}

export function unresolvedCubeCount(cubes: CubeState[]): number {
  return cubes.filter(cube => !cube.captured && !cube.falling).length;
}

export function applyMiss(stats: RunStats): RunStats {
  const next = { ...stats, misses: stats.misses + 1, perfect: false };
  return next.misses > next.missLimit
    ? { ...next, misses: 0, platformRows: next.platformRows - 1 }
    : next;
}

export function applyVoidCapture(stats: RunStats): RunStats {
  return {
    ...stats,
    voidCaptured: stats.voidCaptured + 1,
    perfect: false,
    platformRows: stats.platformRows - 1,
  };
}

export function perfectBonus(rotations: number, requiredRolls: number): number {
  return rotations < requiredRolls
    ? 10000
    : rotations === requiredRolls
      ? 5000
      : 1000;
}

export function normalCaptureScore(source: "manual" | "area"): number {
  return source === "area" ? 200 : 100;
}

export function calculateMindIndex(
  score: number,
  stage: number,
  rows: number,
  misses: number
): number {
  return Math.max(
    0,
    Math.min(999, Math.round(score / 170 + stage * 18 + rows * 9 - misses * 22))
  );
}

export function cloneDeterministic<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
