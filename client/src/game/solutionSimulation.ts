/** Obsidian Observatory: deterministic headless replay for authored and generated puzzle solutions. */
import { DIFFICULTIES, type CubeState, type PuzzleDescriptor, type SolutionStep } from "./types";

export interface SolutionSimulationResult {
  valid: boolean;
  reason: string;
  requiredCaptured: number;
  voidCaptured: number;
  measuredRolls: number;
  playerReachable: boolean;
}

export function simulatePuzzleSolution(puzzle: PuzzleDescriptor): SolutionSimulationResult {
  const targetZ = 0;
  const cubes: CubeState[] = puzzle.layout.map((cube, index) => ({ ...cube, id: `${puzzle.id}-${index}`, previousZ: cube.z }));
  const areas: Array<{ x: number; z: number }> = [];
  const steps = [...puzzle.solution].sort(compareSteps);
  let marker: { x: number; z: number } | null = null;
  let player = { x: Math.max(0.5, puzzle.width / 2), z: 0.7 };
  let previousRotation = 0;
  let voidCaptured = 0;
  let playerReachable = true;
  const captureRotations: number[] = [];
  const cycleSeconds = DIFFICULTIES.NORMAL.rollSeconds + DIFFICULTIES.NORMAL.settleSeconds;

  for (const step of steps) {
    if (!Number.isInteger(step.rotation) || step.rotation < previousRotation) return failure("invalid rotation order");
    const elapsed = (step.rotation - previousRotation) * cycleSeconds + (previousRotation === 0 ? 1 : 0);
    for (const cube of cubes) if (!cube.captured && !cube.falling) { cube.previousZ = cube.z; cube.z -= step.rotation - previousRotation; if (cube.z < targetZ) cube.falling = true; }
    if (step.x !== undefined && step.z !== undefined) {
      const distance = Math.hypot(step.x - player.x, step.z - player.z);
      if (distance > elapsed * DIFFICULTIES.NORMAL.playerSpeed + 0.35) playerReachable = false;
      player = { x: step.x, z: step.z };
    }
    previousRotation = step.rotation;

    if (step.action === "mark") { marker = step.x !== undefined && step.z !== undefined ? { x: step.x, z: step.z } : null; continue; }
    if (step.action === "capture") {
      if (!marker) return failure("capture without marker");
      const target = cubes.find((cube) => !cube.captured && !cube.falling && cube.x === marker?.x && cube.z === marker?.z);
      if (!target) return failure("marker has no landed cube");
      target.captured = true;
      if (target.type === "void") voidCaptured += 1;
      if (target.type === "veil") areas.push({ x: target.x, z: target.z });
      captureRotations.push(step.rotation);
      marker = null;
      continue;
    }
    if (step.action === "area") {
      if (!areas.length) return failure("area without veil anchor");
      const targets = cubes.filter((cube) => !cube.captured && !cube.falling && areas.some((area) => Math.abs(cube.x - area.x) <= 1 && Math.abs(cube.z - area.z) <= 1) && !(cube.type === "void" && marker && cube.x === marker.x && cube.z === marker.z));
      if (!targets.length) return failure("area has no targets");
      for (const target of targets) { target.captured = true; if (target.type === "void") voidCaptured += 1; if (target.type === "veil") areas.push({ x: target.x, z: target.z }); if (target.type !== "void") captureRotations.push(step.rotation); }
    }
  }
  const remaining = cubes.filter((cube) => cube.type !== "void" && !cube.captured).length;
  const measuredRolls = captureRotations.length < 2 ? 0 : Math.max(...captureRotations) - Math.min(...captureRotations);
  if (!playerReachable) return failure("player cannot reach a scheduled action", measuredRolls, playerReachable, voidCaptured);
  if (voidCaptured) return failure("solution captures VOID", measuredRolls, playerReachable, voidCaptured);
  if (remaining) return failure("solution leaves required cubes", measuredRolls, playerReachable, voidCaptured);
  if (measuredRolls !== puzzle.requiredRolls) return failure("requiredRolls differs from replay", measuredRolls, playerReachable, voidCaptured);
  return { valid: true, reason: "ok", requiredCaptured: cubes.filter((cube) => cube.type !== "void" && cube.captured).length, voidCaptured, measuredRolls, playerReachable };
}

export function deriveDirectSolution(puzzle: Pick<PuzzleDescriptor, "id" | "width" | "depth" | "layout">): SolutionStep[] {
  const targetZ = 0;
  return puzzle.layout.filter((cube) => cube.type !== "void").sort((a, b) => a.z - b.z || a.x - b.x).flatMap((cube) => {
    const rotation = cube.z - targetZ;
    return [{ rotation: Math.max(0, rotation - 1), action: "mark" as const, x: cube.x, z: targetZ }, { rotation, action: "capture" as const, x: cube.x, z: targetZ }];
  });
}

function compareSteps(a: SolutionStep, b: SolutionStep): number { const priority = { mark: 0, capture: 1, area: 2 }; return a.rotation - b.rotation || priority[a.action] - priority[b.action]; }
function failure(reason: string, measuredRolls = 0, playerReachable = true, voidCaptured = 0): SolutionSimulationResult { return { valid: false, reason, requiredCaptured: 0, voidCaptured, measuredRolls, playerReachable }; }
