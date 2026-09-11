import { measureTimingMargin } from "./timingMargin";
import { simulatePuzzleSolution } from "./solutionSimulation";
import type { Difficulty, PuzzleDescriptor } from "./types";

/**
 * A small, stable set of authored encounters used as the archive quality
 * gate. The set deliberately follows the teaching curve instead of selecting
 * every ordinal-1 puzzle: it covers the first route lesson, AREA introduction,
 * the first long chain at each geometry jump, and the Final hand-off.
 */
export interface QualityRepresentativeDefinition {
  stage: number;
  wave: number;
  ordinal: number;
  label: string;
  expectedTag: string;
  width: number;
  depth: number;
  expectedAreaUses: number;
}

export const QUALITY_REPRESENTATIVES: readonly QualityRepresentativeDefinition[] =
  [
    {
      stage: 1,
      wave: 1,
      ordinal: 1,
      label: "first route read",
      expectedTag: "intro-read",
      width: 4,
      depth: 2,
      expectedAreaUses: 0,
    },
    {
      stage: 1,
      wave: 2,
      ordinal: 1,
      label: "AREA introduction",
      expectedTag: "area-intro-range",
      width: 4,
      depth: 2,
      expectedAreaUses: 1,
    },
    {
      stage: 1,
      wave: 4,
      ordinal: 1,
      label: "braided route",
      expectedTag: "read-braid",
      width: 4,
      depth: 4,
      expectedAreaUses: 0,
    },
    {
      stage: 2,
      wave: 1,
      ordinal: 1,
      label: "route pressure",
      expectedTag: "route-stagger",
      width: 4,
      depth: 5,
      expectedAreaUses: 0,
    },
    {
      stage: 2,
      wave: 3,
      ordinal: 1,
      label: "first AREA chain",
      expectedTag: "area-ribbon",
      width: 4,
      depth: 6,
      expectedAreaUses: 3,
    },
    {
      stage: 3,
      wave: 1,
      ordinal: 1,
      label: "wide route read",
      expectedTag: "wide-center",
      width: 5,
      depth: 4,
      expectedAreaUses: 0,
    },
    {
      stage: 4,
      wave: 1,
      ordinal: 1,
      label: "long chain",
      expectedTag: "long-chain-ribbon",
      width: 5,
      depth: 7,
      expectedAreaUses: 4,
    },
    {
      stage: 5,
      wave: 1,
      ordinal: 1,
      label: "six-column chain",
      expectedTag: "six-chain-ribbon",
      width: 6,
      depth: 6,
      expectedAreaUses: 3,
    },
    {
      stage: 6,
      wave: 3,
      ordinal: 1,
      label: "deep chain",
      expectedTag: "six-deep-long-ribbon",
      width: 6,
      depth: 9,
      expectedAreaUses: 5,
    },
    {
      stage: 7,
      wave: 1,
      ordinal: 1,
      label: "seven-column chain",
      expectedTag: "seven-wide-ribbon",
      width: 7,
      depth: 7,
      expectedAreaUses: 4,
    },
    {
      stage: 8,
      wave: 3,
      ordinal: 1,
      label: "late gate",
      expectedTag: "eight-wide-gate",
      width: 7,
      depth: 9,
      expectedAreaUses: 5,
    },
    {
      stage: 9,
      wave: 4,
      ordinal: 1,
      label: "Final return",
      expectedTag: "final-return-pulse",
      width: 7,
      depth: 9,
      expectedAreaUses: 5,
    },
  ] as const;

const QUALITY_DIFFICULTIES: readonly Difficulty[] = [
  "BEGINNER",
  "EASY",
  "NORMAL",
  "HARD",
  "EXTREME",
];

export interface QualityValidationSummary {
  valid: boolean;
  reason: string;
  areaUses: number;
}

export interface QualityRepresentativeResult {
  id: string;
  stage: number;
  wave: number;
  ordinal: number;
  label: string;
  difficultyTag: string;
  width: number;
  depth: number;
  areaUses: number;
  replayByDifficulty: Readonly<Record<Difficulty, boolean>>;
  minimumMarginByDifficulty: Readonly<Record<Difficulty, number>>;
  valid: boolean;
}

export interface PuzzleQualityAudit {
  valid: boolean;
  issues: string[];
  results: QualityRepresentativeResult[];
}

/**
 * Audits the authored representative set without touching renderer state.
 * `validationResults` is supplied by `validatePuzzleArchive` so the archive
 * validator does not replay its normal-difficulty checks a second time.
 */
