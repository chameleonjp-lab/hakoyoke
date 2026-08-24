import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
const FORBIDDEN_PATHS = new Set([".project-config.json", "template.json"]);
const SAFE_ENV_EXAMPLES = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
]);
const FORBIDDEN_CREDENTIAL_FILES = new Set([
  ".netrc",
  ".npmrc",
  ".pypirc",
  "credentials.json",
  "id_ed25519",
  "id_rsa",
]);
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
    pattern: /\bart_v2_[a-zA-Z0-9_?=&-]+/,
  },
  {
    name: "embedded private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    name: "embedded GitHub access token",
    pattern: /\b(?:gh[pousr]_[a-zA-Z0-9_]{20,}|github_pat_[a-zA-Z0-9_]{20,})\b/,
  },
  {
    name: "embedded AWS access key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    name: "embedded Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/,
  },
  {
    name: "embedded OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    name: "embedded Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    name: "embedded Stripe secret key",
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  },
  {
    name: "embedded Supabase secret key",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}\b/,
  },
  {
    name: "embedded JSON Web Token",
    pattern:
      /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    name: "database URL containing a password",
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s/@]+:[^@\s/]+@/i,
  },
  {
    name: "literal bearer credential",
    pattern:
      /\bAuthorization\s*:\s*["'`]Bearer\s+(?!\$\{|<|REPLACE_|CHANGE_ME)[A-Za-z0-9._~+/=-]{16,}/i,
  },
  {
    name: "literal value assigned to a sensitive name",
    pattern:
      /\b(?:[A-Z0-9_]*API_?KEY|[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|CREDENTIALS?))\b\s*[:=]\s*["'`](?!\$\{|<|REPLACE_|CHANGE_ME|process\.env|import\.meta\.env)[^"'`\r\n]{8,}["'`]/i,
  },
];

const issues = [];
await inspectDirectory(REPOSITORY_ROOT);

if (issues.length > 0) {
  issues.sort();
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

    const forbiddenReason = getForbiddenCredentialFileReason(relativePath);
    if (forbiddenReason) {
      issues.push(`${relativePath}: ${forbiddenReason}`);
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

function getForbiddenCredentialFileReason(relativePath) {
  if (FORBIDDEN_PATHS.has(relativePath)) {
    return "local-only file is tracked";
  }

  const basename = path.basename(relativePath);
  if (/^\.env(?:\..+)?$/.test(basename) && !SAFE_ENV_EXAMPLES.has(basename)) {
    return "environment file is tracked";
  }
  if (FORBIDDEN_CREDENTIAL_FILES.has(basename)) {
    return "credential file is tracked";
  }
  if (/^service-account.*\.json$/i.test(basename)) {
    return "service-account file is tracked";
  }
  if (/\.(?:p12|pfx|pem)$/i.test(basename)) {
    return "private-key container is tracked";
  }

  return null;
}
