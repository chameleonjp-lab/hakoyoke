import { describe, expect, it } from "vitest";
import { GameWorld, type CubicCommand } from "./GameWorld";
import { generatePuzzles } from "./puzzles";
import type { GameSnapshot, PuzzleDescriptor, SolutionStep } from "./types";

type BrowserTarget = EventTarget & {
  location: { search: string };
  hidden: boolean;
};

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function installBrowserStubs(): BrowserTarget {
  const windowStub = Object.assign(new EventTarget(), {
    location: { search: "" },
  }) as BrowserTarget;
  const documentStub = Object.assign(new EventTarget(), {
    hidden: false,
  }) as BrowserTarget;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowStub,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentStub,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  return windowStub;
}

function command(windowStub: BrowserTarget, detail: CubicCommand): void {
  windowStub.dispatchEvent(new CustomEvent("cubic:command", { detail }));
}

function nearCell(snapshot: GameSnapshot, step: SolutionStep): boolean {
  return (
    step.x !== undefined &&
    step.z !== undefined &&
    Math.abs(snapshot.player.x - step.x) <= 0.12 &&
    Math.abs(snapshot.player.z - step.z) <= 0.12
  );
}

function moveToward(
  snapshot: GameSnapshot,
  target: Pick<SolutionStep, "x" | "z">
): { x: number; z: number } {
  if (target.x === undefined || target.z === undefined) return { x: 0, z: 0 };
  return {
    x:
      Math.abs(target.x - snapshot.player.x) > 0.12
        ? Math.sign(target.x - snapshot.player.x)
        : 0,
    z:
      Math.abs(target.z - snapshot.player.z) > 0.12
        ? Math.sign(target.z - snapshot.player.z)
        : 0,
  };
}

function reachesCell(
  snapshot: GameSnapshot,
  step: SolutionStep,
  movement: { x: number; z: number }
): boolean {
  if (step.x === undefined || step.z === undefined) return false;
  const length = Math.hypot(movement.x, movement.z) || 1;
  const distance = 4.45 / 30;
  const next = {
    x: snapshot.player.x + (movement.x / length) * distance,
    z: snapshot.player.z + (movement.z / length) * distance,
  };
  return Math.abs(next.x - step.x) <= 0.12 && Math.abs(next.z - step.z) <= 0.12;
}

function requiredCaptured(snapshot: GameSnapshot): number {
  return snapshot.stats.normalCaptured + snapshot.stats.veilCaptured;
}

