/** Obsidian Observatory: deterministic 30Hz rules; Babylon only reads snapshots. */
import { InputManager } from "./InputManager";
import { findPuzzle } from "./puzzles";
import { resolveDuelRound } from "./duelRules";
import {
  advanceOneCell,
  areaTargets,
  calculateMindIndex,
  isPositionOnPlatform,
  markerCanCapture,
  unresolvedCubeCount,
} from "./rules";
import { playerIntersectsRollSweep } from "./rollPhysics";
import {
  DIFFICULTIES,
  initialStats,
  type AreaMark,
  type CubeState,
  type Difficulty,
  type GameMode,
  type GamePhase,
  type GameSnapshot,
  type GridPosition,
  type PuzzleDescriptor,
  type RunStats,
} from "./types";

const FIXED_STEP = 1 / 30;
const STORAGE_KEY = "cubic-ordeal-campaign-v1";
const HIGH_SCORE_KEY = "cubic-ordeal-highscore-v1";
const SAVE_VERSION = 4;

export type CubicCommand =
  | {
      type: "start";
      mode: GameMode;
      difficulty: Difficulty;
      stage?: number;
      wave?: number;
      ordinal?: number;
    }
  | { type: "menu" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "rewind" }
  | { type: "quick-save" }
  | { type: "quick-load" }
  | { type: "step-roll" }
  | { type: "continue" }
  | { type: "touch-move"; x: number; z: number }
  | { type: "touch-fast"; active: boolean }
  | { type: "touch-press"; action: "mark" | "area" | "pause" }
  | { type: "load-custom"; puzzle: PuzzleDescriptor }
  | { type: "set-debug"; active: boolean }
  | { type: "auto-solve" }
  | { type: "debug-platform"; rows: number };

interface CaptureOptions {
  batch?: boolean;
}

const PAUSABLE_PHASES = new Set<GamePhase>([
  "TUTORIAL",
  "STAGE_INTRO",
  "COUNTDOWN",
  "PLAYING",
  "CAPTURE_PAUSE",
  "CRUSHED",
]);
const TERMINAL_PHASES = new Set<GamePhase>(["GAME_OVER", "FINAL_RESULT"]);

const isPausablePhase = (phase: GamePhase): boolean =>
  PAUSABLE_PHASES.has(phase);

export class GameWorld {
  private readonly input = new InputManager();
  private readonly history: GameSnapshot[] = [];
  private quickSave: GameSnapshot | null = null;
  private readonly onPublish: (snapshot: GameSnapshot) => void;
  private readonly onSignal: (signal: string) => void;
  private readonly onCommand = (event: Event) =>
    this.command((event as CustomEvent<CubicCommand>).detail);
  private readonly onVisibility = () => {
    if (
      document.hidden &&
      [
        "PLAYING",
        "TUTORIAL",
        "CAPTURE_PAUSE",
        "COUNTDOWN",
        "STAGE_INTRO",
      ].includes(this.phase)
    ) {
      this.pauseGame("PAUSED // VIEW HIDDEN");
    }
  };

  private accumulator = 0;
  private elapsed = 0;
  private phaseTimer = 0;
  private pausedFromPhase: GamePhase | null = null;
  private completionAwardedForPuzzle: string | null = null;
  private rollElapsed = 0;
  private lastCampaignSaveSecond = -1;
  private settleElapsed = 0;
  private isRolling = false;
  private hasScoringStarted = false;
  private demoElapsed = 0;
  private tutorialStep = 0;
  private duelTurn = 0;
  private duelScore: [number, number] = [0, 0];
  private currentPuzzle: PuzzleDescriptor;
  private customPuzzle: PuzzleDescriptor | null = null;
  private puzzleIndex = 0;
  private mode: GameMode = "CAMPAIGN";
  private difficulty: Difficulty = "NORMAL";
  private phase: GamePhase = "TITLE";
  private player = { x: 1.5, z: 10, heading: 0 };
  private cubes: CubeState[] = [];
  private marker: GridPosition | null = null;
  private areas: AreaMark[] = [];
  private stats: RunStats = initialStats(4);
  private banner = "CUBIC ORDEAL";
  private hint = "進路を読み、MARKを置け。";
  private debug =
    new URLSearchParams(window.location.search).get("debug") === "1";
  private demo = new URLSearchParams(window.location.search).has("demo");

  constructor(
    private readonly puzzles: PuzzleDescriptor[],
    onPublish: (snapshot: GameSnapshot) => void,
    onSignal: (signal: string) => void
  ) {
    if (!puzzles.length) throw new Error("Puzzle archive is empty.");
    this.onPublish = onPublish;
    this.onSignal = onSignal;
    this.currentPuzzle = puzzles[0];
    this.loadPuzzle(this.currentPuzzle, true);
    window.addEventListener("cubic:command", this.onCommand);
    document.addEventListener("visibilitychange", this.onVisibility);
    if (this.demo) this.start("PRACTICE", "BEGINNER", 1, 1, 1);
    this.publish();
  }

