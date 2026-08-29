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
  markerTarget,
  markerProtectsRollSweep,
} from "./rules";
import { playerIntersectsRollSweep } from "./rollPhysics";
import {
  DIFFICULTIES,
  initialStats,
  type AreaMark,
  type CubeState,
  type Difficulty,
  type PuzzleDescriptor,
  type RunStats,
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

const FIXED_STEP = 1 / 30;
const MAX_TICKS_PER_STEP = 1600;

type ReplayPhase =
  | "PLAYING"
  | "CAPTURE_PAUSE"
  | "PUZZLE_RESULT"
  | "CRUSHED"
  | "GAME_OVER";

interface ReplayState {
  puzzle: PuzzleDescriptor;
  difficulty: Difficulty;
  cubes: CubeState[];
  areas: AreaMark[];
  marker: { x: number; z: number } | null;
  player: { x: number; z: number; heading: number };
  stats: RunStats;
  phase: ReplayPhase;
  phaseTimer: number;
  rollElapsed: number;
  settleElapsed: number;
  isRolling: boolean;
  completedRolls: number;
  hasScoringStarted: boolean;
  playerReachable: boolean;
  requiredCaptured: number;
  requiredFallen: number;
  areaUses: number;
  consumedAreaAnchors: number;
  regeneratedAreaAnchors: number;
  captureRotations: number[];
}

export function simulatePuzzleSolution(
  puzzle: PuzzleDescriptor,
  options: SolutionSimulationOptions = {}
): SolutionSimulationResult {
  const platformRows =
    options.platformRows ?? platformRowsForStage(puzzle.stage, puzzle.depth);
  const sourceStart = puzzleSourceStart(puzzle);
  const runtimeStart = platformRows - puzzle.depth;
  const rotationOffset = runtimeStart - sourceStart;
  const state = createReplayState(
    puzzle,
    platformRows,
    options.difficulty ?? "NORMAL"
  );
  const steps = [...puzzle.solution].sort(compareSteps);

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex]!;
    const timing = step.timing ?? "settled";
    const progress = step.progress ?? 0;
    const targetRoll = step.rotation + rotationOffset;
    if (
      !Number.isInteger(step.rotation) ||
      step.rotation < 0 ||
      !Number.isInteger(targetRoll) ||
      targetRoll < 0 ||
      !Number.isFinite(progress) ||
      progress < 0 ||
      progress > 1
    )
      return replayFailure(state, "invalid rotation or timing");

    const safeTarget = {
      x: Math.floor(puzzle.width / 2),
      z: 0,
    };
    let completed = false;
    for (let tick = 0; tick < MAX_TICKS_PER_STEP; tick += 1) {
      const actionTargetReady =
        timing === "settled"
          ? state.phase === "CAPTURE_PAUSE"
            ? state.completedRolls >= targetRoll
            : !state.isRolling && state.completedRolls >= targetRoll
          : state.isRolling && state.completedRolls === targetRoll - 1;
      const movementTarget =
        step.action === "mark"
          ? actionTargetReady
            ? step
            : safeTarget
          : step.action === "capture"
            ? (state.marker ?? (actionTargetReady ? step : safeTarget))
            : (state.marker ?? safeTarget);
      const canMove =
        state.phase === "CAPTURE_PAUSE" ||
        !state.isRolling ||
        timing === "rolling";
      const movement =
        movementTarget && canMove
          ? moveToward(state.player, movementTarget)
          : { x: 0, z: 0 };
      const ready =
        state.phase === "PLAYING" &&
        (timing === "settled"
          ? !state.isRolling && state.completedRolls === targetRoll
          : state.isRolling &&
            state.completedRolls === targetRoll - 1 &&
            rollProgress(state) >= progress) &&
        (step.action !== "mark" ||
          nearCell(state.player, step) ||
          reachesCell(state.player, step, movement, state.difficulty));

      const capturedBeforeTick = state.requiredCaptured;
      const voidCapturedBeforeTick = state.stats.voidCaptured;
      const markerBeforeTick = state.marker;
      tickReplay(
        state,
        movement.x,
        movement.z,
        ready ? step.action : undefined
      );
      if (
        ready &&
        (step.action === "capture" || step.action === "area") &&
        state.requiredCaptured > capturedBeforeTick
      )
        state.captureRotations.push(step.rotation);
      if (ready) {
        if (
          step.action === "capture" &&
          state.requiredCaptured === capturedBeforeTick &&
          state.stats.voidCaptured === voidCapturedBeforeTick
        )
          return replayFailure(
            state,
            `step ${step.rotation}/capture found no cube`
          );
        if (
          step.action === "area" &&
          state.requiredCaptured === capturedBeforeTick &&
          state.stats.voidCaptured === voidCapturedBeforeTick
        )
          return replayFailure(
            state,
            `step ${step.rotation}/area found no target`
          );
        if (step.action === "mark" && markerBeforeTick === state.marker)
          return replayFailure(
            state,
            `step ${step.rotation}/mark did not set marker`
          );
        completed = true;
        break;
      }
      if (state.phase === "GAME_OVER" || state.phase === "CRUSHED") break;
    }
    if (!completed)
      return replayFailure(
        state,
        `step ${step.rotation}/${step.action} could not be executed`
      );
  }

  const unresolvedXs = new Set(
    state.cubes
      .filter(cube => !cube.captured && !cube.falling)
      .map(cube => cube.x)
  );
  const drainTarget = {
    x:
      Array.from({ length: puzzle.width }, (_, x) => x)
        .filter(x => !unresolvedXs.has(x))
        .sort(
          (a, b) => Math.abs(a - state.player.x) - Math.abs(b - state.player.x)
        )[0] ?? Math.floor(puzzle.width / 2),
    z: 0,
  };
  for (let tick = 0; tick < MAX_TICKS_PER_STEP; tick += 1) {
    if (state.phase === "PUZZLE_RESULT") break;
    if (state.phase === "GAME_OVER" || state.phase === "CRUSHED") break;
    const canMove = state.phase === "CAPTURE_PAUSE" || !state.isRolling;
    const movement = canMove
      ? moveToward(state.player, drainTarget)
      : { x: 0, z: 0 };
    tickReplay(state, movement.x, movement.z);
  }

  const remaining = state.cubes.filter(
    cube => cube.type !== "void" && !cube.captured && !cube.falling
  ).length;
  const measuredRolls = measureCaptureRolls(state.captureRotations);
  if (state.phase !== "PUZZLE_RESULT")
    return replayFailure(state, "solution did not resolve all VOID cubes");
  if (!state.playerReachable)
    return replayFailure(state, "player cannot reach a scheduled MARK");
  if (state.requiredFallen)
    return replayFailure(state, "solution lets a required cube fall");
  if (state.stats.voidCaptured)
    return replayFailure(state, "solution captures VOID");
  if (remaining) return replayFailure(state, "solution leaves required cubes");
  if (measuredRolls !== puzzle.requiredRolls)
    return replayFailure(state, "requiredRolls differs from replay");
  return {
    valid: true,
    reason: "ok",
    requiredCaptured: state.requiredCaptured,
    voidCaptured: state.stats.voidCaptured,
    measuredRolls,
    playerReachable: state.playerReachable,
    areaUses: state.areaUses,
    consumedAreaAnchors: state.consumedAreaAnchors,
    regeneratedAreaAnchors: state.regeneratedAreaAnchors,
  };
}

