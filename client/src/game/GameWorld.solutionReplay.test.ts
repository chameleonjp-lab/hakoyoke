import { describe, expect, it } from "vitest";
import { GameWorld, type CubicCommand } from "./GameWorld";
import { generatePuzzles } from "./puzzles";
import type { Difficulty, GameSnapshot, PuzzleDescriptor } from "./types";

const replayDifficulties: Difficulty[] = [
  "BEGINNER",
  "EASY",
  "NORMAL",
  "HARD",
  "EXTREME",
];

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

/**
 * Grid-input replay used as the publish gate. It intentionally drives the
 * runtime with the same one-cell commands a player has (no coordinate writes)
 * and chooses a safe front lane before each automatic roll.
 */
function replayGrid(
  puzzle: PuzzleDescriptor,
  difficulty: Difficulty,
  options: { actionDelayTicks?: number } = {}
): {
  id: string;
  difficulty: Difficulty;
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
    difficulty,
    stage: puzzle.stage,
    wave: puzzle.wave,
    ordinal: puzzle.ordinal,
  });

  const tick = (
    x = 0,
    z = 0,
    action?: "mark" | "area" | "clear"
  ): GameSnapshot => {
    command(windowStub, { type: "touch-move", x, z });
    if (action) command(windowStub, { type: "touch-press", action });
    world.update(1 / 30);
    return latest!;
  };

  for (let index = 0; index < 180 && latest?.phase !== "PLAYING"; index += 1)
    tick();
  if (latest?.phase !== "PLAYING") {
    const result = {
      id: puzzle.id,
      difficulty,
      phase: latest?.phase ?? "NO_SNAPSHOT",
      reason: "could not enter PLAYING",
      snapshot: latest,
    };
    world.dispose();
    return result;
  }

  const steps = [...puzzle.solution].sort(
    (a, b) =>
      a.rotation - b.rotation ||
      (a.sequence ?? Number.MAX_SAFE_INTEGER) -
        (b.sequence ?? Number.MAX_SAFE_INTEGER)
  );
  const runtimeOffset =
    latest.cubes[0]!.z - (puzzle.layout[0]?.z ?? puzzle.spawnRow ?? 0);
  let actionIndex = 0;
  const actionDelayTicks = Math.max(0, options.actionDelayTicks ?? 0);
  const actionReadyAt = new Map<number, number>();
  let completedRolls = 0;
  let previousRolling = Boolean(latest.isRolling);
  const driveTick = (
    x = 0,
    z = 0,
    action?: "mark" | "area" | "clear"
  ): GameSnapshot => {
    const beforeRolling = previousRolling;
    const result = tick(x, z, action);
    if (beforeRolling && !result.isRolling) completedRolls += 1;
    previousRolling = Boolean(result.isRolling);
    return result;
  };

  for (let tickIndex = 0; tickIndex < 20_000; tickIndex += 1) {
    const snapshot = latest!;
    if (snapshot.phase === "PUZZLE_RESULT") break;
    if (snapshot.phase === "GAME_OVER" || snapshot.phase === "CRUSHED") break;

    const logicalCell = snapshot.playerCell ?? {
      x: Math.round(snapshot.player.x),
      z: Math.round(snapshot.player.z),
    };
    const step = steps[actionIndex];
    if (step) {
      const targetRoll = step.rotation + runtimeOffset;
      const targetX = step.x ?? logicalCell.x;
      const targetZ = step.z ?? 0;
      const atTarget = logicalCell.x === targetX && logicalCell.z === targetZ;
      if (step.action === "mark") {
        if (snapshot.marker?.x === targetX && snapshot.marker?.z === targetZ) {
          actionIndex += 1;
          continue;
        }
        if (snapshot.marker) {
          driveTick(0, 0, "clear");
          continue;
        }
        if (snapshot.playerStep?.to) {
          const reservesDestination =
            snapshot.playerStep.to.x === targetX &&
            snapshot.playerStep.to.z === targetZ;
          driveTick(0, 0, reservesDestination ? "mark" : undefined);
          continue;
        }
        if (!atTarget && !snapshot.isRolling) {
          driveTick(
            targetX < logicalCell.x ? -1 : targetX > logicalCell.x ? 1 : 0,
            0
          );
          continue;
        }
        if (atTarget && snapshot.phase === "PLAYING") {
          const before = snapshot.marker;
          const after = driveTick(0, 0, "mark");
          if (
            !after.marker ||
            after.marker.x !== targetX ||
            after.marker.z !== targetZ
          )
            break;
          actionIndex += 1;
          continue;
        }
        driveTick();
        continue;
      }

      const targetCube = snapshot.marker
        ? snapshot.cubes.find(
            cube =>
              cube.type !== "void" &&
              !cube.captured &&
              !cube.falling &&
              cube.x === snapshot.marker!.x &&
              cube.z === snapshot.marker!.z
          )
        : undefined;
      if (!snapshot.marker && !atTarget && !snapshot.isRolling) {
        driveTick(
          targetX < logicalCell.x ? -1 : targetX > logicalCell.x ? 1 : 0,
          0
        );
        continue;
      }
      const targetReady =
        (step.timing ?? "settled") === "settled"
          ? !snapshot.isRolling && completedRolls >= targetRoll
          : snapshot.isRolling &&
            completedRolls === targetRoll - 1 &&
            snapshot.rollProgress >= (step.progress ?? 0);
      const delayedTargetReady = (ready: boolean): boolean => {
        if (!ready) {
          actionReadyAt.delete(actionIndex);
          return false;
        }
        const firstReadyTick = actionReadyAt.get(actionIndex) ?? tickIndex;
        actionReadyAt.set(actionIndex, firstReadyTick);
        return tickIndex - firstReadyTick >= actionDelayTicks;
      };
      const actionReady =
        step.action === "capture" || step.action === "area"
          ? delayedTargetReady(targetReady)
          : targetReady;
      if (
        step.action === "capture" &&
        targetCube &&
        atTarget &&
        actionReady &&
        snapshot.phase === "PLAYING"
      ) {
        const before =
          snapshot.stats.normalCaptured + snapshot.stats.veilCaptured;
        const after = driveTick(0, 0, "mark");
        if (after.stats.normalCaptured + after.stats.veilCaptured > before) {
          actionIndex += 1;
          actionReadyAt.delete(actionIndex - 1);
          continue;
        }
      } else if (
        step.action === "area" &&
        actionReady &&
        snapshot.phase === "PLAYING"
      ) {
        const before =
          snapshot.stats.normalCaptured + snapshot.stats.veilCaptured;
        const after = driveTick(0, 0, "area");
        if (after.stats.normalCaptured + after.stats.veilCaptured > before) {
          actionIndex += 1;
          actionReadyAt.delete(actionIndex - 1);
          continue;
        }
      } else if (
        step.action === "area" &&
        !snapshot.marker &&
        snapshot.phase === "PLAYING" &&
        !snapshot.isRolling
      ) {
        // AREA can be primed while the player is waiting. A temporary MARK
        // protects the current lane from an incoming VOID until the area
        // discharge resolves its targets.
        driveTick(0, 0, "mark");
        continue;
      } else if (snapshot.playerStep?.to) {
        driveTick();
        continue;
      }
      driveTick();
      continue;
    }

    const occupiedFront = new Set(
      snapshot.cubes
        .filter(cube => !cube.captured && !cube.falling && cube.z <= 1)
        .map(cube => cube.x)
    );
    const safeX =
      [...Array(snapshot.boardWidth).keys()]
        .filter(x => !occupiedFront.has(x))
        .sort(
          (a, b) => Math.abs(a - logicalCell.x) - Math.abs(b - logicalCell.x)
        )[0] ?? logicalCell.x;
    if (
      !snapshot.marker &&
      snapshot.phase === "PLAYING" &&
      !snapshot.isRolling
    ) {
      driveTick(0, 0, "mark");
      continue;
    }
    if (logicalCell.x !== safeX && !snapshot.isRolling) {
      driveTick(safeX < logicalCell.x ? -1 : 1, 0);
      continue;
    }
    driveTick();
  }

  const snapshot = latest;
  const required = puzzle.layout.filter(cube => cube.type !== "void").length;
  const result = {
    id: puzzle.id,
    difficulty,
    phase: snapshot?.phase ?? "NO_SNAPSHOT",
    reason:
      snapshot?.phase === "PUZZLE_RESULT" &&
      snapshot.stats.voidCaptured === 0 &&
      snapshot.stats.misses === 0 &&
      snapshot.stats.normalCaptured + snapshot.stats.veilCaptured === required
        ? "ok"
        : "grid input replay did not meet puzzle invariants",
    snapshot,
  };
  world.dispose();
  return result;
}

describe("direct GameWorld solution replay", () => {
  it("replays all 88 puzzles at all five difficulties through 30Hz input", () => {
    const results = generatePuzzles().flatMap(puzzle =>
      replayDifficulties.map(difficulty => replayGrid(puzzle, difficulty))
    );
    const failures = results.filter(result => result.reason !== "ok");
    expect(
      failures.map(({ id, difficulty, phase, reason }) => ({
        id,
        difficulty,
        phase,
        reason,
      }))
    ).toEqual([]);
  });

  it("retains the authored route with a two fixed-tick action delay", () => {
    const results = generatePuzzles().flatMap(puzzle =>
      replayDifficulties.map(difficulty =>
        replayGrid(puzzle, difficulty, { actionDelayTicks: 2 })
      )
    );
    const failures = results.filter(result => result.reason !== "ok");
    expect(
      failures.map(({ id, difficulty, phase, reason }) => ({
        id,
        difficulty,
        phase,
        reason,
      }))
    ).toEqual([]);
  });
});
