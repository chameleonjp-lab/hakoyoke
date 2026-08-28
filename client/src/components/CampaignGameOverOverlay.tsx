import { useEffect, useState } from "react";
import { calculateMindIndex } from "@/game/rules";
import type { GameSnapshot } from "@/game/types";

function command(type: "campaign-continue" | "campaign-new"): void {
  window.dispatchEvent(
    new CustomEvent("cubic:command", { detail: { type } })
  );
}

export default function CampaignGameOverOverlay() {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const active = snapshot?.mode === "CAMPAIGN" && snapshot.phase === "GAME_OVER";

  useEffect(() => {
    const update = (event: Event) =>
      setSnapshot((event as CustomEvent<GameSnapshot>).detail);
    window.addEventListener("cubic:snapshot", update);
    return () => window.removeEventListener("cubic:snapshot", update);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("campaign-gameover-active", Boolean(active));
    return () => document.body.classList.remove("campaign-gameover-active");
  }, [active]);

  if (!active || !snapshot) return null;

  const mindIndex = calculateMindIndex(
    snapshot.stats.score,
    snapshot.stage,
    snapshot.stats.platformRows,
    snapshot.stats.misses
  );

  return (
    <>
      <style>{`
        body.campaign-gameover-active .game-shell > .overlay-panel.result { display: none; }
        .campaign-gameover-overlay { z-index: 80; }
        .campaign-gameover-actions { display: grid; gap: .65rem; width: min(28rem, 100%); }
      `}</style>
      <div className="overlay-panel result campaign-gameover-overlay">
        <span className="eyebrow">CONTACT LOST</span>
        <h2>{snapshot.banner}</h2>
        <div className="result-grid">
          <div className="hud-stat">
            <span>SCORE</span>
            <b>{String(snapshot.stats.score).padStart(6, "0")}</b>
          </div>
          <div className="hud-stat">
            <span>MIND INDEX</span>
            <b>{String(mindIndex).padStart(3, "0")}</b>
          </div>
          <div className="hud-stat">
            <span>STAGE</span>
            <b>{String(snapshot.stage).padStart(2, "0")}</b>
          </div>
        </div>
        <p>
          CONTINUEはこのステージの開始時点へ戻ります。NEW CAMPAIGNは保存を消してSTAGE 1から始めます。
        </p>
        <div className="campaign-gameover-actions">
          <button
            className="signal-action primary"
            type="button"
            onClick={() => command("campaign-continue")}
          >
            <span>CONTINUE</span>
            <small>RESTART CURRENT STAGE</small>
          </button>
          <button
            className="signal-action"
            type="button"
            onClick={() => command("campaign-new")}
          >
            <span>NEW CAMPAIGN</span>
            <small>CLEAR SAVE // STAGE 1</small>
          </button>
        </div>
      </div>
    </>
  );
}