  update(deltaSeconds: number): void {
    this.accumulator = Math.min(0.25, this.accumulator + deltaSeconds);
    while (this.accumulator >= FIXED_STEP) {
      this.fixedUpdate(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    if (
      this.mode === "CAMPAIGN" &&
      this.phase !== "TITLE" &&
      this.phase !== "MENU" &&
      Math.floor(this.elapsed) !== this.lastCampaignSaveSecond
    ) {
      this.lastCampaignSaveSecond = Math.floor(this.elapsed);
      this.saveCampaign();
    }
    this.publish();
  }

  private fixedUpdate(dt: number): void {
    this.elapsed += dt;
    if (this.demo) this.runDemo(dt);
    const input = this.input.sample(
      this.phase === "PLAYING" || this.phase === "TUTORIAL"
    );
    if (input.pause) this.togglePause();
    if (
      [
        "PAUSED",
        "TITLE",
        "MENU",
        "EDITOR",
        "GAME_OVER",
        "FINAL_RESULT",
      ].includes(this.phase)
    )
      return;

    if (this.phase === "STAGE_INTRO") {
      this.phaseTimer += dt;
      if (this.phaseTimer > 0.85) {
        this.phase = "COUNTDOWN";
        this.phaseTimer = 3;
        this.banner = "3";
      }
      return;
    }

    if (this.phase === "COUNTDOWN") {
      this.phaseTimer -= dt;
      this.banner =
        this.phaseTimer > 0
          ? String(Math.max(1, Math.ceil(this.phaseTimer)))
          : "EXECUTE";
      if (this.phaseTimer <= 0) {
        this.phase = this.mode === "TUTORIAL" ? "TUTORIAL" : "PLAYING";
        this.banner = "ORDEAL ACTIVE";
        this.phaseTimer = 0;
      }
      return;
    }

    if (this.phase === "CAPTURE_PAUSE") {
      if (!this.movePlayer(input.moveX, input.moveZ, dt)) return;
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = this.mode === "TUTORIAL" ? "TUTORIAL" : "PLAYING";
        this.banner = "";
      }
      return;
    }

    if (["CRUSHED", "WAVE_RESULT", "STAGE_RESULT"].includes(this.phase)) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.advanceAfterResult();
      return;
    }

    if (this.phase === "PUZZLE_RESULT") {
      if (this.demo) {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.advanceAfterResult();
      }
      return;
    }

    if (this.phase !== "PLAYING" && this.phase !== "TUTORIAL") return;
    if (!this.movePlayer(input.moveX, input.moveZ, dt)) return;
    if (input.mark) this.markOrCapture();
    if (input.area) this.activateAreas();
    this.updateTutorial(input.moveX, input.moveZ);
    if (this.phase === "PLAYING" || this.phase === "TUTORIAL")
      this.updateRoll(dt, input.fast);
    if (
      this.mode === "PRACTICE" &&
      Math.floor(this.elapsed * 4) !== Math.floor((this.elapsed - dt) * 4)
    )
      this.recordHistory();
  }

  private movePlayer(moveX: number, moveZ: number, dt: number): boolean {
    if (!moveX && !moveZ) return true;
    const config = DIFFICULTIES[this.difficulty];
    const length = Math.hypot(moveX, moveZ) || 1;
    this.player.x += (moveX / length) * config.playerSpeed * dt;
    this.player.z += (moveZ / length) * config.playerSpeed * dt;
    this.player.heading = Math.atan2(moveX, moveZ);
    if (
      !isPositionOnPlatform(
        this.player,
        this.currentPuzzle.width,
        this.stats.platformRows
      )
    ) {
      this.fallFromPlatform();
      return false;
    }
    return true;
  }

  private updateRoll(dt: number, fast: boolean): void {
    const config = DIFFICULTIES[this.difficulty];
    const multiplier = fast ? 1.82 : 1;
    if (!this.isRolling) {
      this.settleElapsed += dt * multiplier;
      if (this.settleElapsed >= config.settleSeconds) {
        this.isRolling = true;
        this.rollElapsed = 0;
        this.settleElapsed = 0;
        if (this.hasScoringStarted) this.stats.rotations += 1;
        this.onSignal("roll");
      }
      return;
    }

    const previousProgress = this.rollProgress;
    this.rollElapsed += dt * multiplier;
    this.checkRollCollision(previousProgress, this.rollProgress);
    if (this.rollElapsed >= config.rollSeconds) {
      this.finishRotation();
      this.isRolling = false;
      this.rollElapsed = 0;
      this.onSignal("land");
    }
  }

