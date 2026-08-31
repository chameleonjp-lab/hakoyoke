/** Obsidian Observatory UI: edge instrumentation, not a centered generic dashboard. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { parsePuzzleDescriptor, validatePuzzle } from "@/game/puzzleValidation";
import { deriveDirectSolution } from "@/game/solutionSimulation";
import { calculateMindIndex, cubeOccupiesCell } from "@/game/rules";
import { puzzleCountFor } from "@/game/stagePlan";
import type { CubicCommand } from "@/game/GameWorld";
import {
  RANKING_CONFIG,
  formatRankingScore,
  rankingClient,
  readStoredPlayerName,
  saveStoredPlayerName,
  startErrorMessage,
  validatePlayerName,
  type RankingRow,
  type RankingSubmissionState,
} from "@/lib/ranking";
import type {
  Difficulty,
  GameMode,
  GameSnapshot,
  PuzzleDescriptor,
} from "@/game/types";
import RumPanel from "./RumPanel";

const difficulties: Difficulty[] = [
  "BEGINNER",
  "EASY",
  "NORMAL",
  "HARD",
  "EXTREME",
];
type Panel =
  | "title"
  | "mode"
  | "difficulty"
  | "practice"
  | "create"
  | "settings"
  | null;
type EditorCell = "empty" | "normal" | "veil" | "void";

function command(detail: unknown): void {
  window.dispatchEvent(new CustomEvent("cubic:command", { detail }));
}
function setting(key: "quality" | "audio", value: string): void {
  window.dispatchEvent(
    new CustomEvent("cubic:settings", { detail: { key, value } })
  );
}

function homeShareMessage(): string {
  return `${RANKING_CONFIG.shareText}\n${RANKING_CONFIG.canonicalUrl}\n#CUBICORDEAL #ミニゲーム`;
}

async function shareOrCopy(
  text: string,
  setStatus: (message: string) => void
): Promise<void> {
  setStatus("");
  if (navigator.share) {
    try {
      const nativeText = text
        .replace(`\n${RANKING_CONFIG.canonicalUrl}`, "")
        .trim();
      await navigator.share({
        title: "CUBIC ORDEAL",
        text: nativeText,
        url: RANKING_CONFIG.canonicalUrl,
      });
      setStatus("共有しました。");
      return;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(text);
    setStatus("シェア文をコピーしました。");
  } catch {
    setStatus("シェア文をコピーできませんでした。もう一度お試しください。");
  }
}

export default function GameShell({
  onLaunch,
}: {
  onLaunch(command: CubicCommand): void;
}) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [panel, setPanel] = useState<Panel>("title");
  const [launching, setLaunching] = useState(false);
  const [chosenMode, setChosenMode] = useState<GameMode>("CAMPAIGN");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [practice, setPractice] = useState({ stage: 1, wave: 1, ordinal: 1 });
  const [playerName, setPlayerName] = useState(readStoredPlayerName);
  const [nameMessage, setNameMessage] = useState("");
  const [startingPlay, setStartingPlay] = useState(false);
  const rumEnabled =
    new URLSearchParams(window.location.search).get("rum") === "1";

  useEffect(() => {
    const update = (event: Event) =>
      setSnapshot((event as CustomEvent<GameSnapshot>).detail);
    window.addEventListener("cubic:snapshot", update);
    return () => window.removeEventListener("cubic:snapshot", update);
  }, []);

  const playing =
    snapshot &&
    [
      "PLAYING",
      "TUTORIAL",
      "CAPTURE_PAUSE",
      "COUNTDOWN",
      "STAGE_INTRO",
      "PAUSED",
      "CRUSHED",
    ].includes(snapshot.phase);
  const touchInput =
    snapshot &&
    ["PLAYING", "TUTORIAL", "CAPTURE_PAUSE"].includes(snapshot.phase);
  const result =
    snapshot &&
    [
      "PUZZLE_RESULT",
      "WAVE_RESULT",
      "STAGE_RESULT",
      "FINAL_RESULT",
      "GAME_OVER",
    ].includes(snapshot.phase);
  const showMenu =
    (!snapshot && !launching) ||
    snapshot?.phase === "TITLE" ||
    snapshot?.phase === "MENU" ||
    Boolean(panel && !playing && !result);
  const launch = (detail: CubicCommand) => {
    setLaunching(true);
    onLaunch(detail);
  };
  const execute = async (
    mode = chosenMode,
    stage = practice.stage,
    wave = practice.wave,
    ordinal = practice.ordinal
  ) => {
    if (startingPlay) return;
    const validation = saveStoredPlayerName(playerName);
    if (!validation.ok) {
      setNameMessage(validation.message);
      setPanel("title");
      return;
    }
    setPlayerName(validation.name);
    let resumeCampaign: boolean | undefined;
    if (mode === "CAMPAIGN") {
      setStartingPlay(true);
      setNameMessage("ランキング対象プレイの開始を確認中…");
      try {
        const started = await rankingClient.startCampaignPlay(validation.name);
        resumeCampaign = started.resumed;
      } catch (error) {
        setNameMessage(startErrorMessage(error));
        setPanel("title");
        setStartingPlay(false);
        return;
      }
      setStartingPlay(false);
    }
    setNameMessage("");
    launch({
      type: "start",
      mode,
      difficulty,
      stage,
      wave,
      ordinal,
      resumeCampaign,
    });
    setPanel(null);
  };

  return (
    <div className="game-shell" data-playing={playing ? "yes" : "no"}>
      <div className="void-vignette" />
      <div className="instrument-frame" aria-hidden="true">
        <i className="frame-top" />
        <i className="frame-right" />
        <i className="frame-bottom" />
        <i className="frame-left" />
        <span className="frame-coord north">N // 000</span>
        <span className="frame-coord east">E // 090</span>
        <span className="frame-coord south">S // 180</span>
        <span className="frame-coord west">W // 270</span>
      </div>
      {playing && snapshot && (
        <Hud
          snapshot={snapshot}
          onMenu={() => {
            command({ type: "menu" });
            setPanel("mode");
          }}
        />
      )}
      {snapshot?.phase === "TUTORIAL" && (
        <aside className="tutorial-callout">
          <span>TRAINING {Math.min(8, snapshot.tutorialStep + 1)} / 8</span>
          <p>{snapshot.hint}</p>
        </aside>
      )}
      {snapshot?.debug && <DebugPanel snapshot={snapshot} />}
      {rumEnabled && <RumPanel />}
      {snapshot?.banner && playing && (
        <div className="signal-banner" aria-live="polite">
          {snapshot.banner}
        </div>
      )}
      {showMenu && (
        <MenuPanel
          panel={panel ?? "title"}
          setPanel={setPanel}
          chosenMode={chosenMode}
          setChosenMode={setChosenMode}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          playerName={playerName}
          setPlayerName={value => {
            setPlayerName(value);
            setNameMessage("");
          }}
          nameMessage={nameMessage}
          execute={execute}
          practice={practice}
          setPractice={setPractice}
          onTest={puzzle => {
            const validation = saveStoredPlayerName(playerName);
            if (!validation.ok) {
              setNameMessage(validation.message);
              setPanel("title");
              return;
            }
            setPlayerName(validation.name);
            launch({ type: "load-custom", puzzle });
            setPanel(null);
          }}
        />
      )}
      {snapshot?.phase === "PAUSED" && (
        <PauseOverlay
          snapshot={snapshot}
          onResume={() => command({ type: "resume" })}
          onQuit={() => {
            command({ type: "menu" });
            setPanel("mode");
          }}
        />
      )}
      {result && snapshot && (
        <ResultOverlay
          snapshot={snapshot}
          playerName={playerName}
          onContinue={() => {
            command({ type: "menu" });
            setPanel("mode");
          }}
        />
      )}
      {touchInput && snapshot && <TouchControls snapshot={snapshot} />}
    </div>
  );
}

function MenuPanel({
  panel,
  setPanel,
  chosenMode,
  setChosenMode,
  difficulty,
  setDifficulty,
  playerName,
  setPlayerName,
  nameMessage,
  execute,
  practice,
  setPractice,
  onTest,
}: {
  panel: Exclude<Panel, null>;
  setPanel: (panel: Panel) => void;
  chosenMode: GameMode;
  setChosenMode: (mode: GameMode) => void;
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
  playerName: string;
  setPlayerName: (value: string) => void;
  nameMessage: string;
  execute: (
    mode?: GameMode,
    stage?: number,
    wave?: number,
    ordinal?: number
  ) => void;
  practice: { stage: number; wave: number; ordinal: number };
  setPractice: (value: {
    stage: number;
    wave: number;
    ordinal: number;
  }) => void;
  onTest(puzzle: PuzzleDescriptor): void;
}) {
  return (
    <section className="title-shell">
      <div className="title-rail">
        <div className="brand-lockup">
          <BrandMark />
          <div>
            <span className="eyebrow">OBSERVATORY // 01</span>
            <h1>
              <b>CUBIC</b> <em>ORDEAL</em>
            </h1>
          </div>
        </div>
        <PlayerNameGate
          playerName={playerName}
          onChange={setPlayerName}
          message={nameMessage}
        />
        <PendingRankingNotice />
        {panel === "title" && (
          <TitleActions
            onMode={() => setPanel("mode")}
            onTutorial={() => execute("TUTORIAL", 1, 1, 1)}
            onSettings={() => setPanel("settings")}
          />
        )}
        {panel === "mode" && (
          <ModeActions
            chosenMode={chosenMode}
            setChosenMode={setChosenMode}
            onNext={() =>
              setPanel(
                chosenMode === "PRACTICE"
                  ? "practice"
                  : chosenMode === "CREATE"
                    ? "create"
                    : "difficulty"
              )
            }
            onBack={() => setPanel("title")}
          />
        )}
        {panel === "difficulty" && (
          <DifficultyActions
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            onStart={() => execute(chosenMode)}
            onBack={() => setPanel("mode")}
          />
        )}
        {panel === "practice" && (
          <PracticeActions
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            practice={practice}
            setPractice={setPractice}
            onStart={() => execute("PRACTICE")}
            onBack={() => setPanel("mode")}
          />
        )}
        {panel === "create" && (
          <CreatePanel
            difficulty={difficulty}
            onBack={() => setPanel("mode")}
            onTest={onTest}
          />
        )}
        {panel === "settings" && (
          <SettingsPanel onBack={() => setPanel("title")} />
        )}
      </div>
      <div className="title-footer">
        <span>MARK / CAPTURE</span>
        <i />
        <span>AREA</span>
        <i />
        <span>FAST</span>
        <i />
        <span>ESC PAUSE</span>
      </div>
    </section>
  );
}

function PendingRankingNotice() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const hasRetryable = useSyncExternalStore(
    rankingClient.subscribePending,
    rankingClient.hasRetryablePendingCampaignResult,
    rankingClient.hasRetryablePendingCampaignResult
  );
  if (!hasRetryable && !message) return null;

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("未送信結果を再送中です。");
    const outcome = await rankingClient.retryPendingCampaignResult();
    setMessage(outcome.message);
    setBusy(false);
  };

  return (
    <aside className="pending-ranking-notice">
      <span className="eyebrow">RANKING // UNSENT RESULT</span>
      <p>前回のランキング送信が完了していません。</p>
      {hasRetryable && (
        <button
          className="platform-action ranking-retry"
          type="button"
          onClick={() => void retry()}
          disabled={busy}
        >
          <span>RETRY UNSENT SCORE</span>
          <small>同じ結果を再送</small>
        </button>
      )}
      {message && (
        <p className="platform-status" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </aside>
  );
}

function TitleActions({
  onMode,
  onTutorial,
  onSettings,
}: {
  onMode(): void;
  onTutorial(): void;
  onSettings(): void;
}) {
  const [shareStatus, setShareStatus] = useState("");
  return (
    <div className="menu-actions">
      <p className="menu-lead">
        奥から来る質量を読む。
        <br />
        足場を一列でも長く保て。
      </p>
      <Action
        label="CAMPAIGN"
        note="9 STAGES // 88 ORDEALS"
        onClick={onMode}
        primary
      />
      <Action
        label="TUTORIAL"
        note="SYSTEMS CALIBRATION"
        onClick={onTutorial}
      />
      <Action
        label="SETTINGS"
        note="AUDIO // QUALITY // ACCESS"
        onClick={onSettings}
      />
      <button
        className="platform-action"
        type="button"
        onClick={() => void shareOrCopy(homeShareMessage(), setShareStatus)}
      >
        <span>SHARE GAME</span>
        <small>INVITE A PLAYER</small>
      </button>
      <p className="platform-status" role="status" aria-live="polite">
        {shareStatus}
      </p>
      <a
        className="platform-link"
        href={RANKING_CONFIG.labUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        カメレオンJPの実験場
      </a>
    </div>
  );
}

function PlayerNameGate({
  playerName,
  onChange,
  message,
}: {
  playerName: string;
  onChange(value: string): void;
  message: string;
}) {
  const validation = validatePlayerName(playerName);
  return (
    <section className="player-name-gate" aria-labelledby="player-name-title">
      <span className="eyebrow" id="player-name-title">
        PLAYER DISPLAY NAME
      </span>
      <label htmlFor="cubic-player-name">公開表示名（同名可・必須）</label>
      <input
        id="cubic-player-name"
        type="text"
        value={playerName}
        autoComplete="nickname"
        placeholder="20文字以内で入力"
        onChange={event => onChange(event.target.value)}
        aria-invalid={!validation.ok}
        aria-describedby="cubic-player-name-status"
        required
      />
      <small
        className="platform-status"
        id="cubic-player-name-status"
        role="status"
        aria-live="polite"
      >
        {message ||
          (validation.ok
            ? `${validation.name}さんの名前で記録します。`
            : validation.message)}
      </small>
    </section>
  );
}

function ModeActions({
  chosenMode,
  setChosenMode,
  onNext,
  onBack,
}: {
  chosenMode: GameMode;
  setChosenMode(mode: GameMode): void;
  onNext(): void;
  onBack(): void;
}) {
  const modes: Array<[GameMode, string, string]> = [
    ["CAMPAIGN", "CAMPAIGN", "STAGE 1 TO FINAL"],
    ["PRACTICE", "PRACTICE", "REWIND / QUICK SAVE"],
    ["CREATE", "CREATE", "BUILD A CUSTOM ORDEAL"],
    ["DUEL", "DUEL", "LOCAL TURN-BASED // FIRST TO 5"],
  ];
  return (
    <div className="menu-actions">
      <span className="eyebrow">MODE SELECT</span>
      {modes.map(([mode, title, note]) => (
        <button
          key={mode}
          className={`mode-card ${chosenMode === mode ? "selected" : ""}`}
          onClick={() => setChosenMode(mode)}
        >
          <b>{title}</b>
          <span>{note}</span>
          <i>{chosenMode === mode ? "SELECTED" : ""}</i>
        </button>
      ))}
      <div className="action-row">
        <Action label="BACK" note="RETURN" onClick={onBack} />
        <Action label="CONFIGURE" note="CONTINUE" onClick={onNext} primary />
      </div>
    </div>
  );
}

function DifficultyActions({
  difficulty,
  setDifficulty,
  onStart,
  onBack,
}: {
  difficulty: Difficulty;
  setDifficulty(value: Difficulty): void;
  onStart(): void;
  onBack(): void;
}) {
  return (
    <div className="menu-actions">
      <span className="eyebrow">THREAT VELOCITY</span>
      <h2>SELECT DIFFICULTY</h2>
      <div className="difficulty-row">
        {difficulties.map(item => (
          <button
            onClick={() => setDifficulty(item)}
            className={difficulty === item ? "active" : ""}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <p className="menu-lead">
        配置は変わらない。変わるのは、読み終えるまでに残された時間だ。
      </p>
      <div className="action-row">
        <Action label="BACK" note="MODE" onClick={onBack} />
        <Action
          label="BEGIN ORDEAL"
          note={difficulty}
          onClick={onStart}
          primary
        />
      </div>
    </div>
  );
}

function PracticeActions({
  difficulty,
  setDifficulty,
  practice,
  setPractice,
  onStart,
  onBack,
}: {
  difficulty: Difficulty;
  setDifficulty(value: Difficulty): void;
  practice: { stage: number; wave: number; ordinal: number };
  setPractice(value: { stage: number; wave: number; ordinal: number }): void;
  onStart(): void;
  onBack(): void;
}) {
  const maxPuzzle = puzzleCountFor(practice.stage, practice.wave);
  const update = (next: Partial<typeof practice>) => {
    const merged = { ...practice, ...next };
    const count = puzzleCountFor(merged.stage, merged.wave);
    setPractice({
      ...merged,
      ordinal: Math.min(Math.max(1, merged.ordinal), Math.max(1, count)),
    });
  };
  return (
    <div className="menu-actions">
      <span className="eyebrow">PRACTICE ARCHIVE</span>
      <h2>SELECT AN ORDEAL</h2>
      <div className="select-grid">
        <LabeledSelect
          label="STAGE"
          value={practice.stage}
          min={1}
          max={9}
          onChange={stage => update({ stage })}
        />
        <LabeledSelect
          label="WAVE"
          value={practice.wave}
          min={1}
          max={4}
          onChange={wave => update({ wave })}
        />
        <LabeledSelect
          label="PUZZLE"
          value={practice.ordinal}
          min={1}
          max={Math.max(1, maxPuzzle)}
          onChange={ordinal => update({ ordinal })}
        />
      </div>
      <div className="difficulty-row compact">
        {difficulties.slice(0, 4).map(item => (
          <button
            onClick={() => setDifficulty(item)}
            className={difficulty === item ? "active" : ""}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <p className="menu-lead">
        存在する問題番号だけを選択できます。一手送り、10秒巻き戻し、クイックセーブを使用できます。
      </p>
      <div className="action-row">
        <Action label="BACK" note="MODE" onClick={onBack} />
        <Action
          label="LOAD ARCHIVE"
          note={`S${practice.stage} W${practice.wave} P${practice.ordinal}`}
          onClick={onStart}
          primary
        />
      </div>
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      >
        {Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => (
          <option value={min + index} key={min + index}>
            {String(min + index).padStart(2, "0")}
          </option>
        ))}
      </select>
    </label>
  );
}

function CreatePanel({
  difficulty,
  onBack,
  onTest,
}: {
  difficulty: Difficulty;
  onBack(): void;
  onTest(puzzle: PuzzleDescriptor): void;
}) {
  const [width, setWidth] = useState(4);
  const [depth, setDepth] = useState(3);
  const [cells, setCells] = useState<EditorCell[]>(
    Array.from({ length: 12 }, () => "empty")
  );
  const [requiredRolls, setRequiredRolls] = useState(0);
  const [notice, setNotice] = useState(
    "セルをクリックして EMPTY → NORMAL → VEIL → VOID を切り替えます。"
  );
  const [seed] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => setCells(Array.from({ length: width * depth }, () => "empty")),
    [width, depth]
  );
  const layout = useMemo(
    () =>
      cells.flatMap((cell, index) =>
        cell === "empty"
          ? []
          : [{ x: index % width, z: Math.floor(index / width), type: cell }]
      ),
    [cells, width]
  );
  const derived = useMemo(
    () => deriveDirectSolution({ id: `CUSTOM-${seed}`, width, depth, layout }),
    [depth, layout, seed, width]
  );
  useEffect(() => {
    const captures = derived
      .filter(step => step.action === "capture")
      .map(step => step.rotation);
    setRequiredRolls(
      captures.length < 2 ? 0 : Math.max(...captures) - Math.min(...captures)
    );
  }, [derived]);
  const descriptor = useMemo<PuzzleDescriptor>(
    () => ({
      id: `CUSTOM-${seed}`,
      stage: 1,
      wave: 1,
      ordinal: 1,
      width,
      depth,
      spawnRow: 0,
      requiredRolls,
      difficultyTag: "custom",
      seed,
      layout,
      solution: derived,
      validation: {
        valid: false,
        normal: layout.filter(cell => cell.type === "normal").length,
        veil: layout.filter(cell => cell.type === "veil").length,
        void: layout.filter(cell => cell.type === "void").length,
        travelBudget: width + depth + 4,
      },
      featured: true,
    }),
    [depth, derived, layout, requiredRolls, seed, width]
  );
  const validation = useMemo(() => validatePuzzle(descriptor), [descriptor]);
  const cycle = (index: number) =>
    setCells(previous =>
      previous.map((cell, cellIndex) =>
        cellIndex !== index
          ? cell
          : cell === "empty"
            ? "normal"
            : cell === "normal"
              ? "veil"
              : cell === "veil"
                ? "void"
                : "empty"
      )
    );
  const mirror = () => {
    setCells(previous =>
      Array.from(
        { length: width * depth },
        (_, index) =>
          previous[
            Math.floor(index / width) * width + (width - 1 - (index % width))
          ]
      )
    );
    setNotice("盤面を左右反転しました。");
  };
  const save = () => {
    const archive = JSON.parse(
      localStorage.getItem("cubic-ordeal-custom-v1") ?? "[]"
    ) as PuzzleDescriptor[];
    localStorage.setItem(
      "cubic-ordeal-custom-v1",
      JSON.stringify([...archive, descriptor])
    );
    setNotice(`CUSTOM ARCHIVEへ保存しました。保存数: ${archive.length + 1}`);
  };
  const test = () => {
    const result = validation;
    setNotice(
      result.valid
        ? `VALID // 必須 ${result.required}、VOID ${result.voids}、AREA ${result.areaUses}回`
        : `WARNING // ${result.reason}`
    );
  };
  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(descriptor, null, 2)], {
        type: "application/json",
      })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cubic-ordeal-custom.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parsePuzzleDescriptor(
        JSON.parse(await file.text()) as unknown
      );
      if (!parsed.valid || !parsed.puzzle) throw new Error(parsed.reason);
      const imported = parsed.puzzle;
      if (
        imported.width < 4 ||
        imported.width > 7 ||
        imported.depth < 2 ||
        imported.depth > 9
      )
        throw new Error("grid bounds");
      setWidth(imported.width);
      setDepth(imported.depth);
      setCells(
        Array.from({ length: imported.width * imported.depth }, (_, index) => {
          const cube = imported.layout.find(
            item =>
              item.x === index % imported.width &&
              item.z === Math.floor(index / imported.width)
          );
          return cube?.type ?? "empty";
        })
      );
      setRequiredRolls(imported.requiredRolls);
      setNotice(
        "JSONを読み込みました。VALIDATEで現在の規則に照合してください。"
      );
    } catch {
      setNotice("WARNING // 読み込めないCUBIC ORDEAL JSONです。");
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  const loadLatest = () => {
    try {
      const archive = JSON.parse(
        localStorage.getItem("cubic-ordeal-custom-v1") ?? "[]"
      ) as unknown;
      if (!Array.isArray(archive)) throw new Error("archive");
      const latest = archive.at(-1);
      if (!latest) {
        setNotice("保存済み問題がありません。");
        return;
      }
      void importJson(
        new File([JSON.stringify(latest)], "archive.json", {
          type: "application/json",
        })
      );
    } catch {
      setNotice("WARNING // 保存済み問題アーカイブが壊れています。");
    }
  };
  return (
    <div className="menu-actions create-panel">
      <span className="eyebrow">CREATE // LOCAL ARCHIVE</span>
      <div className="select-grid">
        <LabeledSelect
          label="WIDTH"
          value={width}
          min={4}
          max={7}
          onChange={setWidth}
        />
        <LabeledSelect
          label="DEPTH"
          value={depth}
          min={2}
          max={9}
          onChange={setDepth}
        />
        <label>
          <span>REQUIRED</span>
          <input
            type="number"
            min="0"
            max="99"
            value={requiredRolls}
            onChange={event =>
              setRequiredRolls(Math.max(0, Number(event.target.value)))
            }
          />
        </label>
      </div>
      <div
        className="editor-grid"
        style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
      >
        {cells.map((cell, index) => (
          <button
            className={`editor-cell ${cell}`}
            title={`${cell} cell`}
            onClick={() => cycle(index)}
            key={index}
          >
            {cell === "normal"
              ? "N"
              : cell === "veil"
                ? "V"
                : cell === "void"
                  ? "Ø"
                  : ""}
          </button>
        ))}
      </div>
      <p className="editor-notice">{notice}</p>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={event => void importJson(event.target.files?.[0])}
      />
      <div className="editor-actions">
        <Action label="VALIDATE" note="CHECK" onClick={test} />
        <Action label="SAVE" note="LOCAL" onClick={save} />
        <Action label="LOAD" note="LATEST" onClick={loadLatest} />
        <Action
          label="IMPORT"
          note="JSON"
          onClick={() => input.current?.click()}
        />
        <Action label="EXPORT" note="JSON" onClick={exportJson} />
        <Action label="MIRROR" note="LEFT / RIGHT" onClick={mirror} />
      </div>
      <div className="action-row">
        <Action label="BACK" note="MODE" onClick={onBack} />
        <Action
          label="TEST ORDEAL"
          note={validation.valid ? difficulty : "VALIDATE"}
          onClick={() => onTest(descriptor)}
          disabled={!validation.valid}
          primary
        />
      </div>
    </div>
  );
}

function SettingsPanel({ onBack }: { onBack(): void }) {
  const [quality, setQuality] = useState(
    localStorage.getItem("cubic-ordeal-quality") ?? "AUTO"
  );
  const [audio, setAudio] = useState(
    localStorage.getItem("cubic-ordeal-audio") ?? "ON"
  );
  const set = (key: "quality" | "audio", value: string) => {
    localStorage.setItem(`cubic-ordeal-${key}`, value);
    setting(key, value);
  };
  return (
    <div className="menu-actions">
      <span className="eyebrow">OBSERVATORY SETTINGS</span>
      <h2>CALIBRATION</h2>
      <div className="setting-line">
        <span>QUALITY</span>
        <select
          value={quality}
          onChange={event => {
            setQuality(event.target.value);
            set("quality", event.target.value);
          }}
        >
          <option>AUTO</option>
          <option>LOW</option>
          <option>NORMAL</option>
          <option>HIGH</option>
        </select>
      </div>
      <div className="setting-line">
        <span>AUDIO</span>
        <select
          value={audio}
          onChange={event => {
            setAudio(event.target.value);
            set("audio", event.target.value);
          }}
        >
          <option>ON</option>
          <option>OFF</option>
        </select>
      </div>
      <p className="menu-lead">
        品質と音声は選択直後に反映されます。AUTOは端末性能から安全な描画密度を選びます。
      </p>
      <Action label="BACK" note="TITLE" onClick={onBack} primary />
    </div>
  );
}

function Action({
  label,
  note,
  onClick,
  primary = false,
  disabled = false,
}: {
  label: string;
  note: string;
  onClick(): void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      className={`signal-action ${primary ? "primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      <small>{note}</small>
    </Button>
  );
}
function BrandMark() {
  return (
    <span className="brand-symbol" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Hud({ snapshot, onMenu }: { snapshot: GameSnapshot; onMenu(): void }) {
  const compact = snapshot.mode === "TUTORIAL";
  const mindIndex = calculateMindIndex(
    snapshot.stats.score,
    snapshot.stage,
    snapshot.stats.platformRows,
    snapshot.stats.misses
  );
  return (
    <>
      <header className="hud-top">
        <div className="hud-brand">
          <BrandMark />
          <span>CUBIC ORDEAL</span>
        </div>
        <div className="hud-stat score">
          <span>
            {snapshot.mode === "DUEL"
              ? `P1 ${snapshot.duelScore[0]} : ${snapshot.duelScore[1]} P2`
              : "SCORE"}
          </span>
          <b>
            {snapshot.mode === "DUEL"
              ? `TURN P${snapshot.duelTurn + 1}`
              : String(snapshot.stats.score).padStart(6, "0")}
          </b>
        </div>
        <button
          className="pause-button"
          aria-label="PAUSE"
          onClick={() => command({ type: "pause" })}
        >
          Ⅱ <span>PAUSE</span>
        </button>
      </header>
      <aside className="hud-left">
        <Metric
          label="STAGE"
          value={
            snapshot.stage === 9
              ? "FINAL"
              : String(snapshot.stage).padStart(2, "0")
          }
        />
        <Metric label="WAVE" value={String(snapshot.wave).padStart(2, "0")} />
        <Metric
          label="PUZZLE"
          value={String(snapshot.puzzleIndex + 1).padStart(2, "0")}
        />
      </aside>
      <aside className="hud-right">
        <Metric
          label="ROLL"
          value={`${snapshot.stats.rotations} / ${snapshot.stats.requiredRolls}`}
        />
        <Metric
          label="LOSS"
          value={`${snapshot.stats.misses} / ${snapshot.stats.missLimit}`}
          danger={snapshot.stats.misses > 0}
        />
        <Metric label="ROWS" value={String(snapshot.stats.platformRows)} />
        <Metric label="VEIL" value={String(snapshot.stats.areaMarks)} />
      </aside>
      {!compact && (
        <footer className="hud-bottom">
          <span>{snapshot.difficulty}</span>
          <i />
          <span>MIND INDEX {mindIndex}</span>
          <i />
          <button onClick={onMenu}>MENU</button>
        </footer>
      )}
      {snapshot.mode === "PRACTICE" && <PracticeTools />}
    </>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={`hud-stat ${danger ? "danger" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
function PracticeTools() {
  return (
    <div className="practice-tools">
      <button onClick={() => command({ type: "rewind" })}>
        REWIND
        <br />
        <span>10 SEC</span>
      </button>
      <button onClick={() => command({ type: "quick-save" })}>SAVE</button>
      <button onClick={() => command({ type: "quick-load" })}>LOAD</button>
      <button onClick={() => command({ type: "step-roll" })}>
        STEP
        <br />
        <span>ROLL</span>
      </button>
    </div>
  );
}
function DebugPanel({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <aside className="debug-panel">
      <span>
        DEBUG // GRID {snapshot.player.x.toFixed(1)}:
        {snapshot.player.z.toFixed(1)}
      </span>
      <span>STATE {snapshot.phase}</span>
      <div>
        <button onClick={() => command({ type: "step-roll" })}>STEP</button>
        <button onClick={() => command({ type: "auto-solve" })}>AUTO</button>
        <button
          onClick={() =>
            command({
              type: "debug-platform",
              rows: snapshot.stats.platformRows + 1,
            })
          }
        >
          +ROW
        </button>
      </div>
    </aside>
  );
}
function PauseOverlay({
  snapshot,
  onResume,
  onQuit,
}: {
  snapshot: GameSnapshot;
  onResume(): void;
  onQuit(): void;
}) {
  return (
    <div
      className="overlay-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cubic-pause-title"
    >
      <span className="eyebrow">ORDEAL SUSPENDED</span>
      <h2 id="cubic-pause-title">PAUSED</h2>
      <p>キューブ回転、判定、経過時間は停止しています。</p>
      <Action label="RESUME" note="ESC" onClick={onResume} primary />
      <Action label="QUIT TO MENU" note="ABORT RUN" onClick={onQuit} />
    </div>
  );
}
function ResultOverlay({
  snapshot,
  onContinue,
  playerName,
}: {
  snapshot: GameSnapshot;
  onContinue(): void;
  playerName: string;
}) {
  const final = snapshot.phase === "FINAL_RESULT";
  const gameOver = snapshot.phase === "GAME_OVER";
  const ranked = snapshot.mode === "CAMPAIGN" && (final || gameOver);
  const [shareStatus, setShareStatus] = useState("");
  const [submissionState, setSubmissionState] =
    useState<RankingSubmissionState>(ranked ? "submitting" : "idle");
  const [submissionMessage, setSubmissionMessage] = useState(
    ranked ? "ランキングへ送信中です。" : ""
  );
  const [rankingStatus, setRankingStatus] = useState(
    ranked ? "ランキングを読み込み中…" : ""
  );
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [replayMessage, setReplayMessage] = useState("");
  const [startingReplay, setStartingReplay] = useState(false);
  const mindIndex = calculateMindIndex(
    snapshot.stats.score,
    snapshot.stage,
    snapshot.stats.platformRows,
    snapshot.stats.misses
  );
  const validatedName = validatePlayerName(playerName);
  const displayName = validatedName.ok ? validatedName.name : "ななし";
  const shareText = `${displayName}さんのCUBIC ORDEAL結果：${formatRankingScore(snapshot.stats.score)}、ステージ${snapshot.stage}、足場${snapshot.stats.platformRows}列、MIND INDEX ${mindIndex}。\n${RANKING_CONFIG.canonicalUrl}\n#CUBICORDEAL #ミニゲーム`;

  useEffect(() => {
    if (!ranked) return;
    let active = true;
    setSubmissionState("submitting");
    setSubmissionMessage("ランキングへ送信中です。");
    setRankingStatus("ランキングを読み込み中…");
    setRanking([]);
    void (async () => {
      const outcome = await rankingClient.finishAndSubmitCampaignResult({
        displayName,
        resultType: final ? "clear" : "game_over",
        reachedStage: snapshot.stage,
        score: snapshot.stats.score,
      });
      if (active) {
        setSubmissionState(outcome.state);
        setSubmissionMessage(outcome.message);
      }
      try {
        const rows = await rankingClient.loadBestRanking();
        if (!active) return;
        setRanking(rows);
        setRankingStatus(
          rows.length
            ? "上位10名を表示しています。"
            : "まだランキングがありません。"
        );
      } catch {
        if (!active) return;
        setRankingStatus("ランキングを読み込めませんでした。");
      }
    })();
    return () => {
      active = false;
    };
  }, [displayName, final, ranked, snapshot.stage, snapshot.stats.score]);

  const retrySubmission = async () => {
    setSubmissionState("submitting");
    setSubmissionMessage("同じ結果を再送中です。");
    const outcome = await rankingClient.retryPendingCampaignResult();
    setSubmissionState(outcome.state);
    setSubmissionMessage(outcome.message);
    if (outcome.state === "submitted") {
      try {
        const rows = await rankingClient.loadBestRanking();
        setRanking(rows);
        setRankingStatus(
          rows.length
            ? "上位10名を表示しています。"
            : "まだランキングがありません。"
        );
      } catch {
        setRankingStatus("ランキングを読み込めませんでした。");
      }
    }
  };

  const startAnotherCampaign = async (
    type: "campaign-continue" | "campaign-new"
  ) => {
    if (startingReplay || !validatedName.ok) return;
    setStartingReplay(true);
    setReplayMessage("次のプレイ開始を確認中…");
    try {
      await rankingClient.startCampaignPlay(validatedName.name, {
        forceNew: true,
      });
      command({ type });
      setReplayMessage("");
    } catch (error) {
      setReplayMessage(startErrorMessage(error));
    } finally {
      setStartingReplay(false);
    }
  };

  return (
    <div
      className="overlay-panel result"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cubic-result-title"
    >
      <span className="eyebrow">
        {gameOver
          ? "CONTACT LOST"
          : final
            ? "OBSERVATION COMPLETE"
            : "ORDEAL ANALYSIS"}
      </span>
      <h2 id="cubic-result-title">{snapshot.banner}</h2>
      <div className="result-grid">
        <Metric
          label="SCORE"
          value={formatRankingScore(snapshot.stats.score)}
        />
        <Metric
          label="MIND INDEX"
          value={String(
            calculateMindIndex(
              snapshot.stats.score,
              snapshot.stage,
              snapshot.stats.platformRows,
              snapshot.stats.misses
            )
          ).padStart(3, "0")}
        />
        <Metric label="ROWS" value={String(snapshot.stats.platformRows)} />
      </div>
      <p>
        {gameOver
          ? "足場が必要な奥行を失いました。別の進路を試してください。"
          : final
            ? "すべての観測対象を通過しました。"
            : "次の解析結果を待機しています。"}
      </p>
      {ranked && (
        <>
          <section
            className="result-sharing"
            aria-labelledby="cubic-result-share-title"
          >
            <span className="eyebrow" id="cubic-result-share-title">
              RESULT SIGNAL
            </span>
            <p className="platform-status">{displayName}さんの結果</p>
            <textarea
              value={shareText}
              readOnly
              rows={4}
              aria-label="結果のシェア文"
            />
            <button
              className="platform-action"
              type="button"
              onClick={() => void shareOrCopy(shareText, setShareStatus)}
            >
              <span>SHARE RESULT</span>
              <small>共有またはコピー</small>
            </button>
            <p className="platform-status" role="status" aria-live="polite">
              {shareStatus}
            </p>
          </section>
          <section
            className="online-ranking"
            aria-labelledby="cubic-ranking-title"
          >
            <span className="eyebrow" id="cubic-ranking-title">
              TOP 10 OBSERVATIONS
            </span>
            <ol className="ranking-list">
              {ranking.length ? (
                ranking.map(item => (
                  <li key={`${item.rankNo}-${item.name}`}>
                    <span>{item.rankNo}.</span>
                    <span className="ranking-name">{item.name}</span>
                    <b>{formatRankingScore(item.score)}</b>
                  </li>
                ))
              ) : (
                <li>表示できる記録はまだありません。</li>
              )}
            </ol>
            <p className="platform-status" role="status" aria-live="polite">
              {rankingStatus}
            </p>
            <p
              className="platform-status ranking-submission-status"
              data-state={submissionState}
              role="status"
              aria-live="polite"
            >
              {submissionMessage}
            </p>
            {submissionState === "retryable_failed" && (
              <button
                className="platform-action ranking-retry"
                type="button"
                onClick={() => void retrySubmission()}
              >
                <span>RETRY SCORE</span>
                <small>同じ結果を再送</small>
              </button>
            )}
          </section>
          <div className="result-platform-links">
            <a
              className="platform-link result-platform-link"
              href={RANKING_CONFIG.rankingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              詳細ランキング
            </a>
            <a
              className="platform-link result-platform-link"
              href={RANKING_CONFIG.labUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              カメレオンJPの実験場
            </a>
          </div>
        </>
      )}
      {ranked ? (
        <div className="result-actions">
          <p className="platform-status" role="status" aria-live="polite">
            {replayMessage}
          </p>
          {gameOver && (
            <Action
              label="CONTINUE"
              note="RESTART CURRENT STAGE"
              onClick={() => void startAnotherCampaign("campaign-continue")}
              disabled={startingReplay}
              primary
            />
          )}
          <Action
            label="NEW CAMPAIGN"
            note="CLEAR SAVE // STAGE 1"
            onClick={() => void startAnotherCampaign("campaign-new")}
            disabled={startingReplay}
            primary={final}
          />
          <Action label="RETURN TO MENU" note="HOME" onClick={onContinue} />
        </div>
      ) : (
        <Action
          label={final ? "RETURN TO MENU" : "CONTINUE"}
          note="ENTER"
          onClick={final ? onContinue : () => command({ type: "continue" })}
          primary
        />
      )}
    </div>
  );
}

function TouchControls({ snapshot }: { snapshot: GameSnapshot }) {
  const [stick, setStick] = useState<{
    originX: number;
    originY: number;
    x: number;
    y: number;
  } | null>(null);
  const basis = useRef({ forwardX: 0, forwardZ: 1, rightX: 1, rightZ: 0 });
  const activePointer = useRef<number | null>(null);
  const activeFastPointer = useRef<number | null>(null);
  const resetInput = useCallback(() => {
    activePointer.current = null;
    activeFastPointer.current = null;
    setStick(null);
    command({ type: "touch-move", x: 0, z: 0 });
    command({ type: "touch-fast", active: false });
  }, []);
  const previousPhase = useRef(snapshot.phase);
  useEffect(() => {
    if (previousPhase.current !== snapshot.phase) resetInput();
    previousPhase.current = snapshot.phase;
  }, [resetInput, snapshot.phase]);
  useEffect(() => () => resetInput(), [resetInput]);
  useEffect(() => {
    const resetOnFocusLoss = () => resetInput();
    window.addEventListener("blur", resetOnFocusLoss);
    document.addEventListener("visibilitychange", resetOnFocusLoss);
    return () => {
      window.removeEventListener("blur", resetOnFocusLoss);
      document.removeEventListener("visibilitychange", resetOnFocusLoss);
    };
  }, [resetInput]);
  const markHasTarget = Boolean(
    snapshot.marker &&
      snapshot.cubes.some(cube =>
        cubeOccupiesCell(
          cube,
          snapshot.marker!,
          snapshot.rollProgress,
          snapshot.isRolling ?? false
        )
      )
  );
  const markAction = !snapshot.marker
    ? "MARK"
    : markHasTarget
      ? "CAPTURE"
      : "CLEAR";
  useEffect(() => {
    const updateBasis = (event: Event) => {
      basis.current = (event as CustomEvent<typeof basis.current>).detail;
    };
    window.addEventListener("cubic:camera-basis", updateBasis);
    return () => window.removeEventListener("cubic:camera-basis", updateBasis);
  }, []);
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== null || !event.isPrimary) return;
    activePointer.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic test events */
    }
    setStick({ originX: event.clientX, originY: event.clientY, x: 0, y: 0 });
    command({ type: "touch-move", x: 0, z: 0 });
  };
  const update = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    setStick(origin => {
      if (!origin) return null;
      const dx = Math.max(-52, Math.min(52, event.clientX - origin.originX));
      const dy = Math.max(-52, Math.min(52, event.clientY - origin.originY));
      const next = { ...origin, x: dx / 52, y: dy / 52 };
      const screenForward = -next.y;
      command({
        type: "touch-move",
        x:
          basis.current.rightX * next.x +
          basis.current.forwardX * screenForward,
        z:
          basis.current.rightZ * next.x +
          basis.current.forwardZ * screenForward,
      });
      return next;
    });
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    resetInput();
  };
  const pressAction = (
    event: PointerEvent<HTMLButtonElement>,
    action: "mark" | "area"
  ) => {
    if (!event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic test events */
    }
    command({ type: "touch-press", action });
  };
  const keyAction = (
    event: KeyboardEvent<HTMLButtonElement>,
    action: "mark" | "area"
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      command({ type: "touch-press", action });
    }
  };
  const beginFast = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || activeFastPointer.current !== null) return;
    activeFastPointer.current = event.pointerId;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic test events */
    }
    command({ type: "touch-fast", active: true });
  };
  const endFast = (event: PointerEvent<HTMLButtonElement>) => {
    if (activeFastPointer.current !== event.pointerId) return;
    activeFastPointer.current = null;
    event.preventDefault();
    event.stopPropagation();
    command({ type: "touch-fast", active: false });
  };
  return (
    <div
      className="touch-controls"
      aria-label="タッチ操作"
      onContextMenu={event => event.preventDefault()}
    >
      <div
        className="touch-zone"
        aria-label="画面下半分のフローティング移動キー"
        onPointerDown={begin}
        onPointerMove={update}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        {stick && (
          <div
            className="touch-stick floating"
            data-origin={`${Math.round(stick.originX)}:${Math.round(stick.originY)}`}
            style={{ left: stick.originX, top: stick.originY }}
          >
            <div
              className="touch-knob"
              style={{
                transform: `translate(${stick.x * 35}px, ${stick.y * 35}px)`,
              }}
            />
          </div>
        )}
        <span className="touch-zone-label">MOVE // TAP ORIGIN</span>
      </div>
      <div className="touch-actions">
        <button
          className="area"
          aria-label="AREA"
          disabled={!snapshot.areas.length}
          onPointerDown={event => pressAction(event, "area")}
          onKeyDown={event => keyAction(event, "area")}
        >
          AREA
        </button>
        <button
          className="fast"
          aria-label="FAST"
          onPointerDown={beginFast}
          onPointerUp={endFast}
          onPointerCancel={endFast}
          onPointerLeave={endFast}
          onLostPointerCapture={endFast}
        >
          FAST
        </button>
        <button
          className="mark"
          aria-label={markAction}
          onPointerDown={event => pressAction(event, "mark")}
          onKeyDown={event => keyAction(event, "mark")}
        >
          {markAction}
          <br />
          <span>
            {markAction === "MARK"
              ? "SET TRAP"
              : markAction === "CAPTURE"
                ? "ON SIGNAL"
                : "REMOVE TRAP"}
          </span>
        </button>
      </div>
    </div>
  );
}
