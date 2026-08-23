import { writePuzzleArtifacts } from "./puzzle-archive.mjs";

const { puzzles } = await writePuzzleArtifacts();
console.log(`Wrote and validated ${puzzles.length} puzzle records.`);
