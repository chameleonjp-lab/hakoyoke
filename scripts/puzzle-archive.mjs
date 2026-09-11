import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
const ARCHIVE_PATH = path.join(
  REPOSITORY_ROOT,
  "client/public/data/puzzles.json"
);
const REPORT_PATH = path.join(REPOSITORY_ROOT, "LEVEL_VALIDATION_REPORT.md");

export async function buildPuzzleArtifacts() {
  const { generatePuzzles, validatePuzzleArchive } =
    await loadPuzzleImplementation();
  const puzzles = generatePuzzles();
  const validation = validatePuzzleArchive(puzzles, { quality: true });

  if (!validation.valid) {
    throw new Error(
      `Puzzle archive validation failed:\n${validation.issues.join("\n")}`
    );
  }

  return {
    puzzles,
    archive: `${JSON.stringify(puzzles, null, 2)}\n`,
    report: renderValidationReport(
      puzzles,
      validation.results,
      validation.quality
    ),
  };
}

export async function writePuzzleArtifacts() {
  const artifacts = await buildPuzzleArtifacts();
  await Promise.all([
    writeFile(ARCHIVE_PATH, artifacts.archive, "utf8"),
    writeFile(REPORT_PATH, artifacts.report, "utf8"),
  ]);
  return artifacts;
}

export async function checkPuzzleArtifacts() {
  const artifacts = await buildPuzzleArtifacts();
  const expectedFiles = [
    [ARCHIVE_PATH, artifacts.archive],
    [REPORT_PATH, artifacts.report],
  ];
  const staleFiles = [];

  for (const [filePath, expected] of expectedFiles) {
    let actual = "";
    try {
      actual = await readFile(filePath, "utf8");
    } catch {
      staleFiles.push(path.relative(REPOSITORY_ROOT, filePath));
      continue;
    }
    if (actual !== expected) {
      staleFiles.push(path.relative(REPOSITORY_ROOT, filePath));
    }
  }

  if (staleFiles.length > 0) {
    throw new Error(
      [
        "Generated puzzle artifacts are out of date:",
        ...staleFiles.map(file => `- ${file}`),
        "Run `pnpm puzzles:write` and commit the result.",
      ].join("\n")
    );
  }

  return artifacts;
}

async function loadPuzzleImplementation() {
  const result = await build({
    stdin: {
      contents: [
        'export { generatePuzzles } from "./client/src/game/puzzles.ts";',
        'export { validatePuzzleArchive } from "./client/src/game/puzzleValidation.ts";',
      ].join("\n"),
      loader: "ts",
      resolveDir: REPOSITORY_ROOT,
      sourcefile: "puzzle-archive-entry.ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    write: false,
    logLevel: "silent",
  });

  const bundledSource = result.outputFiles[0]?.text;
  if (!bundledSource) {
    throw new Error("Could not bundle the TypeScript puzzle implementation.");
  }

  const dataUrl = `data:text/javascript;base64,${Buffer.from(
    bundledSource
  ).toString("base64")}`;
  return import(dataUrl);
}

function renderValidationReport(puzzles, results, quality) {
  const areaPuzzleCount = results.filter(result => result.areaUses > 0).length;
  const chainPuzzleCount = results.filter(
    result => result.areaUses >= 2
  ).length;
  const rows = puzzles.map((puzzle, index) => {
    const result = results[index];
    const stage = puzzle.stage === 9 ? "Final" : `Stage ${puzzle.stage}`;
    return [
      puzzle.id,
      stage,
      puzzle.wave,
      `${puzzle.width}×${puzzle.depth}`,
      puzzle.requiredRolls,
      puzzle.difficultyTag,
      puzzle.seed,
      result.required,
      result.voids,
      result.areaUses,
      "PASS",
    ].join(" | ");
  });

  return `# LEVEL VALIDATION REPORT

> このファイルは \`client/src/game/puzzles.ts\` と \`client/src/game/stagePlan.ts\` から自動生成されます。手編集せず、\`pnpm puzzles:write\` で更新してください。

## 検証結果

- 問題数: ${puzzles.length}
- AREAを使用する問題: ${areaPuzzleCount}
- AREAを2回以上使用する連鎖問題: ${chainPuzzleCount}
- 検査内容: 問題数、ID・seedの一意性、Stage Plan、全マス形成、配置範囲、保存件数、MARK到達性、AREAの一回使用と再生成、必要キューブ全回収、VOID非捕獲、規定回転数
- 結果: **PASS**

## 代表問題の品質ゲート

- 対象: ${quality.results.length}問（Stage 1〜9の学習曲線から選定）
- 検査内容: 手設計タグ・盤面サイズ・AREA回数、5難易度の30Hz解法再生、入力遅延予算を差し引いた操作猶予
- 結果: **${quality.valid ? "PASS" : "FAIL"}**

| ID | Focus | Size | Tag | AREA uses | BEGINNER | EASY | NORMAL | HARD | EXTREME | Gate |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${quality.results
  .map(result => {
    const margins = result.minimumMarginByDifficulty;
    return `| ${result.id} | ${result.label} | ${result.width}×${result.depth} | ${result.difficultyTag} | ${result.areaUses} | ${margins.BEGINNER} | ${margins.EASY} | ${margins.NORMAL} | ${margins.HARD} | ${margins.EXTREME} | ${result.valid ? "PASS" : "FAIL"} |`;
  })
  .join("\n")}

| ID | Stage | Wave | Size | Required rolls | Tag | Seed | Required | VOID | AREA uses | Validation |
| --- | --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
${rows.map(row => `| ${row} |`).join("\n")}
`;
}

function isExecutedDirectly() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
    : false;
}

if (isExecutedDirectly()) {
  const mode = process.argv[2] ?? "--check";
  if (mode === "--write") {
    const { puzzles } = await writePuzzleArtifacts();
    console.log(`Wrote and validated ${puzzles.length} puzzle records.`);
  } else if (mode === "--check") {
    const { puzzles } = await checkPuzzleArtifacts();
    console.log(
      `Validated ${puzzles.length} puzzle records; artifacts are current.`
    );
  } else {
    throw new Error(`Unknown mode: ${mode}. Use --write or --check.`);
  }
}