  private checkRollCollision(previousProgress: number, progress: number): void {
    const crushing = this.cubes.some(
      cube =>
        !cube.captured &&
        !cube.falling &&
        playerIntersectsRollSweep(cube, this.player, previousProgress, progress)
    );
    if (crushing) this.crush();
  }

  private finishRotation(): void {
    for (const cube of this.cubes) {
      if (cube.captured || cube.falling) continue;
      Object.assign(cube, advanceOneCell(cube));
      if (cube.z < 0) {
        this.handleFalling(cube);
        if (this.phase === "GAME_OVER") break;
      }
    }
    this.cubes = this.cubes.filter(cube => !cube.falling && !cube.captured);
    if (this.phase === "GAME_OVER") return;
    this.resolveIfEmpty();
  }

  private handleFalling(cube: CubeState): void {
    cube.falling = true;
    if (cube.type === "void") {
      if (this.mode === "TUTORIAL")
        this.tutorialStep = Math.max(this.tutorialStep, 5);
      return;
    }
    this.stats.misses += 1;
    this.stats.perfect = false;
    this.banner = "SIGNAL LOST";
    if (this.stats.misses > this.stats.missLimit)
      this.losePlatformRow("LOSS LIMIT");
  }

  private fallFromPlatform(): void {
    this.stats.perfect = false;
    this.phase = "GAME_OVER";
    this.banner = "FALL INTO VOID";
    this.input.clear();
    this.onSignal("collapse");
  }

  private markOrCapture(): void {
    if (!this.marker) {
      this.marker = {
        x: Math.round(this.player.x),
        z: Math.round(this.player.z),
      };
      this.banner = "MARK SET";
      this.onSignal("mark");
      if (this.mode === "TUTORIAL") {
        const protectsVoid = this.cubes.some(
          cube =>
            cube.type === "void" &&
            cube.x === this.marker?.x &&
            cube.z === this.marker?.z
        );
        this.tutorialStep = Math.max(this.tutorialStep, protectsVoid ? 3 : 1);
      }
      return;
    }

    const target = this.cubes.find(cube => markerCanCapture(this.marker, cube));
    if (!target) {
      this.marker = null;
      this.banner = "MARK CLEARED";
      this.onSignal("mark");
      return;
    }
    if (this.isRolling) {
      this.banner = "WAIT FOR LANDING";
      return;
    }
    this.captureCube(target, "manual");
    this.marker = null;
  }

  private addAreaAnchor(cube: CubeState): void {
    const area: AreaMark = {
      id: `area-${cube.id}`,
      x: cube.x,
      z: cube.z,
      armed: true,
    };
    if (
      !this.areas.some(
        existing => existing.x === area.x && existing.z === area.z
      )
    )
      this.areas.push(area);
    this.stats.areaMarks = this.areas.length;
  }

  private captureCube(
    cube: CubeState,
    source: "manual" | "area",
    options: CaptureOptions = {}
  ): void {
    cube.captured = true;
    if (cube.type === "void") {
      this.stats.voidCaptured += 1;
      this.stats.perfect = false;
      this.losePlatformRow(
        source === "area" ? "AREA VOID BREACH" : "VOID BREACH"
      );
      if (!options.batch) this.onSignal("warning");
      return;
    }

    if (!this.hasScoringStarted) {
      this.hasScoringStarted = true;
      this.stats.rotations = 0;
    }
    this.stats.score += source === "area" ? 200 : 100;
    if (cube.type === "normal") this.stats.normalCaptured += 1;
    if (cube.type === "veil") {
      this.stats.veilCaptured += 1;
      this.addAreaAnchor(cube);
    }

    if (options.batch) return;
    this.phase = "CAPTURE_PAUSE";
    this.phaseTimer = DIFFICULTIES[this.difficulty].captureSeconds;
    this.banner = cube.type === "veil" ? "VEIL ANCHOR SET" : "CAPTURED";
    this.onSignal("capture");
    if (this.mode === "TUTORIAL")
      this.tutorialStep = Math.max(this.tutorialStep, 2);
    this.resolveIfEmpty();
  }

