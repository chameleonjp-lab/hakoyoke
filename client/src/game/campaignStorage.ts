export const CAMPAIGN_STORAGE_KEY = "cubic-ordeal-campaign-v1";
export const CAMPAIGN_SAVE_VERSION = 4;

const TERMINAL_PHASES = new Set(["GAME_OVER", "FINAL_RESULT"]);

export function hasRecoverableTerminalCampaign(): boolean {
  try {
    const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as {
      version?: unknown;
      snapshot?: { mode?: unknown; phase?: unknown };
    };
    return (
      saved.version === CAMPAIGN_SAVE_VERSION &&
      saved.snapshot?.mode === "CAMPAIGN" &&
      typeof saved.snapshot.phase === "string" &&
      TERMINAL_PHASES.has(saved.snapshot.phase)
    );
  } catch {
    return false;
  }
}