function createReplayState(
  puzzle: PuzzleDescriptor,
  platformRows: number,
  difficulty: Difficulty
): ReplayState {
  const stats = initialStats(puzzle.width);
  stats.platformRows = platformRows;
  stats.requiredRolls = puzzle.requiredRolls;
  return {
    puzzle,
    difficulty,
    cubes: createRuntimePuzzleCubes(puzzle, platformRows).map(cube => ({
      ...cube,
      captured: false,
      falling: false,
    })),
    areas: [],
    marker: null,
    player: {
      x: Math.min(puzzle.width - 0.5, Math.max(0.5, puzzle.width / 2)),
      z: 0.7,
      heading: 0,
    },
    stats,
    phase: "PLAYING",
    phaseTimer: 0,
    rollElapsed: 0,
    settleElapsed: 0,
    isRolling: false,
    completedRolls: 0,
    hasScoringStarted: false,
    playerReachable: true,
    requiredCaptured: 0,
    requiredFallen: 0,
    areaUses: 0,
    consumedAreaAnchors: 0,
    regeneratedAreaAnchors: 0,
    captureRotations: [],
  };
}

function tickReplay(
  state: ReplayState,
  moveX: number,
  moveZ: number,
  action?: SolutionStep["action"]
): void {
  const wasRolling = state.isRolling;
  if (state.phase === "CAPTURE_PAUSE") {
    if (!movePlayer(state, moveX, moveZ)) return;
    state.phaseTimer -= FIXED_STEP;
    if (state.phaseTimer <= 0) state.phase = "PLAYING";
    return;
  }
  if (state.phase !== "PLAYING") return;
  if (!movePlayer(state, moveX, moveZ)) return;
  if (action === "mark" || action === "capture") markOrCapture(state);
  if (action === "area") activateAreas(state);
  if (state.phase === "PLAYING") updateRoll(state);
  if (wasRolling && !state.isRolling) state.completedRolls += 1;
}

