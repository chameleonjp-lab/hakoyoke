import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import {
  consumeStorageRateLimit,
  configuredStorageAssetKeys,
  isAllowedStorageKey,
  normalizeStorageKey,
  pruneStorageRateLimits,
  type RateLimitState,
} from "./server/storagePolicy";
import { resolveStorageAsset } from "./server/storageProxy";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map(entry => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      const storageAllowlist = configuredStorageAssetKeys();
      const storageRateLimits = new Map<string, RateLimitState>();
      server.middlewares.use("/manus-storage", async (req, res) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.writeHead(405, { "Content-Type": "text/plain" });
          res.end("Method not allowed");
          return;
        }

        const identity = req.socket.remoteAddress ?? "unknown";
        if (storageRateLimits.size > 1_000)
          pruneStorageRateLimits(storageRateLimits);
        const rate = consumeStorageRateLimit(storageRateLimits, identity);
        if (!rate.allowed) {
          res.writeHead(429, {
            "Content-Type": "text/plain",
            "Retry-After": String(rate.retryAfterSeconds),
          });
          res.end("Storage asset request limit exceeded");
          return;
        }

        const requestPath = (req.url ?? "").split("?", 1)[0];
        const key = normalizeStorageKey(`/manus-storage${requestPath}`);
        if (!key) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid storage key");
          return;
        }
        if (!isAllowedStorageKey(key, storageAllowlist)) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Storage asset not found");
          return;
        }

        try {
          const url = await resolveStorageAsset(key);
          if (!url) {
            res.writeHead(503, { "Content-Type": "text/plain" });
            res.end("Storage asset is unavailable");
            return;
          }

          res.writeHead(307, {
            Location: url,
            "Cache-Control": "no-store",
          });
          res.end();
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Storage proxy error");
        }
      });
    },
  };
}

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  vitePluginStorageProxy(),
];

function resolveBasePath(value: string | undefined): string {
  const configured = value?.trim();
  if (!configured || configured === "/") return "/";
  return `/${configured.replace(/^\/+|\/+$/g, "")}/`;
}

function vitePluginRemoveManusPublicAssets(): Plugin {
  return {
    name: "remove-manus-public-assets",
    closeBundle() {
      // Keep the path narrow: this only removes generated production output,
      // never source files or an arbitrary directory.
      fs.rmSync(
        path.resolve(import.meta.dirname, "dist", "public", "__manus__"),
        { recursive: true, force: true }
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // The Manus runtime is useful only while developing or previewing locally.
  // A production build must not ship its runtime or debug collector. Preview
  // tooling can opt in explicitly without changing the production default.
  const manusRuntimeEnabled =
    process.env.MANUS_RUNTIME_ENABLED === "true" ||
    (process.env.MANUS_RUNTIME_ENABLED !== "false" &&
      command === "serve" &&
      mode !== "production");
  const activePlugins = [...plugins];
  if (manusRuntimeEnabled) {
    activePlugins.splice(
      3,
      0,
      vitePluginManusRuntime(),
      vitePluginManusDebugCollector()
    );
  } else {
    activePlugins.push(vitePluginRemoveManusPublicAssets());
  }

  return {
    plugins: activePlugins,
    base: resolveBasePath(process.env.VITE_BASE_PATH),
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      // GameCanvas is already loaded only when an ordeal starts. Keep Babylon's cyclic graph intact rather than splitting it by folders.
      chunkSizeWarningLimit: 1300,
    },
    server: {
      port: 3000,
      strictPort: false, // Will find next available port if 3000 is busy
      host: true,
      allowedHosts: [
        ".manuspre.computer",
        ".manus.computer",
        ".manus-asia.computer",
        ".manuscomputer.ai",
        ".manusvm.computer",
        "localhost",
        "127.0.0.1",
      ],
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
