/** Lightweight practice metadata used before the Babylon runtime is loaded. */
import { parsePuzzleDescriptor } from "./puzzleValidation";
import type { PuzzleDescriptor } from "./types";

export interface PracticePuzzleSummary {
  id: string;
  stage: number;
  wave: number;
  ordinal: number;
  width: number;
  depth: number;
  requiredRolls: number;
  difficultyTag: string;
  normal: number;
  veil: number;
  void: number;
  designIntent: string;
}

function countType(puzzle: PuzzleDescriptor, type: "normal" | "veil" | "void") {
  return puzzle.layout.filter(cube => cube.type === type).length;
}

/** Converts an archive entry into the small, player-facing preview shape. */
export function summarizePracticePuzzle(
  value: unknown
): PracticePuzzleSummary | null {
  const parsed = parsePuzzleDescriptor(value);
  if (!parsed.valid || !parsed.puzzle) return null;
  const puzzle = parsed.puzzle;
  return {
    id: puzzle.id,
    stage: puzzle.stage,
    wave: puzzle.wave,
    ordinal: puzzle.ordinal,
    width: puzzle.width,
    depth: puzzle.depth,
    requiredRolls: puzzle.requiredRolls,
    difficultyTag: puzzle.difficultyTag,
    normal: countType(puzzle, "normal"),
    veil: countType(puzzle, "veil"),
    void: countType(puzzle, "void"),
    designIntent: puzzle.designIntent ?? "この問題の安全なルートを読む。",
  };
}

/** Parses only metadata; the runtime performs the full archive validation at start. */
export function parsePracticeCatalog(value: unknown): PracticePuzzleSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(summarizePracticePuzzle)
    .filter((summary): summary is PracticePuzzleSummary => summary !== null)
    .sort(
      (left, right) =>
        left.stage - right.stage ||
        left.wave - right.wave ||
        left.ordinal - right.ordinal
    );
}

export function findPracticePuzzle(
  catalog: readonly PracticePuzzleSummary[],
  stage: number,
  wave: number,
  ordinal: number
): PracticePuzzleSummary | undefined {
  return catalog.find(
    puzzle =>
      puzzle.stage === stage &&
      puzzle.wave === wave &&
      puzzle.ordinal === ordinal
  );
}

/** Keeps the preview language focused on the decision the player is practicing. */
export function practiceFocus(tag: string): string {
  if (tag.startsWith("intro")) return "安全な列を読み、VOIDを避ける";
  if (tag.includes("long")) return "長い奥行で発射タイミングを管理する";
  if (tag.includes("area")) return "VEILを捕獲し、AREAの範囲を使う";
  if (tag.includes("chain")) return "AREA連鎖と外周レーンを切り替える";
  if (tag.includes("wide") || tag.startsWith("six"))
    return "広い盤面で中央と外周を読み替える";
  if (tag.startsWith("read")) return "次の安全マスへ先回りする";
  return "盤面のルートを読み、1マスずつ進む";
}
