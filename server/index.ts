import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function redirectStorageAsset(key: string): Promise<string | null> {
  const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!forgeBaseUrl || !forgeKey) return null;

  const forgeUrl = new URL("v1/storage/presign/get", `${forgeBaseUrl}/`);
  forgeUrl.searchParams.set("path", key);
  const response = await fetch(forgeUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!response.ok) return null;
  const payload = await response.json() as { url?: string };
  return payload.url ?? null;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.get("/manus-storage/*", async (req, res) => {
    const key = req.path.replace(/^\/manus-storage\/?/, "");
    if (!key || key.includes("..")) {
      res.status(400).type("text/plain").send("Invalid storage key");
      return;
    }
    try {
      const url = await redirectStorageAsset(key);
      if (!url) {
        res.status(503).type("text/plain").send("Storage asset is unavailable");
        return;
      }
      res.redirect(307, url);
    } catch {
      res.status(502).type("text/plain").send("Storage asset could not be resolved");
    }
  });

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
