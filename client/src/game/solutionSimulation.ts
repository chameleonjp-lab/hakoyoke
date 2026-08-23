/** Deterministic headless replay using the same one-shot AREA and MARK protection rules as GameWorld. */
import { areaTargets } from "./rules";
import {
  DIFFICULTIES,
  type AreaMark,
  type CubeState,
  type PuzzleDescriptor,
  type SolutionStep,
} from "./types";

export interface SolutionSimulationResult {
  valid: boolean;
  reason: string;
  requiredCaptured: number;
  voidCaptured: number;
  measuredRolls: number;
  playerReachable: boolean;
  areaUses: number;
  consumedAreaAnchors: number;
  regeneratedAreaAnchors: number;
}

const ACTION_PRIORITY: Record<SolutionStep["action"], number> = {
  capture: 0,
  mark: 1,
  area: 2,
};

export function simulatePuzzleSolution(
  puzzle: PuzzleDescriptor
): SolutionSimulationResult {
  const cubes: CubeState[] = puzzle.layout.map((cube, index) => ({
    ...cube,
    id: `${puzzle.id}-${index}`,
    previousZ: cube.z,
    captured: false,
    falling: false,
  }));
  let areas: AreaMark[] = [];
  const steps = [...puzzle.solution].sort(compareSteps);
  let marker: { x: number; z: number } | null = null;
  let player = { x: Math.max(0.5, puzzle.width / 2), z: 0.7 };
  let previousRotation = 0;
  let voidCaptured = 0;
  let playerReachable = true;
  let areaUses = 0;
  let consumedAreaAnchors = 0;
  let regeneratedAreaAnchors = 0;
  const captureRotations: number[] = [];
  const config = DIFFICULTIES.NORMAL;
  const cycleSeconds = config.rollSeconds + config.settleSeconds;

  for (const step of steps) {
    if (!Number.isInteger(step.rotation) || step.rotation < previousRotation)
      return failure("invalid rotation order");
    const elapsedRotations = step.rotation - previousRotation;
    for (const cube of cubes) {
      if (cube.captured || cube.falling) continue;
      cube.previousZ = cube.z;
      cube.z -= elapsedRotations;
      if (cube.z < 0) cube.falling = true;
    }

    if (step.action === "mark") {
      if (step.x === undefined || step.z === undefined)
        return failure("mark without position");
      const distance = Math.hypot(step.x - player.x, step.z - player.z);
      // A mark scheduled at the same rotation as a capture is placed during capture pause + settle.
      const available =
        elapsedRotations * cycleSeconds +
        config.captureSeconds +
        config.settleSeconds;
      if (distance > available * config.playerSpeed + 0.35)
        playerReachable = false;
      player = { x: step.x, z: step.z };
      marker = { x: step.x, z: step.z };
      previousRotation = step.rotation;
      continue;
    }

    if (step.action === "capture") {
      if (!marker) return failure("capture without marker");
      const target = cubes.find(
        cube =>
          !cube.captured &&
          !cube.falling &&
          cube.x === marker?.x &&
          cube.z === marker?.z
      );
      if (!target) return failure("marker has no landed cube");
      target.captured = true;
      if (target.type === "void") voidCaptured += 1;
      else captureRotations.push(step.rotation);
      if (target.type === "veil") {
        const next: AreaMark = {
          id: `area-${target.id}`,
          x: target.x,
          z: target.z,
          armed: true,
        };
        if (!areas.some(area => area.x === next.x && area.z === next.z)) {
          areas.push(next);
          regeneratedAreaAnchors += 1;
        }
      }
      marker = null;
      previousRotation = step.rotation;
      continue;
    }

    if (!areas.length) return failure("area without veil anchor");
    areaUses += 1;
    const activeAreas = areas;
    consumedAreaAnchors += activeAreas.length;
    areas = [];
    const targets = areaTargets(cubes, activeAreas, marker);
    if (!targets.length) return failure("area has no targets");
    for (const target of targets) {
      target.captured = true;
      if (target.type === "void") voidCaptured += 1;
      else captureRotations.push(step.rotation);
      if (target.type === "veil") {
        const next: AreaMark = {
          id: `area-${target.id}`,
          x: target.x,
          z: target.z,
          armed: true,
        };
        if (!areas.some(area => area.x === next.x && area.z === next.z)) {
          areas.push(next);
          regeneratedAreaAnchors += 1;
        }
      }
    }
    previousRotation = step.rotation;
  }

  const remaining = cubes.filter(
    cube => cube.type !== "void" && !cube.captured
  ).length;
  const measuredRolls =
    captureRotations.length < 2
      ? 0
      : Math.max(...captureRotations) - Math.min(...captureRotations);
  if (!playerReachable)
    return failure(
      "player cannot reach a scheduled MARK",
      measuredRolls,
      false,
      voidCaptured,
      areaUses,
      consumedAreaAnchors,
      regeneratedAreaAnchors
    );
  if (voidCaptured)
    return failure(
      "solution captures VOID",
      measuredRolls,
      true,
      voidCaptured,
      areaUses,
      consumedAreaAnchors,
      regeneratedAreaAnchors
    );
  if (remaining)
    return failure(
      "solution leaves required cubes",
      measuredRolls,
      true,
      voidCaptured,
      areaUses,
      consumedAreaAnchors,
      regeneratedAreaAnchors
    );
  if (measuredRolls !== puzzle.requiredRolls)
    return failure(
      "requiredRolls differs from replay",
      measuredRolls,
      true,
      voidCaptured,
      areaUses,
      consumedAreaAnchors,
      regeneratedAreaAnchors
    );
  return {
    valid: true,
    reason: "ok",
    requiredCaptured: cubes.filter(
      cube => cube.type !== "void" && cube.captured
    ).length,
    voidCaptured,
    measuredRolls,
    playerReachable,
    areaUses,
    consumedAreaAnchors,
    regeneratedAreaAnchors,
  };
}

export function deriveDirectSolution(
  puzzle: Pick<PuzzleDescriptor, "id" | "width" | "depth" | "layout">
): SolutionStep[] {
  const targetZ = 0;
  return puzzle.layout
    .filter(cube => cube.type !== "void")
    .sort((a, b) => a.z - b.z || a.x - b.x)
    .flatMap(cube => {
      const rotation = cube.z - targetZ;
      return [
        {
          rotation: Math.max(0, rotation - 1),
          action: "mark" as const,
          x: cube.x,
          z: targetZ,
        },
        { rotation, action: "capture" as const, x: cube.x, z: targetZ },
      ];
    });
}

function compareSteps(a: SolutionStep, b: SolutionStep): number {
  return (
    a.rotation - b.rotation ||
    ACTION_PRIORITY[a.action] - ACTION_PRIORITY[b.action]
  );
}

function failure(
  reason: string,
  measuredRolls = 0,
  playerReachable = true,
  voidCaptured = 0,
  areaUses = 0,
  consumedAreaAnchors = 0,
  regeneratedAreaAnchors = 0
): SolutionSimulationResult {
  return {
    valid: false,
    reason,
    requiredCaptured: 0,
    voidCaptured,
    measuredRolls,
    playerReachable,
    areaUses,
    consumedAreaAnchors,
    regeneratedAreaAnchors,
  };
}
