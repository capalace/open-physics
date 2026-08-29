import { describe, expect, it } from "vitest";
import { rectangularLoopPoint, resistorZigzagCount, wrappedPhase } from "./renderer";

describe("electromagnetism visual motion", () => {
  it("moves current markers around the complete circuit instead of one fixed edge", () => {
    const bounds = [10, 110, 20, 70] as const;

    const points = [0, 1 / 3, 1 / 2, 5 / 6].map((progress) => rectangularLoopPoint(progress, ...bounds));
    const expected = [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 70 }, { x: 10, y: 70 }];
    points.forEach((point, index) => {
      expect(point.x).toBeCloseTo(expected[index].x);
      expect(point.y).toBeCloseTo(expected[index].y);
    });
  });

  it("wraps visual phases deterministically in both directions", () => {
    expect(wrappedPhase(1.25)).toBeCloseTo(0.25);
    expect(wrappedPhase(-0.25)).toBeCloseTo(0.75);
  });

  it("keeps the resistor footprint fixed while adding more zigzags for higher resistance", () => {
    expect(resistorZigzagCount(2)).toBe(4);
    expect(resistorZigzagCount(10)).toBeGreaterThan(resistorZigzagCount(2));
    expect(resistorZigzagCount(20)).toBe(16);
  });
});