function replay(puzzle: PuzzleDescriptor): {
  id: string;
  phase: GameSnapshot["phase"] | "NO_SNAPSHOT";
  reason: string;
  snapshot: GameSnapshot | null;
} {
  const windowStub = installBrowserStubs();
  let latest: GameSnapshot | null = null;
  const world = new GameWorld(
    generatePuzzles(),
    snapshot => {
      latest = snapshot;
    },
    () => undefined
  );
  command(windowStub, {
    type: "start",
    mode: "PRACTICE",
    difficulty: "NORMAL",
    stage: puzzle.stage,
    wave: puzzle.wave,
    ordinal: puzzle.ordinal,
  });

  let previousRolling = false;
  let completedRolls = 0;
  const tick = (moveX = 0, moveZ = 0, action?: "mark" | "area"): void => {
    command(windowStub, { type: "touch-move", x: moveX, z: moveZ });
    if (action) command(windowStub, { type: "touch-press", action });
    world.update(1 / 30);
    if (previousRolling && !latest?.isRolling) completedRolls += 1;
    previousRolling = Boolean(latest?.isRolling);
  };

  for (let index = 0; index < 160 && latest?.phase !== "PLAYING"; index += 1)
    tick();
  if (latest?.phase !== "PLAYING") {
    const result = {
      id: puzzle.id,
      phase: latest?.phase ?? "NO_SNAPSHOT",
      reason: "could not enter PLAYING",
      snapshot: latest,
    };
    world.dispose();
    return result;
  }

  const runtimeOffset =
    latest.cubes[0]!.z - (puzzle.layout[0]?.z ?? puzzle.spawnRow ?? 0);
  const steps = [...puzzle.solution].sort(
    (a, b) =>
      a.rotation - b.rotation ||
      (a.sequence ?? Number.MAX_SAFE_INTEGER) -
        (b.sequence ?? Number.MAX_SAFE_INTEGER)
  );
  const safeTarget: SolutionStep = {
    rotation: 0,
    action: "mark",
    x: Math.floor(puzzle.width / 2),
    z: 0,
  };

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex]!;
    const timing = step.timing ?? "settled";
    const progress = step.progress ?? 0;
    const targetRoll = step.rotation + runtimeOffset;
    let completed = false;

    for (let tickIndex = 0; tickIndex < 1600; tickIndex += 1) {
      const snapshot = latest!;
      const actionTargetReady =
        timing === "settled"
          ? snapshot.phase === "CAPTURE_PAUSE"
            ? completedRolls >= targetRoll
            : !snapshot.isRolling && completedRolls >= targetRoll
          : snapshot.isRolling && completedRolls === targetRoll - 1;
      const movementTarget =
        step.action === "mark"
          ? actionTargetReady
            ? step
            : safeTarget
          : step.action === "capture"
            ? (snapshot.marker ?? (actionTargetReady ? step : safeTarget))
            : (snapshot.marker ?? safeTarget);
      const canMove =
        snapshot.phase === "CAPTURE_PAUSE" ||
        !snapshot.isRolling ||
        timing === "rolling";
      const movement = canMove
        ? moveToward(snapshot, movementTarget)
        : { x: 0, z: 0 };
      const ready =
        snapshot.phase === "PLAYING" &&
        (timing === "settled"
          ? !snapshot.isRolling && completedRolls === targetRoll
          : snapshot.isRolling &&
            completedRolls === targetRoll - 1 &&
            snapshot.rollProgress >= progress) &&
        (step.action !== "mark" ||
          nearCell(snapshot, step) ||
          reachesCell(snapshot, step, movement));

      const capturedBefore = requiredCaptured(snapshot);
      const voidBefore = snapshot.stats.voidCaptured;
      const markerBefore = snapshot.marker;
      const areaCountBefore = snapshot.stats.areaMarks;
      if (ready) {
        tick(movement.x, movement.z, step.action === "area" ? "area" : "mark");
        const after = latest!;
        if (
          step.action === "capture" &&
          requiredCaptured(after) === capturedBefore &&
          after.stats.voidCaptured === voidBefore
        ) {
          world.dispose();
          return {
            id: puzzle.id,
            phase: after.phase,
            reason: `${step.rotation}/capture found no cube`,
            snapshot: after,
          };
        }
        if (step.action === "mark" && markerBefore === after.marker) {
          world.dispose();
          return {
            id: puzzle.id,
            phase: after.phase,
            reason: `${step.rotation}/mark did not set marker`,
            snapshot: after,
          };
        }
        if (
          step.action === "area" &&
          areaCountBefore === after.stats.areaMarks &&
          requiredCaptured(after) === capturedBefore &&
          after.stats.voidCaptured === voidBefore
        ) {
          world.dispose();
          return {
            id: puzzle.id,
            phase: after.phase,
            reason: `${step.rotation}/area found no target`,
            snapshot: after,
          };
        }
        completed = true;
        break;
      }
      tick(movement.x, movement.z);
      if (["GAME_OVER", "CRUSHED", "PUZZLE_RESULT"].includes(latest!.phase))
        break;
    }
    if (!completed) {
      const result = {
        id: puzzle.id,
        phase: latest?.phase ?? "NO_SNAPSHOT",
        reason: `${step.rotation}/${step.action} could not be executed`,
        snapshot: latest,
      };
      world.dispose();
      return result;
    }
  }

  const unresolvedXs = new Set(
    latest!.cubes
      .filter(cube => !cube.captured && !cube.falling)
      .map(cube => cube.x)
  );
  const drainTarget: SolutionStep = {
    rotation: 0,
    action: "mark",
    x:
      [...Array(puzzle.width).keys()]
        .filter(x => !unresolvedXs.has(x))
        .sort(
          (a, b) =>
            Math.abs(a - latest!.player.x) - Math.abs(b - latest!.player.x)
        )[0] ?? Math.floor(puzzle.width / 2),
    z: 0,
  };
  for (let tickIndex = 0; tickIndex < 1600; tickIndex += 1) {
    if (latest!.phase === "PUZZLE_RESULT") break;
    if (latest!.phase === "GAME_OVER" || latest!.phase === "CRUSHED") break;
    const movement =
      latest!.phase === "CAPTURE_PAUSE" || !latest!.isRolling
        ? moveToward(latest!, drainTarget)
        : { x: 0, z: 0 };
    tick(movement.x, movement.z);
  }

  const snapshot = latest;
  const result = {
    id: puzzle.id,
    phase: snapshot?.phase ?? "NO_SNAPSHOT",
    reason:
      snapshot?.phase === "PUZZLE_RESULT" &&
      snapshot.stats.voidCaptured === 0 &&
      snapshot.stats.misses === 0 &&
      requiredCaptured(snapshot) ===
        puzzle.layout.filter(cube => cube.type !== "void").length &&
      snapshot.cubes.every(cube => cube.captured || cube.falling)
        ? "ok"
        : "final state did not meet puzzle invariants",
    snapshot,
  };
  world.dispose();
  return result;
}

describe("direct GameWorld solution replay", () => {
  it("replays every generated puzzle through the actual 30Hz GameWorld", () => {
    const results = generatePuzzles().map(replay);
    const failures = results.filter(result => result.reason !== "ok");
    expect(
      failures.map(({ id, phase, reason }) => ({ id, phase, reason }))
    ).toEqual([]);
  });
});
