export interface DuelRoundResolution {
  scores: [number, number];
  nextTurn: 0 | 1;
  advancePuzzle: boolean;
  winner: 0 | 1 | null;
}

/** A failed player hands the same puzzle to the opponent; a PERFECT scores and advances. */
export function resolveDuelRound(scores: [number, number], turn: 0 | 1, succeeded: boolean): DuelRoundResolution {
  const nextScores: [number, number] = [...scores];
  const nextTurn = turn === 0 ? 1 : 0;
  if (!succeeded) return { scores: nextScores, nextTurn, advancePuzzle: false, winner: null };
  nextScores[turn] += 1;
  const hasWinner = (nextScores[0] >= 5 || nextScores[1] >= 5) && Math.abs(nextScores[0] - nextScores[1]) >= 2;
  return { scores: nextScores, nextTurn, advancePuzzle: true, winner: hasWinner ? turn : null };
}