function movePlayer(state: ReplayState, moveX: number, moveZ: number): boolean {
  if (!moveX && !moveZ) return true;
  const config = DIFFICULTIES[state.difficulty];
  const length = Math.hypot(moveX, moveZ) || 1;
  state.player.x += (moveX / length) * config.playerSpeed * FIXED_STEP;
  state.player.z += (moveZ / length) * config.playerSpeed * FIXED_STEP;
  state.player.heading = Math.atan2(moveX, moveZ);
  if (
    !isPositionOnPlatform(
      state.player,
      state.puzzle.width,
      state.stats.platformRows
    )
  ) {
    state.playerReachable = false;
    state.phase = "GAME_OVER";
    return false;
  }
  return true;
}

function updateRoll(state: ReplayState): void {
  const config = DIFFICULTIES[state.difficulty];
  if (!state.isRolling) {
    state.settleElapsed += FIXED_STEP;
    if (state.settleElapsed >= config.settleSeconds) {
      state.isRolling = true;
      state.rollElapsed = 0;
      state.settleElapsed = 0;
      if (state.hasScoringStarted) state.stats.rotations += 1;
    }
    return;
  }

  const previousProgress = rollProgress(state);
  state.rollElapsed += FIXED_STEP;
  const progress = rollProgress(state);
  checkRollCollision(state, previousProgress, progress);
  if (state.rollElapsed >= config.rollSeconds) {
    finishRotation(state);
    state.isRolling = false;
    state.rollElapsed = 0;
  }
}

function checkRollCollision(
  state: ReplayState,
  previousProgress: number,
  progress: number
): void {
  const crushing = state.cubes.some(
    cube =>
      !cube.captured &&
      !cube.falling &&
      !markerProtectsRollSweep(
        state.marker,
        cube,
        previousProgress,
        progress,
        state.isRolling
      ) &&
      playerIntersectsRollSweep(cube, state.player, previousProgress, progress)
  );
  if (crushing) crush(state);
}

function finishRotation(state: ReplayState): void {
  for (const cube of state.cubes) {
    if (cube.captured || cube.falling) continue;
    Object.assign(cube, advanceOneCell(cube));
    if (cube.z < 0) {
      handleFalling(state, cube);
      if (state.phase === "GAME_OVER") break;
    }
  }
  state.cubes = state.cubes.filter(cube => !cube.falling && !cube.captured);
  if (state.phase === "GAME_OVER") return;
  resolveIfEmpty(state);
}

