import { GameWorld } from "./GameWorld";
import {
  platformRowsForStage,
  projectPuzzleCubesToPlatform,
  shouldResetPlatformAtLoad,
} from "./platformProgression";
import type { CubeState, GameMode, PuzzleDescriptor, RunStats } from "./types";

type GameWorldInternals = {
  currentPuzzle: PuzzleDescriptor;
  cubes: CubeState[];
  stats: RunStats;
  mode: GameMode;
  loadPuzzle(puzzle: PuzzleDescriptor, resetPlatform: boolean): void;
};

type PatchedPrototype = GameWorldInternals & {
  __platformProgressionPatched?: boolean;
};

const prototype = GameWorld.prototype as unknown as PatchedPrototype;

if (!prototype.__platformProgressionPatched) {
  const originalLoadPuzzle = prototype.loadPuzzle;

  prototype.loadPuzzle = function (
    this: GameWorldInternals,
    puzzle: PuzzleDescriptor,
    resetPlatform: boolean,
  ): void {
    const previousStage = this.currentPuzzle?.stage;
    originalLoadPuzzle.call(this, puzzle, resetPlatform);

    if (
      shouldResetPlatformAtLoad(
        this.mode,
        previousStage,
        puzzle.stage,
        resetPlatform,
      )
    ) {
      this.stats.platformRows = platformRowsForStage(puzzle.stage, puzzle.depth);
    }

    this.cubes = projectPuzzleCubesToPlatform(
      puzzle,
      this.cubes,
      this.stats.platformRows,
    );
  };

  prototype.__platformProgressionPatched = true;
}
