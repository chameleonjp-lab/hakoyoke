import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  consumeStorageRateLimit,
  configuredStorageAssetKeys,
  isAllowedStorageKey,
  normalizeStorageKey,
  pruneStorageRateLimits,
  type RateLimitState,
} from "./storagePolicy";
import { resolveStorageAsset } from "./storageProxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const storageAllowlist = configuredStorageAssetKeys();
  const storageRateLimits = new Map<string, RateLimitState>();
  app.disable("x-powered-by");

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.get("/manus-storage/*", async (req, res) => {
    const identity = req.socket.remoteAddress ?? "unknown";
    if (storageRateLimits.size > 1_000)
      pruneStorageRateLimits(storageRateLimits);
    const rate = consumeStorageRateLimit(storageRateLimits, identity);
    if (!rate.allowed) {
      res
        .status(429)
        .set("Retry-After", String(rate.retryAfterSeconds))
        .type("text/plain")
        .send("Storage asset request limit exceeded");
      return;
    }
    const key = normalizeStorageKey(req.path);
    if (!key) {
      res.status(400).type("text/plain").send("Invalid storage key");
      return;
    }
    if (!isAllowedStorageKey(key, storageAllowlist)) {
      res.status(404).type("text/plain").send("Storage asset not found");
      return;
    }
    try {
      const url = await resolveStorageAsset(key);
      if (!url) {
        res.status(503).type("text/plain").send("Storage asset is unavailable");
        return;
      }
      res.redirect(307, url);
    } catch {
      res
        .status(502)
        .type("text/plain")
        .send("Storage asset could not be resolved");
    }
  });

  // The CI build uses the GitHub Pages base path so the exact same static
  // artifact can be published and served by the production E2E server.
  app.use("/hakoyoke", express.static(staticPath));
  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
