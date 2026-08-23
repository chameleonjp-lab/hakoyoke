import { checkPuzzleArtifacts } from "./puzzle-archive.mjs";

const { puzzles } = await checkPuzzleArtifacts();
console.log(
  `Validated ${puzzles.length} puzzle records; artifacts are current.`
);
