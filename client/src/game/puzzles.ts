/** Deterministic 88-puzzle archive with authored learning beats and generated continuation. */
import {
  parsePuzzleDescriptor,
  validatePuzzleArchive,
} from "./puzzleValidation";
import { deriveDirectSolution } from "./solutionSimulation";
import { STAGE_PLAN } from "./stagePlan";
import type { CubeType, PuzzleDescriptor, SolutionStep } from "./types";

export async function loadPuzzles(): Promise<PuzzleDescriptor[]> {
  const puzzleArchiveUrl = `${import.meta.env.BASE_URL}data/puzzles.json`;
  const response = await fetch(puzzleArchiveUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error("Puzzle archive could not be loaded.");
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Puzzle archive has an invalid format.");
  }

  const parsed = payload.map(parsePuzzleDescriptor);
  const invalidIndex = parsed.findIndex(
    result => !result.valid || !result.puzzle
  );
  if (invalidIndex >= 0) {
    throw new Error(
      `Puzzle archive entry ${invalidIndex + 1} invalid: ${parsed[invalidIndex]?.reason}`
    );
  }

  const puzzles = parsed.map(result => result.puzzle as PuzzleDescriptor);
  const validation = validatePuzzleArchive(puzzles);
  if (!validation.valid) {
    throw new Error(
      `Puzzle archive failed validation: ${validation.issues[0] ?? "unknown error"}`
    );
  }
  return puzzles;
}

export function generatePuzzles(): PuzzleDescriptor[] {
  const puzzles: PuzzleDescriptor[] = [];
  const stages = Object.keys(STAGE_PLAN)
    .map(Number)
    .sort((a, b) => a - b);
  for (const stage of stages) {
    const waves = STAGE_PLAN[stage] ?? [];
    waves.forEach((plan, waveIndex) => {
      const wave = waveIndex + 1;
      for (let ordinal = 1; ordinal <= plan.puzzles; ordinal += 1) {
        puzzles.push(
          buildHandAuthoredPuzzle(
            stage,
            wave,
            ordinal,
            plan.width,
            plan.depth
          ) ?? buildPuzzle(stage, wave, ordinal, plan.width, plan.depth)
        );
      }
    });
  }
  return puzzles;
}

export function findPuzzle(
  puzzles: PuzzleDescriptor[],
  stage: number,
  wave: number,
  ordinal: number
): PuzzleDescriptor | undefined {
  return puzzles.find(
    puzzle =>
      puzzle.stage === stage &&
      puzzle.wave === wave &&
      puzzle.ordinal === ordinal
  );
}

export function puzzleOrdinals(
  puzzles: PuzzleDescriptor[],
  stage: number,
  wave: number
): number[] {
  return puzzles
    .filter(puzzle => puzzle.stage === stage && puzzle.wave === wave)
    .map(puzzle => puzzle.ordinal)
    .sort((a, b) => a - b);
}

type AuthoredAction = Omit<SolutionStep, "sequence">;

interface HandAuthoredDesign {
  rows: readonly (readonly CubeType[])[];
  difficultyTag: string;
  designIntent: string;
  solution?: SolutionStep[];
}

/**
 * Early campaign puzzles are authored encounters rather than seeded variations.
 * Stage 1 teaches one decision at a time and then tests changing routes; Stage 2
 * continues that route reading without making AREA the only correct answer.
 * Later waves use the deterministic generator for scalable chain/protection
 * pressure.
 */
