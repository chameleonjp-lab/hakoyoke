/** Deterministic replay of the same projected grid state used by GameWorld. */
import {
  createRuntimePuzzleCubes,
  platformRowsForStage,
  puzzleSourceStart,
} from "./platformProgression";
import {
  advanceOneCell,
  areaTargets,
  isPositionOnPlatform,
  markerCanCapture,
} from "./rules";
import {
  DIFFICULTIES,
  type AreaMark,
  type CubeState,
  type Difficulty,
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

export interface SolutionSimulationOptions {
  /** Override the current platform length when testing row gain or loss. */
  platformRows?: number;
  difficulty?: Difficulty;
}

const ACTION_PRIORITY: Record<SolutionStep["action"], number> = {
  capture: 0,
  mark: 1,
  area: 2,
};

export function simulatePuzzleSolution(
  puzzle: PuzzleDescriptor,
  options: SolutionSimulationOptions = {}
): SolutionSimulationResult {
  const platformRows =
    options.platformRows ?? platformRowsForStage(puzzle.stage, puzzle.depth);
  const sourceStart = puzzleSourceStart(puzzle);
  const runtimeStart = platformRows - puzzle.depth;
  const rotationOffset = runtimeStart - sourceStart;
  let cubes: CubeState[] = createRuntimePuzzleCubes(puzzle, platformRows).map(
    cube => ({ ...cube, captured: false, falling: false })
  );
  let areas: AreaMark[] = [];
  const steps = [...puzzle.solution].sort(compareSteps);
  let marker: { x: number; z: number } | null = null;
  let player = { x: Math.max(0.5, puzzle.width / 2), z: 0.7 };
  let previousRotation = 0;
  let lastActionTime = 0;
  let lastActionWasCapture = false;
  let voidCaptured = 0;
  let requiredCaptured = 0;
  let requiredFallen = 0;
  let playerReachable = true;
  let misses = 0;
  let currentPlatformRows = platformRows;
  let areaUses = 0;
  let consumedAreaAnchors = 0;
  let regeneratedAreaAnchors = 0;
  const captureRotations: number[] = [];
  const config = DIFFICULTIES[options.difficulty ?? "NORMAL"];
  const cycleSeconds = config.rollSeconds + config.settleSeconds;
  const missLimit = Math.max(1, puzzle.width - 1);

  for (const step of steps) {
    if (!Number.isInteger(step.rotation) || step.rotation < 0)
      return failure("invalid rotation order");
    const runtimeRotation = step.rotation + rotationOffset;
    if (
      !Number.isInteger(runtimeRotation) ||
      runtimeRotation < previousRotation
    )
      return failure("invalid rotation order");
    const elapsedRotations = runtimeRotation - previousRotation;
    for (let rotation = 0; rotation < elapsedRotations; rotation += 1) {
      for (const cube of cubes) {
        if (cube.captured || cube.falling) continue;
        Object.assign(cube, advanceOneCell(cube));
        if (cube.z < 0) {
          cube.falling = true;
          if (cube.type === "void") continue;
          requiredFallen += 1;
          misses += 1;
          if (misses > missLimit) {
            misses = 0;
            currentPlatformRows -= 1;
          }
        }
      }
      cubes = cubes.filter(cube => !cube.falling && !cube.captured);
      if (currentPlatformRows < puzzle.depth + 2)
        return failure("platform is too short", 0, true, voidCaptured);
    }
    const actionTime = runtimeRotation * cycleSeconds;
    previousRotation = runtimeRotation;

    if (step.action === "mark") {
      if (step.x === undefined || step.z === undefined)
        return failure("mark without position");
      if (
        !isPositionOnPlatform(
          { x: step.x, z: step.z },
          puzzle.width,
          currentPlatformRows
        )
      )
        return failure("MARK is outside the platform");
      const distance = Math.hypot(step.x - player.x, step.z - player.z);
      const movementSeconds =
        Math.max(0, actionTime - lastActionTime) +
        config.settleSeconds +
        (lastActionWasCapture ? config.captureSeconds : 0);
      const availableDistance = movementSeconds * config.playerSpeed + 0.35;
      if (distance > availableDistance) playerReachable = false;
      player = { x: step.x, z: step.z };
      marker = { x: step.x, z: step.z };
      lastActionWasCapture = false;
    } else if (step.action === "capture") {
      if (!marker) return failure("capture without marker");
      const target = cubes.find(cube => markerCanCapture(marker, cube));
      if (!target) return failure("marker has no landed cube");
      target.captured = true;
      if (target.type === "void") voidCaptured += 1;
      else {
        requiredCaptured += 1;
        captureRotations.push(step.rotation);
      }
      if (target.type === "veil")
        regeneratedAreaAnchors += addAreaAnchor(areas, target);
      marker = null;
      lastActionWasCapture = true;
    } else if (step.action === "area") {
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
        else {
          requiredCaptured += 1;
          captureRotations.push(step.rotation);
        }
        if (target.type === "veil")
          regeneratedAreaAnchors += addAreaAnchor(areas, target);
      }
      lastActionWasCapture = true;
    } else {
      return failure("unknown solution action");
    }

    lastActionTime = actionTime;
    cubes = cubes.filter(cube => !cube.captured && !cube.falling);
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
  if (requiredFallen)
    return failure(
      "solution lets a required cube fall",
      measuredRolls,
      true,
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
    requiredCaptured,
    voidCaptured,
    measuredRolls,
    playerReachable,
    areaUses,
    consumedAreaAnchors,
    regeneratedAreaAnchors,
  };
}

function addAreaAnchor(areas: AreaMark[], cube: CubeState): number {
  const next: AreaMark = {
    id: `area-${cube.id}`,
    x: cube.x,
    z: cube.z,
    armed: true,
  };
  if (areas.some(area => area.x === next.x && area.z === next.z)) return 0;
  areas.push(next);
  return 1;
}

export function deriveDirectSolution(
  puzzle: Pick<PuzzleDescriptor, "id" | "width" | "depth" | "layout">
): SolutionStep[] {
  const targetZ = 0;
  const steps: SolutionStep[] = [];
  let sequence = 0;
  let previousRow: number | null = null;
  let rowIndex = 0;
  for (const cube of puzzle.layout
    .filter(item => item.type !== "void")
    .sort((a, b) => a.z - b.z || a.x - b.x)) {
    if (cube.z !== previousRow) rowIndex = 0;
    const rotation = cube.z - targetZ;
    const markRotation = rowIndex === 0 ? Math.max(0, rotation - 1) : rotation;
    steps.push(
      {
        rotation: markRotation,
        action: "mark",
        x: cube.x,
        z: targetZ,
        sequence: sequence++,
      },
      {
        rotation,
        action: "capture",
        x: cube.x,
        z: targetZ,
        sequence: sequence++,
      }
    );
    previousRow = cube.z;
    rowIndex += 1;
  }
  return steps;
}

function compareSteps(a: SolutionStep, b: SolutionStep): number {
  return (
    a.rotation - b.rotation ||
    (a.sequence !== undefined && b.sequence !== undefined
      ? a.sequence - b.sequence
      : ACTION_PRIORITY[a.action] - ACTION_PRIORITY[b.action])
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
