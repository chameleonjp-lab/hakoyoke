import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
const FORBIDDEN_PATHS = new Set([".project-config.json", "template.json"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".manus-logs",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const SECRET_RULES = [
  {
    name: "embedded sensitive configuration value",
    pattern:
      /"(?:BUILT_IN_FORGE_API_KEY|JWT_SECRET|VITE_FRONTEND_FORGE_API_KEY)"\s*:\s*"(?!\$\{|<|REPLACE_|CHANGE_ME|\")[^"]+"/,
  },
  {
    name: "embedded artifact access token",
    pattern: /art_v2_[a-zA-Z0-9_?=&-]+/,
  },
];

const issues = [];
await inspectDirectory(REPOSITORY_ROOT);

if (issues.length > 0) {
  throw new Error(
    [
      "Repository hygiene check failed:",
      ...issues.map(issue => `- ${issue}`),
      "Keep local credentials and generated scaffold snapshots outside Git.",
    ].join("\n")
  );
}

console.log("Repository hygiene check passed.");

async function inspectDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(REPOSITORY_ROOT, absolutePath);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        await inspectDirectory(absolutePath);
      }
      continue;
    }
    if (!entry.isFile()) continue;

    if (FORBIDDEN_PATHS.has(relativePath)) {
      issues.push(`${relativePath}: local-only file is tracked`);
      continue;
    }

    const content = await readFile(absolutePath);
    if (content.includes(0)) continue;
    const text = content.toString("utf8");
    for (const rule of SECRET_RULES) {
      if (rule.pattern.test(text)) {
        issues.push(`${relativePath}: ${rule.name}`);
      }
    }
  }
}