  private activateAreas(): void {
    if (!this.areas.length) {
      this.banner = "NO VEIL ANCHORS";
      return;
    }

    // AREA anchors are consumed before targets are captured. VEIL targets therefore create
    // a fresh set that can only be used by a later AREA input.
    const activeAreas = this.areas.map(area => ({ ...area }));
    this.areas = [];
    this.stats.areaMarks = 0;
    const targets = areaTargets(this.cubes, activeAreas, this.marker);
    if (!targets.length) {
      this.banner = "AREA DISCHARGED";
      this.onSignal("area");
      return;
    }

    let capturedVoid = false;
    for (const cube of targets) {
      if (cube.type === "void") capturedVoid = true;
      this.captureCube(cube, "area", { batch: true });
    }
    this.stats.areaMarks = this.areas.length;
    if (this.phase === "GAME_OVER") return;
    this.phase = "CAPTURE_PAUSE";
    this.phaseTimer = DIFFICULTIES[this.difficulty].captureSeconds;
    this.banner = capturedVoid ? "AREA BREACH" : "AREA CASCADE";
    this.onSignal(capturedVoid ? "warning" : "area");
    if (this.mode === "TUTORIAL")
      this.tutorialStep = Math.max(this.tutorialStep, 4);
    this.resolveIfEmpty();
  }

  private resolveIfEmpty(): void {
    if (TERMINAL_PHASES.has(this.phase)) return;
    if (
      this.cubes.some(
        cube => !cube.captured && !cube.falling && cube.type !== "void"
      )
    )
      return;
    if (
      this.cubes.some(
        cube => !cube.captured && !cube.falling && cube.type === "void"
      )
    )
      return;
    this.completePuzzle();
  }

  private completePuzzle(): void {
    if (
      TERMINAL_PHASES.has(this.phase) ||
      ["PUZZLE_RESULT", "STAGE_RESULT", "FINAL_RESULT"].includes(this.phase) ||
      this.completionAwardedForPuzzle === this.currentPuzzle.id
    )
      return;
    this.completionAwardedForPuzzle = this.currentPuzzle.id;
    const allRequiredCaptured =
      this.stats.misses === 0 && this.stats.voidCaptured === 0;
    const rollDiff = this.stats.rotations - this.currentPuzzle.requiredRolls;
    if (allRequiredCaptured && this.stats.perfect) {
      this.stats.platformRows += 1;
      this.stats.score += rollDiff < 0 ? 10000 : rollDiff === 0 ? 5000 : 1000;
      this.banner =
        rollDiff < 0
          ? "TRUE PERFECT"
          : rollDiff === 0
            ? "EXACT PERFECT"
            : "PERFECT";
      this.onSignal("perfect");
    } else {
      this.banner = "ORDEAL RESOLVED";
    }
    if (this.mode === "TUTORIAL") this.tutorialStep = 7;
    this.phase = "PUZZLE_RESULT";
    this.phaseTimer = 2.3;
    this.input.clear();
  }

  private losePlatformRow(reason: string, preserveMisses = false): boolean {
    this.stats.platformRows -= 1;
    if (!preserveMisses) this.stats.misses = 0;
    this.banner = reason;
    this.onSignal("collapse");
    if (
      this.player.z >= this.stats.platformRows ||
      this.stats.platformRows < this.currentPuzzle.depth + 2
    ) {
      this.phase = "GAME_OVER";
      this.banner = "OBSERVATORY LOST";
      this.input.clear();
      return true;
    }
    return false;
  }

  private crush(): void {
    if (this.phase !== "PLAYING" && this.phase !== "TUTORIAL") return;
    const escaped = unresolvedCubeCount(this.cubes);
    this.cubes.forEach(cube => {
      if (!cube.captured) cube.falling = true;
    });
    const combinedMisses = this.stats.misses + escaped;
    const threshold = this.stats.missLimit + 1;
    const rowsLost = Math.floor(combinedMisses / threshold);
    this.stats.misses = combinedMisses % threshold;
    this.stats.perfect = false;
    for (let index = 0; index < rowsLost; index += 1) {
      if (this.losePlatformRow("CRUSHED", true)) return;
    }
    this.phase = "CRUSHED";
    this.phaseTimer = 1.8;
    this.banner = "CRUSHED — AGAIN";
    this.onSignal("crush");
  }

  private endStandaloneRun(message: string): void {
    this.phase = "MENU";
    this.phaseTimer = 0;
    this.banner = message;
    this.input.clear();
    this.onSignal("menu");
  }