const HAND_AUTHORED_DESIGNS: Readonly<Record<string, HandAuthoredDesign>> = {
  "1-1-1": {
    rows: [
      ["void", "normal", "normal", "void"],
      ["void", "normal", "normal", "void"],
    ],
    difficultyTag: "intro-read",
    designIntent:
      "Hand-authored centered pair: read the safe lanes and let the outer VOID pass.",
  },
  "1-1-2": {
    rows: [
      ["normal", "normal", "void", "void"],
      ["void", "void", "normal", "normal"],
    ],
    difficultyTag: "intro-shift",
    designIntent:
      "Hand-authored diagonal shift: move from the near left pair to the incoming right pair without touching VOID.",
  },
  "1-1-3": {
    rows: [
      ["normal", "void", "normal", "void"],
      ["void", "normal", "void", "normal"],
    ],
    difficultyTag: "intro-avoid",
    designIntent:
      "Hand-authored alternating lanes: switch sides between rows while keeping MARK away from VOID.",
  },
  "1-2-1": {
    rows: [
      ["normal", "veil", "normal", "normal"],
      ["normal", "normal", "normal", "normal"],
    ],
    difficultyTag: "area-intro-range",
    solution: authoredSolution([
      { rotation: 4, action: "mark", x: 1, z: 0, timing: "settled" },
      { rotation: 5, action: "capture", x: 1, z: 0, timing: "settled" },
      { rotation: 5, action: "mark", x: 3, z: 0, timing: "settled" },
      { rotation: 5, action: "capture", x: 3, z: 0, timing: "settled" },
      { rotation: 5, action: "area", timing: "settled" },
      { rotation: 6, action: "mark", x: 3, z: 0, timing: "settled" },
      { rotation: 6, action: "capture", x: 3, z: 0, timing: "settled" },
    ]),
    designIntent:
      "Hand-authored AREA introduction: use the VEIL anchor, then manually catch the lane outside its 3×3 range.",
  },
  "1-2-2": {
    rows: [
      ["normal", "normal", "veil", "normal"],
      ["normal", "normal", "normal", "normal"],
    ],
    difficultyTag: "area-intro-timing",
    solution: authoredSolution([
      { rotation: 4, action: "mark", x: 2, z: 0, timing: "settled" },
      { rotation: 5, action: "capture", x: 2, z: 0, timing: "settled" },
      { rotation: 5, action: "mark", x: 0, z: 0, timing: "settled" },
      { rotation: 5, action: "capture", x: 0, z: 0, timing: "settled" },
      { rotation: 5, action: "area", timing: "settled" },
      { rotation: 6, action: "mark", x: 0, z: 0, timing: "settled" },
      { rotation: 6, action: "capture", x: 0, z: 0, timing: "settled" },
    ]),
    designIntent:
      "Hand-authored AREA timing lesson: take the center VEIL, manually catch the opposite edge, then discharge the range.",
  },
  "1-2-3": {
    rows: [
      ["normal", "normal", "normal", "veil"],
      ["normal", "normal", "normal", "normal"],
    ],
    difficultyTag: "area-intro-edge",
    solution: authoredSolution([
      { rotation: 4, action: "mark", x: 0, z: 0, timing: "settled" },
      { rotation: 5, action: "capture", x: 0, z: 0, timing: "settled" },
      { rotation: 5, action: "mark", x: 1, z: 0, timing: "settled" },
      { rotation: 5, action: "capture", x: 1, z: 0, timing: "settled" },
      { rotation: 5, action: "mark", x: 3, z: 0, timing: "settled" },
      { rotation: 5, action: "capture", x: 3, z: 0, timing: "settled" },
      { rotation: 5, action: "area", timing: "settled" },
      { rotation: 6, action: "mark", x: 0, z: 0, timing: "settled" },
      { rotation: 6, action: "capture", x: 0, z: 0, timing: "settled" },
      { rotation: 6, action: "mark", x: 1, z: 0, timing: "settled" },
      { rotation: 6, action: "capture", x: 1, z: 0, timing: "settled" },
    ]),
    designIntent:
      "Hand-authored edge AREA lesson: manually clear the side outside the anchor, then let the edge VEIL sweep the paired lanes.",
  },
  "1-3-1": {
    rows: [
      ["normal", "veil", "void", "normal"],
      ["void", "normal", "normal", "void"],
      ["normal", "void", "veil", "normal"],
    ],
    difficultyTag: "read-branch",
    designIntent:
      "Hand-authored branch route: the safe path opens on both sides, then reconnects through a second VEIL row.",
  },
  "1-3-2": {
    rows: [
      ["void", "normal", "normal", "void"],
      ["normal", "void", "veil", "normal"],
      ["void", "normal", "void", "normal"],
    ],
    difficultyTag: "read-cross",
    designIntent:
      "Hand-authored crossing route: each incoming row changes the safe side, so a held center position is no longer reliable.",
  },
  "1-3-3": {
    rows: [
      ["normal", "void", "veil", "void"],
      ["void", "normal", "normal", "void"],
      ["normal", "void", "void", "normal"],
    ],
    difficultyTag: "read-corner",
    designIntent:
      "Hand-authored corner route: the first VEIL invites a wide sweep, while the last row forces a deliberate edge choice.",
  },
  "1-4-1": {
    rows: [
      ["normal", "void", "normal", "void"],
      ["void", "normal", "veil", "normal"],
      ["normal", "void", "void", "normal"],
      ["void", "normal", "normal", "void"],
    ],
    difficultyTag: "read-braid",
    designIntent:
      "Hand-authored braided route: alternating safe bands turn movement rhythm into the main decision after AREA is introduced.",
  },
  "1-4-2": {
    rows: [
      ["void", "normal", "normal", "void"],
      ["normal", "void", "veil", "normal"],
      ["normal", "normal", "void", "void"],
      ["void", "void", "normal", "normal"],
    ],
    difficultyTag: "read-return",
    designIntent:
      "Hand-authored return route: the safe pair leaves center, crosses the VEIL line, and returns through the opposite half.",
  },
  "1-4-3": {
    rows: [
      ["normal", "normal", "void", "void"],
      ["void", "normal", "void", "normal"],
      ["void", "void", "veil", "normal"],
      ["normal", "void", "normal", "void"],
    ],
    difficultyTag: "read-ring",
    designIntent:
      "Hand-authored ring route: safe cells orbit the center and expose a VOID pocket that must be left untouched.",
  },
  "2-3-1": {
    rows: [
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "normal"],
    ],
    difficultyTag: "area-ribbon",
    solution: areaChainSolution(1, 3, [
      "void",
      "normal",
      "void",
      "normal",
      "void",
      "normal",
    ]),
    designIntent:
      "Hand-authored AREA ribbon: a stable inner chain clears the center while an alternating outer lane still needs manual timing.",
  },
  "2-3-2": {
    rows: [
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "void"],
    ],
    difficultyTag: "area-edge",
    solution: areaChainSolution(1, 3, [
      "normal",
      "void",
      "normal",
      "void",
      "normal",
      "void",
    ]),
    designIntent:
      "Hand-authored edge pressure: the outer lane alternates with every row, making the AREA discharge rhythm and side travel compete for attention.",
  },
  "2-3-3": {
    rows: [
      ["void", "normal", "veil", "normal"],
      ["normal", "normal", "veil", "normal"],
      ["void", "normal", "veil", "normal"],
      ["normal", "normal", "veil", "normal"],
      ["void", "normal", "veil", "normal"],
      ["normal", "normal", "veil", "normal"],
    ],
    difficultyTag: "area-reverse",
    solution: areaChainSolution(2, 0, [
      "void",
      "normal",
      "void",
      "normal",
      "void",
      "normal",
    ]),
    designIntent:
      "Hand-authored reverse AREA ribbon: the chain starts on the opposite inner side and moves the manual lane to the left edge.",
  },
  "2-4-1": {
    rows: [
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "void"],
    ],
    difficultyTag: "chain-pulse",
    solution: areaChainSolution(1, 3, [
      "normal",
      "normal",
      "void",
      "void",
      "normal",
      "void",
    ]),
    designIntent:
      "Hand-authored pulse chain: two adjacent outer captures create a short burst before the route opens again.",
  },
  "2-4-2": {
    rows: [
      ["normal", "normal", "veil", "normal"],
      ["void", "normal", "veil", "normal"],
      ["void", "normal", "veil", "normal"],
      ["normal", "normal", "veil", "normal"],
      ["normal", "normal", "veil", "normal"],
      ["void", "normal", "veil", "normal"],
    ],
    difficultyTag: "chain-switch",
    solution: areaChainSolution(2, 0, [
      "normal",
      "void",
      "void",
      "normal",
      "normal",
      "void",
    ]),
    designIntent:
      "Hand-authored switching chain: the AREA anchor begins on the right and leaves a left-edge timing lane to read between discharges.",
  },
  "2-4-3": {
    rows: [
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "normal"],
      ["normal", "veil", "normal", "void"],
      ["normal", "veil", "normal", "normal"],
    ],
    difficultyTag: "chain-ladder",
    solution: areaChainSolution(1, 3, [
      "void",
      "void",
      "normal",
      "normal",
      "void",
      "normal",
    ]),
    designIntent:
      "Hand-authored ladder chain: the manual lane stays closed for two rows, opens for two, then closes before the final handoff.",
  },
  "2-1-1": {
    rows: [
      ["normal", "normal", "void", "void"],
      ["void", "normal", "normal", "void"],
      ["void", "void", "normal", "veil"],
      ["void", "normal", "normal", "void"],
      ["normal", "normal", "void", "void"],
    ],
    difficultyTag: "route-stagger",
    designIntent:
      "Hand-authored route read: the safe pair drifts across the floor and returns, so the player must follow the lane rather than hold center.",
  },
  "2-1-2": {
    rows: [
      ["normal", "void", "void", "normal"],
      ["normal", "normal", "void", "void"],
      ["void", "normal", "veil", "void"],
      ["void", "void", "normal", "normal"],
      ["normal", "void", "void", "normal"],
    ],
    difficultyTag: "route-split",
    designIntent:
      "Hand-authored split route: the safe lanes form two opposing banks, rewarding deliberate side-to-side travel instead of repeated center captures.",
  },
  "2-1-3": {
    rows: [
      ["void", "normal", "normal", "void"],
      ["void", "void", "veil", "normal"],
      ["normal", "void", "void", "void"],
      ["void", "normal", "normal", "void"],
      ["void", "void", "void", "normal"],
    ],
    difficultyTag: "route-thread",
    designIntent:
      "Hand-authored single thread: one safe cube at a time crosses the player path, with a quiet VOID tail that tests patience and alignment.",
  },
  "2-2-1": {
    rows: [
      ["normal", "void", "normal", "void"],
      ["void", "normal", "void", "normal"],
      ["normal", "void", "veil", "void"],
      ["void", "normal", "void", "normal"],
      ["normal", "void", "normal", "void"],
    ],
    difficultyTag: "route-weave",
    designIntent:
      "Hand-authored weave: the usable cells alternate on every row, turning movement rhythm into the puzzle instead of AREA timing.",
  },
  "2-2-2": {
    rows: [
      ["void", "normal", "normal", "void"],
      ["normal", "void", "void", "normal"],
      ["void", "normal", "veil", "void"],
      ["normal", "normal", "void", "void"],
      ["void", "void", "normal", "normal"],
    ],
    difficultyTag: "route-gate",
    designIntent:
      "Hand-authored gate sequence: each row opens a different side of the floor, making the next safe landing legible only after the current row is read.",
  },
  "2-2-3": {
    rows: [
      ["normal", "void", "void", "normal"],
      ["void", "normal", "veil", "void"],
      ["void", "void", "normal", "void"],
      ["void", "normal", "normal", "void"],
      ["normal", "void", "void", "normal"],
    ],
    difficultyTag: "route-return",
    designIntent:
      "Hand-authored return route: a narrow center detour reconnects two edge pairs, asking for a planned out-and-back path.",
  },
};

