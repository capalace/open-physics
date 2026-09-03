import { describe, expect, it } from "vitest";
import { electromagnetismDirectHandle, isElectromagnetismDirectManipulationMode, rectangularLoopPoint, resistorZigzagCount, wrappedPhase } from "./renderer";
import { ElectromagnetismModel } from "./models";

describe("electromagnetism visual motion", () => {
  it("identifies the guided labs whose apparatus is dragged directly", () => {
    expect(["charge", "potential", "electrostatic-induction", "circuits", "capacitors", "electronics", "magnetic-field", "magnetic-materials", "electromagnetic-force", "charged-particle", "induction", "electromagnet", "motor", "generator", "transformer"].every((mode) =>
      isElectromagnetismDirectManipulationMode(mode as Parameters<typeof isElectromagnetismDirectManipulationMode>[0]))).toBe(true);
  });

  it("uses the same visible handle position for force, motor and generator hit testing", () => {
    const force = new ElectromagnetismModel("electromagnetic-force").snapshot();
    const motor = new ElectromagnetismModel("motor").snapshot();
    const generator = new ElectromagnetismModel("generator").snapshot();

    expect(electromagnetismDirectHandle(force)?.x).toBeCloseTo(0.8);
    expect(electromagnetismDirectHandle(force)?.y).toBeCloseTo(0.3);
    expect(electromagnetismDirectHandle(motor)).toEqual({ x: 0.5, y: 0.17 });
    expect(electromagnetismDirectHandle(generator)).toEqual(generator.probe);
  });

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
