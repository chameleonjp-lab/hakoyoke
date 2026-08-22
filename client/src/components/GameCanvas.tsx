/** Obsidian Observatory: lazy Babylon canvas with a lifecycle-safe engine boundary beneath the instant React HUD. */
import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";

export default function GameCanvas({ onReady }: { onReady(): void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: false });
    let handle: GameHandle | null = null;
    let alive = true;
    void createGameScene(engine, canvas).then((created) => { if (!alive) { created.dispose(); return; } handle = created; engine.runRenderLoop(() => created.scene.render()); onReady(); }).catch((error: unknown) => { console.error("CUBIC ORDEAL scene initialization failed", error); });
    const resize = () => engine.resize(); window.addEventListener("resize", resize);
    return () => { alive = false; window.removeEventListener("resize", resize); handle?.dispose(); engine.dispose(); startedRef.current = false; };
  }, []);
  return <canvas ref={canvasRef} className="game-canvas" style={{ touchAction: "none" }} />;
}
