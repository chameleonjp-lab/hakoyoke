/** Obsidian Observatory: deterministic 30Hz rules; Babylon only reads snapshots. */
import { InputManager } from "./InputManager";
import { findPuzzle } from "./puzzles";
import { advanceOneCell, areaAnchorBlocksMark, areaTargets, calculateMindIndex, isPositionOnPlatform, markerCanCapture, unresolvedCubeCount } from "./rules";
import { playerIntersectsRollSweep } from "./rollPhysics";
import { DIFFICULTIES, initialStats, type AreaMark, type CubeState, type Difficulty, type GameMode, type GamePhase, type GameSnapshot, type GridPosition, type PuzzleDescriptor, type RunStats } from "./types";

const FIXED_STEP = 1 / 30;
const STORAGE_KEY = "cubic-ordeal-campaign-v1";
const HIGH_SCORE_KEY = "cubic-ordeal-highscore-v1";

export type CubicCommand =
  | { type: "start"; mode: GameMode; difficulty: Difficulty; stage?: number; wave?: number; ordinal?: number }
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

export class GameWorld {
  private readonly input = new InputManager();
  private readonly history: GameSnapshot[] = [];
  private quickSave: GameSnapshot | null = null;
  private readonly onPublish: (snapshot: GameSnapshot) => void;
  private readonly onSignal: (signal: string) => void;
  private readonly onCommand = (event: Event) => this.command((event as CustomEvent<CubicCommand>).detail);
  private readonly onVisibility = () => { if (document.hidden && ["PLAYING", "TUTORIAL", "CAPTURE_PAUSE", "COUNTDOWN", "STAGE_INTRO"].includes(this.phase)) { this.phase = "PAUSED"; this.banner = "PAUSED // VIEW HIDDEN"; } };
  private accumulator = 0;
  private elapsed = 0;
  private phaseTimer = 0;
  private rollElapsed = 0;
  private totalRotations = 0;
  private lastCampaignSaveSecond = -1;
  private settleElapsed = 0;
  private isRolling = false;
  private hasScoringStarted = false;
  private demoElapsed = 0;
  private tutorialStep = 0;
  private duelTurn = 0;
  private duelScore: [number, number] = [0, 0];
  private currentPuzzle: PuzzleDescriptor;
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
  private debug = new URLSearchParams(window.location.search).get("debug") === "1";
  private demo = new URLSearchParams(window.location.search).has("demo");

  constructor(private readonly puzzles: PuzzleDescriptor[], onPublish: (snapshot: GameSnapshot) => void, onSignal: (signal: string) => void) {
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
    if (this.mode === "CAMPAIGN" && this.phase !== "TITLE" && this.phase !== "MENU" && Math.floor(this.elapsed) !== this.lastCampaignSaveSecond) { this.lastCampaignSaveSecond = Math.floor(this.elapsed); this.saveCampaign(); }
    this.publish();
  }

