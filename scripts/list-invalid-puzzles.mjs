import { readFile } from "node:fs/promises";

const puzzles = JSON.parse(await readFile("client/public/data/puzzles.json", "utf8"));
function passes(puzzle) {
  const targetZ = Math.max(12, puzzle.depth + 5) - 1;
  let marker = null;
  const captured = new Set();
  const steps = [...puzzle.solution].sort((a, b) => a.rotation - b.rotation || (a.action === "mark" ? -1 : 1));
  for (const step of steps) {
    if (step.action === "mark") marker = { x: step.x, z: step.z };
    if (step.action === "capture" && marker) {
      const hitIndex = puzzle.layout.findIndex((cube, index) => cube.type !== "void" && !captured.has(index) && cube.x === marker.x && cube.z + step.rotation === marker.z && marker.z === targetZ);
      if (hitIndex < 0) return false;
      captured.add(hitIndex); marker = null;
    }
  }
  return captured.size === puzzle.layout.filter((cube) => cube.type !== "void").length;
}
console.log(puzzles.filter((puzzle) => !passes(puzzle)).map((puzzle) => ({ id: puzzle.id, depth: puzzle.depth, layout: puzzle.layout, solution: puzzle.solution }))); 

