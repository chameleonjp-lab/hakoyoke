/** App shell: keep title instrumentation instant; load Babylon only when an ordeal begins. */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import GameShell from "@/components/GameShell";
import RuntimeBoundary from "@/components/RuntimeBoundary";
import type { CubicCommand } from "@/game/GameWorld";
import { hasRecoverableTerminalCampaign } from "@/game/campaignStorage";
import {
  markFirstFrame,
  markRuntimeReady,
  markRuntimeRequested,
  startRum,
} from "@/lib/rum";
import "./index.css";

const GameCanvas = lazy(() => import("@/components/GameCanvas"));

export default function App() {
  const search = new URLSearchParams(window.location.search);
  const rumEnabled = search.get("rum") === "1";
  const pendingCommand = useRef<CubicCommand | null>(null);
  const runtimeReady = useRef(false);
  const runtimeRequested = useRef(false);
  const [loadRuntime, setLoadRuntime] = useState(
    () => search.has("demo") || hasRecoverableTerminalCampaign()
  );

  useEffect(() => (rumEnabled ? startRum() : undefined), [rumEnabled]);
  useEffect(() => {
    if (rumEnabled && loadRuntime && !runtimeRequested.current) {
      runtimeRequested.current = true;
      markRuntimeRequested();
    }
  }, [loadRuntime, rumEnabled]);

  const dispatchCommand = useCallback((command: CubicCommand) => {
    window.dispatchEvent(
      new CustomEvent<CubicCommand>("cubic:command", { detail: command })
    );
  }, []);

  const launch = useCallback(
    (command: CubicCommand) => {
      window.dispatchEvent(new Event("cubic:user-gesture"));
      if (runtimeReady.current) dispatchCommand(command);
      else {
        pendingCommand.current = command;
        setLoadRuntime(true);
      }
    },
    [dispatchCommand]
  );

  const handleRuntimeReady = useCallback(() => {
    runtimeReady.current = true;
    if (rumEnabled) markRuntimeReady();
    const command = pendingCommand.current;
    pendingCommand.current = null;
    if (command) dispatchCommand(command);
  }, [dispatchCommand, rumEnabled]);

  const handleFirstFrame = useCallback(() => {
    if (rumEnabled) markFirstFrame();
  }, [rumEnabled]);

  return (
    <div className="game-root">
      {loadRuntime && (
        <RuntimeBoundary>
          <Suspense
            fallback={
              <div className="engine-loading" role="status">
                CALIBRATING OBSERVATORY…
              </div>
            }
          >
            <GameCanvas
              onReady={handleRuntimeReady}
              onFirstFrame={handleFirstFrame}
            />
          </Suspense>
        </RuntimeBoundary>
      )}
      <GameShell onLaunch={launch} />
    </div>
  );
}