  private fixedUpdate(dt: number): void {
    this.elapsed += dt;
    if (this.demo) this.runDemo(dt);
    const input = this.input.sample(this.phase === "PLAYING" || this.phase === "TUTORIAL");
    if (input.pause && this.phase !== "TITLE" && this.phase !== "MENU") this.togglePause();
    if (this.phase === "PAUSED" || this.phase === "TITLE" || this.phase === "MENU" || this.phase === "EDITOR" || this.phase === "GAME_OVER" || this.phase === "FINAL_RESULT") return;
    if (this.phase === "STAGE_INTRO") {
      this.phaseTimer += dt;
      if (this.phaseTimer > 0.85) { this.phase = "COUNTDOWN"; this.phaseTimer = 3; this.banner = "3"; }
      return;
    }
    if (this.phase === "COUNTDOWN") {
      this.phaseTimer -= dt;
      const shown = Math.max(1, Math.ceil(this.phaseTimer));
      this.banner = this.phaseTimer > 0 ? String(shown) : "EXECUTE";
      if (this.phaseTimer <= 0) { this.phase = this.mode === "TUTORIAL" ? "TUTORIAL" : "PLAYING"; this.banner = "ORDEAL ACTIVE"; this.phaseTimer = 0; }
      return;
    }
    if (this.phase === "CAPTURE_PAUSE") {
      if (!this.movePlayer(input.moveX, input.moveZ, dt)) return;
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) { this.phase = this.mode === "TUTORIAL" ? "TUTORIAL" : "PLAYING"; this.banner = ""; }
      return;
    }
    if (this.phase === "CRUSHED" || this.phase === "WAVE_RESULT" || this.phase === "STAGE_RESULT") {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.advanceAfterResult();
      return;
    }
    if (this.phase === "PUZZLE_RESULT") {
      if (this.demo) { this.phaseTimer -= dt; if (this.phaseTimer <= 0) this.advanceAfterResult(); }
      return;
    }
    if (this.phase !== "PLAYING" && this.phase !== "TUTORIAL") return;
    if (!this.movePlayer(input.moveX, input.moveZ, dt)) return;
    if (input.mark) this.markOrCapture();
    if (input.area) this.activateAreas();
    this.updateTutorial(input.moveX, input.moveZ);
    if (this.phase === "PLAYING" || this.phase === "TUTORIAL") this.updateRoll(dt, input.fast);
    if (this.mode === "PRACTICE" && Math.floor(this.elapsed * 4) !== Math.floor((this.elapsed - dt) * 4)) this.recordHistory();
  }

  private movePlayer(moveX: number, moveZ: number, dt: number): boolean {
    if (!moveX && !moveZ) return true;
    const cfg = DIFFICULTIES[this.difficulty];
    const length = Math.hypot(moveX, moveZ) || 1;
    const width = this.currentPuzzle.width;
    this.player.x += (moveX / length) * cfg.playerSpeed * dt;
    this.player.z += (moveZ / length) * cfg.playerSpeed * dt;
    this.player.heading = Math.atan2(moveX, moveZ);
    if (!isPositionOnPlatform(this.player, width, this.stats.platformRows)) { this.fallFromPlatform(); return false; }
    return true;
  }

  private updateRoll(dt: number, fast: boolean): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const multiplier = fast ? 1.82 : 1;
    if (!this.isRolling) {
      this.settleElapsed += dt * multiplier;
      if (this.settleElapsed >= cfg.settleSeconds) {
        this.isRolling = true;
        this.rollElapsed = 0;
        this.settleElapsed = 0;
        this.totalRotations += 1;
        if (this.hasScoringStarted) this.stats.rotations += 1;
        this.onSignal("roll");
      }
      return;
    }
    const previousProgress = this.rollProgress;
    this.rollElapsed += dt * multiplier;
    this.checkRollCollision(previousProgress, this.rollProgress);
    if (this.rollElapsed >= cfg.rollSeconds) {
      this.finishRotation();
      this.isRolling = false;
      this.rollElapsed = 0;
      this.onSignal("land");
    }
  }

  private checkRollCollision(previousProgress: number, progress: number): void {
    const crushing = this.cubes.some((cube) => !cube.captured && !cube.falling && playerIntersectsRollSweep(cube, this.player, previousProgress, progress));
    if (crushing) this.crush();
  }

  private finishRotation(): void {
    for (const cube of this.cubes) {
      if (cube.captured || cube.falling) continue;
      Object.assign(cube, advanceOneCell(cube));
      if (cube.z < 0) this.handleFalling(cube);
    }
    this.cubes = this.cubes.filter((cube) => !cube.falling && !cube.captured);
    this.resolveIfEmpty();
  }

  private handleFalling(cube: CubeState): void {
    cube.falling = true;
    if (cube.type === "void") { if (this.mode === "TUTORIAL") this.tutorialStep = Math.max(this.tutorialStep, 5); return; }
    this.stats.misses += 1;
    this.stats.perfect = false;
    this.banner = "SIGNAL LOST";
    if (this.stats.misses > this.stats.missLimit) this.losePlatformRow("LOSS LIMIT");
  }

  private fallFromPlatform(): void {
    this.stats.perfect = false;
    this.phase = "GAME_OVER";
    this.banner = "FALL INTO VOID";
    this.onSignal("collapse");
  }

  private markOrCapture(): void {
    if (!this.marker) {
      const candidate = { x: Math.round(this.player.x), z: Math.round(this.player.z) };
      if (areaAnchorBlocksMark(this.areas, candidate)) { this.banner = "AREA ANCHOR LOCKED"; return; }
      this.marker = candidate;
      this.banner = "MARK SET";
      this.onSignal("mark");
      if (this.mode === "TUTORIAL") {
        const protectsVoid = this.cubes.some((cube) => cube.type === "void" && cube.x === this.marker?.x && cube.z === this.marker?.z);
        this.tutorialStep = Math.max(this.tutorialStep, protectsVoid ? 3 : 1);
      }
      return;
    }
    const target = this.cubes.find((cube) => markerCanCapture(this.marker, cube));
    if (!target) { this.marker = null; this.banner = "MARK CLEARED"; this.onSignal("mark"); return; }
    if (this.isRolling) { this.banner = "WAIT FOR LANDING"; return; }
    this.captureCube(target, "manual");
    this.marker = null;
  }

  private captureCube(cube: CubeState, source: "manual" | "area"): void {
    cube.captured = true;
    if (cube.type === "void") {
      this.stats.voidCaptured += 1;
      this.stats.perfect = false;
      this.losePlatformRow("VOID BREACH");
      this.onSignal("warning");
      return;
    }
    if (!this.hasScoringStarted) { this.hasScoringStarted = true; this.stats.rotations = 0; }
    this.stats.score += source === "area" ? 200 : 100;
    if (cube.type === "normal") this.stats.normalCaptured += 1;
    if (cube.type === "veil") {
      this.stats.veilCaptured += 1;
      const area: AreaMark = { id: `area-${cube.id}`, x: cube.x, z: cube.z, armed: true };
      if (!this.areas.some((existing) => existing.x === area.x && existing.z === area.z)) this.areas.push(area);
      this.stats.areaMarks = this.areas.length;
    }
    this.phase = "CAPTURE_PAUSE";
    this.phaseTimer = DIFFICULTIES[this.difficulty].captureSeconds;
    this.banner = source === "area" ? "AREA CASCADE" : cube.type === "veil" ? "VEIL ANCHOR SET" : "CAPTURED";
    this.onSignal(source === "area" ? "area" : "capture");
    if (this.mode === "TUTORIAL") this.tutorialStep = Math.max(this.tutorialStep, source === "area" ? 4 : cube.type === "veil" ? 2 : 2);
    this.resolveIfEmpty();
  }

  private activateAreas(): void {
    if (!this.areas.length) { this.banner = "NO VEIL ANCHORS"; return; }
    const targets = areaTargets(this.cubes, this.areas, this.marker);
    if (!targets.length) { this.banner = "AREA CLEAR"; return; }
    for (const cube of targets) this.captureCube(cube, "area");
    if (this.mode === "TUTORIAL") this.tutorialStep = Math.max(this.tutorialStep, 4);
  }

  private resolveIfEmpty(): void {
    const requiredRemaining = this.cubes.some((cube) => !cube.captured && !cube.falling && cube.type !== "void");
    if (requiredRemaining) return;
    const voidRemaining = this.cubes.some((cube) => !cube.captured && !cube.falling && cube.type === "void");
    if (voidRemaining) return;
    this.completePuzzle();
  }

  private completePuzzle(): void {
    if (this.phase === "PUZZLE_RESULT" || this.phase === "STAGE_RESULT" || this.phase === "FINAL_RESULT") return;
    const allRequiredCaptured = this.stats.misses === 0 && this.stats.voidCaptured === 0;
    const rollDiff = this.stats.rotations - this.currentPuzzle.requiredRolls;
    if (allRequiredCaptured && this.stats.perfect) {
      this.stats.platformRows += 1;
      this.stats.score += rollDiff < 0 ? 10000 : rollDiff === 0 ? 5000 : 1000;
      this.banner = rollDiff < 0 ? "TRUE PERFECT" : rollDiff === 0 ? "EXACT PERFECT" : "PERFECT";
      this.onSignal("perfect");
    } else this.banner = "ORDEAL RESOLVED";
    if (this.mode === "TUTORIAL") this.tutorialStep = 7;
    this.phase = "PUZZLE_RESULT";
    this.phaseTimer = 2.3;
  }

  private losePlatformRow(reason: string, preserveMisses = false): void {
    this.stats.platformRows -= 1;
    if (!preserveMisses) this.stats.misses = 0;
    this.banner = reason;
    this.onSignal("collapse");
    if (this.player.z >= this.stats.platformRows || this.stats.platformRows < this.currentPuzzle.depth + 2) {
      this.phase = "GAME_OVER";
      this.banner = "OBSERVATORY LOST";
    }
  }

  private crush(): void {
    if (this.phase !== "PLAYING" && this.phase !== "TUTORIAL") return;
    const escaped = unresolvedCubeCount(this.cubes);
    this.cubes.forEach((cube) => { if (!cube.captured) cube.falling = true; });
    const combinedMisses = this.stats.misses + escaped;
    const threshold = this.stats.missLimit + 1;
    const rowsLost = Math.floor(combinedMisses / threshold);
    this.stats.misses = combinedMisses % threshold;
    this.stats.perfect = false;
    for (let index = 0; index < rowsLost; index += 1) {
      this.losePlatformRow("CRUSHED", true);
      if (this.stats.platformRows < this.currentPuzzle.depth + 2 || this.player.z >= this.stats.platformRows) return;
    }
    if (this.stats.platformRows < this.currentPuzzle.depth + 2 || this.player.z >= this.stats.platformRows) return;
    this.phase = "CRUSHED";
    this.phaseTimer = 1.8;
    this.banner = "CRUSHED — AGAIN";
    this.onSignal("crush");
  }

  private advanceAfterResult(): void {
    if (this.phase === "CRUSHED") { this.loadPuzzle(this.currentPuzzle, false); this.phase = this.mode === "TUTORIAL" ? "TUTORIAL" : "PLAYING"; return; }
    if (this.phase === "WAVE_RESULT" || this.phase === "STAGE_RESULT") { this.phase = "STAGE_INTRO"; this.phaseTimer = 0; this.banner = `STAGE ${this.currentPuzzle.stage}`; return; }
    if (this.mode === "DUEL") {
      if (this.stats.perfect) this.duelScore[this.duelTurn] += 1;
      if (this.duelTurn === 0) {
        this.duelTurn = 1;
        this.loadPuzzle(this.currentPuzzle, false);
        this.phase = "STAGE_INTRO";
        this.phaseTimer = 0;
        this.banner = "DUEL // PLAYER 2 // SAME ORDEAL";
        return;
      }
      const hasWinner = (this.duelScore[0] >= 5 || this.duelScore[1] >= 5) && Math.abs(this.duelScore[0] - this.duelScore[1]) >= 2;
      if (hasWinner) { this.phase = "FINAL_RESULT"; this.banner = `DUEL WINNER: PLAYER ${this.duelScore[0] > this.duelScore[1] ? 1 : 2}`; return; }
      this.duelTurn = 0;
      this.puzzleIndex = (this.puzzleIndex + 1) % this.puzzles.length;
      this.loadPuzzle(this.puzzles[this.puzzleIndex], false);
      this.phase = "STAGE_INTRO";
      this.phaseTimer = 0;
      this.banner = "DUEL // PLAYER 1 // NEXT ORDEAL";
      return;
    }
    const next = this.puzzles[this.puzzleIndex + 1];
    if (!next) { this.stats.score += this.stats.platformRows * 1000; this.saveCampaign(); this.saveHighScore(); this.phase = "FINAL_RESULT"; this.banner = `MIND INDEX ${this.mindIndex}`; return; }
    const stageChanged = next.stage !== this.currentPuzzle.stage;
    const waveChanged = next.wave !== this.currentPuzzle.wave;
    this.puzzleIndex += 1;
    this.loadPuzzle(next, false);
    this.saveCampaign();
    this.phase = stageChanged ? "STAGE_RESULT" : waveChanged ? "WAVE_RESULT" : "PLAYING";
    this.phaseTimer = stageChanged ? 1.5 : waveChanged ? 1.1 : 0;
    if (!stageChanged && !waveChanged) this.banner = "NEXT ORDEAL";
  }

  private loadPuzzle(puzzle: PuzzleDescriptor, resetPlatform: boolean): void {
    this.currentPuzzle = puzzle;
    this.cubes = puzzle.layout.map((cube, index) => ({ id: `${puzzle.id}-${index}`, type: cube.type, x: cube.x, z: cube.z, previousZ: cube.z }));
    this.marker = null;
    this.areas = [];
    const platformRows = resetPlatform ? Math.max(12, (puzzle.spawnRow ?? 0) + puzzle.depth) : this.stats.platformRows;
    const retainedScore = resetPlatform ? 0 : this.stats.score;
    this.stats = { ...initialStats(puzzle.width), platformRows, score: retainedScore, requiredRolls: puzzle.requiredRolls };
    this.player = { x: Math.min(puzzle.width - 0.5, Math.max(0.5, puzzle.width / 2)), z: 0.7, heading: 0 };
    this.hasScoringStarted = false;
    this.totalRotations = 0;
    this.isRolling = false;
    this.rollElapsed = 0;
    this.settleElapsed = 0;
  }

  private start(mode: GameMode, difficulty: Difficulty, stage = 1, wave = 1, ordinal = 1): void {
    if (mode === "CAMPAIGN" && stage === 1 && wave === 1 && ordinal === 1) {
      const restored = this.readCampaign();
      if (restored) { this.restore(restored); this.mode = "CAMPAIGN"; this.phase = "PAUSED"; this.banner = "CAMPAIGN RESTORED"; return; }
    }
    this.mode = mode;
    this.difficulty = difficulty;
    const puzzle = mode === "TUTORIAL" ? makeTutorialPuzzle() : findPuzzle(this.puzzles, stage, wave, ordinal) ?? this.puzzles[0];
    this.puzzleIndex = mode === "TUTORIAL" ? 0 : this.puzzles.indexOf(puzzle);
    this.duelTurn = 0;
    this.duelScore = [0, 0];
    this.tutorialStep = 0;
    this.loadPuzzle(puzzle, true);
    this.phase = "STAGE_INTRO";
    this.phaseTimer = 0;
    this.banner = mode === "TUTORIAL" ? "TRAINING SIGNAL" : mode === "DUEL" ? "DUEL // PLAYER 1" : `STAGE ${stage}`;
    this.onSignal("menu");
  }

  private togglePause(): void {
    if (this.phase === "PAUSED") this.resumeGame(); else this.pauseGame();
  }

  private pauseGame(): void { if (this.phase !== "PAUSED") { this.phase = "PAUSED"; this.banner = "PAUSED"; } }
  private resumeGame(): void { if (this.phase === "PAUSED") { this.phase = this.mode === "TUTORIAL" ? "TUTORIAL" : "PLAYING"; this.banner = "ORDEAL ACTIVE"; } }

  private command(command: CubicCommand): void {
    if (!command) return;
    if (command.type !== "touch-move" && command.type !== "touch-fast") this.emitUserGesture();
    if (command.type === "start") { this.start(command.mode, command.difficulty, command.stage, command.wave, command.ordinal); return; }
    if (command.type === "menu") { if (this.mode === "CAMPAIGN") this.saveCampaign(); this.phase = "MENU"; this.banner = "MODE SELECT"; return; }
    if (command.type === "pause") { this.pauseGame(); return; }
    if (command.type === "resume") { this.resumeGame(); return; }
    if (command.type === "continue" && ["PUZZLE_RESULT", "WAVE_RESULT", "STAGE_RESULT"].includes(this.phase)) { this.advanceAfterResult(); return; }
    if (command.type === "rewind" && this.mode === "PRACTICE") { this.restoreHistory(); return; }
    if (command.type === "quick-save" && this.mode === "PRACTICE") { this.quickSave = this.snapshot(); this.banner = "QUICK SAVE STORED"; return; }
    if (command.type === "quick-load" && this.mode === "PRACTICE" && this.quickSave) { this.restore(this.quickSave); this.banner = "QUICK SAVE RESTORED"; return; }
    if (command.type === "step-roll" && (this.mode === "PRACTICE" || this.debug)) { this.isRolling = true; this.rollElapsed = DIFFICULTIES[this.difficulty].rollSeconds; this.finishRotation(); this.isRolling = false; return; }
    if (command.type === "touch-move") { this.input.setTouchMove(command.x, command.z); return; }
    if (command.type === "touch-fast") { this.input.setTouchFast(command.active); return; }
    if (command.type === "touch-press") { this.input.press(command.action); return; }
    if (command.type === "load-custom") { this.mode = "CREATE"; this.puzzles.unshift(command.puzzle); this.puzzleIndex = 0; this.loadPuzzle(command.puzzle, true); this.phase = "STAGE_INTRO"; this.banner = "CUSTOM ORDEAL"; return; }
    if (command.type === "set-debug") { this.debug = command.active; }
    if (command.type === "debug-platform" && this.debug) { this.stats.platformRows = Math.max(this.currentPuzzle.depth + 2, command.rows); }
    if (command.type === "auto-solve" && this.debug) { this.cubes.filter((cube) => cube.type !== "void" && !cube.captured).forEach((cube) => this.captureCube(cube, "manual")); }
  }

  private emitUserGesture(): void {
    window.dispatchEvent(new Event("cubic:user-gesture"));
  }

  private updateTutorial(moveX: number, moveZ: number): void {
    if (this.mode !== "TUTORIAL") return;
    if ((Math.abs(moveX) + Math.abs(moveZ)) > 0.1) this.tutorialStep = Math.max(this.tutorialStep, 1);
    const hints = ["1/8: 盤面を横へ走り、移動入力を確認する。", "2/8: 青いMARKを次に通る床へ置く。", "3/8: 緑のVEILがMARKへ到着したらCAPTUREする。", "4/8: 紫のVOIDがMARKへ来たら、その床へMARKを置いて保護する。", "5/8: AREAを起動し、MARK上のVOIDを残したまま必要物を回収する。", "6/8: VOIDが足場の端から落ちるのを確認する。", "7/8: 取り逃しなしのPERFECTで足場が1列増える。", "8/8: 練習問題を完了しました。MENUからCampaignへ進めます。"];
    this.hint = hints[Math.min(this.tutorialStep, hints.length - 1)];
  }

  private runDemo(dt: number): void {
    this.demoElapsed += dt;
    if ((this.phase === "PLAYING" || this.phase === "TUTORIAL") && this.demoElapsed > 1.1) {
      this.demoElapsed = 0;
      const target = this.cubes.find((cube) => cube.type !== "void" && !cube.captured && !cube.falling);
      if (target && !this.marker) { this.player.x = target.x; this.player.z = target.z; this.marker = { x: target.x, z: target.z }; this.banner = "AUTO MARK"; }
      else if (target && this.marker) this.markOrCapture();
      else if (this.areas.length) this.activateAreas();
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
    this.cubes = snapshot.cubes.map((cube) => ({ ...cube }));
    this.marker = snapshot.marker ? { ...snapshot.marker } : null;
    this.areas = snapshot.areas.map((area) => ({ ...area }));
    this.stats = { ...snapshot.stats };
    this.puzzleIndex = snapshot.puzzleIndex;
    this.currentPuzzle = this.puzzles[this.puzzleIndex] ?? this.currentPuzzle;
    this.banner = snapshot.banner;
    this.hint = snapshot.hint;
    this.duelTurn = snapshot.duelTurn;
    this.duelScore = [...snapshot.duelScore] as [number, number];
  }

  private saveCampaign(): void {
    if (this.mode !== "CAMPAIGN") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, snapshot: this.snapshot() }));
    } catch { /* local storage can be unavailable in strict privacy contexts */ }
  }

  private readCampaign(): GameSnapshot | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) as { version?: number; snapshot?: GameSnapshot } : null;
      if (saved?.version === 2 && saved.snapshot && this.puzzles[saved.snapshot.puzzleIndex]) return saved.snapshot;
    } catch { /* invalid local data starts a fresh campaign */ }
    return null;
  }

  private saveHighScore(): void {
    try {
      const current = { score: this.stats.score, mindIndex: this.mindIndex, at: Date.now() };
      const previous = JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) ?? "null") as { score?: number } | null;
      if (!previous || current.score > (previous.score ?? 0)) localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(current));
    } catch { /* score persistence is optional */ }
  }

  private snapshot(): GameSnapshot {
    return {
      phase: this.phase, mode: this.mode, difficulty: this.difficulty, player: { ...this.player }, cubes: this.cubes.map((cube) => ({ ...cube })),
      marker: this.marker ? { ...this.marker } : null, areas: this.areas.map((area) => ({ ...area })), stats: { ...this.stats },
      stage: this.currentPuzzle.stage, wave: this.currentPuzzle.wave, puzzleIndex: this.puzzleIndex, boardWidth: this.currentPuzzle.width, boardDepth: this.currentPuzzle.depth, countdown: this.phase === "COUNTDOWN" ? Math.ceil(this.phaseTimer) : 0,
      banner: this.banner, hint: this.hint, rollProgress: this.rollProgress, debug: this.debug, duelTurn: this.duelTurn, duelScore: [...this.duelScore] as [number, number], tutorialStep: this.tutorialStep,
      captureProgress: this.phase === "CAPTURE_PAUSE" ? Math.max(0, Math.min(1, 1 - this.phaseTimer / DIFFICULTIES[this.difficulty].captureSeconds)) : 0,
      crushProgress: this.phase === "CRUSHED" ? Math.max(0, Math.min(1, 1 - this.phaseTimer / 1.8)) : 0,
    };
  }

  private publish(): void { this.onPublish(this.snapshot()); }

  get rollProgress(): number { return this.isRolling ? Math.min(1, this.rollElapsed / DIFFICULTIES[this.difficulty].rollSeconds) : 0; }
  get mindIndex(): number { return calculateMindIndex(this.stats.score, this.currentPuzzle.stage, this.stats.platformRows, this.stats.misses); }
  dispose(): void { window.removeEventListener("cubic:command", this.onCommand); document.removeEventListener("visibilitychange", this.onVisibility); this.input.dispose(); }
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

function makeTutorialPuzzle(): PuzzleDescriptor {
  const width = 4; const depth = 5;
  return {
    id: "TUTORIAL-OBSERVATION-01", stage: 1, wave: 1, ordinal: 1, width, depth, spawnRow: 7, requiredRolls: 0, difficultyTag: "training", seed: 0,
    layout: [{ x: 2, z: 11, type: "veil" }, { x: 1, z: 11, type: "normal" }, { x: 3, z: 11, type: "void" }],
    solution: [{ rotation: 10, action: "mark", x: 2, z: 0 }, { rotation: 11, action: "capture", x: 2, z: 0 }, { rotation: 11, action: "mark", x: 3, z: 0 }, { rotation: 11, action: "area", x: 3, z: 0 }],
    validation: { valid: true, normal: 1, veil: 1, void: 1, travelBudget: 14 }, featured: true,
  };
}
