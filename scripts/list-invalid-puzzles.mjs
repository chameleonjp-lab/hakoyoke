import { buildPuzzleArtifacts } from "./puzzle-archive.mjs";

try {
  const { puzzles } = await buildPuzzleArtifacts();
  console.log(`No invalid puzzles found in ${puzzles.length} records.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
