/** Obsidian Observatory: deterministic, renderer-free rules shared by simulation and tests. */
import type { AreaMark, CubeState, GridPosition, RunStats } from "./types";

/** z=0 is the player-side front edge; cubes descend from larger z values toward the player. */
export function advanceOneCell(cube: CubeState): CubeState { return { ...cube, previousZ: cube.z, z: cube.z - 1 }; }
export function isPositionOnPlatform(position: { x: number; z: number }, width: number, rows: number, footprintRadius = 0.18): boolean {
  return position.x >= -0.5 + footprintRadius && position.x <= width - 0.5 - footprintRadius && position.z >= -0.5 + footprintRadius && position.z <= rows - 0.5 - footprintRadius;
}
export function markerCanCapture(marker: GridPosition | null, cube: CubeState): boolean { return Boolean(marker && !cube.captured && !cube.falling && marker.x === cube.x && marker.z === cube.z); }
export function isProtectedVoid(marker: GridPosition | null, cube: CubeState): boolean { return cube.type === "void" && markerCanCapture(marker, cube); }
export function areaTargets(cubes: CubeState[], areas: AreaMark[], marker: GridPosition | null): CubeState[] {
  return cubes.filter((cube) => !cube.captured && !cube.falling && !isProtectedVoid(marker, cube) && areas.some((area) => Math.abs(cube.x - area.x) <= 1 && Math.abs(cube.z - area.z) <= 1));
}
export function applyMiss(stats: RunStats): RunStats { const next = { ...stats, misses: stats.misses + 1, perfect: false }; return next.misses > next.missLimit ? { ...next, misses: 0, platformRows: next.platformRows - 1 } : next; }
export function applyVoidCapture(stats: RunStats): RunStats { return { ...stats, voidCaptured: stats.voidCaptured + 1, perfect: false, platformRows: stats.platformRows - 1 }; }
export function perfectBonus(rotations: number, requiredRolls: number): number { return rotations < requiredRolls ? 10000 : rotations === requiredRolls ? 5000 : 1000; }
export function normalCaptureScore(source: "manual" | "area"): number { return source === "area" ? 200 : 100; }
export function calculateMindIndex(score: number, stage: number, rows: number, misses: number): number { return Math.max(0, Math.min(999, Math.round(score / 170 + stage * 18 + rows * 9 - misses * 22))); }
export function cloneDeterministic<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
