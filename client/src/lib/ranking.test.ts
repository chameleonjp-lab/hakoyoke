import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RANKING_CONFIG,
  RANKING_STORAGE_KEYS,
  createRankingClient,
  formatRankingScore,
  validatePlayerName,
} from "./ranking";

const START_ID = "11111111-1111-4111-8111-111111111111";
const PLAY_ID = "22222222-2222-4222-8222-222222222222";
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_START_ID = "44444444-4444-4444-8444-444444444444";
const SECOND_PLAY_ID = "55555555-5555-4555-8555-555555555555";
const SECOND_SUBMISSION_ID = "66666666-6666-4666-8666-666666666666";
const THIRD_SUBMISSION_ID = "77777777-7777-4777-8777-777777777777";
const THIRD_PLAY_ID = "88888888-8888-4888-8888-888888888888";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    get length() {
      return values.size;
    },
  };
}

function partitionedStorage(shared: Map<string, string>) {
  const local = new Map<string, string>();
  const isShared = (key: string): boolean =>
    key === RANKING_STORAGE_KEYS.completed ||
    key.startsWith(`${RANKING_STORAGE_KEYS.completed}:`);
  const keys = (): string[] =>
    Array.from(new Set([...local.keys(), ...shared.keys()]));
  return {
    getItem(key: string) {
      return (isShared(key) ? shared : local).get(key) ?? null;
    },
    setItem(key: string, value: string) {
      (isShared(key) ? shared : local).set(key, value);
    },
    removeItem(key: string) {
      (isShared(key) ? shared : local).delete(key);
    },
    key(index: number) {
      return keys()[index] ?? null;
    },
    get length() {
      return keys().length;
    },
  };
}

function startResponse(startId = START_ID) {
  return {
    accepted: true,
    duplicate: false,
    start_id: startId,
    play_id: PLAY_ID,
    game_slug: RANKING_CONFIG.gameSlug,
    display_name: "山田 太郎",
    normalized_name: "山田 太郎",
    client_version: RANKING_CONFIG.clientVersion,
  };
}

function finishResponse(duplicate = false) {
  return {
    accepted: true,
    duplicate,
    play_id: PLAY_ID,
    game_slug: RANKING_CONFIG.gameSlug,
    result_type: "game_over",
    reached_wave: 3,
    score: 4200,
  };
}

