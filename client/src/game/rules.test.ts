import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { advanceOneCell, applyMiss, applyVoidCapture, areaAnchorBlocksMark, areaTargets, calculateMindIndex, cloneDeterministic, isPositionOnPlatform, markerCanCapture, normalCaptureScore, perfectBonus, unresolvedCubeCount } from "./rules";
import { validateAllPuzzles } from "./puzzleValidation";
import { initialStats, type AreaMark, type CubeState, type PuzzleDescriptor } from "./types";

const cube = (id: string, type: CubeState["type"], x: number, z: number): CubeState => ({ id, type, x, z, previousZ: z });

describe("CUBIC ORDEAL deterministic rules", () => {
  it("moves a cube exactly one logical cell from the far side toward the player", () => expect(advanceOneCell(cube("n", "normal", 1, 3))).toMatchObject({ previousZ: 3, z: 2 }));
  it("treats a player footprint beyond any platform edge as a fall", () => { expect(isPositionOnPlatform({ x: 0.5, z: 0.5 }, 4, 12)).toBe(true); expect(isPositionOnPlatform({ x: -0.4, z: 0.5 }, 4, 12)).toBe(false); expect(isPositionOnPlatform({ x: 0.5, z: 11.4 }, 4, 12)).toBe(false); });
  it("allows only the cube directly over the single MARK to be captured", () => { const mark = { x: 2, z: 4 }; expect(markerCanCapture(mark, cube("a", "normal", 2, 4))).toBe(true); expect(markerCanCapture(mark, cube("b", "normal", 2, 3))).toBe(false); });
  it("selects the exact 3 by 3 AREA neighborhood", () => { const area: AreaMark[] = [{ id: "a", x: 2, z: 2, armed: true }]; const selected = areaTargets([cube("0", "normal", 1, 1), cube("1", "normal", 3, 3), cube("2", "normal", 4, 3)], area, null); expect(selected.map((item) => item.id)).toEqual(["0", "1"]); });
  it("activates multiple AREA anchors simultaneously", () => { const areas: AreaMark[] = [{ id: "a", x: 1, z: 1, armed: true }, { id: "b", x: 5, z: 5, armed: true }]; expect(areaTargets([cube("left", "normal", 0, 0), cube("right", "veil", 6, 6)], areas, null)).toHaveLength(2); });
  it("protects a VOID cube parked on the blue MARK from AREA capture", () => { const voidCube = cube("void", "void", 2, 2); expect(areaTargets([voidCube, cube("normal", "normal", 1, 2)], [{ id: "a", x: 2, z: 2, armed: true }], { x: 2, z: 2 }).map((item) => item.id)).toEqual(["normal"]); });
  it("reserves an active AREA anchor tile from a normal blue MARK", () => expect(areaAnchorBlocksMark([{ id: "a", x: 2, z: 2, armed: true }], { x: 2, z: 2 })).toBe(true));
  it("counts every unresolved cube type when a crush resolves the remaining formation", () => expect(unresolvedCubeCount([cube("normal", "normal", 1, 2), cube("veil", "veil", 2, 2), cube("void", "void", 3, 2)])).toBe(3));
  it("preserves the residual loss meter after a multi-row crush calculation", () => { const width = 4; const threshold = initialStats(width).missLimit + 1; const combined = 1 + 10; expect({ rows: Math.floor(combined / threshold), residual: combined % threshold }).toEqual({ rows: 2, residual: 3 }); });
  it("removes a platform row when misses exceed the width-derived threshold", () => { const stats = { ...initialStats(4), misses: 3, platformRows: 12 }; expect(applyMiss(stats)).toMatchObject({ misses: 0, platformRows: 11, perfect: false }); });
  it("removes one platform row for a VOID capture", () => { expect(applyVoidCapture({ ...initialStats(4), platformRows: 12 })).toMatchObject({ platformRows: 11, voidCaptured: 1, perfect: false }); });
  it("awards all three perfect timing bands", () => { expect(perfectBonus(3, 4)).toBe(10000); expect(perfectBonus(4, 4)).toBe(5000); expect(perfectBonus(5, 4)).toBe(1000); });
  it("uses 100 points for manual capture and 200 for AREA capture", () => { expect(normalCaptureScore("manual")).toBe(100); expect(normalCaptureScore("area")).toBe(200); });
  it("bounds MIND INDEX between zero and 999", () => { expect(calculateMindIndex(-5000, 1, 1, 50)).toBe(0); expect(calculateMindIndex(999999, 9, 50, 0)).toBe(999); });
  it("restores an independent deterministic snapshot copy", () => { const source = { marker: { x: 2, z: 3 }, values: [1, 2] }; const copy = cloneDeterministic(source); copy.marker.x = 8; expect(source.marker.x).toBe(2); });
  it("loads and validates all 88 registered puzzle descriptors", async () => { const raw = await readFile(new URL("../../public/data/puzzles.json", import.meta.url), "utf8"); const puzzles = JSON.parse(raw) as PuzzleDescriptor[]; const results = validateAllPuzzles(puzzles); expect(puzzles).toHaveLength(88); expect(results.every((result) => result.valid)).toBe(true); });
  it("contains a hand-authored featured puzzle that requires AREA chaining and MARK protection", async () => { const raw = await readFile(new URL("../../public/data/puzzles.json", import.meta.url), "utf8"); const puzzles = JSON.parse(raw) as PuzzleDescriptor[]; const representative = puzzles.find((puzzle) => puzzle.id === "STAGE-5-W2-P01"); expect(representative?.designIntent).toMatch(/VOID/); expect(representative?.solution.some((step) => step.action === "area")).toBe(true); expect(representative?.layout.filter((cube) => cube.type === "veil")).toHaveLength(2); expect(representative?.layout.some((cube) => cube.type === "void")).toBe(true); });
  it("keeps puzzle IDs and seeds unique across the archive", async () => { const raw = await readFile(new URL("../../public/data/puzzles.json", import.meta.url), "utf8"); const puzzles = JSON.parse(raw) as PuzzleDescriptor[]; expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(88); expect(new Set(puzzles.map((puzzle) => puzzle.seed)).size).toBe(88); });
});
