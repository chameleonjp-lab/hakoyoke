/** Obsidian Observatory: JSON-backed puzzle loading; program logic never owns layouts. */
import type { PuzzleDescriptor } from "./types";

export async function loadPuzzles(): Promise<PuzzleDescriptor[]> {
  const response = await fetch("/data/puzzles.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Puzzle archive could not be loaded.");
  return (await response.json()) as PuzzleDescriptor[];
}

export function findPuzzle(
  puzzles: PuzzleDescriptor[],
  stage: number,
  wave: number,
  ordinal: number,
): PuzzleDescriptor | undefined {
  return puzzles.find((puzzle) => puzzle.stage === stage && puzzle.wave === wave && puzzle.ordinal === ordinal);
}

