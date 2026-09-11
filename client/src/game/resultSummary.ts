/** Player-facing result facts; keeps missing legacy fields from leaking as “undefined”. */
import type { GamePhase, GameSnapshot, ScoreBreakdown } from "./types";

export interface ResultSummary {
  phaseLabel: string;
  headline: string;
  detail: string;
  nextStep: string;
  score: number;
  rows: number;
  captured: number;
  normalCaptured: number;
  veilCaptured: number;
  voidCaptured: number;
  misses: number;
  missLimit: number;
  captureRotations: number;
  requiredRolls: number;
  rotations: number;
  areaMarks: number;
  scoreBreakdown: ScoreBreakdown;
}

const integerOr = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;

const scoreOr = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;

function phaseLabel(phase: GamePhase): string {
  if (phase === "GAME_OVER") return "CONTACT LOST";
  if (phase === "FINAL_RESULT") return "OBSERVATION COMPLETE";
  return "ORDEAL ANALYSIS";
}

function detailFor(phase: GamePhase, headline: string): string {
  if (phase === "GAME_OVER") {
    return headline === "FALL INTO VOID"
      ? "プレイヤーが足場の外へ出ました。安全なマスで止まってください。"
      : "足場が必要な奥行を失いました。別の進路を試してください。";
  }
  if (phase === "FINAL_RESULT") return "すべての観測対象を通過しました。";
  return "次の解析結果を待機しています。";
}

function nextStepFor(phase: GamePhase): string {
  if (phase === "GAME_OVER")
    return "RETRYで同じ問題をやり直すか、RETURN TO MENUで問題選択へ戻れます。";
  if (phase === "FINAL_RESULT")
    return "NEW CAMPAIGNで最初から、RETURN TO MENUでメニューへ戻れます。";
  return "CONTINUEで次の問題へ進みます。";
}

export function summarizeResult(snapshot: GameSnapshot): ResultSummary {
  // Result snapshots from older clients and test harnesses may omit newer fields.
  const stats = (snapshot.stats ?? {}) as Partial<GameSnapshot["stats"]>;
  const rawBreakdown = (stats.scoreBreakdown ?? {}) as Partial<ScoreBreakdown>;
  const scoreBreakdown: ScoreBreakdown = {
    manualCapture: integerOr(rawBreakdown.manualCapture),
    areaCapture: integerOr(rawBreakdown.areaCapture),
    perfectBonus: integerOr(rawBreakdown.perfectBonus),
    stageBonus: integerOr(rawBreakdown.stageBonus),
    finalBonus: integerOr(rawBreakdown.finalBonus),
  };
  const normalCaptured = integerOr(stats.normalCaptured);
  const veilCaptured = integerOr(stats.veilCaptured);
  const captureRotations = integerOr(
    stats.captureRotations,
    integerOr(stats.rotations)
  );
  const phase = snapshot.phase;
  const headline = snapshot.banner || "ORDEAL RESOLVED";

  return {
    phaseLabel: phaseLabel(phase),
    headline,
    detail: detailFor(phase, headline),
    nextStep: nextStepFor(phase),
    score: scoreOr(stats.score),
    rows: integerOr(stats.platformRows),
    captured: normalCaptured + veilCaptured,
    normalCaptured,
    veilCaptured,
    voidCaptured: integerOr(stats.voidCaptured),
    misses: integerOr(stats.misses),
    missLimit: integerOr(stats.missLimit),
    captureRotations,
    requiredRolls: integerOr(stats.requiredRolls),
    rotations: integerOr(stats.rotations),
    areaMarks: integerOr(stats.areaMarks),
    scoreBreakdown,
  };
}
