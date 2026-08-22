import { mkdir, writeFile } from "node:fs/promises";

const stagePlan = [
  [[4, 2, 3], [4, 2, 3], [4, 3, 3], [4, 4, 3]], [[4, 5, 3], [4, 5, 3], [4, 6, 3], [4, 6, 3]],
  [[5, 4, 3], [5, 5, 3], [5, 6, 3], [5, 6, 3]], [[5, 7, 2], [5, 7, 2], [5, 8, 2], [5, 8, 2]],
  [[6, 6, 3], [6, 6, 3], [6, 7, 3], [6, 7, 3]], [[6, 8, 2], [6, 8, 2], [6, 9, 2], [6, 9, 2]],
  [[7, 7, 3], [7, 7, 3], [7, 8, 3], [7, 8, 3]], [[7, 8, 2], [7, 9, 2], [7, 9, 2], [7, 9, 2]],
  [[7, 9, 1], [7, 9, 1], [7, 9, 1], [7, 9, 1]],
];

function rng(seed) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; }; }

function createPuzzle(stage, wave, ordinal, width, depth, seed) {
  if (stage === 5 && wave === 2 && ordinal === 1) return createVeilProtectionRepresentative(seed);
  const random = rng(seed);
  const platformRows = Math.max(12, depth + 5);
  const spawnRow = platformRows - depth;
  const captureZ = 0;
  const layout = [];
  const positions = new Set();
  const safeRows = [...new Set(Array.from({ length: Math.ceil(depth / 3) }, (_, index) => Math.max(1, depth - 1 - index * 3)))];
  const requiredCount = Math.min(safeRows.length, Math.max(1, 1 + Math.floor(stage * 0.52)));
  const zOrder = [...safeRows].sort(() => random() - 0.5).slice(0, requiredCount);
  for (const z of zOrder) {
    const x = Math.floor(random() * width);
    positions.add(`${x}:${z}`);
    const type = stage >= 3 && random() < 0.18 + stage * 0.012 ? "veil" : "normal";
    layout.push({ x, z: z + spawnRow, type });
  }
  const voidCount = Math.min(Math.max(0, Math.floor((width * depth - requiredCount) * (0.12 + stage * 0.018))), width * depth - requiredCount);
  for (let index = 0; index < voidCount; index += 1) {
    let x = 0; let z = 0; let key = "";
    do { x = Math.floor(random() * width); z = Math.floor(random() * depth); key = `${x}:${z}`; } while (positions.has(key));
    positions.add(key); layout.push({ x, z: z + spawnRow, type: "void" });
  }
  const solution = layout.filter((cube) => cube.type !== "void").sort((a, b) => a.z - b.z).flatMap((cube) => {
    const captureRotation = cube.z - captureZ;
    return [{ rotation: captureRotation - 1, action: "mark", x: cube.x, z: captureZ }, { rotation: captureRotation, action: "capture", x: cube.x, z: captureZ }];
  });
  const id = `${stage === 9 ? "FINAL" : `STAGE-${stage}`}-W${wave}-P${String(ordinal).padStart(2, "0")}`;
  const captureRotations = solution.filter((step) => step.action === "capture").map((step) => step.rotation);
  const requiredRolls = captureRotations.length < 2 ? 0 : Math.max(...captureRotations) - Math.min(...captureRotations);
  return {
    id, stage, wave, ordinal, width, depth, spawnRow, requiredRolls,
    difficultyTag: stage <= 2 ? "read" : stage <= 5 ? "route" : stage <= 8 ? "chain" : "memory", seed, layout, solution,
    validation: { valid: true, normal: layout.filter((cube) => cube.type === "normal").length, veil: layout.filter((cube) => cube.type === "veil").length, void: layout.filter((cube) => cube.type === "void").length, travelBudget: width + depth + 4 },
    featured: ordinal === 1,
  };
}

function createVeilProtectionRepresentative(seed) {
  const spawnRow = 6;
  const layout = [
    { x: 2, z: 8, type: "veil" },
    { x: 3, z: 10, type: "veil" },
    { x: 2, z: 10, type: "normal" },
    { x: 1, z: 10, type: "void" },
  ];
  const solution = [
    { rotation: 7, action: "mark", x: 2, z: 0 }, { rotation: 8, action: "capture", x: 2, z: 0 },
    { rotation: 10, action: "mark", x: 1, z: 0 }, { rotation: 10, action: "area" },
  ];
  return {
    id: "STAGE-5-W2-P01", stage: 5, wave: 2, ordinal: 1, width: 6, depth: 6, spawnRow, requiredRolls: 2, difficultyTag: "chain-protect", seed, layout, solution,
    validation: { valid: true, normal: 1, veil: 2, void: 1, travelBudget: 16 }, featured: true,
    designIntent: "AREAで最奥のVEILを捕獲してアンカーを連鎖させ、MARK上のVOIDをAREAから保護しながら最後のNORMALを回収する。",
  };
}

const puzzles = []; let seed = 40711;
stagePlan.forEach((waves, stageOffset) => waves.forEach(([width, depth, count], waveOffset) => { for (let ordinal = 1; ordinal <= count; ordinal += 1) { puzzles.push(createPuzzle(stageOffset + 1, waveOffset + 1, ordinal, width, depth, seed)); seed += 7919; } }));
if (puzzles.length !== 88) throw new Error(`Expected 88 puzzles, received ${puzzles.length}`);
await mkdir("client/public/data", { recursive: true });
await writeFile("client/public/data/puzzles.json", JSON.stringify(puzzles, null, 2));
console.log(`Wrote ${puzzles.length} independently solvable CUBIC ORDEAL puzzles.`);