  private advanceAfterResult(): void {
    if (TERMINAL_PHASES.has(this.phase)) return;
    if (this.phase === "CRUSHED") {
      const residualMisses = this.stats.misses;
      this.loadPuzzle(this.currentPuzzle, false);
      this.stats.misses = residualMisses;
      this.stats.perfect = false;
      this.phase = this.mode === "TUTORIAL" ? "TUTORIAL" : "PLAYING";
      return;
    }

    if (this.phase === "WAVE_RESULT" || this.phase === "STAGE_RESULT") {
      this.phase = "STAGE_INTRO";
      this.phaseTimer = 0;
      this.banner = `STAGE ${this.currentPuzzle.stage}`;
      return;
    }

    if (this.mode === "DUEL") {
      this.advanceDuel();
      return;
    }

    if (this.mode === "TUTORIAL") {
      this.endStandaloneRun("TUTORIAL COMPLETE");
      return;
    }
    if (this.mode === "CREATE") {
      this.endStandaloneRun("CUSTOM ORDEAL COMPLETE");
      return;
    }
    if (this.mode === "PRACTICE") {
      this.endStandaloneRun("PRACTICE COMPLETE");
      return;
    }

    const next = this.puzzles[this.puzzleIndex + 1];
    if (!next) {
      this.stats.score += this.stats.platformRows * 1000;
      this.saveHighScore();
      this.phase = "FINAL_RESULT";
      this.banner = `MIND INDEX ${this.mindIndex}`;
      this.input.clear();
      // Persist the terminal phase after applying the final bonus. A reload must not
      // turn the result back into an active run that can award the bonus again.
      this.saveCampaign();
      return;
    }

    const stageChanged = next.stage !== this.currentPuzzle.stage;
    const waveChanged = next.wave !== this.currentPuzzle.wave;
    this.puzzleIndex += 1;
    this.loadPuzzle(next, false);
    this.saveCampaign();
    this.phase = stageChanged
      ? "STAGE_RESULT"
      : waveChanged
        ? "WAVE_RESULT"
        : "PLAYING";
    this.phaseTimer = stageChanged ? 1.5 : waveChanged ? 1.1 : 0;
    if (!stageChanged && !waveChanged) this.banner = "NEXT ORDEAL";
  }

  private advanceDuel(): void {
    const succeeded =
      this.stats.perfect &&
      this.stats.misses === 0 &&
      this.stats.voidCaptured === 0;
    const resolution = resolveDuelRound(
      this.duelScore,
      this.duelTurn as 0 | 1,
      succeeded
    );
    this.duelScore = resolution.scores;
    this.duelTurn = resolution.nextTurn;
    if (resolution.winner !== null) {
      this.phase = "FINAL_RESULT";
      this.banner = `DUEL WINNER: PLAYER ${resolution.winner + 1}`;
      return;
    }
    if (resolution.advancePuzzle)
      this.puzzleIndex = (this.puzzleIndex + 1) % this.puzzles.length;
    const nextPuzzle = resolution.advancePuzzle
      ? this.puzzles[this.puzzleIndex]
      : this.currentPuzzle;
    this.loadPuzzle(nextPuzzle, true);
    this.phase = "STAGE_INTRO";
    this.phaseTimer = 0;
    this.banner = `DUEL // PLAYER ${this.duelTurn + 1} // ${resolution.advancePuzzle ? "NEXT" : "SAME"} ORDEAL`;
  }

  private loadPuzzle(puzzle: PuzzleDescriptor, resetPlatform: boolean): void {
    this.currentPuzzle = puzzle;
    this.cubes = puzzle.layout.map((cube, index) => ({
      id: `${puzzle.id}-${index}`,
      type: cube.type,
      x: cube.x,
      z: cube.z,
      previousZ: cube.z,
    }));
    this.marker = null;
    this.areas = [];
    const platformRows = resetPlatform
      ? Math.max(12, (puzzle.spawnRow ?? 0) + puzzle.depth)
      : this.stats.platformRows;
    const retainedScore = resetPlatform ? 0 : this.stats.score;
    this.stats = {
      ...initialStats(puzzle.width),
      platformRows,
      score: retainedScore,
      requiredRolls: puzzle.requiredRolls,
    };
    this.player = {
      x: Math.min(puzzle.width - 0.5, Math.max(0.5, puzzle.width / 2)),
      z: 0.7,
      heading: 0,
    };
    this.hasScoringStarted = false;
    this.isRolling = false;
    this.rollElapsed = 0;
    this.settleElapsed = 0;
    this.phaseTimer = 0;
    this.pausedFromPhase = null;
    this.completionAwardedForPuzzle = null;
    if (this.mode === "PRACTICE") {
      this.history.length = 0;
      this.quickSave = null;
    }
  }

