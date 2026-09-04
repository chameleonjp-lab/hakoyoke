/** CUBIC ORDEAL: authored, renderer-free tutorial gates. */
import type { CubeType, PuzzleDescriptor } from "./types";

export const TUTORIAL_STAGE_COUNT = 8;

export type TutorialAction = "mark" | "clear" | "area";

export const TUTORIAL_HINTS = [
  "移動入力を確認する。下の移動キーで、まず横へ一歩進め。",
  "青いMARKを設置する。足元の床セルに印を置け。",
  "通常キューブがMARKへ到着したら、もう一度押してCAPTUREする。",
  "緑のVEILを捕獲すると、AREAアンカーが1つ残る。",
  "紫のVOIDが来る床へMARKを置く。印の上では押し潰されない。",
  "VEILで作ったAREAを、次の通常キューブへ発射する。",
  "何も捕獲せず、VOIDが足場の端から落ちるのを待つ。",
  "取り逃しなしで通常キューブを捕獲し、PERFECTを出す。",
] as const;

type TutorialCube = PuzzleDescriptor["layout"][number];

interface TutorialDefinition {
  id: string;
  layout: TutorialCube[];
  designIntent: string;
}

const tutorialDefinitions: TutorialDefinition[] = [
  {
    id: "TUTORIAL-GATE-01-MOVE",
    layout: [],
    designIntent:
      "Movement is the only input needed to leave the observation bay.",
  },
  {
    id: "TUTORIAL-GATE-02-MARK",
    layout: [],
    designIntent: "A quiet floor makes the first MARK action unambiguous.",
  },
  {
    id: "TUTORIAL-GATE-03-CAPTURE",
    layout: [{ x: 2, z: 5, type: "normal" }],
    designIntent:
      "A single NORMAL teaches the two-step MARK then CAPTURE rhythm.",
  },
  {
    id: "TUTORIAL-GATE-04-VEIL",
    layout: [{ x: 2, z: 5, type: "veil" }],
    designIntent: "A single VEIL makes the AREA anchor reward visible.",
  },
  {
    id: "TUTORIAL-GATE-05-PROTECT",
    layout: [{ x: 2, z: 5, type: "void" }],
    designIntent: "MARK protects one VOID lane through its rolling sweep.",
  },
  {
    id: "TUTORIAL-GATE-06-AREA",
    layout: [
      { x: 2, z: 5, type: "veil" },
      { x: 1, z: 6, type: "normal" },
    ],
    designIntent:
      "A VEIL anchor and adjacent NORMAL teach a deliberate AREA use.",
  },
  {
    id: "TUTORIAL-GATE-07-LOSS",
    layout: [{ x: 0, z: 5, type: "normal" }],
    designIntent:
      "A harmless miss demonstrates the LOSS meter without ending the run.",
  },
  {
    id: "TUTORIAL-GATE-08-PERFECT",
    layout: [{ x: 2, z: 5, type: "normal" }],
    designIntent:
      "A clean single capture closes the training loop with PERFECT.",
  },
];

const tutorialActions: readonly TutorialAction[][] = [
  [],
  ["mark"],
  ["mark", "clear"],
  ["mark", "clear"],
  ["mark", "clear"],
  ["mark", "clear", "area"],
  [],
  ["mark", "clear"],
];

export function tutorialActionEnabled(
  step: number,
  action: TutorialAction
): boolean {
  return tutorialActions[step]?.includes(action) ?? false;
}

export function tutorialHint(step: number): string {
  return TUTORIAL_HINTS[Math.min(Math.max(step, 0), TUTORIAL_HINTS.length - 1)];
}

export function getTutorialPuzzle(index: number): PuzzleDescriptor | undefined {
  const definition = tutorialDefinitions[index];
  if (!definition) return undefined;
  const layout = definition.layout.map(cube => ({ ...cube }));
  const count = (type: CubeType) =>
    layout.filter(cube => cube.type === type).length;
  return {
    id: definition.id,
    stage: 1,
    wave: 1,
    ordinal: index + 1,
    width: 4,
    depth: 2,
    spawnRow: 5,
    requiredRolls: 0,
    difficultyTag: "training-gate",
    seed: index,
    layout,
    solution: [],
    validation: {
      valid: true,
      normal: count("normal"),
      veil: count("veil"),
      void: count("void"),
      travelBudget: layout.length ? 12 : 0,
    },
    featured: true,
    designIntent: definition.designIntent,
  };
}
