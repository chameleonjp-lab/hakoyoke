import { GameWorld, type CubicCommand } from "./GameWorld";
import {
  makeStageCheckpoint,
  shouldAwardStageCompletion,
  stageCompletionBonus,
} from "./campaignLifecycle";
import type {
  Difficulty,
  GameMode,
  GamePhase,
  GameSnapshot,
  PuzzleDescriptor,
  RunStats,
} from "./types";

const CHECKPOINT_KEY = "cubic-ordeal-stage-checkpoint-v1";
const CAMPAIGN_SAVE_KEY = "cubic-ordeal-campaign-v1";

type CampaignCommand =
  | CubicCommand
  | { type: "campaign-continue" }
  | { type: "campaign-new" };

type GameWorldInternals = {
  mode: GameMode;
  difficulty: Difficulty;
  phase: GamePhase;
  phaseTimer: number;
  banner: string;
  currentPuzzle: PuzzleDescriptor;
  puzzles: PuzzleDescriptor[];
  puzzleIndex: number;
  stats: RunStats;
  command(command: CubicCommand): void;
  advanceAfterResult(): void;
  loadPuzzle(puzzle: PuzzleDescriptor, resetPlatform: boolean): void;
  snapshot(): GameSnapshot;
  restore(snapshot: GameSnapshot): void;
  saveCampaign(): void;
};

type PatchedPrototype = GameWorldInternals & {
  __campaignLifecyclePatched?: boolean;
};

function writeCheckpoint(world: GameWorldInternals): void {
  try {
    localStorage.setItem(
      CHECKPOINT_KEY,
      JSON.stringify(makeStageCheckpoint(world.snapshot()))
    );
  } catch {
    // Storage can be unavailable in strict privacy contexts.
  }
}

function readCheckpoint(): GameSnapshot | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    return raw ? (JSON.parse(raw) as GameSnapshot) : null;
  } catch {
    return null;
  }
}

function clearCampaignStorage(): void {
  try {
    localStorage.removeItem(CAMPAIGN_SAVE_KEY);
    localStorage.removeItem(CHECKPOINT_KEY);
  } catch {
    // Storage can be unavailable in strict privacy contexts.
  }
}

const prototype = GameWorld.prototype as unknown as PatchedPrototype;

if (!prototype.__campaignLifecyclePatched) {
  const originalCommand = prototype.command;
  const originalAdvanceAfterResult = prototype.advanceAfterResult;

  prototype.command = function (
    this: GameWorldInternals,
    command: CubicCommand
  ): void {
    const extended = command as CampaignCommand;

    if (extended.type === "campaign-new") {
      clearCampaignStorage();
      originalCommand.call(this, {
        type: "start",
        mode: "CAMPAIGN",
        difficulty: this.difficulty,
        stage: 1,
        wave: 1,
        ordinal: 1,
      });
      if (this.mode === "CAMPAIGN" && this.phase === "STAGE_INTRO") {
        writeCheckpoint(this);
        this.saveCampaign();
      }
      return;
    }

    if (extended.type === "campaign-continue") {
      if (this.mode !== "CAMPAIGN" || this.phase !== "GAME_OVER") return;

      const checkpoint = readCheckpoint();
      if (
        checkpoint &&
        checkpoint.mode === "CAMPAIGN" &&
        checkpoint.stage === this.currentPuzzle.stage
      ) {
        this.restore(makeStageCheckpoint(checkpoint));
      } else {
        const stageStartIndex = this.puzzles.findIndex(
          puzzle => puzzle.stage === this.currentPuzzle.stage
        );
        const stageStart = this.puzzles[stageStartIndex];
        if (!stageStart) return;
        const retainedScore = this.stats.score;
        this.puzzleIndex = stageStartIndex;
        this.loadPuzzle(stageStart, true);
        this.stats.score = retainedScore;
        this.phase = "STAGE_INTRO";
        this.phaseTimer = 0;
        this.banner = `STAGE ${stageStart.stage} // CONTINUE`;
        writeCheckpoint(this);
      }
      this.saveCampaign();
      return;
    }

    const campaignStart =
      extended.type === "start" && extended.mode === "CAMPAIGN";
    originalCommand.call(this, command);
    if (campaignStart && this.mode === "CAMPAIGN" && this.phase === "STAGE_INTRO") {
      writeCheckpoint(this);
      this.saveCampaign();
    }
  };

  prototype.advanceAfterResult = function (this: GameWorldInternals): void {
    const next = this.puzzles[this.puzzleIndex + 1];
    const stageBoundary = shouldAwardStageCompletion(
      this.mode,
      this.phase,
      this.currentPuzzle,
      next
    );

    if (stageBoundary) {
      this.stats.score += stageCompletionBonus(this.stats.platformRows);
    }

    originalAdvanceAfterResult.call(this);

    if (stageBoundary && this.mode === "CAMPAIGN") {
      writeCheckpoint(this);
      this.saveCampaign();
    }
  };

  prototype.__campaignLifecyclePatched = true;
}