  private start(
    mode: GameMode,
    difficulty: Difficulty,
    stage = 1,
    wave = 1,
    ordinal = 1
  ): void {
    if (mode === "CAMPAIGN" && stage === 1 && wave === 1 && ordinal === 1) {
      const restored = this.readCampaign();
      if (restored) {
        this.restore(restored);
        this.mode = "CAMPAIGN";
        if (isPausablePhase(this.phase)) {
          this.pausedFromPhase = this.phase;
          this.phase = "PAUSED";
          this.banner = "CAMPAIGN RESTORED";
        } else if (this.phase === "FINAL_RESULT") {
          this.banner = "CAMPAIGN COMPLETE";
        } else if (this.phase === "GAME_OVER") {
          this.banner = "CAMPAIGN RESTORED // GAME OVER";
        } else {
          this.banner = "CAMPAIGN RESTORED";
        }
        return;
      }
    }

    this.mode = mode;
    this.difficulty = difficulty;
    this.customPuzzle = null;
    const puzzle =
      mode === "TUTORIAL"
        ? makeTutorialPuzzle()
        : findPuzzle(this.puzzles, stage, wave, ordinal);
    if (!puzzle) {
      this.phase = "MENU";
      this.banner = `ARCHIVE NOT FOUND // S${stage} W${wave} P${ordinal}`;
      return;
    }
    this.puzzleIndex = mode === "TUTORIAL" ? 0 : this.puzzles.indexOf(puzzle);
    this.duelTurn = 0;
    this.duelScore = [0, 0];
    this.tutorialStep = 0;
    this.loadPuzzle(puzzle, true);
    this.phase = "STAGE_INTRO";
    this.phaseTimer = 0;
    this.banner =
      mode === "TUTORIAL"
        ? "TRAINING SIGNAL"
        : mode === "DUEL"
          ? "DUEL // PLAYER 1"
          : `STAGE ${stage}`;
    this.onSignal("menu");
  }

  private togglePause(): void {
    if (this.phase === "PAUSED") this.resumeGame();
    else this.pauseGame();
  }

  private pauseGame(reason = "PAUSED"): void {
    if (!isPausablePhase(this.phase)) return;
    this.pausedFromPhase = this.phase;
    this.phase = "PAUSED";
    this.banner = reason;
    this.input.clear();
  }

  private resumeGame(): void {
    if (
      this.phase !== "PAUSED" ||
      !isPausablePhase(this.pausedFromPhase ?? "TITLE")
    )
      return;
    this.phase = this.pausedFromPhase as GamePhase;
    this.pausedFromPhase = null;
    this.banner =
      this.phase === "COUNTDOWN"
        ? String(Math.max(1, Math.ceil(this.phaseTimer)))
        : this.phase === "CRUSHED"
          ? "CRUSHED — AGAIN"
          : this.phase === "STAGE_INTRO"
            ? "STAGE INTRO"
            : "ORDEAL ACTIVE";
    this.input.clear();
  }

  private command(command: CubicCommand): void {
    if (!command) return;
    if (command.type !== "touch-move" && command.type !== "touch-fast")
      this.emitUserGesture();
    if (command.type === "start") {
      this.start(
        command.mode,
        command.difficulty,
        command.stage,
        command.wave,
        command.ordinal
      );
      return;
    }
    if (command.type === "menu") {
      if (this.mode === "CAMPAIGN") this.saveCampaign();
      this.phase = "MENU";
      this.banner = "MODE SELECT";
      return;
    }
    if (command.type === "pause") {
      this.pauseGame();
      return;
    }
    if (command.type === "resume") {
      this.resumeGame();
      return;
    }
    if (
      command.type === "continue" &&
      ["PUZZLE_RESULT", "WAVE_RESULT", "STAGE_RESULT"].includes(this.phase)
    ) {
      this.advanceAfterResult();
      return;
    }
    if (command.type === "rewind" && this.mode === "PRACTICE") {
      this.restoreHistory();
      return;
    }
    if (command.type === "quick-save" && this.mode === "PRACTICE") {
      this.quickSave = this.snapshot();
      this.banner = "QUICK SAVE STORED";
      return;
    }
    if (
      command.type === "quick-load" &&
      this.mode === "PRACTICE" &&
      this.quickSave
    ) {
      this.restore(this.quickSave);
      this.banner = "QUICK SAVE RESTORED";
      return;
    }
    if (
      command.type === "step-roll" &&
      (this.mode === "PRACTICE" || this.debug)
    ) {
      this.isRolling = true;
      this.rollElapsed = DIFFICULTIES[this.difficulty].rollSeconds;
      this.finishRotation();
      this.isRolling = false;
      return;
    }
    if (command.type === "touch-move") {
      this.input.setTouchMove(command.x, command.z);
      return;
    }
    if (command.type === "touch-fast") {
      this.input.setTouchFast(command.active);
      return;
    }
    if (command.type === "touch-press") {
      this.input.press(command.action);
      return;
    }
    if (command.type === "load-custom") {
      this.mode = "CREATE";
      this.customPuzzle = command.puzzle;
      this.puzzleIndex = 0;
      this.loadPuzzle(command.puzzle, true);
      this.phase = "STAGE_INTRO";
      this.banner = "CUSTOM ORDEAL";
      return;
    }
    if (command.type === "set-debug") {
      this.debug = command.active;
      return;
    }
    if (command.type === "debug-platform" && this.debug) {
      this.stats.platformRows = Math.max(
        this.currentPuzzle.depth + 2,
        command.rows
      );
      return;
    }
    if (command.type === "auto-solve" && this.debug) {
      this.cubes
        .filter(cube => cube.type !== "void" && !cube.captured)
        .forEach(cube => this.captureCube(cube, "manual", { batch: true }));
      this.resolveIfEmpty();
    }
  }