function authoredSolution(actions: readonly AuthoredAction[]): SolutionStep[] {
  return actions.map((action, sequence) => ({ ...action, sequence }));
}

function areaChainSolution(
  anchorX: number,
  edgeX: number,
  edgeRows: readonly CubeType[]
): SolutionStep[] {
  const actions: AuthoredAction[] = [
    { rotation: 4, action: "mark", x: anchorX, z: 0, timing: "settled" },
    { rotation: 5, action: "capture", x: anchorX, z: 0, timing: "settled" },
  ];
  edgeRows.forEach((type, offset) => {
    if (type !== "normal") return;
    const rotation = 5 + offset;
    actions.push(
      { rotation, action: "mark", x: edgeX, z: 0, timing: "settled" },
      { rotation, action: "capture", x: edgeX, z: 0, timing: "settled" }
    );
    if (offset < 3)
      actions.push({ rotation, action: "area", timing: "settled" });
  });
  for (const rotation of [5, 6, 7]) {
    if (
      !actions.some(
        action => action.rotation === rotation && action.action === "area"
      )
    )
      actions.push({ rotation, action: "area", timing: "settled" });
  }
  return authoredSolution(actions);
}

function buildHandAuthoredPuzzle(
  stage: number,
  wave: number,
  ordinal: number,
  width: number,
  depth: number
): PuzzleDescriptor | undefined {
  const design = HAND_AUTHORED_DESIGNS[`${stage}-${wave}-${ordinal}`];
  if (!design) return undefined;
  if (
    design.rows.length !== depth ||
    design.rows.some(row => row.length !== width)
  ) {
    throw new Error(
      `Hand-authored puzzle ${stage}-${wave}-${ordinal} does not match ${width}x${depth}.`
    );
  }

  const spawnRow = 5;
  const id = puzzleId(stage, wave, ordinal);
  const seed = puzzleSeed(stage, wave, ordinal);
  const layout = design.rows.flatMap((row, offset) =>
    row.map((type, x) => ({ x, z: spawnRow + offset, type }))
  );
  const solution = design.solution
    ? design.solution.map(step => ({ ...step }))
    : deriveDirectSolution({ id, width, depth, layout });
  const actionRotations = solution
    .filter(step => step.action === "capture" || step.action === "area")
    .map(step => step.rotation);
  const requiredRolls =
    actionRotations.length < 2
      ? 0
      : Math.max(...actionRotations) - Math.min(...actionRotations);
  const normal = layout.filter(cube => cube.type === "normal").length;
  const veil = layout.filter(cube => cube.type === "veil").length;
  const voids = layout.filter(cube => cube.type === "void").length;

  return {
    id,
    stage,
    wave,
    ordinal,
    width,
    depth,
    spawnRow,
    requiredRolls,
    difficultyTag: design.difficultyTag,
    seed,
    layout,
    solution,
    validation: {
      valid: true,
      normal,
      veil,
      void: voids,
      travelBudget: width + depth + normal + veil + 4,
    },
    featured: ordinal === 1,
    designIntent: design.designIntent,
  };
}

