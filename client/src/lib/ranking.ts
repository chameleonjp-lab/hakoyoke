export const RANKING_CONFIG = Object.freeze({
  gameId: "hakoyoke",
  gameSlug: "hakoyoke",
  canonicalUrl: "https://chameleonjp-lab.github.io/hakoyoke/",
  shareText: "CUBIC ORDEALで、崩れる足場の進路を読もう！",
  labUrl: "https://chameleonjp-lab.github.io/chameleonjp_lab/",
  rankingUrl:
    "https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html?game=hakoyoke",
  releaseId: "hakoyoke-20260831-01",
  clientVersion: "hakoyoke-20260831-01",
  playerNameStorageKey: "chameleonjp_hakoyoke_player_name",
  supabaseUrl: "https://mlpnjgezrnhdxsxolyzj.supabase.co",
  supabasePublishableKey: "sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM",
  startRpc: "start_game_play_v1",
  finishRpc: "finish_game_play_v1",
  scoreRpc: "submit_score_idempotent_v1",
  rankingRpc: "get_best_score_ranking",
  rankingType: "best",
  scoreOrder: "desc",
  rankedResults: ["clear", "game_over"] as const,
  timeoutMs: 8_000,
  scoreUnit: "点",
  scoreScale: 1,
  scoreDecimals: 0,
  scoreMin: 0,
  scoreMax: 100_000_000,
});

const SESSION_STORAGE_KEY = "chameleonjp_hakoyoke_ranking_session_v1";
const PENDING_STORAGE_KEY = "chameleonjp_hakoyoke_pending_score_v1";
const PENDING_ENTRY_PREFIX = `${PENDING_STORAGE_KEY}:`;
const COMPLETED_STORAGE_KEY = "chameleonjp_hakoyoke_completed_score_v1";

export const RANKING_STORAGE_KEYS = Object.freeze({
  session: SESSION_STORAGE_KEY,
  pending: PENDING_STORAGE_KEY,
  completed: COMPLETED_STORAGE_KEY,
  playerName: RANKING_CONFIG.playerNameStorageKey,
});

export type RankingSubmissionState =
  | "idle"
  | "submitting"
  | "submitted"
  | "retryable_failed"
  | "permanent_failed";

export interface RankingRow {
  rankNo: number;
  name: string;
  score: number;
}

interface RankingSession {
  version: 1;
  startId: string;
  playId?: string;
  displayName: string;
  gameSlug: string;
  clientVersion: string;
  status: "starting" | "active" | "finished";
  createdAt: string;
}

interface PendingSubmission {
  version: 1;
  submissionId: string;
  playId: string;
  displayName: string;
  gameSlug: string;
  clientVersion: string;
  resultType: "clear" | "game_over";
  reachedStage: number;
  score: number;
  createdAt: string;
  attemptCount: number;
  state: RankingSubmissionState;
}

interface CompletedSubmission {
  version: 1;
  submissionId: string;
  playId: string;
  displayName: string;
  gameSlug: string;
  clientVersion: string;
  resultType: "clear" | "game_over";
  reachedStage: number;
  score: number;
  completedAt: string;
}

export interface SubmissionOutcome {
  state: RankingSubmissionState;
  message: string;
}