  private emitUserGesture(): void {
    window.dispatchEvent(new Event("cubic:user-gesture"));
  }

  private updateTutorial(moveX: number, moveZ: number): void {
    if (this.mode !== "TUTORIAL") return;
    if (Math.abs(moveX) + Math.abs(moveZ) > 0.1)
      this.tutorialStep = Math.max(this.tutorialStep, 1);
    const hints = [
      "1/8: 盤面を横へ走り、移動入力を確認する。",
      "2/8: 青いMARKを次に通る床へ置く。",
      "3/8: 緑のVEILがMARKへ到着したらCAPTUREする。",
      "4/8: 紫のVOIDが来る床へMARKを置き、AREAから保護する。",
      "5/8: AREAは一度で消費される。VEILを巻き込んで次のAREAを作る。",
      "6/8: VOIDが足場の端から落ちるのを確認する。",
      "7/8: 取り逃しなしのPERFECTで足場が1列増える。",
      "8/8: 練習問題を完了しました。MENUからCampaignへ進めます。",
    ];
    this.hint = hints[Math.min(this.tutorialStep, hints.length - 1)];
  }

  private runDemo(dt: number): void {
    this.demoElapsed += dt;
    if (
      (this.phase !== "PLAYING" && this.phase !== "TUTORIAL") ||
      this.demoElapsed <= 1.1
    )
      return;
    this.demoElapsed = 0;
    const landed = this.cubes.find(
      cube =>
        cube.type !== "void" && !cube.captured && !cube.falling && cube.z === 0
    );
    if (landed) {
      this.marker = { x: landed.x, z: landed.z };
      this.markOrCapture();
    } else if (this.areas.length) {
      this.activateAreas();
    }
  }

  private recordHistory(): void {
    this.history.push(this.snapshot());
    if (this.history.length > 40) this.history.shift();
  }

  private restoreHistory(): void {
    const snapshot = this.history[Math.max(0, this.history.length - 40)];
    if (snapshot) this.restore(snapshot);
    this.banner = "10 SECONDS REWOUND";
  }

  private restore(snapshot: GameSnapshot): void {
    this.phase = snapshot.phase;
    this.mode = snapshot.mode;
    this.difficulty = snapshot.difficulty;
    this.player = { ...snapshot.player };
    this.cubes = snapshot.cubes.map(cube => ({ ...cube }));
    this.marker = snapshot.marker ? { ...snapshot.marker } : null;
    this.areas = snapshot.areas.map(area => ({ ...area }));
    this.stats = { ...snapshot.stats };
    const restoredIndex = snapshot.puzzleId
      ? this.puzzles.findIndex(puzzle => puzzle.id === snapshot.puzzleId)
      : snapshot.puzzleIndex;
    if (restoredIndex >= 0 && this.puzzles[restoredIndex]) {
      this.puzzleIndex = restoredIndex;
      this.currentPuzzle = this.puzzles[restoredIndex];
    }
    this.banner = snapshot.banner;
    this.hint = snapshot.hint;
    this.duelTurn = snapshot.duelTurn;
    this.duelScore = [...snapshot.duelScore] as [number, number];
    this.elapsed = snapshot.elapsed ?? 0;
    this.phaseTimer = snapshot.phaseTimer ?? 0;
    this.isRolling = snapshot.isRolling ?? snapshot.rollProgress > 0;
    this.rollElapsed =
      snapshot.rollElapsed ??
      (this.isRolling
        ? snapshot.rollProgress * DIFFICULTIES[this.difficulty].rollSeconds
        : 0);
    this.settleElapsed = snapshot.settleElapsed ?? 0;
    this.hasScoringStarted =
      snapshot.hasScoringStarted ??
      (snapshot.stats.score > 0 || snapshot.stats.rotations > 0);
    this.tutorialStep = snapshot.tutorialStep ?? 0;
    this.pausedFromPhase =
      snapshot.pausedFromPhase ??
      (snapshot.phase === "PAUSED"
        ? snapshot.mode === "TUTORIAL"
          ? "TUTORIAL"
          : "PLAYING"
        : null);
    this.completionAwardedForPuzzle =
      snapshot.completionAwardedForPuzzle ?? null;
  }