function handleFalling(state: ReplayState, cube: CubeState): void {
  cube.falling = true;
  if (cube.type === "void") return;
  state.requiredFallen += 1;
  state.stats.misses += 1;
  state.stats.perfect = false;
  if (state.stats.misses > state.stats.missLimit) losePlatformRow(state, true);
}

function markOrCapture(state: ReplayState): void {
  if (!state.marker) {
    state.marker = {
      x: Math.round(state.player.x),
      z: Math.round(state.player.z),
    };
    return;
  }
  const target = markerTarget(
    state.cubes,
    state.marker,
    rollProgress(state),
    state.isRolling
  );
  if (!target) {
    state.marker = null;
    return;
  }
  captureCube(state, target, false);
  state.marker = null;
}

function captureCube(
  state: ReplayState,
  cube: CubeState,
  batch: boolean
): void {
  cube.captured = true;
  if (cube.type === "void") {
    state.stats.voidCaptured += 1;
    state.stats.perfect = false;
    losePlatformRow(state, false);
    return;
  }
  if (!state.hasScoringStarted) {
    state.hasScoringStarted = true;
    state.stats.rotations = 0;
  }
  state.stats.score += batch ? 200 : 100;
  if (cube.type === "normal") state.stats.normalCaptured += 1;
  if (cube.type === "veil") {
    state.stats.veilCaptured += 1;
    state.regeneratedAreaAnchors += addAreaAnchor(state.areas, cube);
  }
  state.requiredCaptured += 1;
  if (batch) return;
  state.phase = "CAPTURE_PAUSE";
  state.phaseTimer = DIFFICULTIES[state.difficulty].captureSeconds;
  resolveIfEmpty(state);
}

function activateAreas(state: ReplayState): void {
  if (!state.areas.length) return;
  const activeAreas = state.areas.map(area => ({ ...area }));
  state.areas = [];
  state.consumedAreaAnchors += activeAreas.length;
  state.areaUses += 1;
  const targets = areaTargets(
    state.cubes,
    activeAreas,
    state.marker,
    rollProgress(state),
    state.isRolling
  );
  if (!targets.length) return;
  for (const target of targets) captureCube(state, target, true);
  if (state.phase === "GAME_OVER") return;
  state.phase = "CAPTURE_PAUSE";
  state.phaseTimer = DIFFICULTIES[state.difficulty].captureSeconds;
  resolveIfEmpty(state);
}

function losePlatformRow(state: ReplayState, preserveMisses: boolean): boolean {
  state.stats.platformRows -= 1;
  if (!preserveMisses) state.stats.misses = 0;
  if (
    state.player.z >= state.stats.platformRows ||
    state.stats.platformRows < state.puzzle.depth + 2
  ) {
    state.phase = "GAME_OVER";
    return true;
  }
  return false;
}

function crush(state: ReplayState): void {
  if (state.phase !== "PLAYING") return;
  const escaped = state.cubes.filter(
    cube => !cube.captured && !cube.falling
  ).length;
  state.cubes.forEach(cube => {
    if (!cube.captured) cube.falling = true;
  });
  const combinedMisses = state.stats.misses + escaped;
  const threshold = state.stats.missLimit + 1;
  const rowsLost = Math.floor(combinedMisses / threshold);
  state.stats.misses = combinedMisses % threshold;
  state.stats.perfect = false;
  for (let index = 0; index < rowsLost; index += 1) {
    if (losePlatformRow(state, true)) return;
  }
  state.phase = "CRUSHED";
  state.phaseTimer = 1.8;
}

