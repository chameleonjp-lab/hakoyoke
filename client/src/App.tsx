/** Obsidian Observatory app shell: keep title instrumentation instant; load Babylon only when an ordeal begins. */
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import GameShell from "@/components/GameShell";
import type { CubicCommand } from "@/game/GameWorld";
import "./index.css";

const GameCanvas = lazy(() => import("@/components/GameCanvas"));

export default function App() {
  const pendingCommand = useRef<CubicCommand | null>(null);
  const runtimeReady = useRef(false);
  const [loadRuntime, setLoadRuntime] = useState(() => new URLSearchParams(window.location.search).has("demo"));

  const dispatchCommand = useCallback((command: CubicCommand) => {
    window.dispatchEvent(new CustomEvent<CubicCommand>("cubic:command", { detail: command }));
  }, []);

  const launch = useCallback((command: CubicCommand) => {
    if (runtimeReady.current) {
      dispatchCommand(command);
      return;
    }
    pendingCommand.current = command;
    setLoadRuntime(true);
  }, [dispatchCommand]);

  const handleRuntimeReady = useCallback(() => {
    runtimeReady.current = true;
    const command = pendingCommand.current;
    pendingCommand.current = null;
    if (command) dispatchCommand(command);
  }, [dispatchCommand]);

  return <div className="game-root">
    {loadRuntime && <Suspense fallback={<div className="engine-loading" role="status">CALIBRATING OBSERVATORY…</div>}><GameCanvas onReady={handleRuntimeReady} /></Suspense>}
    <GameShell onLaunch={launch} />
  </div>;
}