  private saveCampaign(): void {
    if (this.mode !== "CAMPAIGN") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: SAVE_VERSION, snapshot: this.snapshot() })
      );
    } catch {
      // localStorage can be unavailable in strict privacy contexts.
    }
  }

  private readCampaign(): GameSnapshot | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw
        ? (JSON.parse(raw) as { version?: number; snapshot?: GameSnapshot })
        : null;
      const snapshot = saved?.snapshot;
      if (saved?.version !== SAVE_VERSION || !snapshot) return null;
      const index = snapshot.puzzleId
        ? this.puzzles.findIndex(puzzle => puzzle.id === snapshot.puzzleId)
        : snapshot.puzzleIndex;
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        !this.puzzles[index] ||
        (snapshot.puzzleId && this.puzzles[index].id !== snapshot.puzzleId) ||
        !snapshot.stats ||
        !Array.isArray(snapshot.cubes)
      )
        return null;
      return snapshot;
    } catch {
      // Invalid or obsolete data starts a fresh campaign.
    }
    return null;
  }

  private saveHighScore(): void {
    try {
      const current = {
        score: this.stats.score,
        mindIndex: this.mindIndex,
        at: Date.now(),
      };
      const previous = JSON.parse(
        localStorage.getItem(HIGH_SCORE_KEY) ?? "null"
      ) as { score?: number } | null;
      if (!previous || current.score > (previous.score ?? 0))
        localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(current));
    } catch {
      // Score persistence is optional.
    }
  }

  private snapshot(): GameSnapshot {
    return {
      phase: this.phase,
      mode: this.mode,
      difficulty: this.difficulty,
      player: { ...this.player },
      cubes: this.cubes.map(cube => ({ ...cube })),
      marker: this.marker ? { ...this.marker } : null,
      areas: this.areas.map(area => ({ ...area })),
      stats: { ...this.stats },
      stage: this.currentPuzzle.stage,
      wave: this.currentPuzzle.wave,
      puzzleIndex: this.puzzleIndex,
      boardWidth: this.currentPuzzle.width,
      boardDepth: this.currentPuzzle.depth,
      countdown: this.phase === "COUNTDOWN" ? Math.ceil(this.phaseTimer) : 0,
      banner: this.banner,
      hint: this.hint,
      rollProgress: this.rollProgress,
      debug: this.debug,
      duelTurn: this.duelTurn,
      duelScore: [...this.duelScore] as [number, number],
      tutorialStep: this.tutorialStep,
      pausedFromPhase: this.pausedFromPhase,
      phaseTimer: this.phaseTimer,
      rollElapsed: this.rollElapsed,
      settleElapsed: this.settleElapsed,
      isRolling: this.isRolling,
      hasScoringStarted: this.hasScoringStarted,
      elapsed: this.elapsed,
      puzzleId: this.currentPuzzle.id,
      completionAwardedForPuzzle: this.completionAwardedForPuzzle,
      captureProgress:
        this.phase === "CAPTURE_PAUSE"
          ? Math.max(
              0,
              Math.min(
                1,
                1 -
                  this.phaseTimer / DIFFICULTIES[this.difficulty].captureSeconds
              )
            )
          : 0,
      crushProgress:
        this.phase === "CRUSHED"
          ? Math.max(0, Math.min(1, 1 - this.phaseTimer / 1.8))
          : 0,
    };
  }

  private publish(): void {
    this.onPublish(this.snapshot());
  }

  get rollProgress(): number {
    return this.isRolling
      ? Math.min(
          1,
          this.rollElapsed / DIFFICULTIES[this.difficulty].rollSeconds
        )
      : 0;
  }

  get mindIndex(): number {
    return calculateMindIndex(
      this.stats.score,
      this.currentPuzzle.stage,
      this.stats.platformRows,
      this.stats.misses
    );
  }

  dispose(): void {
    window.removeEventListener("cubic:command", this.onCommand);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.input.dispose();
  }
}

function makeTutorialPuzzle(): PuzzleDescriptor {
  return {
    id: "TUTORIAL-OBSERVATION-01",
    stage: 1,
    wave: 1,
    ordinal: 1,
    width: 4,
    depth: 5,
    spawnRow: 7,
    requiredRolls: 0,
    difficultyTag: "training",
    seed: 0,
    layout: [
      { x: 2, z: 11, type: "veil" },
      { x: 1, z: 11, type: "normal" },
      { x: 3, z: 11, type: "void" },
    ],
    solution: [
      { rotation: 10, action: "mark", x: 2, z: 0 },
      { rotation: 11, action: "capture", x: 2, z: 0 },
      { rotation: 11, action: "mark", x: 3, z: 0 },
      { rotation: 11, action: "area", x: 3, z: 0 },
    ],
    validation: { valid: true, normal: 1, veil: 1, void: 1, travelBudget: 14 },
    featured: true,
  };
}
