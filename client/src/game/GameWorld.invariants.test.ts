import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameWorld } from "./GameWorld";
import {
  initialStats,
  type CubeState,
  type GameMode,
  type GamePhase,
  type PuzzleDescriptor,
  type RunStats,
} from "./types";

type Listener = (event: { type: string; detail?: unknown }) => void;

class TestEventTarget {
  readonly location = { search: "" };
  hidden = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    const bucket = this.listeners.get(type) ?? new Set<Listener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string; detail?: unknown }): boolean {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
    return true;
  }
}

class TestStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  clear(): void {
    this.values.clear();
  }
}

type WorldInternals = {
  phase: GamePhase;
  mode: GameMode;
  pausedFromPhase: GamePhase | null;
  currentPuzzle: PuzzleDescriptor;
  puzzleIndex: number;
  cubes: CubeState[];
  stats: RunStats;
  finishRotation: () => void;
  advanceAfterResult: () => void;
};

const puzzle = (): PuzzleDescriptor => ({
  id: "TEST-PUZZLE",
  stage: 1,
  wave: 1,
  ordinal: 1,
  width: 4,
  depth: 2,
  spawnRow: 0,
  requiredRolls: 0,
  difficultyTag: "test",
  seed: 1,
  layout: [{ x: 1, z: 0, type: "normal" }],
  solution: [],
  validation: {
    valid: true,
    normal: 1,
    veil: 0,
    void: 0,
    travelBudget: 4,
  },
  featured: false,
});

const windowStub = new TestEventTarget();
const documentStub = new TestEventTarget();
const storage = new TestStorage();

function installBrowserStubs(): void {
  documentStub.hidden = false;
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
    value: storage,
  });
}

function command(detail: unknown): void {
  windowStub.dispatchEvent({ type: "cubic:command", detail });
}

function internals(world: GameWorld): WorldInternals {
  return world as unknown as WorldInternals;
}

describe("GameWorld state invariants", () => {
  beforeEach(() => {
    storage.clear();
    installBrowserStubs();
  });

  afterEach(() => {
    storage.clear();
  });

  it("restores the exact pausable phase instead of skipping to PLAYING", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined,
    );
    const state = internals(world);

    command({
      type: "start",
      mode: "CAMPAIGN",
      difficulty: "NORMAL",
      stage: 1,
      wave: 1,
      ordinal: 1,
    });
    expect(state.phase).toBe("STAGE_INTRO");

    command({ type: "pause" });
    expect(state.phase).toBe("PAUSED");
    expect(state.pausedFromPhase).toBe("STAGE_INTRO");

    command({ type: "resume" });
    expect(state.phase).toBe("STAGE_INTRO");
    world.dispose();
  });

  it("does not pause or resume terminal phases", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined,
    );
    const state = internals(world);

    state.phase = "GAME_OVER";
    command({ type: "pause" });
    expect(state.phase).toBe("GAME_OVER");
    command({ type: "resume" });
    expect(state.phase).toBe("GAME_OVER");

    state.phase = "FINAL_RESULT";
    command({ type: "pause" });
    expect(state.phase).toBe("FINAL_RESULT");
    command({ type: "resume" });
    expect(state.phase).toBe("FINAL_RESULT");
    world.dispose();
  });

  it("does not turn a terminal loss into a successful result during rotation cleanup", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined,
    );
    const state = internals(world);
    state.mode = "CAMPAIGN";
    state.phase = "PLAYING";
    state.stats = {
      ...initialStats(4),
      platformRows: state.currentPuzzle.depth + 2,
      misses: initialStats(4).missLimit,
    };
    state.cubes = [
      {
        id: "falling",
        type: "normal",
        x: 1,
        z: 0,
        previousZ: 0,
      },
    ];

    state.finishRotation();

    expect(state.phase).toBe("GAME_OVER");
    world.dispose();
  });

  it("persists FINAL_RESULT after the final bonus and makes it idempotent", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined,
    );
    const state = internals(world);
    state.mode = "CAMPAIGN";
    state.phase = "PUZZLE_RESULT";
    state.puzzleIndex = 0;
    state.stats = {
      ...initialStats(4),
      platformRows: 12,
      requiredRolls: 0,
    };

    state.advanceAfterResult();

    expect(state.phase).toBe("FINAL_RESULT");
    expect(state.stats.score).toBe(12000);
    const saved = JSON.parse(
      storage.getItem("cubic-ordeal-campaign-v1") ?? "{}",
    );
    expect(saved.version).toBe(4);
    expect(saved.snapshot.phase).toBe("FINAL_RESULT");
    expect(saved.snapshot.puzzleId).toBe("TEST-PUZZLE");

    state.advanceAfterResult();
    expect(state.stats.score).toBe(12000);
    world.dispose();

    const restoredWorld = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined,
    );
    const restoredState = internals(restoredWorld);
    command({
      type: "start",
      mode: "CAMPAIGN",
      difficulty: "NORMAL",
      stage: 1,
      wave: 1,
      ordinal: 1,
    });
    expect(restoredState.phase).toBe("FINAL_RESULT");
    restoredWorld.dispose();
  });
});