export function auditRepresentativePuzzles(
  puzzles: readonly PuzzleDescriptor[],
  validationResults?: readonly QualityValidationSummary[]
): PuzzleQualityAudit {
  const issues: string[] = [];
  const results: QualityRepresentativeResult[] = [];
  const representedStages = new Set<number>();

  QUALITY_REPRESENTATIVES.forEach(definition => {
    const puzzle = puzzles.find(
      candidate =>
        candidate.stage === definition.stage &&
        candidate.wave === definition.wave &&
        candidate.ordinal === definition.ordinal
    );
    const location = `S${definition.stage}-W${definition.wave}-P${definition.ordinal}`;
    if (!puzzle) {
      issues.push(`${location}: quality representative is missing`);
      return;
    }

    representedStages.add(puzzle.stage);
    const validationIndex = puzzles.indexOf(puzzle);
    const validation = validationResults?.[validationIndex];
    const fallbackReplay = validation ? null : safeReplay(puzzle);
    const validationSummary = validation ?? {
      valid: fallbackReplay?.valid ?? false,
      reason: fallbackReplay?.reason ?? "validation unavailable",
      areaUses: fallbackReplay?.areaUses ?? 0,
    };
    const replayByDifficulty = {} as Record<Difficulty, boolean>;
    const minimumMarginByDifficulty = {} as Record<Difficulty, number>;
    let valid = true;

    if (puzzle.featured !== true) {
      issues.push(`${puzzle.id}: quality representative must be featured`);
      valid = false;
    }
    if (!puzzle.designIntent?.startsWith("Hand-authored")) {
      issues.push(`${puzzle.id}: quality representative is not hand-authored`);
      valid = false;
    }
    if (puzzle.difficultyTag !== definition.expectedTag) {
      issues.push(
        `${puzzle.id}: expected tag ${definition.expectedTag}, got ${puzzle.difficultyTag}`
      );
      valid = false;
    }
    if (
      puzzle.width !== definition.width ||
      puzzle.depth !== definition.depth
    ) {
      issues.push(
        `${puzzle.id}: expected ${definition.width}×${definition.depth}, got ${puzzle.width}×${puzzle.depth}`
      );
      valid = false;
    }
    if (!validationSummary.valid) {
      issues.push(
        `${puzzle.id}: archive validation failed (${validationSummary.reason})`
      );
      valid = false;
    }
    if (validationSummary.areaUses !== definition.expectedAreaUses) {
      issues.push(
        `${puzzle.id}: expected ${definition.expectedAreaUses} AREA uses, got ${validationSummary.areaUses}`
      );
      valid = false;
    }

    for (const difficulty of QUALITY_DIFFICULTIES) {
      const replay = safeReplay(puzzle, difficulty);
      const timing = safeTimingMargin(puzzle, difficulty);
      replayByDifficulty[difficulty] = replay.valid;
      minimumMarginByDifficulty[difficulty] =
        timing.minimumMarginAfterInputBudgetTicks;
      if (!replay.valid) {
        issues.push(
          `${puzzle.id} ${difficulty}: 30Hz solution replay failed (${replay.reason})`
        );
        valid = false;
      }
      if (!timing.meetsTarget) {
        issues.push(
          `${puzzle.id} ${difficulty}: timing margin below target (${timing.minimumMarginAfterInputBudgetTicks} ticks)`
        );
        valid = false;
      }
    }

    results.push({
      id: puzzle.id,
      stage: puzzle.stage,
      wave: puzzle.wave,
      ordinal: puzzle.ordinal,
      label: definition.label,
      difficultyTag: puzzle.difficultyTag,
      width: puzzle.width,
      depth: puzzle.depth,
      areaUses: validationSummary.areaUses,
      replayByDifficulty,
      minimumMarginByDifficulty,
      valid,
    });
  });

  for (let stage = 1; stage <= 9; stage += 1) {
    if (!representedStages.has(stage))
      issues.push(`Stage ${stage}: quality representative is missing`);
  }

  return { valid: issues.length === 0, issues, results };
}

interface ReplaySummary {
  valid: boolean;
  reason: string;
  areaUses: number;
}

function safeReplay(
  puzzle: PuzzleDescriptor,
  difficulty: Difficulty = "NORMAL"
): ReplaySummary {
  try {
    const replay = simulatePuzzleSolution(puzzle, { difficulty });
    return {
      valid: replay.valid,
      reason: replay.reason,
      areaUses: replay.areaUses,
    };
  } catch {
    return { valid: false, reason: "replay threw", areaUses: 0 };
  }
}

interface TimingSummary {
  meetsTarget: boolean;
  minimumMarginAfterInputBudgetTicks: number;
}

function safeTimingMargin(
  puzzle: PuzzleDescriptor,
  difficulty: Difficulty
): TimingSummary {
  try {
    const report = measureTimingMargin(puzzle, difficulty);
    return {
      meetsTarget: report.meetsTarget,
      minimumMarginAfterInputBudgetTicks:
        report.minimumMarginAfterInputBudgetTicks,
    };
  } catch {
    return {
      meetsTarget: false,
      minimumMarginAfterInputBudgetTicks: -Infinity,
    };
  }
}

export function qualityDifficultyOrder(): readonly Difficulty[] {
  return QUALITY_DIFFICULTIES;
}