function submitResponse() {
  return [
    {
      accepted: true,
      result_submission_id: SUBMISSION_ID,
      result_play_id: PLAY_ID,
      result_normalized_name: "山田 太郎",
      result_display_name: "山田 太郎",
      result_first_score: 4200,
      result_best_score: 4200,
      result_play_count: 1,
      is_first_play: true,
      is_new_best: true,
      was_duplicate: false,
    },
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("ranking integration contract", () => {
  it("keeps interior spaces and validates names with the server's 20-character rule", () => {
    expect(validatePlayerName("  山田 太郎  ")).toEqual({
      ok: true,
      name: "山田 太郎",
    });
    expect(validatePlayerName("😀".repeat(20))).toEqual({
      ok: true,
      name: "😀".repeat(20),
    });
    expect(validatePlayerName("😀".repeat(21))).toEqual({
      ok: false,
      message: "プレイヤー名は20文字以内で入力してください。",
    });
    expect(validatePlayerName("abc\u0000def").ok).toBe(false);
    expect(formatRankingScore(4200)).toBe("4200点");
  });

  it("reuses the same start_id after a retryable start failure", async () => {
    const storage = memoryStorage();
    const payloads: Array<Record<string, unknown>> = [];
    let attempt = 0;
    const client = createRankingClient({
      storage,
      makeUuid: () => START_ID,
      fetchImpl: async (_input, init) => {
        payloads.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>
        );
        attempt += 1;
        return attempt === 1
          ? response({ code: "PT500", message: "temporary" }, 503)
          : response(startResponse());
      },
    });

    await expect(client.startCampaignPlay("山田 太郎")).rejects.toMatchObject({
      retryable: true,
    });
    await expect(client.startCampaignPlay("山田 太郎")).resolves.toEqual({
      startId: START_ID,
      playId: PLAY_ID,
      resumed: false,
    });
    await expect(client.startCampaignPlay("山田 太郎")).resolves.toEqual({
      startId: START_ID,
      playId: PLAY_ID,
      resumed: true,
    });
    expect(payloads.map(payload => payload.p_start_id)).toEqual([
      START_ID,
      START_ID,
    ]);
  });

  it("retries a missing campaign start before submitting the result", async () => {
    const storage = memoryStorage();
    const ids = [START_ID, SUBMISSION_ID];
    let startAttempts = 0;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const rpc = String(input).split("/").at(-1);
        const payload = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        if (rpc === RANKING_CONFIG.startRpc) {
          startAttempts += 1;
          return startAttempts === 1
            ? response({ code: "PT500", message: "temporary" }, 503)
            : response(startResponse(String(payload.p_start_id)));
        }
        if (rpc === RANKING_CONFIG.finishRpc) return response(finishResponse());
        return response(submitResponse());
      }
    );
    const client = createRankingClient({
      storage,
      makeUuid: () => ids.shift() ?? SUBMISSION_ID,
      fetchImpl,
    });

    await expect(client.startCampaignPlay("山田 太郎")).rejects.toMatchObject({
      retryable: true,
    });
    await expect(
      client.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 3,
        score: 4200,
      })
    ).resolves.toMatchObject({ state: "submitted" });
    expect(startAttempts).toBe(2);
    expect(storage.getItem(RANKING_STORAGE_KEYS.deferred)).toBeNull();
    expect(storage.getItem(RANKING_STORAGE_KEYS.pending)).toBe("[]");
  });

  it("persists a result without a play_id and retries its start after reload", async () => {
    const storage = memoryStorage();
    let startAttempts = 0;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const rpc = String(input).split("/").at(-1);
        const payload = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        if (rpc === RANKING_CONFIG.startRpc) {
          startAttempts += 1;
          return startAttempts <= 2
            ? response({ code: "PT500", message: "temporary" }, 503)
            : response(startResponse(String(payload.p_start_id)));
        }
        if (rpc === RANKING_CONFIG.finishRpc) return response(finishResponse());
        return response(submitResponse());
      }
    );
    const firstPage = createRankingClient({
      storage,
      makeUuid: () => (startAttempts === 0 ? START_ID : SUBMISSION_ID),
      fetchImpl,
    });

    await expect(
      firstPage.startCampaignPlay("山田 太郎")
    ).rejects.toMatchObject({
      retryable: true,
    });
    await expect(
      firstPage.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 3,
        score: 4200,
      })
    ).resolves.toMatchObject({ state: "retryable_failed" });
    expect(firstPage.hasRetryablePendingCampaignResult()).toBe(true);
    expect(storage.getItem(RANKING_STORAGE_KEYS.deferred)).not.toBeNull();

    const reloadedPage = createRankingClient({
      storage,
      makeUuid: () => {
        throw new Error("reload retry must reuse stored IDs");
      },
      fetchImpl,
    });
    await expect(
      reloadedPage.retryPendingCampaignResult()
    ).resolves.toMatchObject({ state: "submitted" });
    expect(startAttempts).toBe(3);
    expect(storage.getItem(RANKING_STORAGE_KEYS.deferred)).toBeNull();
    expect(storage.getItem(RANKING_STORAGE_KEYS.pending)).toBe("[]");
  });

  it("coalesces rapid replay clicks into one forced start request", async () => {
    let release: ((value: Response) => void) | undefined;
    const waiting = new Promise<Response>(resolve => {
      release = resolve;
    });
    const fetchImpl = vi.fn(() => waiting);
    const makeUuid = vi.fn(() => START_ID);
    const client = createRankingClient({
      storage: memoryStorage(),
      fetchImpl,
      makeUuid,
    });

    const first = client.startCampaignPlay("山田 太郎", { forceNew: true });
    const second = client.startCampaignPlay("山田 太郎", { forceNew: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(makeUuid).toHaveBeenCalledTimes(1);
    release?.(response(startResponse()));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { startId: START_ID, playId: PLAY_ID, resumed: false },
      { startId: START_ID, playId: PLAY_ID, resumed: false },
    ]);
  });

  it("marks a changed-name start as fresh so an old campaign is not restored", async () => {
    const ids = [START_ID, SECOND_START_ID];
    const fetchImpl = vi.fn(async (_input, init) => {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const second = payload.p_start_id === SECOND_START_ID;
      return response({
        ...startResponse(String(payload.p_start_id)),
        play_id: second ? SECOND_PLAY_ID : PLAY_ID,
        display_name: payload.p_display_name,
        normalized_name: String(payload.p_display_name).toLowerCase(),
      });
    });
    const client = createRankingClient({
      storage: memoryStorage(),
      makeUuid: () => ids.shift() ?? SECOND_START_ID,
      fetchImpl,
    });

    await expect(client.startCampaignPlay("ALICE")).resolves.toMatchObject({
      playId: PLAY_ID,
      resumed: false,
    });
    await expect(client.startCampaignPlay("BOB")).resolves.toMatchObject({
      playId: SECOND_PLAY_ID,
      resumed: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps in-memory session and pending data authoritative when persistence writes fail", async () => {
    const storedSession = {
      version: 1,
      startId: START_ID,
      playId: PLAY_ID,
      displayName: "ALICE",
      gameSlug: RANKING_CONFIG.gameSlug,
      clientVersion: RANKING_CONFIG.clientVersion,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    const storedPending = {
      version: 1,
      submissionId: SUBMISSION_ID,
      playId: PLAY_ID,
      displayName: "ALICE",
      gameSlug: RANKING_CONFIG.gameSlug,
      clientVersion: RANKING_CONFIG.clientVersion,
      resultType: "game_over",
      reachedStage: 2,
      score: 1200,
      createdAt: new Date().toISOString(),
      attemptCount: 1,
      state: "retryable_failed",
    };
    const values = new Map<string, string>([
      [RANKING_STORAGE_KEYS.session, JSON.stringify(storedSession)],
      [RANKING_STORAGE_KEYS.pending, JSON.stringify([storedPending])],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, _value: string) => {
        if (
          key === RANKING_STORAGE_KEYS.session ||
          key === RANKING_STORAGE_KEYS.pending
        ) {
          throw new Error("quota exceeded");
        }
      },
      removeItem: (key: string) => values.delete(key),
    };
    const ids = [SECOND_START_ID, SECOND_SUBMISSION_ID, THIRD_SUBMISSION_ID];
    const scoreSubmissionIds: unknown[] = [];
    let submitAttempts = 0;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const rpc = String(input).split("/").at(-1);
        const payload = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        if (rpc === RANKING_CONFIG.startRpc) {
          return response({
            ...startResponse(String(payload.p_start_id)),
            play_id: SECOND_PLAY_ID,
            display_name: payload.p_display_name,
            normalized_name: payload.p_display_name,
          });
        }
        if (rpc === RANKING_CONFIG.finishRpc) {
          return response({
            accepted: true,
            duplicate: submitAttempts > 0,
            play_id: SECOND_PLAY_ID,
            game_slug: RANKING_CONFIG.gameSlug,
            result_type: "game_over",
            reached_wave: 3,
            score: 4200,
          });
        }
        scoreSubmissionIds.push(payload.p_submission_id);
        submitAttempts += 1;
        if (submitAttempts === 1) {
          return response({ code: "PT500", message: "temporary" }, 503);
        }
        return response([
          {
            accepted: true,
            result_submission_id: payload.p_submission_id,
            result_play_id: SECOND_PLAY_ID,
            result_normalized_name: "BOB",
            result_display_name: "BOB",
            result_first_score: 4200,
            result_best_score: 4200,
            result_play_count: 1,
            is_first_play: true,
            is_new_best: true,
            was_duplicate: false,
          },
        ]);
      }
    );
    const client = createRankingClient({
      storage,
      makeUuid: () => ids.shift() ?? THIRD_SUBMISSION_ID,
      fetchImpl,
    });

    await client.startCampaignPlay("BOB");
    const result = {
      displayName: "BOB",
      resultType: "game_over" as const,
      reachedStage: 3,
      score: 4200,
    };
    await expect(
      client.finishAndSubmitCampaignResult(result)
    ).resolves.toMatchObject({
      state: "retryable_failed",
    });
    await expect(
      client.finishAndSubmitCampaignResult(result)
    ).resolves.toMatchObject({
      state: "submitted",
    });
    expect(scoreSubmissionIds).toEqual([
      SECOND_SUBMISSION_ID,
      SECOND_SUBMISSION_ID,
    ]);
  });

  it("persists one submission_id and reuses it after reload and retry", async () => {
    const storage = memoryStorage();
    const requests: Array<{ rpc: string; payload: Record<string, unknown> }> =
      [];
    const ids = [START_ID, SUBMISSION_ID];
    let submitAttempts = 0;
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const rpc = String(input).split("/").at(-1) ?? "";
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push({ rpc, payload });
      if (rpc === RANKING_CONFIG.startRpc) return response(startResponse());
      if (rpc === RANKING_CONFIG.finishRpc) {
        return response(finishResponse(submitAttempts > 0));
      }
      if (rpc === RANKING_CONFIG.scoreRpc) {
        submitAttempts += 1;
        return submitAttempts === 1
          ? response({ code: "PT500", message: "temporary" }, 503)
          : response(submitResponse());
      }
      throw new Error(`unexpected RPC ${rpc}`);
    };
    const firstPage = createRankingClient({
      storage,
      makeUuid: () => ids.shift() ?? SUBMISSION_ID,
      fetchImpl,
    });

    await firstPage.startCampaignPlay("山田 太郎");
    await expect(
      firstPage.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 3,
        score: 4200,
      })
    ).resolves.toMatchObject({ state: "retryable_failed" });

    const reloadedPage = createRankingClient({
      storage,
      makeUuid: () => {
        throw new Error("retry must not create another UUID");
      },
      fetchImpl,
    });
    await expect(
      reloadedPage.retryPendingCampaignResult()
    ).resolves.toMatchObject({
      state: "submitted",
    });

    const submissions = requests.filter(
      request => request.rpc === RANKING_CONFIG.scoreRpc
    );
    expect(submissions).toHaveLength(2);
    expect(submissions.map(request => request.payload.p_submission_id)).toEqual(
      [SUBMISSION_ID, SUBMISSION_ID]
    );
    expect(
      requests.filter(request => request.rpc === RANKING_CONFIG.finishRpc)
    ).toHaveLength(2);
    expect(storage.getItem(RANKING_STORAGE_KEYS.pending)).toBe("[]");
    expect(
      JSON.parse(storage.getItem(RANKING_STORAGE_KEYS.completed) ?? "[]")
    ).toHaveLength(1);
    await expect(
      reloadedPage.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 3,
        score: 4200,
      })
    ).resolves.toMatchObject({ state: "submitted" });
    expect(
      requests.filter(request => request.rpc === RANKING_CONFIG.scoreRpc)
    ).toHaveLength(2);
  });

  it("uses server rank_no so tied positions are not replaced by array indexes", async () => {
    const client = createRankingClient({
      storage: memoryStorage(),
      fetchImpl: async () =>
        response([
          { rank_no: 1, display_name: "A", best_score: 9000 },
          { rank_no: 1, display_name: "B", best_score: 9000 },
          { rank_no: 3, display_name: "C", best_score: 8000 },
        ]),
    });

    await expect(client.loadBestRanking()).resolves.toEqual([
      { rankNo: 1, name: "A", score: 9000 },
      { rankNo: 1, name: "B", score: 9000 },
      { rankNo: 3, name: "C", score: 8000 },
    ]);
  });

  it("rejects a ranking response that exceeds the requested top ten", async () => {
    const client = createRankingClient({
      storage: memoryStorage(),
      fetchImpl: async () =>
        response(
          Array.from({ length: 11 }, (_, index) => ({
            rank_no: index + 1,
            display_name: `P${index + 1}`,
            best_score: 1000 - index,
          }))
        ),
    });

    await expect(client.loadBestRanking()).rejects.toMatchObject({
      code: "invalid_response",
      retryable: false,
    });
  });

  it("rejects a successful HTTP response whose RPC payload does not match", async () => {
    const client = createRankingClient({
      storage: memoryStorage(),
      makeUuid: () => START_ID,
      fetchImpl: async () =>
        response({ ...startResponse(), game_slug: "another_game" }),
    });

    await expect(client.startCampaignPlay("山田 太郎")).rejects.toMatchObject({
      code: "invalid_response",
      retryable: false,
    });
  });

  it("keeps the request timeout active while the response body is read", async () => {
    const client = createRankingClient({
      storage: memoryStorage(),
      makeUuid: () => START_ID,
      timeoutMs: 5,
      fetchImpl: async (_input, init) =>
        ({
          ok: true,
          status: 200,
          text: () =>
            new Promise<string>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
        }) as Response,
    });

    await expect(client.startCampaignPlay("山田 太郎")).rejects.toMatchObject({
      code: "timeout",
      retryable: true,
    });
  });

  it("does not accept a submit response with malformed aggregate fields", async () => {
    const ids = [START_ID, SUBMISSION_ID];
    const fetchImpl = vi.fn(async input => {
      const rpc = String(input).split("/").at(-1);
      if (rpc === RANKING_CONFIG.startRpc) return response(startResponse());
      if (rpc === RANKING_CONFIG.finishRpc) return response(finishResponse());
      return response([{ ...submitResponse()[0], result_play_count: "1" }]);
    });
    const client = createRankingClient({
      storage: memoryStorage(),
      makeUuid: () => ids.shift() ?? SUBMISSION_ID,
      fetchImpl,
    });

    await client.startCampaignPlay("山田 太郎");
    const result = {
      displayName: "山田 太郎",
      resultType: "game_over" as const,
      reachedStage: 3,
      score: 4200,
    };
    await expect(
      client.finishAndSubmitCampaignResult(result)
    ).resolves.toMatchObject({ state: "permanent_failed" });
    await expect(
      client.finishAndSubmitCampaignResult(result)
    ).resolves.toMatchObject({ state: "permanent_failed" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("keeps an earlier retryable result when a later result is created", async () => {
    const storage = memoryStorage();
    storage.setItem(
      RANKING_STORAGE_KEYS.pending,
      JSON.stringify([
        {
          version: 1,
          submissionId: SUBMISSION_ID,
          playId: SECOND_PLAY_ID,
          displayName: "別ユーザー",
          gameSlug: RANKING_CONFIG.gameSlug,
          clientVersion: RANKING_CONFIG.clientVersion,
          resultType: "game_over",
          reachedStage: 2,
          score: 1200,
          createdAt: new Date().toISOString(),
          attemptCount: 1,
          state: "retryable_failed",
        },
      ])
    );
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const rpc = String(input).split("/").at(-1);
        const payload = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        if (rpc === RANKING_CONFIG.startRpc) {
          return response({
            ...startResponse(String(payload.p_start_id)),
            display_name: payload.p_display_name,
            normalized_name: String(payload.p_display_name),
          });
        }
        if (rpc === RANKING_CONFIG.finishRpc) return response(finishResponse());
        return response({ code: "PT500", message: "temporary" }, 503);
      }
    );
    const client = createRankingClient({
      storage,
      makeUuid: () =>
        storage.getItem(RANKING_STORAGE_KEYS.session)
          ? SECOND_START_ID
          : START_ID,
      fetchImpl,
    });

    await client.startCampaignPlay("山田 太郎");
    await expect(
      client.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 3,
        score: 4200,
      })
    ).resolves.toMatchObject({ state: "retryable_failed" });

    const entries = JSON.parse(
      storage.getItem(RANKING_STORAGE_KEYS.pending) ?? "[]"
    ) as Array<{ submissionId: string }>;
    expect(entries.map(entry => entry.submissionId)).toEqual([
      SUBMISSION_ID,
      SECOND_START_ID,
    ]);
    expect(client.hasRetryablePendingCampaignResult()).toBe(true);
  });

  it("retries every pending result and removes each one after a verified response", async () => {
    const storage = memoryStorage();
    const pending = [
      {
        version: 1,
        submissionId: SUBMISSION_ID,
        playId: PLAY_ID,
        displayName: "山田 太郎",
        gameSlug: RANKING_CONFIG.gameSlug,
        clientVersion: RANKING_CONFIG.clientVersion,
        resultType: "game_over",
        reachedStage: 3,
        score: 4200,
        createdAt: new Date().toISOString(),
        attemptCount: 1,
        state: "retryable_failed",
      },
      {
        version: 1,
        submissionId: SECOND_SUBMISSION_ID,
        playId: THIRD_PLAY_ID,
        displayName: "佐藤 花子",
        gameSlug: RANKING_CONFIG.gameSlug,
        clientVersion: RANKING_CONFIG.clientVersion,
        resultType: "clear",
        reachedStage: 9,
        score: 9000,
        createdAt: new Date().toISOString(),
        attemptCount: 2,
        state: "retryable_failed",
      },
    ];
    storage.setItem(RANKING_STORAGE_KEYS.pending, JSON.stringify(pending));
    const scoreSubmissionIds: unknown[] = [];
    const client = createRankingClient({
      storage,
      fetchImpl: async (input, init) => {
        const rpc = String(input).split("/").at(-1);
        const payload = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        if (rpc === RANKING_CONFIG.finishRpc) {
          return response({
            accepted: true,
            duplicate: false,
            play_id: payload.p_play_id,
            game_slug: payload.p_game_slug,
            result_type: payload.p_result_type,
            reached_wave: payload.p_reached_wave,
            score: payload.p_score,
          });
        }
        scoreSubmissionIds.push(payload.p_submission_id);
        return response([
          {
            accepted: true,
            result_submission_id: payload.p_submission_id,
            result_play_id: payload.p_play_id,
            result_normalized_name: payload.p_display_name,
            result_display_name: payload.p_display_name,
            result_first_score: payload.p_score,
            result_best_score: payload.p_score,
            result_play_count: 1,
            is_first_play: true,
            is_new_best: true,
            was_duplicate: false,
          },
        ]);
      },
    });

    await expect(client.retryPendingCampaignResult()).resolves.toMatchObject({
      state: "submitted",
    });
    expect(scoreSubmissionIds).toEqual([SUBMISSION_ID, SECOND_SUBMISSION_ID]);
    expect(storage.getItem(RANKING_STORAGE_KEYS.pending)).toBe("[]");
    expect(
      JSON.parse(storage.getItem(RANKING_STORAGE_KEYS.completed) ?? "[]")
    ).toHaveLength(2);
  });

  it("turns an interrupted submitting entry into a retry after reload", async () => {
    const storage = memoryStorage();
    storage.setItem(
      RANKING_STORAGE_KEYS.pending,
      JSON.stringify([
        {
          version: 1,
          submissionId: SUBMISSION_ID,
          playId: PLAY_ID,
          displayName: "山田 太郎",
          gameSlug: RANKING_CONFIG.gameSlug,
          clientVersion: RANKING_CONFIG.clientVersion,
          resultType: "game_over",
          reachedStage: 3,
          score: 4200,
          createdAt: new Date().toISOString(),
          attemptCount: 1,
          state: "submitting",
        },
      ])
    );
    const client = createRankingClient({
      storage,
      fetchImpl: async (input, init) => {
        const rpc = String(input).split("/").at(-1);
        const payload = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        if (rpc === RANKING_CONFIG.finishRpc) {
          return response({
            accepted: true,
            duplicate: true,
            play_id: PLAY_ID,
            game_slug: RANKING_CONFIG.gameSlug,
            result_type: "game_over",
            reached_wave: 3,
            score: 4200,
          });
        }
        return response([
          {
            accepted: true,
            result_submission_id: payload.p_submission_id,
            result_play_id: PLAY_ID,
            result_normalized_name: "山田 太郎",
            result_display_name: "山田 太郎",
            result_first_score: 4200,
            result_best_score: 4200,
            result_play_count: 1,
            is_first_play: false,
            is_new_best: false,
            was_duplicate: true,
          },
        ]);
      },
    });

    expect(client.hasRetryablePendingCampaignResult()).toBe(true);
    await expect(client.retryPendingCampaignResult()).resolves.toMatchObject({
      state: "submitted",
    });
  });

  it("turns an idle persisted entry into a retry after reload", async () => {
    const storage = memoryStorage();
    storage.setItem(
      RANKING_STORAGE_KEYS.pending,
      JSON.stringify([
        {
          version: 1,
          submissionId: SUBMISSION_ID,
          playId: PLAY_ID,
          displayName: "山田 太郎",
          gameSlug: RANKING_CONFIG.gameSlug,
          clientVersion: RANKING_CONFIG.clientVersion,
          resultType: "game_over",
          reachedStage: 3,
          score: 4200,
          createdAt: new Date().toISOString(),
          attemptCount: 0,
          state: "idle",
        },
      ])
    );
    const client = createRankingClient({
      storage,
      fetchImpl: async (input, init) => {
        const rpc = String(input).split("/").at(-1);
        const payload = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        if (rpc === RANKING_CONFIG.finishRpc) {
          return response({
            accepted: true,
            duplicate: false,
            play_id: PLAY_ID,
            game_slug: RANKING_CONFIG.gameSlug,
            result_type: "game_over",
            reached_wave: 3,
            score: 4200,
          });
        }
        return response([
          {
            accepted: true,
            result_submission_id: payload.p_submission_id,
            result_play_id: PLAY_ID,
            result_normalized_name: "山田 太郎",
            result_display_name: "山田 太郎",
            result_first_score: 4200,
            result_best_score: 4200,
            result_play_count: 1,
            is_first_play: true,
            is_new_best: true,
            was_duplicate: false,
          },
        ]);
      },
    });

    expect(client.hasRetryablePendingCampaignResult()).toBe(true);
    await expect(client.retryPendingCampaignResult()).resolves.toMatchObject({
      state: "submitted",
    });
    expect(storage.getItem(RANKING_STORAGE_KEYS.pending)).toBe("[]");
  });

  it("preserves completion receipts when two hydrated tabs finish different results", async () => {
    const sharedReceipts = new Map<string, string>();
    const firstStorage = partitionedStorage(sharedReceipts);
    const secondStorage = partitionedStorage(sharedReceipts);
    firstStorage.setItem(
      RANKING_STORAGE_KEYS.session,
      JSON.stringify({
        version: 1,
        startId: START_ID,
        playId: PLAY_ID,
        displayName: "山田 太郎",
        gameSlug: RANKING_CONFIG.gameSlug,
        clientVersion: RANKING_CONFIG.clientVersion,
        status: "active",
        createdAt: new Date().toISOString(),
      })
    );
    secondStorage.setItem(
      RANKING_STORAGE_KEYS.session,
      JSON.stringify({
        version: 1,
        startId: SECOND_START_ID,
        playId: SECOND_PLAY_ID,
        displayName: "山田 太郎",
        gameSlug: RANKING_CONFIG.gameSlug,
        clientVersion: RANKING_CONFIG.clientVersion,
        status: "active",
        createdAt: new Date().toISOString(),
      })
    );
    let failedFinishes = 2;
    let scoreCalls = 0;
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const rpc = String(input).split("/").at(-1);
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (rpc === RANKING_CONFIG.finishRpc && failedFinishes > 0) {
        failedFinishes -= 1;
        return response({ code: "PT500", message: "temporary" }, 503);
      }
      if (rpc === RANKING_CONFIG.finishRpc) {
        return response({
          accepted: true,
          duplicate: false,
          play_id: payload.p_play_id,
          game_slug: RANKING_CONFIG.gameSlug,
          result_type: payload.p_result_type,
          reached_wave: payload.p_reached_wave,
          score: payload.p_score,
        });
      }
      scoreCalls += 1;
      return response([
        {
          accepted: true,
          result_submission_id: payload.p_submission_id,
          result_play_id: payload.p_play_id,
          result_normalized_name: "山田 太郎",
          result_display_name: "山田 太郎",
          result_first_score: payload.p_score,
          result_best_score: payload.p_score,
          result_play_count: 1,
          is_first_play: true,
          is_new_best: true,
          was_duplicate: false,
        },
      ]);
    };
    const firstTab = createRankingClient({
      storage: firstStorage,
      makeUuid: () => SUBMISSION_ID,
      fetchImpl,
    });
    const secondTab = createRankingClient({
      storage: secondStorage,
      makeUuid: () => SECOND_SUBMISSION_ID,
      fetchImpl,
    });

    await expect(
      firstTab.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 3,
        score: 4200,
      })
    ).resolves.toMatchObject({ state: "retryable_failed" });
    await expect(
      secondTab.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 4,
        score: 4300,
      })
    ).resolves.toMatchObject({ state: "retryable_failed" });

    await expect(firstTab.retryPendingCampaignResult()).resolves.toMatchObject({
      state: "submitted",
    });
    await expect(
      secondTab.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 4,
        score: 4300,
      })
    ).resolves.toMatchObject({ state: "submitted" });
    expect(scoreCalls).toBe(2);
    expect(
      JSON.parse(firstStorage.getItem(RANKING_STORAGE_KEYS.completed) ?? "[]")
    ).toHaveLength(2);

    const reloadedTab = createRankingClient({
      storage: firstStorage,
      makeUuid: () => {
        throw new Error("completed receipt must prevent a new submission");
      },
      fetchImpl,
    });
    await expect(
      reloadedTab.finishAndSubmitCampaignResult({
        displayName: "山田 太郎",
        resultType: "game_over",
        reachedStage: 3,
        score: 4200,
      })
    ).resolves.toMatchObject({ state: "submitted" });
    expect(scoreCalls).toBe(2);
  });

  it("uses a permanent Supabase code even when its HTTP status is retryable", async () => {
    const client = createRankingClient({
      storage: memoryStorage(),
      makeUuid: () => START_ID,
      fetchImpl: async () =>
        response({ code: "22023", message: "invalid input" }, 500),
    });

    await expect(client.startCampaignPlay("山田 太郎")).rejects.toMatchObject({
      code: "22023",
      retryable: false,
    });
  });

  it("keeps a rate-limited start retryable when the RPC returns HTTP 200", async () => {
    const client = createRankingClient({
      storage: memoryStorage(),
      makeUuid: () => START_ID,
      fetchImpl: async () =>
        response({ accepted: false, reason: "play_rate_limited" }),
    });

    await expect(client.startCampaignPlay("山田 太郎")).rejects.toMatchObject({
      code: "play_rate_limited",
      retryable: true,
    });
  });
});
