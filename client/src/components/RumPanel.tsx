/** Obsidian Observatory debug surface: compact, optional RUM telemetry without altering the game presentation. */
import { useEffect, useState } from "react";
import { getRumSnapshot, subscribeRum, type RumSnapshot } from "@/lib/rum";

const metrics: Array<[keyof RumSnapshot, string]> = [["navigationMs", "NAV"], ["fcpMs", "FCP"], ["lcpMs", "LCP"], ["runtimeRequestedMs", "REQUEST"], ["runtimeReadyMs", "READY"], ["firstFrameMs", "FRAME"]];

export default function RumPanel() {
  const [snapshot, setSnapshot] = useState<RumSnapshot>(() => getRumSnapshot());
  const enabled = new URLSearchParams(window.location.search).get("rum") === "1";
  useEffect(() => subscribeRum(setSnapshot), []);
  if (!enabled) return null;
  return <aside className="rum-panel" aria-label="Runtime measurement"><span>RUM // ANONYMOUS</span>{metrics.map(([key, label]) => <div key={key}><b>{label}</b><i>{snapshot[key] === undefined ? "—" : `${snapshot[key]}ms`}</i></div>)}<div><b>CLS</b><i>{snapshot.cls.toFixed(4)}</i></div></aside>;
}
