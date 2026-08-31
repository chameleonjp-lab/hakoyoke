import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(path.join(root, "ranking-manifest.json"), "utf8")
);
const schema = JSON.parse(
  await readFile(
    path.join(root, "scripts", "ranking-manifest-v1.schema.json"),
    "utf8"
  )
);
const issues = [];

validate(manifest, schema, "$", issues);

const rankingSource = await readFile(
  path.join(root, "client", "src", "lib", "ranking.ts"),
  "utf8"
);
const html = await readFile(path.join(root, "client", "index.html"), "utf8");
const shellSource = await readFile(
  path.join(root, "client", "src", "components", "GameShell.tsx"),
  "utf8"
);
const entry = manifest.ranking_entries.find(
  item => item.game_slug === manifest.lab.representative_slug
);

if (!entry) issues.push("$.lab.representative_slug: no matching ranking entry");
expectSource("gameId", manifest.game_id);
expectSource("gameSlug", manifest.lab.representative_slug);
expectSource("canonicalUrl", manifest.canonical_url);
expectSource("shareText", manifest.share_text);
expectSource("clientVersion", manifest.client_version);
expectSource("playerNameStorageKey", manifest.player_name.storage_key);
expectSource("startRpc", manifest.play_count.rpc);
expectSource("finishRpc", manifest.submission.finish_rpc);
expectSource("scoreRpc", manifest.submission.rpc);
if (entry) {
  expectSource("rankingRpc", entry.ranking_rpc);
  expectSource("rankingType", entry.top_ranking_type);
  expectSource("scoreOrder", entry.score_order);
  expectSource(
    "rankedResults",
    entry.ranked_results,
    value => `[${value.map(item => JSON.stringify(item)).join(", ")}]`
  );
  expectSource("scoreUnit", entry.score_unit);
  expectSource("scoreScale", entry.score_scale);
  expectSource("scoreDecimals", entry.score_decimals);
  expectSource("scoreMin", entry.score_min);
  expectSource("scoreMax", entry.score_max, numericLiteral);
}
const timeoutLiteral = String(manifest.submission.timeout_ms).replace(
  /\B(?=(\d{3})+(?!\d))/g,
  "_"
);
if (!rankingSource.includes(`timeoutMs: ${timeoutLiteral}`)) {
  issues.push("ranking.ts: timeoutMs does not match ranking-manifest.json");
}
if (
  !html.includes(
    `<meta name="chameleonjp-release" content="${manifest.client_version}" />`
  )
) {
  issues.push(
    "client/index.html: chameleonjp-release is missing or mismatched"
  );
}
if (!html.includes(`href="${manifest.canonical_url}"`)) {
  issues.push("client/index.html: canonical URL is missing or mismatched");
}
if (shellSource.includes("location.href")) {
  issues.push(
    "GameShell.tsx: shares must not derive the canonical URL from location.href"
  );
}
if (
  JSON.stringify(manifest).includes("sb_publishable_") ||
  JSON.stringify(manifest).includes("sb_secret_")
) {
  issues.push("ranking-manifest.json: keys must not be stored in the manifest");
}

if (issues.length) {
  throw new Error(
    [
      "Ranking manifest validation failed:",
      ...issues.map(issue => `- ${issue}`),
    ].join("\n")
  );
}

console.log("Ranking manifest and implementation values are consistent.");

function expectSource(key, value, format = JSON.stringify) {
  if (!rankingSource.includes(`${key}: ${format(value)}`)) {
    issues.push(`ranking.ts: ${key} does not match ranking-manifest.json`);
  }
}

function numericLiteral(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "_");
}

function validate(value, rule, location, errors) {
  if (Object.hasOwn(rule, "const") && value !== rule.const) {
    errors.push(`${location}: expected constant ${JSON.stringify(rule.const)}`);
  }
  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`${location}: expected one of ${rule.enum.join(", ")}`);
  }
  if (rule.type === "object") {
    if (!isObject(value)) {
      errors.push(`${location}: expected object`);
      return;
    }
    for (const key of rule.required ?? []) {
      if (!Object.hasOwn(value, key))
        errors.push(`${location}.${key}: required`);
    }
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(rule.properties ?? {}, key)) {
          errors.push(`${location}.${key}: additional property`);
        }
      }
    }
    for (const [key, child] of Object.entries(rule.properties ?? {})) {
      if (Object.hasOwn(value, key))
        validate(value[key], child, `${location}.${key}`, errors);
    }
    return;
  }
  if (rule.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${location}: expected array`);
      return;
    }
    if (rule.minItems !== undefined && value.length < rule.minItems) {
      errors.push(`${location}: expected at least ${rule.minItems} item(s)`);
    }
    if (rule.uniqueItems) {
      const serialized = value.map(item => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) {
        errors.push(`${location}: expected unique items`);
      }
    }
    value.forEach((item, index) =>
      validate(item, rule.items ?? {}, `${location}[${index}]`, errors)
    );
    return;
  }
  if (rule.type === "string") {
    if (typeof value !== "string") {
      errors.push(`${location}: expected string`);
      return;
    }
    const length = Array.from(value).length;
    if (rule.minLength !== undefined && length < rule.minLength) {
      errors.push(`${location}: shorter than ${rule.minLength}`);
    }
    if (rule.maxLength !== undefined && length > rule.maxLength) {
      errors.push(`${location}: longer than ${rule.maxLength}`);
    }
    if (rule.pattern && !new RegExp(rule.pattern, "u").test(value)) {
      errors.push(`${location}: does not match ${rule.pattern}`);
    }
    return;
  }
  if (rule.type === "integer" && !Number.isInteger(value)) {
    errors.push(`${location}: expected integer`);
    return;
  }
  if (rule.minimum !== undefined && value < rule.minimum) {
    errors.push(`${location}: below minimum ${rule.minimum}`);
  }
  if (rule.maximum !== undefined && value > rule.maximum) {
    errors.push(`${location}: above maximum ${rule.maximum}`);
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
