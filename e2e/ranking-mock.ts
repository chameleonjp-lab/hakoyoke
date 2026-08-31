import type { Page, Route } from "@playwright/test";

export const E2E_PLAYER_NAME = "E2E PLAYER";
export const PLAYER_NAME_STORAGE_KEY = "chameleonjp_hakoyoke_player_name";
export const BLANK_NAME_SESSION_KEY = "hakoyoke-e2e-blank-name";

const CLIENT_VERSION = "hakoyoke-20260831-01";
const GAME_SLUG = "hakoyoke";

function playId(index: number): string {
  return `${index.toString(16).padStart(8, "0")}-2222-4222-8222-222222222222`;
}

function bodyOf(route: Route): Record<string, unknown> {
  return (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
}

export async function installRankingMock(page: Page): Promise<void> {
  const plays = new Map<string, string>();
  let nextPlay = 1;
  await page.addInitScript(
    ({ blankKey, nameKey, playerName }) => {
      if (sessionStorage.getItem(blankKey) !== "1") {
        localStorage.setItem(nameKey, playerName);
      }
    },
    {
      blankKey: BLANK_NAME_SESSION_KEY,
      nameKey: PLAYER_NAME_STORAGE_KEY,
      playerName: E2E_PLAYER_NAME,
    }
  );
  await page.route("**/rest/v1/rpc/**", async route => {
    const rpc = new URL(route.request().url()).pathname.split("/").at(-1);
    const payload = bodyOf(route);
    let result: unknown;
    switch (rpc) {
      case "start_game_play_v1": {
        const startId = String(payload.p_start_id);
        const existing = plays.get(startId);
        const id = existing ?? playId(nextPlay++);
        plays.set(startId, id);
        result = {
          accepted: true,
          duplicate: Boolean(existing),
          start_id: startId,
          play_id: id,
          game_slug: GAME_SLUG,
          display_name: payload.p_display_name,
          normalized_name: payload.p_display_name,
          client_version: CLIENT_VERSION,
        };
        break;
      }
      case "finish_game_play_v1":
        result = {
          accepted: true,
          duplicate: false,
          play_id: payload.p_play_id,
          game_slug: GAME_SLUG,
          result_type: payload.p_result_type,
          reached_wave: payload.p_reached_wave,
          score: payload.p_score,
        };
        break;
      case "submit_score_idempotent_v1":
        result = [
          {
            accepted: true,
            result_submission_id: payload.p_submission_id,
            result_play_id: payload.p_play_id,
            result_normalized_name: String(
              payload.p_display_name
            ).toLowerCase(),
            result_display_name: payload.p_display_name,
            result_first_score: payload.p_score,
            result_best_score: payload.p_score,
            result_play_count: 1,
            is_first_play: true,
            is_new_best: true,
            was_duplicate: false,
          },
        ];
        break;
      case "get_best_score_ranking":
        result = [
          { rank_no: 1, display_name: "ALPHA", best_score: 9000 },
          { rank_no: 1, display_name: "BETA", best_score: 9000 },
          { rank_no: 3, display_name: "GAMMA", best_score: 8000 },
        ];
        break;
      default:
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ code: "mock_missing", message: String(rpc) }),
        });
        return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
}

export async function installGameCanvasStub(page: Page): Promise<void> {
  await page.route("**/src/components/GameCanvas.tsx*", async route => {
    await route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: `
        let notified = false;
        export default function GameCanvas({ onReady, onFirstFrame }) {
          if (!notified) {
            notified = true;
            queueMicrotask(() => {
              onReady();
              onFirstFrame();
            });
          }
          return {
            $$typeof: Symbol.for("react.transitional.element"),
            type: "canvas",
            key: null,
            props: { className: "game-canvas", "aria-hidden": "true" },
            _owner: null,
            _store: {}
          };
        }
      `,
    });
  });
}
