import { describe, expect, it } from "vitest";
import { generatePuzzles } from "./puzzles";
import {
  findPracticePuzzle,
  parsePracticeCatalog,
  practiceFocus,
} from "./practiceCatalog";

describe("practice archive preview", () => {
  it("keeps the preview catalog aligned with all generated puzzles", () => {
    const catalog = parsePracticeCatalog(generatePuzzles());

    expect(catalog).toHaveLength(88);
    expect(findPracticePuzzle(catalog, 1, 1, 1)).toMatchObject({
      id: "STAGE-1-W1-P01",
      width: 4,
      depth: 2,
      normal: 4,
      veil: 0,
      void: 4,
    });
    expect(findPracticePuzzle(catalog, 9, 4, 1)).toMatchObject({
      id: "FINAL-W4-P01",
      width: 7,
      depth: 9,
    });
  });

  it("drops malformed entries instead of exposing misleading metadata", () => {
    const catalog = parsePracticeCatalog([
      generatePuzzles()[0],
      { id: "broken" },
    ]);

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.id).toBe("STAGE-1-W1-P01");
  });

  it("summarizes the learning focus using the authored difficulty tag", () => {
    expect(practiceFocus("intro-read")).toContain("VOID");
    expect(practiceFocus("area-intro-range")).toContain("AREA");
    expect(practiceFocus("long-chain-delay")).toContain("長い奥行");
  });
});
