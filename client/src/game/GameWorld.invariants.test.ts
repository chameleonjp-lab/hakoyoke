import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameWorld } from "./GameWorld";
import {
  DIFFICULTIES,
  initialStats,
  type CubeState,
  type GameMode,
  type GamePhase,
  type GameSnapshot,
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
    this.listeners.get(event.type)?.forEach(listener => listener(event));
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

  removeItem(key: string): void {
    this.values.delete(key);
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
  player: { x: number; z: number; heading: number };
  cubes: CubeState[];
  quickSave: GameSnapshot | null;
  marker: { x: number; z: number } | null;
  areas: Array<{ id: string; x: number; z: number; armed: boolean }>;
  stats: RunStats;
  isRolling: boolean;
  rollElapsed: number;
  markOrCapture: () => void;
  activateAreas: () => void;
  checkRollCollision: (previousProgress: number, progress: number) => void;
  finishRotation: () => void;
  advanceAfterResult: () => void;
};

const puzzle = (
  overrides: Partial<PuzzleDescriptor> = {}
): PuzzleDescriptor => ({
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
  ...overrides,
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
      () => undefined
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
      () => undefined
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
      () => undefined
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

  it("rejects malformed custom puzzles before entering a run", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined
    );
    const invalid = {
      ...puzzle(),
      layout: [{ x: 99, z: 0, type: "normal" as const }],
    };

    command({ type: "load-custom", puzzle: invalid });

    const state = internals(world);
    expect(state.phase).toBe("MENU");
    expect((world as unknown as { banner: string }).banner).toContain(
      "CUSTOM INVALID"
    );
    world.dispose();
  });

  it("starts a validated custom puzzle in CREATE mode", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined
    );
    const custom = {
      ...puzzle(),
      id: "CUSTOM-VALID",
      difficultyTag: "custom",
      solution: [
        { rotation: 0, action: "mark" as const, x: 1, z: 0, sequence: 0 },
        {
          rotation: 0,
          action: "capture" as const,
          x: 1,
          z: 0,
          sequence: 1,
        },
      ],
    };

    command({ type: "load-custom", puzzle: custom });

    const state = internals(world);
    expect(state.mode).toBe("CREATE");
    expect(state.phase).toBe("STAGE_INTRO");
    expect(state.currentPuzzle.id).toBe("CUSTOM-VALID");
    expect((world as unknown as { banner: string }).banner).toBe(
      "CUSTOM ORDEAL"
    );
    world.dispose();
  });

  it("keeps custom puzzles out of the campaign archive and returns CREATE to menu", () => {
    const archive = [puzzle()];
    const world = new GameWorld(
      archive,
      () => undefined,
      () => undefined
    );
    const custom = puzzle({
      id: "CUSTOM-ISOLATED",
      difficultyTag: "custom",
      solution: [
        { rotation: 0, action: "mark" as const, x: 1, z: 0, sequence: 0 },
        {
          rotation: 0,
          action: "capture" as const,
          x: 1,
          z: 0,
          sequence: 1,
        },
      ],
    });

    command({ type: "load-custom", puzzle: custom });
    const state = internals(world);
    state.phase = "PUZZLE_RESULT";
    state.advanceAfterResult();

    expect(archive).toHaveLength(1);
    expect(state.currentPuzzle.id).toBe("CUSTOM-ISOLATED");
    expect(state.puzzleIndex).toBe(-1);
    expect(state.phase).toBe("MENU");
    world.dispose();
  });

  it("uses the GameWorld rolling occupancy for direct MARK capture", () => {
    const world = new GameWorld(
      [
        puzzle({
          layout: [
            { x: 2, z: 4, type: "normal" },
            { x: 1, z: 6, type: "normal" },
          ],
          validation: {
            valid: true,
            normal: 2,
            veil: 0,
            void: 0,
            travelBudget: 8,
          },
        }),
      ],
      () => undefined,
      () => undefined
    );
    const state = internals(world);
    state.mode = "PRACTICE";
    state.phase = "PLAYING";
    state.player = { x: 2, z: 3, heading: 0 };
    state.marker = { x: 2, z: 3 };
    state.isRolling = true;
    state.rollElapsed = DIFFICULTIES.NORMAL.rollSeconds * 0.65;
    state.cubes = [
      {
        id: "rolling-target",
        type: "normal",
        x: 2,
        z: 4,
        previousZ: 4,
      },
      {
        id: "unresolved",
        type: "normal",
        x: 1,
        z: 6,
        previousZ: 6,
      },
    ];

    state.markOrCapture();

    expect(state.cubes[0]?.captured).toBe(true);
    expect(state.marker).toBeNull();
    expect(state.phase).toBe("CAPTURE_PAUSE");
    world.dispose();
  });

  it("uses the incoming cube when rolling MARK targets overlap", () => {
    const world = new GameWorld(
      [
        puzzle({
          layout: [
            { x: 2, z: 3, type: "normal" },
            { x: 2, z: 4, type: "normal" },
          ],
          validation: {
            valid: true,
            normal: 2,
            veil: 0,
            void: 0,
            travelBudget: 8,
          },
        }),
      ],
      () => undefined,
      () => undefined
    );
    const state = internals(world);
    state.mode = "PRACTICE";
    state.phase = "PLAYING";
    state.player = { x: 2, z: 3, heading: 0 };
    state.marker = { x: 2, z: 3 };
    state.isRolling = true;
    state.rollElapsed = DIFFICULTIES.NORMAL.rollSeconds * 0.65;
    state.cubes = [
      { id: "leading", type: "normal", x: 2, z: 3, previousZ: 3 },
      { id: "incoming", type: "normal", x: 2, z: 4, previousZ: 4 },
    ];

    state.markOrCapture();

    expect(state.cubes.find(cube => cube.id === "incoming")?.captured).toBe(
      true
    );
    expect(state.cubes.find(cube => cube.id === "leading")?.captured).toBe(
      undefined
    );
    world.dispose();
  });

  it("does not crush the player while MARK protects a rolling VOID lane", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined
    );
    const state = internals(world);
    state.phase = "PLAYING";
    state.isRolling = true;
    state.player = { x: 2, z: 2, heading: 0 };
    state.marker = { x: 2, z: 2 };
    state.cubes = [
      { id: "protected-void", type: "void", x: 2, z: 3, previousZ: 3 },
    ];

    state.checkRollCollision(0, 1);

    expect(state.phase).toBe("PLAYING");
    expect(state.cubes[0]?.falling).toBeUndefined();

    state.marker = null;
    state.checkRollCollision(0, 1);

    expect(state.phase).toBe("CRUSHED");
    expect(state.cubes[0]?.falling).toBe(true);
    world.dispose();
  });

  it("takes a practice quick-save from the current authoritative state", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined
    );
    const state = internals(world);
    state.mode = "PRACTICE";
    state.cubes = [
      { id: "visible", type: "normal", x: 1, z: 10, previousZ: 10 },
    ];

    command({ type: "quick-save" });

    state.cubes[0]!.z = 7;

    expect(state.quickSave?.cubes[0]?.z).toBe(10);
    world.dispose();
  });

  it("carries same-wave state and projects the next puzzle from current rows", () => {
    const first = puzzle({ id: "S1-W1-P1" });
    const second = puzzle({
      id: "S1-W1-P2",
      ordinal: 2,
      layout: [{ x: 2, z: 1, type: "normal" }],
    });
    const world = new GameWorld(
      [first, second],
      () => undefined,
      () => undefined
    );
    const state = internals(world);
    state.mode = "CAMPAIGN";
    state.currentPuzzle = first;
    state.puzzleIndex = 0;
    state.phase = "PUZZLE_RESULT";
    state.stats = {
      ...initialStats(4),
      score: 123,
      misses: 1,
      platformRows: 13,
      perfect: false,
    };
    state.areas = [{ id: "carry", x: 2, z: 2, armed: true }];

    state.advanceAfterResult();

    expect(state.currentPuzzle.id).toBe("S1-W1-P2");
    expect(state.phase).toBe("PLAYING");
    expect(state.stats.platformRows).toBe(13);
    expect(state.stats.misses).toBe(1);
    expect(state.stats.areaMarks).toBe(1);
    expect(state.areas).toEqual([{ id: "carry", x: 2, z: 2, armed: true }]);
    expect(state.cubes[0]?.z).toBe(12);
    world.dispose();
  });

  it("awards and checkpoints a stage boundary, then supports both campaign exits", () => {
    const first = puzzle({ id: "S1-W1-P1" });
    const second = puzzle({ id: "S2-W1-P1", stage: 2 });
    const world = new GameWorld(
      [first, second],
      () => undefined,
      () => undefined
    );
    const state = internals(world);
    state.mode = "CAMPAIGN";
    state.currentPuzzle = first;
    state.puzzleIndex = 0;
    state.phase = "PUZZLE_RESULT";
    state.stats = {
      ...initialStats(4),
      score: 100,
      platformRows: 13,
    };

    state.advanceAfterResult();

    expect(state.currentPuzzle.id).toBe("S2-W1-P1");
    expect(state.phase).toBe("STAGE_RESULT");
    expect(state.stats.score).toBe(13100);
    expect(state.stats.platformRows).toBe(12);
    const checkpoint = JSON.parse(
      storage.getItem("cubic-ordeal-stage-checkpoint-v1") ?? "{}"
    );
    expect(checkpoint.phase).toBe("STAGE_INTRO");
    expect(checkpoint.stage).toBe(2);

    state.phase = "GAME_OVER";
    command({ type: "campaign-continue" });
    expect(state.phase).toBe("STAGE_INTRO");
    expect(state.currentPuzzle.id).toBe("S2-W1-P1");

    state.phase = "GAME_OVER";
    command({ type: "campaign-new" });
    expect(state.phase).toBe("STAGE_INTRO");
    expect(state.currentPuzzle.id).toBe("S1-W1-P1");
    expect(state.stats.score).toBe(0);
    const freshSave = JSON.parse(
      storage.getItem("cubic-ordeal-campaign-v1") ?? "{}"
    );
    expect(freshSave.snapshot.phase).toBe("STAGE_INTRO");
    world.dispose();
  });

  it("ignores a corrupted campaign snapshot and starts a fresh run", () => {
    storage.setItem("cubic-ordeal-campaign-v1", "{broken");

    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined
    );

    command({
      type: "start",
      mode: "CAMPAIGN",
      difficulty: "NORMAL",
      stage: 1,
      wave: 1,
      ordinal: 1,
    });

    const state = internals(world);
    expect(state.mode).toBe("CAMPAIGN");
    expect(state.phase).toBe("STAGE_INTRO");
    expect((world as unknown as { banner: string }).banner).toBe("STAGE 1");
    world.dispose();
  });

  it("persists FINAL_RESULT after the final bonus and makes it idempotent", () => {
    const world = new GameWorld(
      [puzzle()],
      () => undefined,
      () => undefined
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
      storage.getItem("cubic-ordeal-campaign-v1") ?? "{}"
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
      () => undefined
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