function puzzleId(stage: number, wave: number, ordinal: number): string {
  const prefix = stage === 9 ? "FINAL" : `STAGE-${stage}`;
  return `${prefix}-W${wave}-P${String(ordinal).padStart(2, "0")}`;
}

function puzzleSeed(stage: number, wave: number, ordinal: number): number {
  return stage * 100_000 + wave * 1_000 + ordinal * 17;
}

function buildPuzzle(
  stage: number,
  wave: number,
  ordinal: number,
  width: number,
  depth: number
): PuzzleDescriptor {
  const seed = puzzleSeed(stage, wave, ordinal);
  const spawnRow = 5 + ((stage + wave + ordinal) % 2);
  const pairCount = Math.ceil(depth / 2);
  const pattern = (stage * 11 + wave * 5 + ordinal * 3) % 12;
  const center =
    1 +
    ((seed + wave * 37 + ordinal * 17 + pattern * 13) % Math.max(1, width - 2));
  const protectVoid =
    stage >= 2
      ? ordinal === 1 || pattern % 3 === 0
      : ordinal === 3 || pattern === 0;
  const routeCandidates = [0, width - 1].filter(x => Math.abs(x - center) > 1);
  const routeLane =
    routeCandidates[(pattern + ordinal) % Math.max(1, routeCandidates.length)];
  const routeNeeded =
    ordinal > 1 || stage >= 2 || (stage === 1 && pattern % 2 === 0);
  const routeCount =
    routeNeeded && depth > 2
      ? Math.min(stage >= 5 ? 2 : 1, routeCandidates.length)
      : 0;
  const innerProtectionX = center + (center < width / 2 ? 1 : -1);
  const protectionX = protectVoid
    ? routeCount > 0
      ? (routeLane ?? innerProtectionX)
      : innerProtectionX
    : center + (ordinal % 3 === 0 ? -1 : 1);
  const layout: Array<{ x: number; z: number; type: CubeType }> = [];

  for (let offset = 0; offset < depth; offset += 1) {
    for (let x = 0; x < width; x += 1) {
      let type: CubeType = Math.abs(x - center) <= 1 ? "normal" : "void";
      if (offset === 0 && x === center) type = "veil";
      if (offset % 2 === 1 && offset + 1 < depth && x === center) type = "veil";
      if (protectVoid && offset === 0 && x === protectionX) type = "void";
      layout.push({ x, z: spawnRow + offset, type });
    }
  }
  if (depth === 2 && pattern % 2 === 0) {
    const extraVeilColumns = [center, center - 1, center + 1].filter(
      x => x >= 0 && x < width
    );
    const extraVeilX =
      extraVeilColumns[(pattern + wave + ordinal) % extraVeilColumns.length];
    const extraVeil = layout.find(
      cube => cube.x === extraVeilX && cube.z === spawnRow + 1
    );
    if (extraVeil?.type === "normal") extraVeil.type = "veil";
  }

  const routeTargets: Array<{ x: number; offset: number }> = [];
  for (let index = 0; index < routeCount; index += 1) {
    const x = routeLane ?? center;
    const minimumOffset = Math.max(1, pairCount - 1);
    const maximumOffset =
      routeCount === 2 && index === 0 ? depth - 2 : depth - 1;
    const offsetSpan = Math.max(1, maximumOffset - minimumOffset + 1);
    let offset =
      routeCount === 2 && index === 1
        ? depth - 1
        : minimumOffset +
          ((pattern + ordinal + wave * 5 + index * 3) % offsetSpan);
    while (routeTargets.some(target => target.offset === offset)) {
      offset = offset === depth - 1 ? 1 : offset + 1;
    }
    routeTargets.push({ x, offset });
  }
  for (const target of routeTargets) {
    const cube = layout.find(
      item => item.x === target.x && item.z === spawnRow + target.offset
    );
    if (cube) cube.type = "normal";
  }
  if (depth > 2) {
    const routePositions = new Set(
      routeTargets.map(target => `${target.x}:${spawnRow + target.offset}`)
    );
    const voidColumns = new Set(
      layout.filter(cube => cube.type === "void").map(cube => cube.x)
    );
    const extraVeilCandidates = layout.filter(
      cube =>
        cube.type === "normal" &&
        cube.z > spawnRow &&
        Math.abs(cube.x - center) <= 1 &&
        (routeLane === undefined || Math.abs(cube.x - routeLane) > 1) &&
        Array.from(voidColumns).every(voidX => Math.abs(cube.x - voidX) > 1) &&
        !routePositions.has(`${cube.x}:${cube.z}`)
    );
    const extraVeil = extraVeilCandidates.length
      ? extraVeilCandidates[
          (pattern * 7 + stage * 11 + wave * 13 + ordinal * 20) %
            extraVeilCandidates.length
        ]
      : undefined;
    if (extraVeil) extraVeil.type = "veil";
  }

  let sequence = 0;
  const solution: SolutionStep[] = [
    {
      rotation: Math.max(0, spawnRow - 1),
      action: "mark",
      x: center,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    },
    {
      rotation: spawnRow,
      action: "capture",
      x: center,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    },
  ];
  if (protectVoid)
    solution.push({
      rotation: spawnRow,
      action: "mark",
      x: protectionX,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    });
  if (routeTargets.length > 0 && !protectVoid) {
    const target = routeTargets[0]!;
    solution.push({
      rotation: spawnRow,
      action: "mark",
      x: target.x,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    });
  }
  for (let pair = 0; pair < pairCount; pair += 1) {
    solution.push({
      rotation: spawnRow + pair,
      action: "area",
      timing: "settled",
      sequence: sequence++,
    });
  }
  for (let index = 0; index < routeTargets.length; index += 1) {
    const target = routeTargets[index]!;
    solution.push({
      rotation: spawnRow + target.offset,
      action: "capture",
      x: target.x,
      z: 0,
      timing: "settled",
      sequence: sequence++,
    });
    const nextTarget = routeTargets[index + 1];
    if (nextTarget) {
      solution.push({
        rotation: spawnRow + target.offset,
        action: "mark",
        x: nextTarget.x,
        z: 0,
        timing: "settled",
        sequence: sequence++,
      });
    }
  }

  const finalRequiredRotation = Math.max(
    spawnRow + pairCount - 1,
    ...routeTargets.map(target => spawnRow + target.offset)
  );
  const normal = layout.filter(cube => cube.type === "normal").length;
  const veil = layout.filter(cube => cube.type === "veil").length;
  const voids = layout.length - normal - veil;
  const difficultyTag =
    stage >= 6
      ? "chain-protect"
      : stage >= 4
        ? "chain"
        : stage >= 2
          ? "route"
          : "read";
  return {
    id: puzzleId(stage, wave, ordinal),
    stage,
    wave,
    ordinal,
    width,
    depth,
    spawnRow,
    requiredRolls: Math.max(0, finalRequiredRotation - spawnRow),
    difficultyTag,
    seed,
    layout,
    solution,
    validation: {
      valid: true,
      normal,
      veil,
      void: voids,
      travelBudget: width + depth + pairCount + routeTargets.length * 2 + 4,
    },
    featured: ordinal === 1,
    designIntent: protectVoid
      ? "Complete formation with a one-shot AREA chain, MARK-protected VOID, and isolated route captures."
      : "Complete formation with a one-shot AREA chain and isolated route captures.",
  };
}
