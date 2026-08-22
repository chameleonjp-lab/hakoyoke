/** Obsidian Observatory RUM: anonymous runtime milestones and Web Vitals, retained locally unless an endpoint is configured. */
export interface RumSnapshot {
  navigationMs?: number;
  fcpMs?: number;
  lcpMs?: number;
  cls: number;
  inputDelayMs?: number;
  runtimeRequestedMs?: number;
  runtimeReadyMs?: number;
  firstFrameMs?: number;
  recordedAt: string;
}

const STORAGE_KEY = "cubic-ordeal-rum-v1";
const EVENT_NAME = "cubic:rum";
let started = false;
let sent = false;
let snapshot: RumSnapshot = { cls: 0, recordedAt: new Date().toISOString() };

function isBrowser(): boolean { return typeof window !== "undefined" && typeof performance !== "undefined"; }
function now(): number { return Math.round(performance.now()); }

function publish(): void {
  if (!isBrowser()) return;
  snapshot = { ...snapshot, recordedAt: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent<RumSnapshot>(EVENT_NAME, { detail: snapshot }));
}

function persist(send = false): void {
  if (!isBrowser()) return;
  try {
    const previous = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as RumSnapshot[];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...previous.slice(-23), snapshot]));
  } catch { /* RUM is optional in restricted storage contexts. */ }
  const endpoint = import.meta.env.VITE_RUM_ENDPOINT;
  if (!send || sent || !endpoint) return;
  sent = true;
  const body = JSON.stringify(snapshot);
  if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) {
    void fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  }
}

function observe(type: string, receive: (entries: PerformanceEntry[]) => void): () => void {
  if (!isBrowser() || !("PerformanceObserver" in window)) return () => undefined;
  try {
    const observer = new PerformanceObserver((list) => receive(list.getEntries()));
    observer.observe({ type, buffered: true });
    return () => observer.disconnect();
  } catch { return () => undefined; }
}

export function startRum(): () => void {
  if (!isBrowser() || started) return () => undefined;
  started = true;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  snapshot.navigationMs = Math.round(navigation?.duration ?? performance.now());
  const stopPaint = observe("paint", (entries) => entries.forEach((entry) => {
    if (entry.name === "first-contentful-paint") { snapshot.fcpMs = Math.round(entry.startTime); publish(); }
  }));
  const stopLcp = observe("largest-contentful-paint", (entries) => {
    const latest = entries.at(-1);
    if (latest) { snapshot.lcpMs = Math.round(latest.startTime); publish(); }
  });
  const stopCls = observe("layout-shift", (entries) => entries.forEach((entry) => {
    const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
    if (!shift.hadRecentInput) snapshot.cls = Number((snapshot.cls + (shift.value ?? 0)).toFixed(4));
  }));
  const stopInput = observe("first-input", (entries) => {
    const input = entries[0];
    if (input) { snapshot.inputDelayMs = Math.round(input.duration); publish(); }
  });
  const finish = () => { persist(true); publish(); };
  window.addEventListener("pagehide", finish, { once: true });
  publish();
  return () => { stopPaint(); stopLcp(); stopCls(); stopInput(); window.removeEventListener("pagehide", finish); };
}

export function markRuntimeRequested(): void { if (isBrowser()) { snapshot.runtimeRequestedMs = now(); publish(); } }
export function markRuntimeReady(): void { if (isBrowser()) { snapshot.runtimeReadyMs = now(); publish(); } }
export function markFirstFrame(): void { if (isBrowser() && snapshot.firstFrameMs === undefined) { snapshot.firstFrameMs = now(); persist(); publish(); } }
export function getRumSnapshot(): RumSnapshot { return { ...snapshot }; }

export function subscribeRum(listener: (value: RumSnapshot) => void): () => void {
  if (!isBrowser()) return () => undefined;
  const receive = (event: Event) => listener((event as CustomEvent<RumSnapshot>).detail);
  window.addEventListener(EVENT_NAME, receive);
  return () => window.removeEventListener(EVENT_NAME, receive);
}
