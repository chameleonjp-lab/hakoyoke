import { GameWorld } from "./GameWorld";
import {
  platformRowsForStage,
  projectPuzzleCubesToPlatform,
  shouldResetPlatformAtLoad,
} from "./platformProgression";
import {
  retainRunState,
  shouldCarryRunState,
} from "./runStateProgression";
import type {
  AreaMark,
  CubeState,
  GameMode,
  PuzzleDescriptor,
  RunStats,
} from "./types";

type GameWorldInternals = {
  currentPuzzle: PuzzleDescriptor;
  cubes: CubeState[];
  areas: AreaMark[];
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
    resetPlatform: boolean
  ): void {
    const previousPuzzle = this.currentPuzzle;
    const previousStage = previousPuzzle?.stage;
    const carriedState = shouldCarryRunState(
      previousPuzzle,
      puzzle,
      resetPlatform
    )
      ? retainRunState(this.stats.misses, this.areas)
      : null;

    originalLoadPuzzle.call(this, puzzle, resetPlatform);

    if (
      shouldResetPlatformAtLoad(
        this.mode,
        previousStage,
        puzzle.stage,
        resetPlatform
      )
    ) {
      this.stats.platformRows = platformRowsForStage(
        puzzle.stage,
        puzzle.depth
      );
    }

    if (carriedState) {
      this.stats.misses = Math.min(carriedState.misses, this.stats.missLimit);
      this.areas = carriedState.areas;
      this.stats.areaMarks = this.areas.length;
    }

    this.cubes = projectPuzzleCubesToPlatform(
      puzzle,
      this.cubes,
      this.stats.platformRows
    );
  };

  prototype.__platformProgressionPatched = true;
}
