/** Obsidian Observatory: lazy Babylon canvas with a lifecycle-safe, retryable engine boundary beneath the instant React HUD. */
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import "@/game/platformProgressionPatch";
import { createGameScene, type GameHandle } from "@/game/scene";

export default function GameCanvas({
  onReady,
  onFirstFrame,
}: {
  onReady(): void;
  onFirstFrame(): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: true,
      powerPreference: "high-performance",
    });
    let handle: GameHandle | null = null;
    let alive = true;
    let firstFrame = false;
    void createGameScene(engine, canvas)
      .then(created => {
        if (!alive) {
          created.dispose();
          return;
        }
        handle = created;
        engine.runRenderLoop(() => {
          created.scene.render();
          if (!firstFrame) {
            firstFrame = true;
            onFirstFrame();
          }
        });
        onReady();
      })
      .catch((reason: unknown) => {
        const failure =
          reason instanceof Error ? reason : new Error(String(reason));
        console.error("CUBIC ORDEAL scene initialization failed", failure);
        if (alive) setError(failure);
      });
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    return () => {
      alive = false;
      window.removeEventListener("resize", resize);
      handle?.dispose();
      engine.dispose();
      startedRef.current = false;
    };
  }, [onFirstFrame, onReady]);
  return (
    <>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-hidden="true"
        style={{ touchAction: "none" }}
      />
      {error && (
        <section className="engine-failure" role="alert" aria-live="assertive">
          <span>RENDERER // INITIALIZATION FAILED</span>
          <p>
            3D描画を開始できませんでした。ゲームの保存データは保持されています。
          </p>
          {import.meta.env.DEV && (
            <code className="engine-error-detail">{error.message}</code>
          )}
          <button type="button" onClick={() => window.location.reload()}>
            RETRY
          </button>
        </section>
      )}
    </>
  );
}
