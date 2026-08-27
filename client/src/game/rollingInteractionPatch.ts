import { GameWorld } from "./GameWorld";
import { areaTargets, markerCanCapture } from "./rules";
import {
  DIFFICULTIES,
  type AreaMark,
  type CubeState,
  type Difficulty,
  type GameMode,
  type GamePhase,
  type GridPosition,
  type RunStats,
} from "./types";

type CaptureOptions = { batch?: boolean };

type GameWorldInteractions = {
  marker: GridPosition | null;
  cubes: CubeState[];
  areas: AreaMark[];
  stats: RunStats;
  isRolling: boolean;
  rollProgress: number;
  phase: GamePhase;
  phaseTimer: number;
  difficulty: Difficulty;
  mode: GameMode;
  tutorialStep: number;
  banner: string;
  captureCube(
    cube: CubeState,
    source: "manual" | "area",
    options?: CaptureOptions
  ): void;
  resolveIfEmpty(): void;
  onSignal(signal: string): void;
};

type PatchedPrototype = GameWorldInteractions & {
  markOrCapture(): void;
  activateAreas(): void;
  __rollingInteractionPatched?: boolean;
};

const prototype = GameWorld.prototype as unknown as PatchedPrototype;

if (!prototype.__rollingInteractionPatched) {
  prototype.markOrCapture = function (this: GameWorldInteractions): void {
    if (!this.marker) {
      this.marker = {
        x: Math.round((this as unknown as { player: { x: number } }).player.x),
        z: Math.round((this as unknown as { player: { z: number } }).player.z),
      };
      this.banner = "MARK SET";
      this.onSignal("mark");
      if (this.mode === "TUTORIAL") {
        const protectsVoid = this.cubes.some(
          cube =>
            cube.type === "void" &&
            markerCanCapture(
              this.marker,
              cube,
              this.rollProgress,
              this.isRolling
            )
        );
        this.tutorialStep = Math.max(this.tutorialStep, protectsVoid ? 3 : 1);
      }
      return;
    }

    const target = this.cubes.find(cube =>
      markerCanCapture(this.marker, cube, this.rollProgress, this.isRolling)
    );
    if (!target) {
      this.marker = null;
      this.banner = "MARK CLEARED";
      this.onSignal("mark");
      return;
    }

    this.captureCube(target, "manual");
    this.marker = null;
  };

  prototype.activateAreas = function (this: GameWorldInteractions): void {
    if (!this.areas.length) {
      this.banner = "NO VEIL ANCHORS";
      return;
    }

    const activeAreas = this.areas.map(area => ({ ...area }));
    this.areas = [];
    this.stats.areaMarks = 0;
    const targets = areaTargets(
      this.cubes,
      activeAreas,
      this.marker,
      this.rollProgress,
      this.isRolling
    );
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
  };

  prototype.__rollingInteractionPatched = true;
}
