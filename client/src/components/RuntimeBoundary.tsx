/** Obsidian Observatory reliability boundary: preserve a visible, retryable control surface if a renderer module fails. */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface RuntimeBoundaryProps { children: ReactNode; }
interface RuntimeBoundaryState { error: Error | null; }

export default class RuntimeBoundary extends Component<RuntimeBoundaryProps, RuntimeBoundaryState> {
  state: RuntimeBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RuntimeBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("CUBIC ORDEAL runtime boundary captured a renderer error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <section className="runtime-failure" role="alert" aria-live="assertive">
      <span>OBSERVATORY // RUNTIME ALERT</span>
      <h2>描画システムを再接続できません</h2>
      <p>ゲーム進行データには変更を加えていません。再試行しても解決しない場合は、画質を下げるか再読み込みしてください。</p>
      <button className="signal-action primary" type="button" onClick={() => window.location.reload()}>RETRY RUNTIME <small>SAFE RELOAD</small></button>
    </section>;
  }
}
