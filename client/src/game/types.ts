/** Obsidian Observatory: deterministic integer-grid domain; no renderer state here. */
export type CubeType = "normal" | "veil" | "void";
export type Difficulty = "BEGINNER" | "EASY" | "NORMAL" | "HARD" | "EXTREME";
export type GameMode = "TUTORIAL" | "CAMPAIGN" | "PRACTICE" | "CREATE" | "DUEL";
export type GamePhase =
  | "BOOT"
  | "TITLE"
  | "MENU"
  | "TUTORIAL"
  | "STAGE_INTRO"
  | "COUNTDOWN"
  | "PLAYING"
  | "CAPTURE_PAUSE"
  | "PUZZLE_RESULT"
  | "WAVE_RESULT"
  | "STAGE_RESULT"
  | "CRUSHED"
  | "PAUSED"
  | "GAME_OVER"
  | "FINAL_RESULT"
  | "EDITOR";

export interface GridPosition {
  x: number;
  z: number;
}

export interface CubeState extends GridPosition {
  id: string;
  type: CubeType;
  previousZ: number;
  captured?: boolean;
  falling?: boolean;
}

export interface AreaMark extends GridPosition {
  id: string;
  armed: boolean;
}

export interface SolutionStep {
  rotation: number;
  action: "mark" | "capture" | "area";
  x?: number;
  z?: number;
  /** Explicit order for multiple actions sharing one rotation. */
  sequence?: number;
}

export interface PuzzleDescriptor {
  id: string;
  stage: number;
  wave: number;
  ordinal: number;
  width: number;
  depth: number;
  spawnRow?: number;
  requiredRolls: number;
  difficultyTag: string;
  seed: number;
  layout: Array<{ x: number; z: number; type: CubeType }>;
  solution: SolutionStep[];
  validation: {
    valid: boolean;
    normal: number;
    veil: number;
    void: number;
    travelBudget: number;
  };
  featured: boolean;
  designIntent?: string;
}

export interface RunStats {
  score: number;
  rotations: number;
  requiredRolls: number;
  misses: number;
  missLimit: number;
  platformRows: number;
  areaMarks: number;
  perfect: boolean;
  normalCaptured: number;
  veilCaptured: number;
  voidCaptured: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  mode: GameMode;
  difficulty: Difficulty;
  player: { x: number; z: number; heading: number };
  cubes: CubeState[];
  marker: GridPosition | null;
  areas: AreaMark[];
  stats: RunStats;
  stage: number;
  wave: number;
  puzzleIndex: number;
  boardWidth: number;
  boardDepth: number;
  countdown: number;
  banner: string;
  hint: string;
  rollProgress: number;
  debug: boolean;
  duelTurn: number;
  duelScore: [number, number];
  tutorialStep: number;
  captureProgress: number;
  crushProgress: number;
  /** State required to restore a run without changing its phase or score. */
  pausedFromPhase?: GamePhase | null;
  phaseTimer?: number;
  rollElapsed?: number;
  settleElapsed?: number;
  isRolling?: boolean;
  hasScoringStarted?: boolean;
  elapsed?: number;
  puzzleId?: string;
  completionAwardedForPuzzle?: string | null;
}

export interface DifficultyConfig {
  rollSeconds: number;
  settleSeconds: number;
  captureSeconds: number;
  playerSpeed: number;
  assistance: "high" | "medium" | "low";
}

const PLAYER_SPEED = 4.45;

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  BEGINNER: {
    rollSeconds: 0.82,
    settleSeconds: 1.05,
    captureSeconds: 0.82,
    playerSpeed: PLAYER_SPEED,
    assistance: "high",
  },
  EASY: {
    rollSeconds: 0.72,
    settleSeconds: 0.9,
    captureSeconds: 0.7,
    playerSpeed: PLAYER_SPEED,
    assistance: "high",
  },
  NORMAL: {
    rollSeconds: 0.62,
    settleSeconds: 0.76,
    captureSeconds: 0.58,
    playerSpeed: PLAYER_SPEED,
    assistance: "medium",
  },
  HARD: {
    rollSeconds: 0.52,
    settleSeconds: 0.62,
    captureSeconds: 0.46,
    playerSpeed: PLAYER_SPEED,
    assistance: "low",
  },
  EXTREME: {
    rollSeconds: 0.44,
    settleSeconds: 0.54,
    captureSeconds: 0.38,
    playerSpeed: PLAYER_SPEED,
    assistance: "low",
  },
};

export const initialStats = (width: number): RunStats => ({
  score: 0,
  rotations: 0,
  requiredRolls: 0,
  misses: 0,
  missLimit: Math.max(1, width - 1),
  platformRows: 12,
  areaMarks: 0,
  perfect: true,
  normalCaptured: 0,
  veilCaptured: 0,
  voidCaptured: 0,
});