export interface StartedRankingPlay {
  startId: string;
  playId: string;
  resumed: boolean;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem"> &
  Partial<Pick<Storage, "key" | "length">>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

interface RankingClientOptions {
  fetchImpl?: FetchLike;
  storage?: StorageLike | null;
  makeUuid?: () => string;
  now?: () => Date;
  timeoutMs?: number;
}

export class RankingRpcError extends Error {
  readonly operation: string;
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(
    operation: string,
    message: string,
    status: number,
    code: string,
    retryable: boolean
  ) {
    super(message);
    this.name = "RankingRpcError";
    this.operation = operation;
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export type PlayerNameValidation =
  | { ok: true; name: string }
  | { ok: false; message: string };

export function formatRankingScore(value: number): string {
  const displayValue = value / RANKING_CONFIG.scoreScale;
  return `${displayValue.toFixed(RANKING_CONFIG.scoreDecimals)}${RANKING_CONFIG.scoreUnit}`;
}

export function validatePlayerName(value: string): PlayerNameValidation {
  const name = value.trim();
  if (!name) {
    return { ok: false, message: "プレイヤー名を入力してください。" };
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    return {
      ok: false,
      message: "プレイヤー名に制御文字は使用できません。",
    };
  }
  if (Array.from(name).length > 20) {
    return {
      ok: false,
      message: "プレイヤー名は20文字以内で入力してください。",
    };
  }
  return { ok: true, name };
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof globalThis.fetch !== "function") {
    return Promise.reject(new TypeError("fetch is unavailable"));
  }
  return globalThis.fetch.call(globalThis, input, init);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isSession(value: unknown): value is RankingSession {
  if (!isRecord(value)) return false;
  const name =
    typeof value.displayName === "string"
      ? validatePlayerName(value.displayName)
      : null;
  return (
    value.version === 1 &&
    isUuid(value.startId) &&
    (value.playId === undefined || isUuid(value.playId)) &&
    name?.ok === true &&
    name.name === value.displayName &&
    value.gameSlug === RANKING_CONFIG.gameSlug &&
    value.clientVersion === RANKING_CONFIG.clientVersion &&
    ["starting", "active", "finished"].includes(String(value.status)) &&
    typeof value.createdAt === "string"
  );
}

function isPending(value: unknown): value is PendingSubmission {
  if (!isRecord(value)) return false;
  const name =
    typeof value.displayName === "string"
      ? validatePlayerName(value.displayName)
      : null;
  return (
    value.version === 1 &&
    isUuid(value.submissionId) &&
    isUuid(value.playId) &&
    name?.ok === true &&
    name.name === value.displayName &&
    value.gameSlug === RANKING_CONFIG.gameSlug &&
    value.clientVersion === RANKING_CONFIG.clientVersion &&
    (value.resultType === "clear" || value.resultType === "game_over") &&
    Number.isInteger(value.reachedStage) &&
    Number(value.reachedStage) >= 1 &&
    Number(value.reachedStage) <= 9 &&
    Number.isSafeInteger(value.score) &&
    Number(value.score) >= RANKING_CONFIG.scoreMin &&
    Number(value.score) <= RANKING_CONFIG.scoreMax &&
    typeof value.createdAt === "string" &&
    Number.isInteger(value.attemptCount) &&
    Number(value.attemptCount) >= 0 &&
    [
      "idle",
      "submitting",
      "submitted",
      "retryable_failed",
      "permanent_failed",
    ].includes(String(value.state))
  );
}

function isCompleted(value: unknown): value is CompletedSubmission {
  if (!isRecord(value)) return false;
  const name =
    typeof value.displayName === "string"
      ? validatePlayerName(value.displayName)
      : null;
  return (
    value.version === 1 &&
    isUuid(value.submissionId) &&
    isUuid(value.playId) &&
    name?.ok === true &&
    name.name === value.displayName &&
    value.gameSlug === RANKING_CONFIG.gameSlug &&
    value.clientVersion === RANKING_CONFIG.clientVersion &&
    (value.resultType === "clear" || value.resultType === "game_over") &&
    Number.isInteger(value.reachedStage) &&
    Number(value.reachedStage) >= 1 &&
    Number(value.reachedStage) <= 9 &&
    Number.isSafeInteger(value.score) &&
    Number(value.score) >= RANKING_CONFIG.scoreMin &&
    Number(value.score) <= RANKING_CONFIG.scoreMax &&
    typeof value.completedAt === "string"
  );
}

function retryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryableRpcFailure(
  operation: string,
  status: number,
  code: string
): boolean {
  if (
    code === "PT409" ||
    code === "PT410" ||
    code === "22003" ||
    code === "22023" ||
    code === "42501" ||
    code === "invalid_response" ||
    code.startsWith("PGRST20")
  ) {
    return false;
  }
  if (
    code === "42900" ||
    code === "PT500" ||
    code === "40001" ||
    code === "40P01" ||
    code === "53300" ||
    code === "57P01" ||
    (operation === RANKING_CONFIG.scoreRpc && code === "PT425")
  ) {
    return true;
  }
  return retryableHttpStatus(status);
}

function invalidResponse(operation: string, message: string): RankingRpcError {
  return new RankingRpcError(
    operation,
    message,
    200,
    "invalid_response",
    false
  );
}

function rejectedResponse(
  operation: string,
  data: Record<string, unknown>
): RankingRpcError {
  const code = typeof data.reason === "string" ? data.reason : "rpc_rejected";
  const retryable =
    (operation === RANKING_CONFIG.startRpc && code === "play_rate_limited") ||
    retryableRpcFailure(operation, 200, code);
  return new RankingRpcError(operation, code, 200, code, retryable);
}

function submissionMessage(state: RankingSubmissionState): string {
  switch (state) {
    case "submitting":
      return "ランキングへ送信中です。";
    case "submitted":
      return "ランキングへの登録を確認しました。";
    case "retryable_failed":
      return "通信できませんでした。同じ結果を再送できます。";
    case "permanent_failed":
      return "この結果はランキングへ登録できませんでした。";
    default:
      return "ランキング送信を待機しています。";
  }
}

export function startErrorMessage(error: unknown): string {
  if (error instanceof RankingRpcError && !error.retryable) {
    return "ランキング対象プレイを開始できませんでした。入力内容を確認してください。";
  }
  return "ランキング開始処理と通信できませんでした。通信環境を確認してもう一度お試しください。";
}

export function readStoredPlayerName(
  storage: StorageLike | null = defaultStorage()
): string {
  try {
    const raw = storage?.getItem(RANKING_CONFIG.playerNameStorageKey) ?? "";
    const validation = validatePlayerName(raw);
    return validation.ok ? validation.name : "";
  } catch {
    return "";
  }
}

export function saveStoredPlayerName(
  value: string,
  storage: StorageLike | null = defaultStorage()
): PlayerNameValidation {
  const validation = validatePlayerName(value);
  if (!validation.ok) return validation;
  try {
    storage?.setItem(RANKING_CONFIG.playerNameStorageKey, validation.name);
  } catch {
    // The current session can continue even when storage is unavailable.
  }
  return validation;
}

export function createRankingClient(options: RankingClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const storage =
    options.storage === undefined ? defaultStorage() : options.storage;
  const makeUuid = options.makeUuid ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? RANKING_CONFIG.timeoutMs;
  let volatileSession: RankingSession | null = null;
  let volatilePending: PendingSubmission[] = [];
  let volatileCompleted: CompletedSubmission[] = [];
  let sessionHydrated = false;
  let pendingHydrated = false;
  let completedHydrated = false;
  const pendingListeners = new Set<() => void>();
  let startInFlight: {
    displayName: string;
    promise: Promise<StartedRankingPlay>;
  } | null = null;
  let inFlight: { id: string; promise: Promise<SubmissionOutcome> } | null =
    null;

  const reportFailure = (
    error: unknown,
    identifiers: {
      startId?: string;
      playId?: string;
      submissionId?: string;
    }
  ): RankingRpcError => {
    const rankingError =
      error instanceof RankingRpcError
        ? error
        : new RankingRpcError(
            "unknown",
            "unexpected ranking failure",
            0,
            "unexpected_error",
            false
          );
    console.warn("CUBIC ORDEAL ranking request failed", {
      operation: rankingError.operation,
      status: rankingError.status,
      code: rankingError.code,
      gameSlug: RANKING_CONFIG.gameSlug,
      clientVersion: RANKING_CONFIG.clientVersion,
      releaseId: RANKING_CONFIG.releaseId,
      ...identifiers,
      occurredAt: now().toISOString(),
    });
    return rankingError;
  };

  const saveSession = (session: RankingSession): boolean => {
    if (!storage) return true;
    try {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      return true;
    } catch {
      reportFailure(
        new RankingRpcError(
          "session-storage",
          "session could not be persisted",
          0,
          "session-save-failed",
          true
        ),
        {}
      );
      return false;
    }
  };

  const savePendingEntries = (entries: PendingSubmission[]): boolean => {
    if (!storage) return true;
    try {
      entries.forEach(entry => {
        storage.setItem(
          `${PENDING_ENTRY_PREFIX}${entry.submissionId}`,
          JSON.stringify(entry)
        );
      });
      storage.setItem(PENDING_STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch {
      reportFailure(
        new RankingRpcError(
          "pending-storage",
          "pending result could not be persisted",
          0,
          "pending-save-failed",
          true
        ),
        {}
      );
      return false;
    }
  };

  const saveCompletedEntries = (entries: CompletedSubmission[]): boolean => {
    if (!storage) return true;
    try {
      storage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch {
      reportFailure(
        new RankingRpcError(
          "completed-storage",
          "completed result receipt could not be persisted",
          0,
          "pending-save-failed",
          true
        ),
        {}
      );
      return false;
    }
  };

  const readSession = (): RankingSession | null => {
    if (sessionHydrated) return volatileSession;
    sessionHydrated = true;
    try {
      const stored = parseJson(storage?.getItem(SESSION_STORAGE_KEY) ?? null);
      if (isSession(stored)) volatileSession = stored;
    } catch {
      // Fall through to the in-memory copy.
    }
    return volatileSession;
  };

  const writeSession = (session: RankingSession): void => {
    sessionHydrated = true;
    volatileSession = session;
    saveSession(session);
  };

  const readStoredPendingEntries = (): PendingSubmission[] => {
    if (!storage) return [];
    const rawEntries: unknown[] = [];
    try {
      const stored = parseJson(storage.getItem(PENDING_STORAGE_KEY) ?? null);
      if (Array.isArray(stored)) rawEntries.push(...stored);
      else if (stored) rawEntries.push(stored);
      if (
        typeof storage.length === "number" &&
        typeof storage.key === "function"
      ) {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (!key?.startsWith(PENDING_ENTRY_PREFIX)) continue;
          rawEntries.push(parseJson(storage.getItem(key)));
        }
      }
    } catch {
      // Fall through to the in-memory copy.
    }
    const byId = new Map<string, PendingSubmission>();
    rawEntries.forEach(value => {
      if (isPending(value)) byId.set(value.submissionId, value);
    });
    return Array.from(byId.values());
  };

  const readPendingEntries = (): PendingSubmission[] => {
    if (pendingHydrated) return volatilePending;
    pendingHydrated = true;
    volatilePending = readStoredPendingEntries().map(entry =>
      entry.state === "idle" || entry.state === "submitting"
        ? { ...entry, state: "retryable_failed" as const }
        : entry
    );
    return volatilePending;
  };

  const writePending = (pending: PendingSubmission): void => {
    // Merge a fresh storage read with this tab's volatile state before writing.
    const merged = new Map<string, PendingSubmission>();
    readStoredPendingEntries().forEach(entry =>
      merged.set(entry.submissionId, entry)
    );
    readPendingEntries().forEach(entry =>
      merged.set(entry.submissionId, entry)
    );
    const entries = Array.from(merged.values()).filter(
      entry => entry.submissionId !== pending.submissionId
    );
    volatilePending = [...entries, pending];
    savePendingEntries(volatilePending);
    pendingListeners.forEach(listener => listener());
  };

  const readCompletedEntries = (): CompletedSubmission[] => {
    if (completedHydrated) return volatileCompleted;
    completedHydrated = true;
    try {
      const stored = parseJson(storage?.getItem(COMPLETED_STORAGE_KEY) ?? null);
      if (Array.isArray(stored)) volatileCompleted = stored.filter(isCompleted);
      else if (isCompleted(stored)) volatileCompleted = [stored];
    } catch {
      // Fall through to the in-memory copy.
    }
    return volatileCompleted;
  };

  const findCompleted = (
    predicate: (completed: CompletedSubmission) => boolean
  ): CompletedSubmission | null => {
    const entries = readCompletedEntries();
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (predicate(entries[index])) return entries[index];
    }
    return null;
  };

  const writeCompleted = (pending: PendingSubmission): boolean => {
    const entries = readCompletedEntries().filter(
      entry => entry.submissionId !== pending.submissionId
    );
    const receipt: CompletedSubmission = {
      version: 1,
      submissionId: pending.submissionId,
      playId: pending.playId,
      displayName: pending.displayName,
      gameSlug: pending.gameSlug,
      clientVersion: pending.clientVersion,
      resultType: pending.resultType,
      reachedStage: pending.reachedStage,
      score: pending.score,
      completedAt: now().toISOString(),
    };
    // Keep receipts bounded; they only prevent duplicate submissions after reload.
    volatileCompleted = [...entries, receipt].slice(-50);
    return saveCompletedEntries(volatileCompleted);
  };

  const removePending = (submissionId: string): boolean => {
    volatilePending = readPendingEntries().filter(
      entry => entry.submissionId !== submissionId
    );
    let persisted = true;
    try {
      storage?.removeItem(`${PENDING_ENTRY_PREFIX}${submissionId}`);
    } catch {
      persisted = false;
      reportFailure(
        new RankingRpcError(
          "pending-storage",
          "pending result could not be removed",
          0,
          "pending-save-failed",
          true
        ),
        { submissionId }
      );
    }
    persisted = savePendingEntries(volatilePending) && persisted;
    pendingListeners.forEach(listener => listener());
    return persisted;
  };

  const findPending = (
    predicate: (pending: PendingSubmission) => boolean
  ): PendingSubmission | null => {
    const entries = readPendingEntries();
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (predicate(entries[index])) return entries[index];
    }
    return null;
  };

  const callRpc = async (
    operation: string,
    payload: Record<string, unknown>
  ): Promise<unknown> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(
        `${RANKING_CONFIG.supabaseUrl}/rest/v1/rpc/${operation}`,
        {
          method: "POST",
          headers: {
            apikey: RANKING_CONFIG.supabasePublishableKey,
            Authorization: `Bearer ${RANKING_CONFIG.supabasePublishableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );
    } catch (error) {
      const timedOut = controller.signal.aborted;
      clearTimeout(timeout);
      throw new RankingRpcError(
        operation,
        timedOut ? "request timed out" : "network request failed",
        0,
        timedOut ? "timeout" : "network_error",
        true
      );
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      const timedOut = controller.signal.aborted;
      throw new RankingRpcError(
        operation,
        timedOut ? "response timed out" : "response body could not be read",
        response.status,
        timedOut ? "timeout" : "network_error",
        true
      );
    } finally {
      clearTimeout(timeout);
    }
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const code =
        isRecord(data) && typeof data.code === "string"
          ? data.code
          : `http_${response.status}`;
      const message =
        isRecord(data) && typeof data.message === "string"
          ? data.message
          : `${operation} failed`;
      throw new RankingRpcError(
        operation,
        message,
        response.status,
        code,
        retryableRpcFailure(operation, response.status, code)
      );
    }
    return data;
  };

  const validateStartResponse = (
    data: unknown,
    session: RankingSession
  ): string => {
    if (isRecord(data) && data.accepted === false) {
      throw rejectedResponse(RANKING_CONFIG.startRpc, data);
    }
    if (
      !isRecord(data) ||
      data.accepted !== true ||
      typeof data.duplicate !== "boolean" ||
      !isUuid(data.play_id) ||
      typeof data.normalized_name !== "string" ||
      !data.normalized_name
    ) {
      throw invalidResponse(RANKING_CONFIG.startRpc, "invalid start response");
    }
    if (
      data.start_id !== session.startId ||
      data.game_slug !== session.gameSlug ||
      data.display_name !== session.displayName ||
      data.client_version !== session.clientVersion
    ) {
      throw invalidResponse(RANKING_CONFIG.startRpc, "start response mismatch");
    }
    return data.play_id;
  };

  const startCampaignPlay = (
    displayName: string,
    startOptions: { forceNew?: boolean } = {}
  ): Promise<StartedRankingPlay> => {
    const validation = validatePlayerName(displayName);
    if (!validation.ok) {
      throw new RankingRpcError(
        RANKING_CONFIG.startRpc,
        validation.message,
        400,
        "invalid_player_name",
        false
      );
    }
    if (startInFlight?.displayName === validation.name) {
      return startInFlight.promise;
    }
    const promise = (async () => {
      const existing = readSession();
      if (
        !startOptions.forceNew &&
        existing?.displayName === validation.name &&
        existing.status === "active" &&
        existing.playId
      ) {
        return {
          startId: existing.startId,
          playId: existing.playId,
          resumed: true,
        };
      }
      const session: RankingSession =
        !startOptions.forceNew &&
        existing?.displayName === validation.name &&
        existing.status === "starting"
          ? existing
          : {
              version: 1,
              startId: makeUuid(),
              displayName: validation.name,
              gameSlug: RANKING_CONFIG.gameSlug,
              clientVersion: RANKING_CONFIG.clientVersion,
              status: "starting",
              createdAt: now().toISOString(),
            };
      writeSession(session);
      try {
        const data = await callRpc(RANKING_CONFIG.startRpc, {
          p_start_id: session.startId,
          p_display_name: session.displayName,
          p_game_slug: session.gameSlug,
          p_client_version: session.clientVersion,
        });
        const playId = validateStartResponse(data, session);
        writeSession({ ...session, playId, status: "active" });
        return { startId: session.startId, playId, resumed: false };
      } catch (error) {
        reportFailure(error, { startId: session.startId });
        throw error;
      }
    })();
    startInFlight = { displayName: validation.name, promise };
    void promise.then(
      () => {
        if (startInFlight?.promise === promise) startInFlight = null;
      },
      () => {
        if (startInFlight?.promise === promise) startInFlight = null;
      }
    );
    return promise;
  };

  const validateFinishResponse = (
    data: unknown,
    pending: PendingSubmission
  ): void => {
    if (isRecord(data) && data.accepted === false) {
      throw rejectedResponse(RANKING_CONFIG.finishRpc, data);
    }
    if (
      !isRecord(data) ||
      data.accepted !== true ||
      typeof data.duplicate !== "boolean"
    ) {
      throw invalidResponse(
        RANKING_CONFIG.finishRpc,
        "invalid finish response"
      );
    }
    if (
      data.play_id !== pending.playId ||
      data.game_slug !== pending.gameSlug ||
      data.result_type !== pending.resultType ||
      data.reached_wave !== pending.reachedStage ||
      data.score !== pending.score
    ) {
      throw invalidResponse(
        RANKING_CONFIG.finishRpc,
        "finish response mismatch"
      );
    }
  };

  const validateSubmitResponse = (
    data: unknown,
    pending: PendingSubmission
  ): void => {
    if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
      throw invalidResponse(RANKING_CONFIG.scoreRpc, "invalid submit response");
    }
    const result = data[0];
    const firstScore = result.result_first_score;
    const bestScore = result.result_best_score;
    if (
      result.accepted !== true ||
      result.result_submission_id !== pending.submissionId ||
      result.result_play_id !== pending.playId ||
      typeof result.result_normalized_name !== "string" ||
      !result.result_normalized_name ||
      result.result_display_name !== pending.displayName ||
      !Number.isSafeInteger(firstScore) ||
      Number(firstScore) < RANKING_CONFIG.scoreMin ||
      Number(firstScore) > RANKING_CONFIG.scoreMax ||
      !Number.isSafeInteger(bestScore) ||
      Number(bestScore) < RANKING_CONFIG.scoreMin ||
      Number(bestScore) > RANKING_CONFIG.scoreMax ||
      !Number.isSafeInteger(result.result_play_count) ||
      Number(result.result_play_count) < 1 ||
      typeof result.is_first_play !== "boolean" ||
      typeof result.is_new_best !== "boolean" ||
      typeof result.was_duplicate !== "boolean"
    ) {
      throw invalidResponse(
        RANKING_CONFIG.scoreRpc,
        "submit response mismatch"
      );
    }
  };

  const submitPending = (
    pending: PendingSubmission
  ): Promise<SubmissionOutcome> => {
    if (pending.state === "submitted") {
      return Promise.resolve({
        state: "submitted",
        message: submissionMessage("submitted"),
      });
    }
    if (pending.state === "permanent_failed") {
      return Promise.resolve({
        state: "permanent_failed",
        message: submissionMessage("permanent_failed"),
      });
    }
    if (inFlight?.id === pending.submissionId) return inFlight.promise;

    const promise = (async (): Promise<SubmissionOutcome> => {
      const submitting: PendingSubmission = {
        ...pending,
        attemptCount: pending.attemptCount + 1,
        state: "submitting",
      };
      writePending(submitting);
      try {
        const finish = await callRpc(RANKING_CONFIG.finishRpc, {
          p_play_id: submitting.playId,
          p_display_name: submitting.displayName,
          p_game_slug: submitting.gameSlug,
          p_result_type: submitting.resultType,
          // The shared RPC accepts 1..30. CUBIC ORDEAL reports its reached stage (1..9).
          p_reached_wave: submitting.reachedStage,
          p_score: submitting.score,
          p_client_version: submitting.clientVersion,
          p_ranking_score: submitting.score,
        });
        validateFinishResponse(finish, submitting);
        const result = await callRpc(RANKING_CONFIG.scoreRpc, {
          p_play_id: submitting.playId,
          p_submission_id: submitting.submissionId,
          p_display_name: submitting.displayName,
          p_game_slug: submitting.gameSlug,
          p_score: submitting.score,
          p_client_version: submitting.clientVersion,
        });
        validateSubmitResponse(result, submitting);
        const receiptSaved = writeCompleted(submitting);
        if (receiptSaved) {
          // The server response has been validated; only now remove the retry payload.
          removePending(submitting.submissionId);
        } else {
          // Keep the same id retryable when the completion receipt cannot be persisted.
          writePending({ ...submitting, state: "retryable_failed" });
        }
        return {
          state: "submitted",
          message: submissionMessage("submitted"),
        };
      } catch (error) {
        const rankingError = reportFailure(error, {
          playId: submitting.playId,
          submissionId: submitting.submissionId,
        });
        const state: RankingSubmissionState = rankingError.retryable
          ? "retryable_failed"
          : "permanent_failed";
        writePending({ ...submitting, state });
        return { state, message: submissionMessage(state) };
      }
    })();
    inFlight = { id: pending.submissionId, promise };
    void promise.finally(() => {
      if (inFlight?.id === pending.submissionId) inFlight = null;
    });
    return promise;
  };

  const finishAndSubmitCampaignResult = async (result: {
    displayName: string;
    resultType: "clear" | "game_over";
    reachedStage: number;
    score: number;
  }): Promise<SubmissionOutcome> => {
    const name = validatePlayerName(result.displayName);
    const score = Math.trunc(result.score);
    const reachedStage = Math.trunc(result.reachedStage);
    const session = readSession();
    if (
      !name.ok ||
      !Number.isSafeInteger(score) ||
      score < RANKING_CONFIG.scoreMin ||
      score > RANKING_CONFIG.scoreMax ||
      !Number.isInteger(reachedStage) ||
      reachedStage < 1 ||
      reachedStage > 9 ||
      !session?.playId ||
      session.displayName !== (name.ok ? name.name : "") ||
      (session.status !== "active" && session.status !== "finished")
    ) {
      return {
        state: "permanent_failed",
        message:
          "このプレイはランキング開始情報を確認できないため登録対象外です。",
      };
    }

    const completed = findCompleted(
      candidate =>
        candidate.playId === session.playId &&
        candidate.displayName === name.name &&
        candidate.resultType === result.resultType &&
        candidate.reachedStage === reachedStage &&
        candidate.score === score
    );
    if (completed) {
      writeSession({ ...session, status: "finished" });
      return {
        state: "submitted",
        message: submissionMessage("submitted"),
      };
    }

    const existing = findPending(
      pending =>
        pending.playId === session.playId &&
        pending.displayName === name.name &&
        pending.resultType === result.resultType &&
        pending.reachedStage === reachedStage &&
        pending.score === score
    );
    const pending: PendingSubmission = existing ?? {
      version: 1,
      submissionId: makeUuid(),
      playId: session.playId,
      displayName: name.name,
      gameSlug: RANKING_CONFIG.gameSlug,
      clientVersion: RANKING_CONFIG.clientVersion,
      resultType: result.resultType,
      reachedStage,
      score,
      createdAt: now().toISOString(),
      attemptCount: 0,
      state: "idle",
    };
    // Persist the complete immutable result before the first network request.
    writePending(pending);
    writeSession({ ...session, status: "finished" });
    return submitPending(pending);
  };

  const retryPendingCampaignResult = async (): Promise<SubmissionOutcome> => {
    const pendingEntries = readPendingEntries().filter(
      candidate =>
        candidate.state === "retryable_failed" &&
        !findCompleted(
          completed =>
            completed.submissionId === candidate.submissionId &&
            completed.playId === candidate.playId
        )
    );
    if (!pendingEntries.length) {
      return {
        state: "permanent_failed",
        message: "再送できる結果がありません。",
      };
    }
    let outcome: SubmissionOutcome = {
      state: "retryable_failed",
      message: submissionMessage("retryable_failed"),
    };
    for (let index = 0; index < pendingEntries.length; index += 1) {
      outcome = await submitPending(pendingEntries[index]);
    }
    return outcome;
  };

  const loadBestRanking = async (): Promise<RankingRow[]> => {
    const data = await callRpc(RANKING_CONFIG.rankingRpc, {
      p_game_slug: RANKING_CONFIG.gameSlug,
      p_limit: 10,
    });
    if (!Array.isArray(data) || data.length > 10) {
      throw invalidResponse(
        RANKING_CONFIG.rankingRpc,
        "invalid ranking response"
      );
    }
    return data.map((value, index) => {
      if (!isRecord(value)) {
        throw invalidResponse(
          RANKING_CONFIG.rankingRpc,
          `invalid ranking row ${index}`
        );
      }
      const name =
        typeof value.display_name === "string"
          ? validatePlayerName(value.display_name)
          : null;
      if (
        !Number.isInteger(value.rank_no) ||
        Number(value.rank_no) < 1 ||
        !name?.ok ||
        !Number.isSafeInteger(value.best_score) ||
        Number(value.best_score) < RANKING_CONFIG.scoreMin ||
        Number(value.best_score) > RANKING_CONFIG.scoreMax
      ) {
        throw invalidResponse(
          RANKING_CONFIG.rankingRpc,
          `invalid ranking row ${index}`
        );
      }
      return {
        rankNo: Number(value.rank_no),
        name: name.name,
        score: Number(value.best_score),
      };
    });
  };

  return {
    startCampaignPlay,
    finishAndSubmitCampaignResult,
    retryPendingCampaignResult,
    subscribePending(listener: () => void) {
      pendingListeners.add(listener);
      return () => pendingListeners.delete(listener);
    },
    hasRetryablePendingCampaignResult: () =>
      Boolean(
        findPending(
          pending =>
            pending.state === "retryable_failed" &&
            !findCompleted(
              completed =>
                completed.submissionId === pending.submissionId &&
                completed.playId === pending.playId
            )
        )
      ),
    loadBestRanking,
  };
}

export const rankingClient = createRankingClient();
