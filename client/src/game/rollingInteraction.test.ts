import { describe, expect, it } from "vitest";
import {
  areaTargets,
  cubeOccupiesCell,
  isProtectedByMarker,
  markerCanCapture,
  markerTarget,
} from "./rules";
import type { AreaMark, CubeState } from "./types";

const cube = (
  id: string,
  type: CubeState["type"],
  x: number,
  z: number
): CubeState => ({ id, type, x, z, previousZ: z });

describe("rolling MARK and AREA interactions", () => {
  it("keeps static MARK capture on the exact occupied cell", () => {
    const target = cube("normal", "normal", 2, 4);
    expect(markerCanCapture({ x: 2, z: 4 }, target)).toBe(true);
    expect(markerCanCapture({ x: 2, z: 3 }, target)).toBe(false);
  });

  it("allows MARK capture while a rolling cube visibly overlaps the destination cell", () => {
    const target = cube("normal", "normal", 2, 4);
    const occupiesDestination = cubeOccupiesCell(
      target,
      { x: 2, z: 3 },
      0.65,
      true
    );
    const canCapture = markerCanCapture({ x: 2, z: 3 }, target, 0.65, true);
    expect(occupiesDestination).toBe(true);
    expect(canCapture).toBe(true);
  });

  it("chooses the incoming cube consistently when rolling cubes overlap", () => {
    const marker = { x: 2, z: 3 };
    const leading = cube("leading", "normal", 2, 3);
    const incoming = cube("incoming", "normal", 2, 4);

    expect(markerTarget([leading, incoming], marker, 0.65, true)?.id).toBe(
      "incoming"
    );
    expect(markerTarget([incoming, leading], marker, 0.65, true)?.id).toBe(
      "incoming"
    );
  });

  it("protects every cube type on MARK from AREA, not only VOID", () => {
    const marker = { x: 2, z: 2 };
    for (const type of ["normal", "veil", "void"] as const) {
      const protectedByMarker = isProtectedByMarker(
        marker,
        cube(type, type, 2, 2)
      );
      expect(protectedByMarker).toBe(true);
    }

    const selected = areaTargets(
      [
        cube("protected-normal", "normal", 2, 2),
        cube("protected-veil", "veil", 2, 2),
        cube("protected-void", "void", 2, 2),
        cube("other", "normal", 1, 2),
      ],
      [{ id: "area", x: 2, z: 2, armed: true }],
      marker
    );
    expect(selected.map(item => item.id)).toEqual(["other"]);
  });

  it("uses rolling occupancy for AREA instead of the cube's old integer z", () => {
    const areas: AreaMark[] = [{ id: "area", x: 2, z: 2, armed: true }];
    const rolling = cube("rolling", "normal", 2, 4);
    const staticTargets = areaTargets([rolling], areas, null);
    const rollingTargets = areaTargets([rolling], areas, null, 0.65, true);

    expect(staticTargets.map(item => item.id)).toEqual([]);
    expect(rollingTargets.map(item => item.id)).toEqual(["rolling"]);
  });

  it("lets a rolling MARK protect a cube from a rolling AREA capture", () => {
    const rolling = cube("rolling", "normal", 2, 4);
    const selected = areaTargets(
      [rolling],
      [{ id: "area", x: 2, z: 2, armed: true }],
      { x: 2, z: 3 },
      0.65,
      true
    );
    expect(selected).toEqual([]);
  });
});
