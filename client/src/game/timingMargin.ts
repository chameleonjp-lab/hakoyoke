import { GRID_STEP_TICKS } from "./gridMovement";
import { DIFFICULTIES, type Difficulty, type PuzzleDescriptor } from "./types";

/** The runtime advances the game at this fixed rate, independent of rendering. */
export const FIXED_TICK_HZ = 30;

/**
 * Margin reserved for an input that arrives between two fixed updates. This
 * is a test budget, not a claim about every device's measured latency.
 */
export const INPUT_LAG_BUDGET_TICKS = 2;

/** Human-readability targets used to flag a schedule that is technically
 * solvable but leaves no decision time after the route is reached. */
export const HUMAN_MARGIN_TARGET_TICKS: Record<Difficulty, number> = {
  BEGINNER: 6,
  EASY: 6,
  NORMAL: 4,
  HARD: 2,
  EXTREME: 2,
};

export interface TimingWindow {
  action: "mark" | "capture" | "area";
  sequence: number;
  rotation: number;
  distanceCells: number;
  requiredTicks: number;
  availableTicks: number;
  marginTicks: number;
  marginAfterInputBudgetTicks: number;
}

export interface TimingMarginReport {
  puzzleId: string;
  difficulty: Difficulty;
  width: number;
  depth: number;
  requiredRolls: number;
  travelLeadTicks: number;
  settleTicks: number;
  capturePauseTicks: number;
  minimumMarginTicks: number;
  minimumMarginAfterInputBudgetTicks: number;
  maximumDistanceCells: number;
  targetTicks: number;
  meetsTarget: boolean;
  windows: TimingWindow[];
}

const ACTION_ORDER: Record<TimingWindow["action"], number> = {
  mark: 0,
  capture: 1,
  area: 2,
};

function ticksForSeconds(seconds: number): number {
  return Math.ceil(seconds * FIXED_TICK_HZ);
}

function compareSteps(
  left: PuzzleDescriptor["solution"][number],
  right: PuzzleDescriptor["solution"][number]
): number {
  return (
    left.rotation - right.rotation ||
    (left.sequence ?? Number.MAX_SAFE_INTEGER) -
      (right.sequence ?? Number.MAX_SAFE_INTEGER) ||
    ACTION_ORDER[left.action] - ACTION_ORDER[right.action] ||
    (left.x ?? -1) - (right.x ?? -1) ||
    (left.z ?? -1) - (right.z ?? -1)
  );
}

function distanceBetween(
  from: { x: number; z: number },
  to: { x: number; z: number }
): number {
  return Math.abs(to.x - from.x) + Math.abs(to.z - from.z);
}

/**
 * Estimate the time available for every authored action under the actual
 * grid rules. Movement is cardinal and one cell consumes GRID_STEP_TICKS;
 * movement remains enabled during capture pause and settled windows, while a
 * rolling cube blocks movement. The result intentionally exposes each window
 * so level authors can fix the first tight action instead of tuning blindly.
 */
export function measureTimingMargin(
  puzzle: PuzzleDescriptor,
  difficulty: Difficulty
): TimingMarginReport {
  const config = DIFFICULTIES[difficulty];
  const settleTicks = ticksForSeconds(config.settleSeconds);
  const capturePauseTicks = ticksForSeconds(config.captureSeconds);
  const travelLeadTicks = Math.max(0, puzzle.width - 4) * GRID_STEP_TICKS;
  const targetTicks = HUMAN_MARGIN_TARGET_TICKS[difficulty];
  const steps = [...puzzle.solution].sort(compareSteps);
  const windows: TimingWindow[] = [];
  let previousRotation = -1;
  let previousPosition = {
    x: Math.floor(puzzle.width / 2),
    z: 0,
  };
  let previousAction: TimingWindow["action"] | null = null;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const position =
      step.x === undefined || step.z === undefined
        ? previousPosition
        : { x: step.x, z: step.z };
    const distanceCells = distanceBetween(previousPosition, position);
    // A settled action is evaluated before the next roll. Even when two
    // actions share the same rotation number, the previous capture/AREA pause
    // is followed by one fresh settled window before that roll starts.
    const rotationGap = Math.max(0, step.rotation - previousRotation);
    const rotationWindows = Math.max(1, rotationGap);
    const pauseTicks =
      previousAction === "capture" || previousAction === "area"
        ? capturePauseTicks
        : 0;
    const availableTicks =
      pauseTicks + rotationWindows * (settleTicks + travelLeadTicks);
    const requiredTicks = distanceCells * GRID_STEP_TICKS;
    windows.push({
      action: step.action,
      sequence: step.sequence ?? index,
      rotation: step.rotation,
      distanceCells,
      requiredTicks,
      availableTicks,
      marginTicks: availableTicks - requiredTicks,
      marginAfterInputBudgetTicks:
        availableTicks - requiredTicks - INPUT_LAG_BUDGET_TICKS,
    });
    previousPosition = position;
    previousRotation = step.rotation;
    previousAction = step.action;
  }

  const minimumMarginTicks = windows.length
    ? Math.min(...windows.map(window => window.marginTicks))
    : 0;
  const minimumMarginAfterInputBudgetTicks = windows.length
    ? Math.min(...windows.map(window => window.marginAfterInputBudgetTicks))
    : 0;
  const maximumDistanceCells = windows.length
    ? Math.max(...windows.map(window => window.distanceCells))
    : 0;

  return {
    puzzleId: puzzle.id,
    difficulty,
    width: puzzle.width,
    depth: puzzle.depth,
    requiredRolls: puzzle.requiredRolls,
    travelLeadTicks,
    settleTicks,
    capturePauseTicks,
    minimumMarginTicks,
    minimumMarginAfterInputBudgetTicks,
    maximumDistanceCells,
    targetTicks,
    meetsTarget: minimumMarginAfterInputBudgetTicks >= targetTicks,
    windows,
  };
}

export function measureArchiveTimingMargins(
  puzzles: PuzzleDescriptor[],
  difficulties: readonly Difficulty[] = [
    "BEGINNER",
    "EASY",
    "NORMAL",
    "HARD",
    "EXTREME",
  ]
): TimingMarginReport[] {
  return puzzles.flatMap(puzzle =>
    difficulties.map(difficulty => measureTimingMargin(puzzle, difficulty))
  );
}