function resolveIfEmpty(state: ReplayState): void {
  if (state.phase === "GAME_OVER") return;
  if (
    state.cubes.some(
      cube => !cube.captured && !cube.falling && cube.type !== "void"
    )
  )
    return;
  if (
    state.cubes.some(
      cube => !cube.captured && !cube.falling && cube.type === "void"
    )
  )
    return;
  state.phase = "PUZZLE_RESULT";
}

function addAreaAnchor(areas: AreaMark[], cube: CubeState): number {
  const area: AreaMark = {
    id: `area-${cube.id}`,
    x: cube.x,
    z: cube.z,
    armed: true,
  };
  if (areas.some(existing => existing.x === area.x && existing.z === area.z))
    return 0;
  areas.push(area);
  return 1;
}

function moveToward(
  player: { x: number; z: number },
  step: Pick<SolutionStep, "x" | "z">
): { x: number; z: number } {
  if (step.x === undefined || step.z === undefined) return { x: 0, z: 0 };
  return {
    x: Math.abs(step.x - player.x) > 0.12 ? Math.sign(step.x - player.x) : 0,
    z: Math.abs(step.z - player.z) > 0.12 ? Math.sign(step.z - player.z) : 0,
  };
}

function nearCell(
  player: { x: number; z: number },
  step: Pick<SolutionStep, "x" | "z">
): boolean {
  return (
    step.x !== undefined &&
    step.z !== undefined &&
    Math.abs(player.x - step.x) <= 0.12 &&
    Math.abs(player.z - step.z) <= 0.12
  );
}

function reachesCell(
  player: { x: number; z: number },
  step: Pick<SolutionStep, "x" | "z">,
  movement: { x: number; z: number },
  difficulty: Difficulty
): boolean {
  if (step.x === undefined || step.z === undefined) return false;
  const length = Math.hypot(movement.x, movement.z) || 1;
  const distance = DIFFICULTIES[difficulty].playerSpeed * FIXED_STEP;
  const next = {
    x: player.x + (movement.x / length) * distance,
    z: player.z + (movement.z / length) * distance,
  };
  return Math.abs(next.x - step.x) <= 0.12 && Math.abs(next.z - step.z) <= 0.12;
}

function rollProgress(state: ReplayState): number {
  return state.isRolling
    ? Math.min(
        1,
        state.rollElapsed / DIFFICULTIES[state.difficulty].rollSeconds
      )
    : 0;
}

function measureCaptureRolls(rotations: number[]): number {
  return rotations.length < 2
    ? 0
    : Math.max(...rotations) - Math.min(...rotations);
}

function replayFailure(
  state: ReplayState,
  reason: string
): SolutionSimulationResult {
  return failure(
    reason,
    measureCaptureRolls(state.captureRotations),
    state.playerReachable,
    state.stats.voidCaptured,
    state.areaUses,
    state.consumedAreaAnchors,
    state.regeneratedAreaAnchors,
    state.requiredCaptured
  );
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
        timing: "settled",
        sequence: sequence++,
      },
      {
        rotation,
        action: "capture",
        x: cube.x,
        z: targetZ,
        timing: "settled",
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
    (a.sequence ?? Number.MAX_SAFE_INTEGER) -
      (b.sequence ?? Number.MAX_SAFE_INTEGER) ||
    ACTION_PRIORITY[a.action] - ACTION_PRIORITY[b.action] ||
    (a.x ?? -1) - (b.x ?? -1) ||
    (a.z ?? -1) - (b.z ?? -1)
  );
}

function failure(
  reason: string,
  measuredRolls = 0,
  playerReachable = true,
  voidCaptured = 0,
  areaUses = 0,
  consumedAreaAnchors = 0,
  regeneratedAreaAnchors = 0,
  requiredCaptured = 0
): SolutionSimulationResult {
  return {
    valid: false,
    reason,
    requiredCaptured,
    voidCaptured,
    measuredRolls,
    playerReachable,
    areaUses,
    consumedAreaAnchors,
    regeneratedAreaAnchors,
  };
}
