export const CAMPAIGN_STORAGE_KEY = "cubic-ordeal-campaign-v1";
/** Grid movement changed the replay contract; v4 free-movement saves archive. */
export const CAMPAIGN_SAVE_VERSION = 5;
export const CAMPAIGN_LEGACY_STORAGE_KEY = "cubic-ordeal-campaign-legacy-v1";
export const CHECKPOINT_LEGACY_STORAGE_KEY =
  "cubic-ordeal-stage-checkpoint-legacy-v1";

const TERMINAL_PHASES = new Set(["GAME_OVER", "FINAL_RESULT"]);

export interface ArchivedCampaignStorage {
  kind: "campaign" | "checkpoint";
  reason: string;
  archivedAt: string;
  raw: string;
}

export function archiveCampaignStorage(
  key: string,
  archiveKey: string,
  kind: ArchivedCampaignStorage["kind"],
  raw: string,
  reason: string
): boolean {
  try {
    const existing = JSON.parse(localStorage.getItem(archiveKey) ?? "[]");
    const entries = Array.isArray(existing) ? existing : [];
    const next: ArchivedCampaignStorage[] = [
      ...entries.filter(
        entry =>
          !(
            entry &&
            typeof entry === "object" &&
            "raw" in entry &&
            entry.raw === raw
          )
      ),
      {
        kind,
        reason,
        archivedAt: new Date().toISOString(),
        raw,
      },
    ].slice(-10);
    localStorage.setItem(archiveKey, JSON.stringify(next));
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

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
